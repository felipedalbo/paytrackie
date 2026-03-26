import { base44 } from '@/api/base44Client';
import { generateBankHolidays } from '@/components/payroll/IrishTaxCalculator';

/**
 * Automatically generate bank holiday entitlements based on company policy
 * This should be run:
 * 1. When a new year starts
 * 2. When a new employee is created
 * 3. When company policy changes
 */
export async function generateBankHolidayEntitlements(employeeId, year, companyPolicy) {
  if (!companyPolicy || companyPolicy.policy_type !== 'ASSUME_WORKED') {
    return { success: false, message: 'Company policy is not ASSUME_WORKED' };
  }

  // Get official Irish bank holidays for the year
  const officialHolidays = generateBankHolidays(year);
  console.log(`[BH Gen] Year ${year}: ${officialHolidays.length} official holidays`, officialHolidays.map(h => h.date));
  
  // Fetch existing entitlements to avoid duplicates
  const existingEntitlements = await base44.entities.BankHolidayEntitlement.filter({
    employee_id: employeeId,
    year: year,
  });
  console.log(`[BH Gen] Employee ${employeeId}, Year ${year}: ${existingEntitlements.length} existing entitlements`, existingEntitlements.map(e => e.bank_holiday_date));

  const existingDates = new Set(existingEntitlements.map(e => e.bank_holiday_date));

  // Fetch employee-specific overrides
  const overrides = await base44.entities.EmployeeBankHolidayOverride.filter({
    employee_id: employeeId,
    year: year,
  });
  console.log(`[BH Gen] Employee ${employeeId}, Year ${year}: ${overrides.length} overrides`);

  const overridesMap = {};
  overrides.forEach(override => {
    overridesMap[override.bank_holiday_date] = override;
  });

  // Create entitlements
  const entitlementsToCreate = [];
  
  for (const holiday of officialHolidays) {
    console.log(`[BH Gen] Checking holiday ${holiday.date} (${holiday.name}): exists=${existingDates.has(holiday.date)}`);
    
    // Skip if already exists
    if (existingDates.has(holiday.date)) {
      console.log(`[BH Gen] Skipping ${holiday.date} - already exists`);
      continue;
    }

    // Check for employee override
    const override = overridesMap[holiday.date];
    
    // If override says NOT_WORKED, skip entitlement
    if (override?.status === 'NOT_WORKED') {
      console.log(`[BH Gen] Skipping ${holiday.date} - override says NOT_WORKED`);
      continue;
    }

    // Grant entitlement
    const hoursGranted = override?.hours_worked || companyPolicy.default_daily_hours;
    
    entitlementsToCreate.push({
      employee_id: employeeId,
      bank_holiday_date: holiday.date,
      bank_holiday_name: holiday.name,
      year: year,
      hours_granted: hoursGranted,
      grant_reason: override?.status === 'WORKED' ? 'ACTUALLY_WORKED' : 'ASSUME_WORKED',
      is_consumed: false,
      consumed_hours: 0,
      remaining_hours: hoursGranted,
    });
    console.log(`[BH Gen] Will create entitlement for ${holiday.date} (${holiday.name}): ${hoursGranted}h`);
  }

  console.log(`[BH Gen] Creating ${entitlementsToCreate.length} new entitlements`);

  if (entitlementsToCreate.length > 0) {
    await base44.entities.BankHolidayEntitlement.bulkCreate(entitlementsToCreate);
  }

  return {
    success: true,
    created: entitlementsToCreate.length,
    message: `Created ${entitlementsToCreate.length} bank holiday entitlements`,
    existing: existingEntitlements.length,
  };
}

/**
 * Consume bank holiday entitlement when leave is taken
 * Creates one consumption record per day of leave
 */
export async function consumeBankHolidayEntitlement(employeeId, leaveRecordId, startDate, endDate, hoursPerDay) {
  // Calculate working days between start and end date
  const start = new Date(startDate);
  const end = new Date(endDate);
  const workingDays = [];
  
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      workingDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  // Get available entitlements (sorted by date, oldest first)
  const entitlements = await base44.entities.BankHolidayEntitlement.filter({
    employee_id: employeeId,
  });

  const availableEntitlements = entitlements.filter(e => {
    const remaining = (e.hours_granted || 0) - (e.consumed_hours || 0);
    return remaining > 0;
  }).sort((a, b) => new Date(a.bank_holiday_date) - new Date(b.bank_holiday_date));

  const consumptionRecords = [];
  let totalToConsume = workingDays.length * hoursPerDay;
  let remainingToConsume = totalToConsume;

  // Check if we have enough balance
  const totalAvailable = availableEntitlements.reduce((sum, e) => {
    const available = (e.hours_granted || 0) - (e.consumed_hours || 0);
    return sum + available;
  }, 0);

  if (totalToConsume > totalAvailable) {
    return {
      success: false,
      message: `Insufficient bank holiday entitlement. Available: ${totalAvailable.toFixed(1)}h, Requested: ${totalToConsume.toFixed(1)}h`,
      consumptionRecords: [],
    };
  }

  // Create one consumption record per working day
  for (const day of workingDays) {
    if (remainingToConsume <= 0) break;

    const dateStr = day.toISOString().split('T')[0];
    let dayHoursToConsume = Math.min(hoursPerDay, remainingToConsume);

    // Consume from oldest entitlements first (FIFO)
    for (const entitlement of availableEntitlements) {
      if (dayHoursToConsume <= 0) break;

      const available = (entitlement.hours_granted || 0) - (entitlement.consumed_hours || 0);
      const toConsume = Math.min(available, dayHoursToConsume);

      if (toConsume > 0) {
        // Create consumption record for this specific day
        const consumption = await base44.entities.BankHolidayConsumption.create({
          employee_id: employeeId,
          entitlement_id: entitlement.id,
          leave_record_id: leaveRecordId,
          consumption_date: dateStr,
          hours_consumed: toConsume,
          consumption_reason: 'LEAVE_REQUEST',
        });

        consumptionRecords.push(consumption);

        // Update entitlement
        const newConsumed = (entitlement.consumed_hours || 0) + toConsume;
        await base44.entities.BankHolidayEntitlement.update(entitlement.id, {
          consumed_hours: newConsumed,
          remaining_hours: entitlement.hours_granted - newConsumed,
          is_consumed: newConsumed >= entitlement.hours_granted,
        });

        dayHoursToConsume -= toConsume;
        remainingToConsume -= toConsume;
      }
    }
  }

  return {
    success: true,
    consumed: totalToConsume,
    consumptionRecords,
  };
}

/**
 * Calculate available bank holiday balance
 */
export async function getBankHolidayBalance(employeeId, year = null) {
  const query = { employee_id: employeeId };
  if (year) {
    query.year = year;
  }

  const entitlements = await base44.entities.BankHolidayEntitlement.filter(query);
  
  const totalGranted = entitlements.reduce((sum, e) => sum + (e.hours_granted || 0), 0);
  const totalConsumed = entitlements.reduce((sum, e) => sum + (e.consumed_hours || 0), 0);
  const totalRemaining = totalGranted - totalConsumed;

  return {
    granted: totalGranted,
    consumed: totalConsumed,
    remaining: totalRemaining,
    entitlements: entitlements.length,
  };
}

export default {
  generateBankHolidayEntitlements,
  consumeBankHolidayEntitlement,
  getBankHolidayBalance,
};