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

// PAYE Tax Bands for 2025/26 (Monthly) - ZRA Standards
const PAYE_BANDS = [
  { min: 0, max: 5100, rate: 0 },
  { min: 5100, max: 6800, rate: 0.20 },
  { min: 6800, max: 8900, rate: 0.30 },
  { min: 8900, max: Infinity, rate: 0.37 }
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
 * NAPSA: 5% of gross salary, capped at K1,342.00
 */
export function calculateNAPSA(basicSalary: number, grossSalary: number): {
  employee: number;
  employer: number;
} {
  const uncappedNAPSA = Math.round(grossSalary * NAPSA_EMPLOYEE_RATE * 100) / 100;
  const employee = Math.min(uncappedNAPSA, NAPSA_EMPLOYER_CAP);
  const employer = employee; // Same as employee contribution
  
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
 * Following ZRA, NAPSA, and NHIMA standards
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

  // Calculate NAPSA: 5% of gross, capped at K1,342
  const napsa = calculateNAPSA(basicSalary, grossSalary);
  
  // Calculate NHIMA: 1% on basic salary
  const nhima = calculateNHIMA(basicSalary);

  // Calculate PAYE on gross salary (as per ZRA standards)
  const paye = calculatePAYE(grossSalary);

  // Total deductions: statutory deductions + advances + other deductions
  const totalDeductions = napsa.employee + nhima.employee + paye + advancesDeducted + otherDeductions;

  // Net salary: gross minus all deductions
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
