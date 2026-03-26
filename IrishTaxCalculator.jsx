// Irish Tax Calculator 2026 - Based on Revenue Ireland Official Rates
// Sources: revenue.ie, citizensinformation.ie

import { getPRSIRule } from './PRSIRules';

// 2026 Tax Rates (projected based on 2024/2025 trends)
export const TAX_RATES_2026 = {
  // PAYE Income Tax
  PAYE: {
    STANDARD_RATE: 0.20, // 20%
    HIGHER_RATE: 0.40, // 40%
  },
  
  // USC Rates 2026 - Budget 2026 Updated Rates
  USC: {
    BAND_1: { threshold: 1001, rate: 0.005 }, // 0.5% up to €1,001
    BAND_2: { threshold: 2391.66, rate: 0.02 },  // 2% €1,002 to €2,391.66
    BAND_3: { threshold: 5837, rate: 0.03 },  // 3% €2,391.67 to €5,837
    BAND_4: { threshold: Infinity, rate: 0.08 }, // 8% above €70,044
    // Medical Card holders
    MEDICAL_CARD: {
      BAND_1: { threshold: 1001, rate: 0.005 },
      BAND_2: { threshold: Infinity, rate: 0.02 },
    },
    // Reduced USC for income under €13,000
    EXEMPTION_THRESHOLD: 13000,
  },
  
  // PRSI Rates 2026 - Class A (most employees) - Budget 2026 Updated
  PRSI: {
    CLASS_A: {
      RATE: 0.042, // 4.2%
      WEEKLY_THRESHOLD: 352, // No PRSI if weekly income below €352
      ANNUAL_THRESHOLD: 18304, // €352 * 52
      TAPERED_CREDIT: {
        MAX_CREDIT: 12, // Weekly
        THRESHOLD: 424, // Weekly
      }
    }
  },
  
  // Statutory Sick Pay 2026
  SICK_PAY: {
    MAX_DAILY: 110,
    COMPANY_RATE: 0.70, // 70% of daily pay
    MAX_DAYS_PER_YEAR: 5, // Statutory entitlement 2026
  },
  
  // Leave Entitlements
  LEAVE: {
    ANNUAL_DAYS: 25,
    BANK_HOLIDAY_DAYS: 10, // Ireland 2026
    HOURS_PER_DAY: 7.5,
  },
  
  // Overtime Rates
  OVERTIME: {
    WEEKDAY_SATURDAY: 1.5, // Time and a half
    SUNDAY_BANK_HOLIDAY: 2.0, // Double time
  },
  
  // Bonus
  BONUS: {
    ANNUAL_PERCENTAGE: 0.10, // 10% of annual salary
    PAYMENT_MONTHS: [1, 4, 7, 10], // January, April, July, October
  },
  
  // Minimum Wage 2026 (projected)
  MINIMUM_WAGE: 15.93,
};

// 1️⃣ Calculate Easter Sunday (Computus algorithm)
function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = Math.floor((a + 11*h + 22*l) / 451);
  const month = Math.floor((h + l - 7*m + 114) / 31);
  const day = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(year, month - 1, day); // month zero-indexed
}

// 2️⃣ Get first Monday of a month
function getFirstMonday(year, month) {
  const d = new Date(year, month - 1, 1);
  const offset = (1 - d.getDay() + 7) % 7; // Monday = 1
  return new Date(year, month - 1, 1 + offset);
}

// Get last Monday of a month
function getLastMonday(year, month) {
  const d = new Date(year, month, 0); // last day of month
  const offset = (d.getDay() === 0 ? 6 : d.getDay() - 1);
  return new Date(year, month - 1, d.getDate() - offset);
}

