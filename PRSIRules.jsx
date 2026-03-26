// PRSI Class & Subclass Rules - Ireland 2025-2026
// Source: Revenue Commissioners & Department of Social Protection

export const PRSI_CLASSES_2026 = [
  // 2025 Rules (same as 2026)
  {
    tax_year: 2025,
    class_code: "A",
    subclass_code: "A1",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    description: "Standard private sector employee under 66"
  },
  
  // CLASS A - Private Sector Employees (Most Common)
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "A1",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    description: "Standard private sector employee under 66"
  },
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "A2",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    min_age: 66,
    description: "Private sector employee aged 66 or over"
  },
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "A3",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    description: "Employee with employer PRSI refund due"
  },
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "A4",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: false,
    description: "Employee on Community Employment schemes"
  },
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "A5",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    description: "Seasonal worker"
  },
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "A6",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    description: "Share fisherman"
  },
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "A7",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    description: "Subsidiary employment"
  },
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "A8",
    employee_rate: 0.042,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    description: "Systematic short-time worker"
  },
  {
    tax_year: 2026,
    class_code: "A",
    subclass_code: "AX",
    employee_rate: 0.042,
    employer_rate: 0.1115,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: true,
    description: "Employee with multiple employments"
  },

  // CLASS B - Reserved for Garda
  {
    tax_year: 2026,
    class_code: "B",
    subclass_code: "B0",
    employee_rate: 0,
    employer_rate: 0,
    weekly_threshold: 0,
    has_tapered_credit: false,
    applies_to_benefits: false,
    description: "Permanent and pensionable Garda/Defence Forces (reserved class)"
  },

  // CLASS C - Reserved for Commissioned Army Officers
  {
    tax_year: 2026,
    class_code: "C",
    subclass_code: "C0",
    employee_rate: 0,
    employer_rate: 0,
    weekly_threshold: 0,
    has_tapered_credit: false,
    applies_to_benefits: false,
    description: "Commissioned officers (reserved class)"
  },

  // CLASS D - Public Service Employees
  {
    tax_year: 2026,
    class_code: "D",
    subclass_code: "D0",
    employee_rate: 0.042,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: false,
    description: "Permanent and pensionable public service employees"
  },

  // CLASS H - Health Service Employees
  {
    tax_year: 2026,
    class_code: "H",
    subclass_code: "H0",
    employee_rate: 0.042,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: true,
    applies_to_benefits: false,
    description: "PRSI-exempt public servants recruited before April 1995"
  },

  // CLASS J - Employees with Low Earnings
  {
    tax_year: 2026,
    class_code: "J",
    subclass_code: "J0",
    employee_rate: 0,
    employer_rate: 0,
    weekly_threshold: 38,
    has_tapered_credit: false,
    applies_to_benefits: false,
    description: "Employee earning less than €38 per week (J class)"
  },
  {
    tax_year: 2026,
    class_code: "J",
    subclass_code: "J1",
    employee_rate: 0,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: false,
    applies_to_benefits: false,
    description: "Employee between €38-€352 per week"
  },
  {
    tax_year: 2026,
    class_code: "J",
    subclass_code: "J2",
    employee_rate: 0,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: false,
    applies_to_benefits: false,
    min_age: 66,
    description: "Employee aged 66+ earning €38-€352 per week"
  },
  {
    tax_year: 2026,
    class_code: "J",
    subclass_code: "J3",
    employee_rate: 0,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: false,
    applies_to_benefits: false,
    description: "Directors earning less than €352 per week"
  },
  {
    tax_year: 2026,
    class_code: "J",
    subclass_code: "J8",
    employee_rate: 0,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: false,
    applies_to_benefits: false,
    description: "Systematic short-time worker earning €38-€352 per week"
  },

  // CLASS K - Public Service Pensioners Re-employed
  {
    tax_year: 2026,
    class_code: "K",
    subclass_code: "K1",
    employee_rate: 0,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: false,
    applies_to_benefits: false,
    description: "Public service pensioner under 66"
  },
  {
    tax_year: 2026,
    class_code: "K",
    subclass_code: "K2",
    employee_rate: 0,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: false,
    applies_to_benefits: false,
    min_age: 66,
    description: "Public service pensioner aged 66 or over"
  },

  // CLASS M - Employees over 66 with Full Rate Contributions
  {
    tax_year: 2026,
    class_code: "M",
    subclass_code: "M0",
    employee_rate: 0,
    employer_rate: 0.0085,
    weekly_threshold: 352,
    has_tapered_credit: false,
    applies_to_benefits: false,
    min_age: 66,
    description: "Employee aged 66+ with modified rate contributions"
  },

  // CLASS S - Self-Employed
  {
    tax_year: 2026,
    class_code: "S",
    subclass_code: "S0",
    employee_rate: 0.04,
    employer_rate: 0,
    weekly_threshold: 0,
    has_tapered_credit: false,
    applies_to_benefits: true,
    description: "Self-employed under 66"
  },
  {
    tax_year: 2026,
    class_code: "S",
    subclass_code: "S1",
    employee_rate: 0.04,
    employer_rate: 0,
    weekly_threshold: 0,
    has_tapered_credit: false,
    applies_to_benefits: false,
    min_age: 66,
    description: "Self-employed aged 66 or over"
  },

  // CLASS P - Voluntary Contributors
  {
    tax_year: 2026,
    class_code: "P",
    subclass_code: "P0",
    employee_rate: 0,
    employer_rate: 0,
    weekly_threshold: 0,
    has_tapered_credit: false,
    applies_to_benefits: false,
    description: "Voluntary contributor"
  }
];

