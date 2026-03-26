import { base44 } from '@/api/base44Client';

/**
 * Get applicable overtime policy for an employee
 * Returns the active policy that applies to the employee
 */
export async function getApplicableOvertimePolicy(employeeId) {
  const activePolicies = await base44.entities.OvertimePolicy.filter({ is_active: true });
  
  if (!activePolicies || activePolicies.length === 0) {
    // Return default multipliers if no policy exists
    return {
      weekday_multiplier: 1.5,
      saturday_multiplier: 1.5,
      sunday_multiplier: 2.0,
      bank_holiday_multiplier: 2.0,
    };
  }

  // Check for specific employee policy first
  const specificPolicy = activePolicies.find(p => 
    p.applies_to === 'SPECIFIC_EMPLOYEES' && 
    p.employee_ids?.includes(employeeId)
  );

  if (specificPolicy) {
    return specificPolicy;
  }

  // Otherwise, return ALL_EMPLOYEES policy
  const generalPolicy = activePolicies.find(p => p.applies_to === 'ALL_EMPLOYEES');
  
  if (generalPolicy) {
    return generalPolicy;
  }

  // Fallback to defaults
  return {
    weekday_multiplier: 1.5,
    saturday_multiplier: 1.5,
    sunday_multiplier: 2.0,
    bank_holiday_multiplier: 2.0,
  };
}

export default {
  getApplicableOvertimePolicy,
};