// 3️⃣ Format date to YYYY-MM-DD string
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 4️⃣ Generate Irish Bank Holidays per Organisation of Working Time Act 1997
// SOURCE: Organisation of Working Time Act 1997, Citizens Information Ireland
// CRITICAL: These dates are CALCULATED, never stored
export function generateBankHolidays(year) {
  const holidays = [];

  // Fixed-date holidays
  holidays.push({ 
    date: formatDateISO(new Date(year, 0, 1)), 
    name: "New Year's Day",
    type: "fixed"
  });
  
  holidays.push({ 
    date: formatDateISO(new Date(year, 2, 17)), 
    name: "St. Patrick's Day",
    type: "fixed"
  });
  
  holidays.push({ 
    date: formatDateISO(new Date(year, 11, 25)), 
    name: "Christmas Day",
    type: "fixed"
  });
  
  holidays.push({ 
    date: formatDateISO(new Date(year, 11, 26)), 
    name: "St. Stephen's Day",
    type: "fixed"
  });

  // St Brigid's Day
  holidays.push({ 
    date: formatDateISO(new Date(year, 1, 1)), 
    name: "St. Brigid's Day",
    type: "fixed"
  });

  // Easter Monday
  const easterSunday = calculateEaster(year);
  const easterMonday = new Date(easterSunday);
  easterMonday.setDate(easterSunday.getDate() + 1);
  holidays.push({ 
    date: formatDateISO(easterMonday), 
    name: "Easter Monday",
    type: "rule-based"
  });

  // Other Bank Holidays
  holidays.push({ 
    date: formatDateISO(getFirstMonday(year, 5)), 
    name: "May Bank Holiday",
    type: "rule-based"
  });
  
  holidays.push({ 
    date: formatDateISO(getFirstMonday(year, 6)), 
    name: "June Bank Holiday",
    type: "rule-based"
  });
  
  holidays.push({ 
    date: formatDateISO(getFirstMonday(year, 8)), 
    name: "August Bank Holiday",
    type: "rule-based"
  });
  
  holidays.push({ 
    date: formatDateISO(getLastMonday(year, 10)), 
    name: "October Bank Holiday",
    type: "rule-based"
  });

  return holidays;
}

// Irish Bank Holidays 2026 (for reference)
export const BANK_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day", dayOfWeek: 'Thursday' },
  { date: '2026-02-02', name: "St. Brigid's Day", dayOfWeek: 'Monday' },
  { date: '2026-03-17', name: "St. Patrick's Day", dayOfWeek: 'Tuesday' },
  { date: '2026-04-06', name: "Easter Monday", dayOfWeek: 'Monday' },
  { date: '2026-05-04', name: "May Bank Holiday", dayOfWeek: 'Monday' },
  { date: '2026-06-01', name: "June Bank Holiday", dayOfWeek: 'Monday' },
  { date: '2026-08-03', name: "August Bank Holiday", dayOfWeek: 'Monday' },
  { date: '2026-10-26', name: "October Bank Holiday", dayOfWeek: 'Monday' },
  { date: '2026-12-25', name: "Christmas Day", dayOfWeek: 'Friday' },
  { date: '2026-12-28', name: "St. Stephen's Day", dayOfWeek: 'Monday' },
];

// All bank holidays cache (2021-2030)
let ALL_BANK_HOLIDAYS_CACHE = null;

export function getAllBankHolidays() {
  if (!ALL_BANK_HOLIDAYS_CACHE) {
    ALL_BANK_HOLIDAYS_CACHE = [];
    for (let year = 2021; year <= 2030; year++) {
      ALL_BANK_HOLIDAYS_CACHE.push(...generateBankHolidays(year));
    }
  }
  return ALL_BANK_HOLIDAYS_CACHE;
}

// Get bank holiday dates only
export function getBankHolidayDates(year = 2026) {
  if (year) {
    return generateBankHolidays(year).map(h => h.date);
  }
  return BANK_HOLIDAYS_2026.map(h => h.date);
}

// Calculate cut-off date (last Friday of the month)
export function getCutOffDate(year, month) {
  const lastDay = new Date(year, month, 0);
  const dayOfWeek = lastDay.getDay();
  const daysToSubtract = (dayOfWeek + 2) % 7;
  const cutOff = new Date(lastDay);
  cutOff.setDate(lastDay.getDate() - daysToSubtract);
  return cutOff;
}

// Calculate payment date (first Friday of the next month)
export function getPaymentDate(year, month) {
  const firstOfNextMonth = new Date(year, month, 1);
  const dayOfWeek = firstOfNextMonth.getDay();
  const daysToAdd = dayOfWeek <= 5 ? (5 - dayOfWeek) : (12 - dayOfWeek);
  const paymentDate = new Date(firstOfNextMonth);
  paymentDate.setDate(1 + daysToAdd);
  return paymentDate;
}

// Calculate base hours for a month
export function calculateBaseHours(year, month, weeklyHours = 37.5) {
  const startDate = getCutOffDate(year, month - 1);
  startDate.setDate(startDate.getDate() + 1);
  const endDate = getCutOffDate(year, month);
  
  let workDays = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  const weeksInPeriod = workDays / 5;
  return weeksInPeriod * weeklyHours;
}

// Determine payroll period for a given date
export function getPayrollPeriod(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  
  const cutOff = getCutOffDate(year, month);
  
  if (d > cutOff) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return { year: nextYear, month: nextMonth };
  }
  
  return { year, month };
}