// Get PRSI rule for specific class/subclass
export function getPRSIRule(prsiClass, prsiSubclass, taxYear = 2026) {
  const rule = PRSI_CLASSES_2026.find(
    r => r.tax_year === taxYear && 
         r.class_code === prsiClass && 
         r.subclass_code === prsiSubclass
  );
  
  if (!rule) {
    console.warn(`PRSI rule not found for ${prsiClass}/${prsiSubclass} in ${taxYear}, defaulting to A1`);
    return PRSI_CLASSES_2026.find(r => r.class_code === "A" && r.subclass_code === "A1");
  }
  
  return rule;
}

// Get all subclasses for a class
export function getSubclassesForClass(prsiClass, taxYear = 2026) {
  return PRSI_CLASSES_2026
    .filter(r => r.tax_year === taxYear && r.class_code === prsiClass)
    .map(r => ({ value: r.subclass_code, label: `${r.subclass_code} - ${r.description}` }));
}

// Get all available classes
export function getAllPRSIClasses(taxYear = 2026) {
  const classes = [...new Set(PRSI_CLASSES_2026.filter(r => r.tax_year === taxYear).map(r => r.class_code))];
  return classes.map(c => ({ value: c, label: `Class ${c}` }));
}

// Validate PRSI assignment based on employee age
export function validatePRSIAssignment(prsiClass, prsiSubclass, employeeDateOfBirth) {
  const rule = getPRSIRule(prsiClass, prsiSubclass);
  
  if (!employeeDateOfBirth || !rule) return { valid: true };
  
  const age = Math.floor((new Date() - new Date(employeeDateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
  
  if (rule.min_age && age < rule.min_age) {
    return { 
      valid: false, 
      message: `${prsiClass}${prsiSubclass} requires minimum age ${rule.min_age}, employee is ${age}` 
    };
  }
  
  if (rule.max_age && age > rule.max_age) {
    return { 
      valid: false, 
      message: `${prsiClass}${prsiSubclass} requires maximum age ${rule.max_age}, employee is ${age}` 
    };
  }
  
  return { valid: true };
}

export default {
  PRSI_CLASSES_2026,
  getPRSIRule,
  getSubclassesForClass,
  getAllPRSIClasses,
  validatePRSIAssignment
};