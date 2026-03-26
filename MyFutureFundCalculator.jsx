// My Future Fund (Auto-Enrolment Pension) Calculator
// Irish Legislation - Effective 1 January 2026
// Sources: gov.ie, Department of Social Protection

// LEGAL CONTEXT:
// - My Future Fund = Auto-Enrolment Pension
// - Mandatory from 01 January 2026
// - Does NOT replace PRSA
// - NO tax relief (post-tax deduction)
// - All logic based on Payment Date (NOT worked period)

// CONTRIBUTION RATES (PHASED)
export const PENSION_RATES = {
  "2026-2028": { employee: 0.015, employer: 0.015, state: 0.005 },
  "2029-2031": { employee: 0.03, employer: 0.03, state: 0.01 },
  "2032-2034": { employee: 0.045, employer: 0.045, state: 0.015 },
  "2035+": { employee: 0.06, employer: 0.06, state: 0.02 },
};

// ELIGIBILITY THRESHOLDS
export const ELIGIBILITY_RULES = {
  MIN_AGE: 23,
  MAX_AGE: 60,
  MIN_ANNUAL_EARNINGS: 20000,
  EARNINGS_CAP: 80000, // Contributions only up to €80k
  OPT_OUT_LOCK_MONTHS: 6, // Cannot opt out for first 6 months
  RE_ENROLMENT_YEARS: 3, // Auto re-enrol after 3 years
  EFFECTIVE_DATE: "2026-01-01", // Mandatory start date
};

// Get contribution phase based on payment date
export function getContributionPhase(paymentDate) {
  const date = new Date(paymentDate);
  const year = date.getFullYear();
  
  if (year >= 2026 && year <= 2028) return "2026-2028";
  if (year >= 2029 && year <= 2031) return "2029-2031";
  if (year >= 2032 && year <= 2034) return "2032-2034";
  return "2035+";
}

// Get contribution rates for a payment date
export function getContributionRates(paymentDate) {
  const phase = getContributionPhase(paymentDate);
  return PENSION_RATES[phase];
}

