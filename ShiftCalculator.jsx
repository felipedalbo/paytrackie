// ===========================================
// Irish Shift Policy Calculator
// Compliance with Working Time Act 1997
// ===========================================

/**
 * Parse time string HH:MM to minutes since midnight
 * @param {string} timeStr - Time in HH:MM format (24h)
 * @returns {number} Minutes since midnight
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate if shift crosses midnight
 * @param {string} startTime - HH:MM
 * @param {string} endTime - HH:MM
 * @returns {boolean}
 */
export function calculateCrossesMidnight(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end <= start;
}

/**
 * Calculate total shift minutes
 * @param {string} startTime - HH:MM
 * @param {string} endTime - HH:MM
 * @param {boolean} crossesMidnight
 * @returns {number} Total minutes
 */
export function calculateTotalShiftMinutes(startTime, endTime, crossesMidnight) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  if (crossesMidnight) {
    // Minutes from start to midnight + minutes from midnight to end
    const minutesToMidnight = (24 * 60) - start;
    const minutesAfterMidnight = end;
    return minutesToMidnight + minutesAfterMidnight;
  } else {
    return end - start;
  }
}

/**
 * Calculate worked minutes (excluding unpaid lunch)
 * @param {number} totalShiftMinutes
 * @param {number} unpaidLunchMinutes
 * @param {number} paidBreakMinutes
 * @param {boolean} paidBreakDefault - If true, paid break is NOT deducted
 * @returns {number} Worked minutes
 */
export function calculateWorkedMinutes(totalShiftMinutes, unpaidLunchMinutes, paidBreakMinutes, paidBreakDefault) {
  let worked = totalShiftMinutes - unpaidLunchMinutes;
  
  // Paid break is ONLY deducted if paidBreakDefault is FALSE
  if (!paidBreakDefault) {
    worked -= paidBreakMinutes;
  }
  
  return Math.max(0, worked);
}

/**
 * Calculate night premium minutes
 * @param {string} startTime - Shift start HH:MM
 * @param {string} endTime - Shift end HH:MM
 * @param {boolean} crossesMidnight
 * @param {string} nightPremiumStartTime - When night premium starts (e.g., 22:00)
 * @param {number} totalShiftMinutes
 * @returns {number} Night premium minutes
 */
export function calculateNightMinutes(startTime, endTime, crossesMidnight, nightPremiumStartTime, totalShiftMinutes) {
  if (!nightPremiumStartTime) return 0;
  
  const shiftStart = timeToMinutes(startTime);
  const shiftEnd = timeToMinutes(endTime);
  const nightStart = timeToMinutes(nightPremiumStartTime);
  
  let nightMinutes = 0;
  
  if (crossesMidnight) {
    // Shift crosses midnight
    // Check if night premium starts before midnight
    if (shiftStart < nightStart) {
      // Part 1: From nightStart to midnight
      nightMinutes += (24 * 60) - nightStart;
    } else {
      // Night premium started before shift (e.g., shift at 23:00, premium at 22:00)
      nightMinutes += (24 * 60) - shiftStart;
    }
    
    // Part 2: All minutes after midnight until shift end
    nightMinutes += shiftEnd;
  } else {
    // Shift doesn't cross midnight
    if (shiftEnd > nightStart && shiftStart < (24 * 60)) {
      // Calculate overlap with night period
      const nightStartInShift = Math.max(shiftStart, nightStart);
      const nightEndInShift = Math.min(shiftEnd, 24 * 60);
      nightMinutes = Math.max(0, nightEndInShift - nightStartInShift);
    }
  }
  
  // Night minutes cannot exceed total shift minutes
  return Math.min(nightMinutes, totalShiftMinutes);
}

/**
 * Calculate shift-based pay
 * @param {object} shiftPolicy - Shift policy object
 * @param {number} baseHourlyRate - Employee's base hourly rate
 * @param {number} daysWorked - Number of days worked in period
 * @returns {object} Calculation breakdown
 */
export function calculateShiftPay(shiftPolicy, baseHourlyRate, daysWorked = 1) {
  // 1. Calculate if shift crosses midnight
  const crossesMidnight = shiftPolicy.crosses_midnight || 
    calculateCrossesMidnight(shiftPolicy.start_time, shiftPolicy.end_time);
  
  // 2. Calculate total shift minutes
  const totalShiftMinutes = calculateTotalShiftMinutes(
    shiftPolicy.start_time,
    shiftPolicy.end_time,
    crossesMidnight
  );
  
  // 3. Calculate worked minutes (excluding unpaid lunch)
  const workedMinutes = calculateWorkedMinutes(
    totalShiftMinutes,
    shiftPolicy.unpaid_lunch_minutes || 0,
    shiftPolicy.paid_break_minutes || 0,
    shiftPolicy.paid_break_default !== false
  );
  
  // 4. Calculate night premium minutes
  const nightMinutes = calculateNightMinutes(
    shiftPolicy.start_time,
    shiftPolicy.end_time,
    crossesMidnight,
    shiftPolicy.night_premium_start_time,
    totalShiftMinutes
  );
  
  // 5. Calculate normal minutes (non-night)
  const normalMinutes = Math.max(0, workedMinutes - nightMinutes);
  
  // 6. Calculate pay
  const normalHours = normalMinutes / 60;
  const nightHours = nightMinutes / 60;
  
  const normalPay = normalHours * baseHourlyRate * daysWorked;
  const nightPremiumPay = nightHours * baseHourlyRate * (shiftPolicy.night_premium_rate || 1.0) * daysWorked;
  const totalPay = normalPay + nightPremiumPay;
  
  return {
    crossesMidnight,
    totalShiftMinutes,
    workedMinutes,
    paidBreakMinutes: shiftPolicy.paid_break_default !== false ? shiftPolicy.paid_break_minutes : 0,
    unpaidLunchMinutes: shiftPolicy.unpaid_lunch_minutes || 0,
    normalMinutes,
    nightMinutes,
    normalHours,
    nightHours,
    normalPay,
    nightPremiumPay,
    totalPay,
    calculation_timestamp: new Date().toISOString(),
    shift_policy_applied: {
      shift_id: shiftPolicy.id,
      shift_name: shiftPolicy.shift_name,
      start_time: shiftPolicy.start_time,
      end_time: shiftPolicy.end_time,
      night_premium_rate: shiftPolicy.night_premium_rate,
      night_premium_start_time: shiftPolicy.night_premium_start_time,
    }
  };
}

/**
 * Format minutes to hours display
 * @param {number} minutes
 * @returns {string}
 */
export function formatMinutesToHours(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

export default {
  calculateCrossesMidnight,
  calculateTotalShiftMinutes,
  calculateWorkedMinutes,
  calculateNightMinutes,
  calculateShiftPay,
  formatMinutesToHours,
};