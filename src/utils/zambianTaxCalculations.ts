// Zambian Tax Calculation Utilities for 2025/26

export interface TaxCalculationResult {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  grossSalary: number;
  paye: number;
  napsaEmployee: number;
  napsaEmployer: number;
  nhimaEmployee: number;
  nhimaEmployer: number;
  advancesDeducted: number;
  totalDeductions: number;
  netSalary: number;
}

// PAYE Tax Bands for 2025/26 (Monthly)
const PAYE_BANDS = [
  { min: 0, max: 5100, rate: 0 },
  { min: 5100, max: 7100, rate: 0.20 },
  { min: 7100, max: 9200, rate: 0.30 },
  { min: 9200, max: Infinity, rate: 0.37 }
];

// Statutory Contribution Rates
const NAPSA_EMPLOYEE_RATE = 0.05; // 5%
const NAPSA_EMPLOYER_RATE = 0.05; // 5%
const NAPSA_BASE_CAP = 26840; // Maximum base for NAPSA calculation
const NAPSA_EMPLOYER_CAP = 1342; // Maximum K1,342 per month (5% of K26,840)
const NHIMA_EMPLOYEE_RATE = 0.01; // 1%
const NHIMA_EMPLOYER_RATE = 0.01; // 1%

/**
 * Calculate PAYE using progressive tax bands
 * Tax is calculated on the difference in each band
 */
export function calculatePAYE(taxableIncome: number): number {
  let paye = 0;
  let remainingIncome = taxableIncome;

  for (const band of PAYE_BANDS) {
    if (remainingIncome <= 0) break;

    const taxableInBand = Math.min(
      remainingIncome,
      band.max - band.min
    );

    paye += taxableInBand * band.rate;
    remainingIncome -= taxableInBand;
  }

  return Math.round(paye * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate NAPSA contributions (employee and employer)
 * NAPSA Employee: 5% of basic salary
 * NAPSA Employer: 5% of gross salary, capped at base of K26,840 (max K1,342)
 */
export function calculateNAPSA(basicSalary: number, grossSalary: number): {
  employee: number;
  employer: number;
} {
  const employee = Math.round(basicSalary * NAPSA_EMPLOYEE_RATE * 100) / 100;
  const napsaBase = Math.min(grossSalary, NAPSA_BASE_CAP);
  const employerUncapped = Math.round(napsaBase * NAPSA_EMPLOYER_RATE * 100) / 100;
  const employer = Math.min(employerUncapped, NAPSA_EMPLOYER_CAP);
  
  return { employee, employer };
}

/**
 * Calculate NHIMA contributions (employee and employer)
 * NHIMA is calculated on basic salary only (1% each)
 */
export function calculateNHIMA(basicSalary: number): {
  employee: number;
  employer: number;
} {
  const employee = Math.round(basicSalary * NHIMA_EMPLOYEE_RATE * 100) / 100;
  const employer = Math.round(basicSalary * NHIMA_EMPLOYER_RATE * 100) / 100;
  
  return { employee, employer };
}

/**
 * Calculate complete payroll for an employee
 */
export function calculatePayroll(
  basicSalary: number,
  housingAllowance: number = 0,
  transportAllowance: number = 0,
  otherAllowances: number = 0,
  advancesDeducted: number = 0,
  otherDeductions: number = 0
): TaxCalculationResult {
  // Calculate gross salary
  const grossSalary = basicSalary + housingAllowance + transportAllowance + otherAllowances;

  // Calculate NAPSA: Employee on basic, Employer on gross (capped)
  const napsa = calculateNAPSA(basicSalary, grossSalary);
  
  // Calculate NHIMA on basic salary
  const nhima = calculateNHIMA(basicSalary);

  // Calculate PAYE on gross salary (for reference only, not deducted)
  const paye = calculatePAYE(grossSalary);

  // Total deductions: only advances and other deductions (no statutory deductions for employee)
  const totalDeductions = advancesDeducted + otherDeductions;

  // Net salary: gross minus advances only (no PAYE, NAPSA, or NHIMA deducted from employee)
  const netSalary = grossSalary - totalDeductions;

  return {
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    grossSalary,
    paye,
    napsaEmployee: napsa.employee,
    napsaEmployer: napsa.employer,
    nhimaEmployee: nhima.employee,
    nhimaEmployer: nhima.employer,
    advancesDeducted,
    totalDeductions,
    netSalary
  };
}

/**
 * Format currency for Zambian Kwacha
 */
export function formatZMW(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