// Calculate age at payment date
export function calculateAge(dateOfBirth, paymentDate) {
  const dob = new Date(dateOfBirth);
  const payment = new Date(paymentDate);
  let age = payment.getFullYear() - dob.getFullYear();
  const monthDiff = payment.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && payment.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Calculate annualised earnings based on gross pay and payroll frequency
export function calculateAnnualisedEarnings(grossPay, payrollFrequency = 'monthly') {
  const multipliers = {
    'weekly': 52,
    'fortnightly': 26,
    '4-weekly': 13,
    'monthly': 12,
  };
  
  const multiplier = multipliers[payrollFrequency];
  if (!multiplier) {
    throw new Error(`Unknown payroll frequency: ${payrollFrequency}`);
  }
  
  return grossPay * multiplier;
}

// Check eligibility for My Future Fund
export function checkEligibility(employee, pensionRecord, grossPay, paymentDate, payrollFrequency = 'monthly') {
  const reasons = [];
  
  // RULE 1: Payment date must be >= 2026-01-01
  const effectiveDate = new Date(ELIGIBILITY_RULES.EFFECTIVE_DATE);
  const payment = new Date(paymentDate);
  if (payment < effectiveDate) {
    reasons.push("My Future Fund not yet mandatory (effective 01-01-2026)");
    return { eligible: false, reasons };
  }
  
  // RULE 2: Age between 23 and 60 (at payment date)
  if (!employee.date_of_birth) {
    reasons.push("Date of birth not provided");
    return { eligible: false, reasons };
  }
  
  const age = calculateAge(employee.date_of_birth, paymentDate);
  if (age < ELIGIBILITY_RULES.MIN_AGE) {
    reasons.push(`Age ${age} < minimum ${ELIGIBILITY_RULES.MIN_AGE}`);
  }
  if (age > ELIGIBILITY_RULES.MAX_AGE) {
    reasons.push(`Age ${age} > maximum ${ELIGIBILITY_RULES.MAX_AGE}`);
  }
  
  // RULE 3: Annualised earnings > €20,000
  const annualisedEarnings = calculateAnnualisedEarnings(grossPay, payrollFrequency);
  if (annualisedEarnings <= ELIGIBILITY_RULES.MIN_ANNUAL_EARNINGS) {
    reasons.push(`Annualised earnings €${annualisedEarnings.toFixed(2)} ≤ minimum €${ELIGIBILITY_RULES.MIN_ANNUAL_EARNINGS}`);
  }
  
  // RULE 4: Not in employer pension or PRSA via employer
  if (pensionRecord?.has_employer_pension) {
    reasons.push("Already enrolled in employer occupational pension");
  }
  if (pensionRecord?.has_prsa_via_employer) {
    reasons.push("Already has PRSA arranged via employer");
  }
  
  // RULE 5: Employment must be active
  if (employee.contract_type === "fixed-term") {
    const contractEnd = new Date(employee.contract_end_date || "9999-12-31");
    if (contractEnd < payment) {
      reasons.push("Contract expired");
    }
  }
  
  // RULE 6: Check if opted out
  if (pensionRecord?.opt_out_status) {
    const optOutDate = new Date(pensionRecord.opt_out_date);
    const reEnrolDate = new Date(pensionRecord.re_enrolment_date);
    if (payment < reEnrolDate) {
      reasons.push("Opted out - re-enrolment scheduled for " + reEnrolDate.toLocaleDateString());
    }
  }
  
  const eligible = reasons.length === 0;
  return { eligible, reasons, age, annualisedEarnings };
}

// Calculate My Future Fund contributions
export function calculateMyFutureFund(grossPay, paymentDate, payrollFrequency = 'monthly') {
  // Calculate annualised earnings
  const annualisedEarnings = calculateAnnualisedEarnings(grossPay, payrollFrequency);
  
  // Cap earnings at €80,000 annually
  const cappedAnnualEarnings = Math.min(annualisedEarnings, ELIGIBILITY_RULES.EARNINGS_CAP);
  
  // Calculate capped gross pay for this period
  const cappedGrossPay = (cappedAnnualEarnings / annualisedEarnings) * grossPay;
  
  // Get rates for payment date
  const rates = getContributionRates(paymentDate);
  
  // Calculate contributions
  const employeeContribution = cappedGrossPay * rates.employee;
  const employerContribution = cappedGrossPay * rates.employer;
  const stateContribution = cappedGrossPay * rates.state;
  
  return {
    employeeContribution,
    employerContribution,
    stateContribution,
    totalContribution: employeeContribution + employerContribution + stateContribution,
    appliedRate: rates.employee * 100, // as percentage
    phase: getContributionPhase(paymentDate),
    cappedGrossPay,
    annualisedEarnings,
  };
}

// Validate contribution cap doesn't exceed annual limit
export function validateAnnualCap(ytdEmployeeContribution, currentContribution, rollingAnnualEarnings) {
  const maxAnnualContribution = ELIGIBILITY_RULES.EARNINGS_CAP * PENSION_RATES["2035+"].employee;
  const projectedTotal = ytdEmployeeContribution + currentContribution;
  
  if (projectedTotal > maxAnnualContribution) {
    return {
      valid: false,
      message: `Annual contribution cap exceeded: €${projectedTotal.toFixed(2)} > €${maxAnnualContribution.toFixed(2)}`,
      cappedContribution: Math.max(0, maxAnnualContribution - ytdEmployeeContribution),
    };
  }
  
  return { valid: true };
}

// Check if opt-out is allowed
export function canOptOut(enrolmentDate, currentDate) {
  if (!enrolmentDate) return false;
  
  const enrolled = new Date(enrolmentDate);
  const current = new Date(currentDate);
  const monthsDiff = (current.getFullYear() - enrolled.getFullYear()) * 12 + 
                     (current.getMonth() - enrolled.getMonth());
  
  return monthsDiff >= ELIGIBILITY_RULES.OPT_OUT_LOCK_MONTHS;
}

// Calculate re-enrolment date
export function calculateReEnrolmentDate(optOutDate) {
  const optOut = new Date(optOutDate);
  const reEnrol = new Date(optOut);
  reEnrol.setFullYear(reEnrol.getFullYear() + ELIGIBILITY_RULES.RE_ENROLMENT_YEARS);
  return reEnrol.toISOString().split('T')[0];
}

export default {
  PENSION_RATES,
  ELIGIBILITY_RULES,
  getContributionPhase,
  getContributionRates,
  calculateAge,
  calculateAnnualisedEarnings,
  checkEligibility,
  calculateMyFutureFund,
  validateAnnualCap,
  canOptOut,
  calculateReEnrolmentDate,
};