// Calculate PAYE - Payment Date Based
export function calculatePAYE(grossPay, annualTaxCredits, standardRateCutOff, taxBasis, ytdGross = 0, ytdPAYE = 0, paymentDate = null) {
  const rates = TAX_RATES_2026.PAYE;
  
  // Determine tax period from payment date
  const paymentMonth = paymentDate ? new Date(paymentDate).getMonth() + 1 : 1;
  
  if (taxBasis === 'emergency') {
    // Emergency tax: no credits, all at higher rate after €700/week
    const weeklyEquivalent = grossPay / 4.33;
    const monthlyThreshold = 700 * 4.33;
    const standardTax = Math.min(grossPay, monthlyThreshold) * rates.STANDARD_RATE;
    const higherTax = Math.max(0, grossPay - monthlyThreshold) * rates.HIGHER_RATE;
    return standardTax + higherTax;
  }
  
  if (taxBasis === 'week1') {
    // Week 1/Month 1: Non-cumulative, use 1/12 of annual credits
    const monthlyCredits = annualTaxCredits / 12;
    const monthlyCutOff = standardRateCutOff / 12;
    
    const standardTax = Math.min(grossPay, monthlyCutOff) * rates.STANDARD_RATE;
    const higherTax = Math.max(0, grossPay - monthlyCutOff) * rates.HIGHER_RATE;
    const grossTax = standardTax + higherTax;
    
    return Math.max(0, grossTax - monthlyCredits);
  }
  
  // Cumulative basis - based on payment date tax year
  const cumulativeGross = ytdGross + grossPay;
  const cumulativeCutOff = (standardRateCutOff / 12) * paymentMonth;
  const cumulativeCredits = (annualTaxCredits / 12) * paymentMonth;
  
  const standardTax = Math.min(cumulativeGross, cumulativeCutOff) * rates.STANDARD_RATE;
  const higherTax = Math.max(0, cumulativeGross - cumulativeCutOff) * rates.HIGHER_RATE;
  const cumulativeGrossTax = standardTax + higherTax;
  
  const cumulativeNetTax = Math.max(0, cumulativeGrossTax - cumulativeCredits);
  const monthlyPAYE = cumulativeNetTax - ytdPAYE;
  
  return Math.max(0, monthlyPAYE);
}

// Calculate USC - Monthly basis (NOT cumulative)
// USC in Ireland is calculated MONTHLY on gross income for that month only
export function calculateUSC(grossPay, hasMedicalCard, ytdGross = 0, ytdUSC = 0, paymentDate = null, employeeUSCRates = null) {
  const paymentMonth = paymentDate ? new Date(paymentDate).getMonth() + 1 : 1;
  
  // Check exemption based on projected annual income
  const cumulativeGross = ytdGross + grossPay;
  const projectedAnnual = (cumulativeGross / paymentMonth) * 12;
  if (projectedAnnual < TAX_RATES_2026.USC.EXEMPTION_THRESHOLD) {
    return 0;
  }
  
  // Use employee custom rates if available, otherwise use default
  const rates = employeeUSCRates || {
    band_1_rate: TAX_RATES_2026.USC.BAND_1.rate,
    band_2_rate: TAX_RATES_2026.USC.BAND_2.rate,
    band_3_rate: TAX_RATES_2026.USC.BAND_3.rate,
    band_4_rate: TAX_RATES_2026.USC.BAND_4.rate,
    band_1_threshold: 1001,
    band_2_threshold: 2391.66,
    band_3_threshold: 5837,
  };
  
  // CRITICAL: Admin Panel stores MONTHLY thresholds (not annual)
  // Use thresholds directly without dividing by 12
  const monthlyBand1 = rates.band_1_threshold;
  const monthlyBand2 = rates.band_2_threshold;
  const monthlyBand3 = rates.band_3_threshold;
  
  let uscAmount = 0;
  let remaining = grossPay; // Apply to THIS MONTH's gross pay only
  
  if (hasMedicalCard) {
    // Medical card: only 2 bands
    const band1 = Math.min(remaining, monthlyBand1);
    uscAmount += band1 * rates.band_1_rate;
    remaining -= band1;
    
    if (remaining > 0) {
      uscAmount += remaining * rates.band_2_rate;
    }
  } else {
    // Band 1: Up to €1,001/month (€12,012/year)
    if (remaining > 0) {
      const band1 = Math.min(remaining, monthlyBand1);
      uscAmount += band1 * rates.band_1_rate;
      remaining -= band1;
    }
    
    // Band 2: €1,001 - €2,391.67/month (€12,013 - €28,700/year)
    if (remaining > 0) {
      const band2 = Math.min(remaining, monthlyBand2 - monthlyBand1);
      uscAmount += band2 * rates.band_2_rate;
      remaining -= band2;
    }
    
    // Band 3: €2,391.67 - €5,837/month (€28,701 - €70,044/year)
    if (remaining > 0) {
      const band3 = Math.min(remaining, monthlyBand3 - monthlyBand2);
      uscAmount += band3 * rates.band_3_rate;
      remaining -= band3;
    }
    
    // Band 4: Above €5,837/month (above €70,044/year)
    if (remaining > 0) {
      uscAmount += remaining * rates.band_4_rate;
    }
  }
  
  return Math.max(0, uscAmount);
}

// Calculate PRSI using class/subclass rules
export function calculatePRSI(grossPay, prsiClass = 'A', prsiSubclass = 'A1', paymentDate = null, customPrsiRate = null) {
  const taxYear = paymentDate ? new Date(paymentDate).getFullYear() : 2026;
  const rule = getPRSIRule(prsiClass, prsiSubclass, taxYear);

  if (!rule) {
    console.error(`PRSI rule not found for ${prsiClass}/${prsiSubclass}`);
    return 0;
  }

  const weeklyGross = grossPay / 4.33;

  // No PRSI if below threshold
  if (weeklyGross < rule.weekly_threshold) {
    return 0;
  }

  // Use custom PRSI rate if provided, otherwise use rule's rate
  const employeeRate = customPrsiRate !== null && customPrsiRate !== undefined ? customPrsiRate : rule.employee_rate;

  // Calculate PRSI using employee rate
  let weeklyPRSI = weeklyGross * employeeRate;

  // Apply tapered credit if applicable
  if (rule.has_tapered_credit && weeklyGross <= 424) {
    const credit = 12 - ((weeklyGross - rule.weekly_threshold) / 6);
    weeklyPRSI = Math.max(0, weeklyPRSI - Math.max(0, credit));
  }

  return weeklyPRSI * 4.33;
}

// Calculate Sick Pay
export function calculateSickPay(days, hourlyRate, hoursPerDay) {
  const dailyPay = hourlyRate * hoursPerDay;
  const companyRate = dailyPay * TAX_RATES_2026.SICK_PAY.COMPANY_RATE;
  const sickPayDaily = Math.min(companyRate, TAX_RATES_2026.SICK_PAY.MAX_DAILY);
  
  return days * sickPayDaily;
}

// Calculate Overtime Pay
// IMPORTANT: multiplier should come from OvertimePolicy, not hardcoded
export function calculateOvertimePay(hours, hourlyRate, dayType, multiplier = null) {
  // If multiplier is provided, use it directly
  if (multiplier !== null) {
    return hours * hourlyRate * multiplier;
  }
  
  // Fallback to default rates if no multiplier provided
  let defaultMultiplier = TAX_RATES_2026.OVERTIME.WEEKDAY_SATURDAY;
  
  if (dayType === 'sunday' || dayType === 'bank_holiday') {
    defaultMultiplier = TAX_RATES_2026.OVERTIME.SUNDAY_BANK_HOLIDAY;
  }
  
  return hours * hourlyRate * defaultMultiplier;
}

// Calculate Quarterly Bonus
export function calculateQuarterlyBonus(hourlyRate, weeklyHours) {
  const annualSalary = weeklyHours * 52 * hourlyRate;
  const annualBonus = annualSalary * TAX_RATES_2026.BONUS.ANNUAL_PERCENTAGE;
  return annualBonus / 4;
}

// Check if month is a bonus month
export function isBonusMonth(month) {
  return TAX_RATES_2026.BONUS.PAYMENT_MONTHS.includes(month);
}

// 5️⃣ Check if date is a bank holiday
export function isBankHoliday(date) {
  let dateStr;
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    dateStr = date;
  } else {
    dateStr = formatDateISO(new Date(date));
  }
  // Check against all years (2021-2030)
  return getAllBankHolidays().some(h => h.date === dateStr);
}

// Get bank holiday name
export function getBankHolidayName(date) {
  let dateStr;
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Already in YYYY-MM-DD format
    dateStr = date;
  } else {
    // Convert to YYYY-MM-DD format
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }
  const holiday = getAllBankHolidays().find(h => h.date === dateStr);
  return holiday ? holiday.name : null;
}

// Format currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount || 0);
}

// Calculate working days between dates (excluding weekends)
export function calculateWorkingDays(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// Full payroll calculation - Payment Date Based
export function calculateFullPayroll(params) {
  const {
    baseHours,
    hourlyRate,
    weekendHours = 0,
    weekendPayAmount = 0,
    overtimeHours = 0,
    overtimePayAmount = 0,
    sickLeaveHours = 0,
    sickPayAmount = 0,
    ptoHours = 0,
    bankHolidayHours = 0,
    bankHolidayWorkedPay = 0,
    quarterlyBonus = 0,
    healthInsurance = 0,
    otherEarnings = 0,
    unpaidLeaveHours = 0,
    annualTaxCredits,
    standardRateCutOff,
    taxBasis,
    hasMedicalCard,
    prsiClass,
    ytdGross = 0,
    ytdPAYE = 0,
    ytdUSC = 0,
    ytdPRSI = 0,
    paymentDate = null,
  } = params;
  
  // CRITICAL: Base Pay = Paid Hours × Rate
  // baseHours already has unpaid hours deducted (Paid Hours)
  const basePay = baseHours * hourlyRate;
  const weekendPay = weekendPayAmount; // Use pre-calculated pay from Weekend Roster
  const ptoPay = ptoHours * hourlyRate;
  const bankHolidayPay = bankHolidayHours * hourlyRate;
  
  // Unpaid deduction is now ZERO because it's already reflected in baseHours
  // We keep this field for display purposes only
  const unpaidDeduction = 0;
  
  // Gross Pay
  const grossPay = 
    basePay + 
    weekendPay + 
    overtimePayAmount + 
    sickPayAmount + 
    ptoPay + 
    bankHolidayPay + 
    bankHolidayWorkedPay +
    quarterlyBonus + 
    healthInsurance + 
    otherEarnings - 
    unpaidDeduction;
  
  // Prepare employee custom USC rates
  const employeeUSCRates = (params.usc_band_1_rate || params.usc_band_1_threshold) ? {
    band_1_rate: params.usc_band_1_rate || TAX_RATES_2026.USC.BAND_1.rate,
    band_2_rate: params.usc_band_2_rate || TAX_RATES_2026.USC.BAND_2.rate,
    band_3_rate: params.usc_band_3_rate || TAX_RATES_2026.USC.BAND_3.rate,
    band_4_rate: params.usc_band_4_rate || TAX_RATES_2026.USC.BAND_4.rate,
    band_1_threshold: params.usc_band_1_threshold || TAX_RATES_2026.USC.BAND_1.threshold,
    band_2_threshold: params.usc_band_2_threshold || TAX_RATES_2026.USC.BAND_2.threshold,
    band_3_threshold: params.usc_band_3_threshold || TAX_RATES_2026.USC.BAND_3.threshold,
  } : null;

  // Deductions - All based on Payment Date with employee custom rates
  const paye = calculatePAYE(grossPay, annualTaxCredits, standardRateCutOff, taxBasis, ytdGross, ytdPAYE, paymentDate);
  const usc = calculateUSC(grossPay, hasMedicalCard, ytdGross, ytdUSC, paymentDate, employeeUSCRates);
  const prsi = calculatePRSI(grossPay, params.prsiClass || prsiClass, params.prsiSubclass || 'A1', paymentDate, params.prsiRate);
  
  const totalDeductions = paye + usc + prsi;
  // Net Pay = Gross Pay - Tax Deductions - Health Insurance (paid by employer)
  // Health Insurance is included in Gross for tax calculation but not paid to employee
  const netPay = grossPay - totalDeductions - healthInsurance;
  
  return {
    basePay,
    weekendPay,
    overtimePay: overtimePayAmount,
    sickPay: sickPayAmount,
    ptoPay,
    bankHolidayPay,
    quarterlyBonus,
    healthInsurance,
    otherEarnings,
    unpaidDeduction,
    grossPay,
    paye,
    usc,
    prsi,
    totalDeductions,
    netPay,
    ytd: {
      gross: ytdGross + grossPay,
      paye: ytdPAYE + paye,
      usc: ytdUSC + usc,
      prsi: ytdPRSI + prsi,
      net: (ytdGross + grossPay) - (ytdPAYE + paye + ytdUSC + usc + ytdPRSI + prsi),
    }
  };
}

export default {
  TAX_RATES_2026,
  BANK_HOLIDAYS_2026,
  getCutOffDate,
  getPaymentDate,
  calculateBaseHours,
  getPayrollPeriod,
  calculatePAYE,
  calculateUSC,
  calculatePRSI,
  calculateSickPay,
  calculateOvertimePay,
  calculateQuarterlyBonus,
  isBonusMonth,
  isBankHoliday,
  formatCurrency,
  calculateWorkingDays,
  calculateFullPayroll,
};