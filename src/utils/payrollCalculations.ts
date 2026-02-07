// Payroll Calculation Engine - Configuration-driven
import { supabase } from "@/integrations/supabase/client";

export interface PayrollConfig {
  payeBands: Array<{
    min_amount: number;
    max_amount: number | null;
    rate: number;
  }>;
  napsa: { employeeRate: number; employerRate: number; cap: number | null };
  nhima: { employeeRate: number; employerRate: number; cap: number | null };
  pension: { employeeRate: number; employerRate: number; cap: number | null };
  whtLocal: number;
  whtNonResident: number;
}

export interface EmployeePayrollInput {
  basicSalary: number;
  allowances: Array<{ amount: number; isTaxable: boolean }>;
  applyPaye: boolean;
  applyNapsa: boolean;
  applyNhima: boolean;
  pensionEnabled: boolean;
  pensionEmployeeRate?: number;
  pensionEmployerRate?: number;
  isConsultant: boolean;
  consultantType?: "local" | "non_resident";
  applyWht: boolean;
  advancesDeducted?: number;
  otherDeductions?: number;
}

export interface PayrollCalculationResult {
  basicSalary: number;
  totalAllowances: number;
  taxableAllowances: number;
  grossSalary: number;
  chargeableIncome: number;
  paye: number;
  napsaEmployee: number;
  napsaEmployer: number;
  nhimaEmployee: number;
  nhimaEmployer: number;
  pensionEmployee: number;
  pensionEmployer: number;
  whtAmount: number;
  advancesDeducted: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
}

// Default configuration (ZRA 2025/26 rates)
const DEFAULT_CONFIG: PayrollConfig = {
  payeBands: [
    { min_amount: 0, max_amount: 5100, rate: 0 },
    { min_amount: 5100, max_amount: 7100, rate: 0.20 },
    { min_amount: 7100, max_amount: 9200, rate: 0.30 },
    { min_amount: 9200, max_amount: null, rate: 0.37 },
  ],
  napsa: { employeeRate: 0.05, employerRate: 0.05, cap: 1342 },
  nhima: { employeeRate: 0.01, employerRate: 0.01, cap: 250 },
  pension: { employeeRate: 0.05, employerRate: 0.05, cap: null },
  whtLocal: 0.15,
  whtNonResident: 0.20,
};

/**
 * Fetch payroll configuration from database
 */
export async function fetchPayrollConfig(companyId: string): Promise<PayrollConfig> {
  try {
    // Fetch PAYE bands
    const { data: bands } = await supabase
      .from("paye_tax_bands")
      .select("min_amount, max_amount, rate")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("band_order");

    // Fetch statutory rates
    const { data: rates } = await supabase
      .from("payroll_statutory_rates")
      .select("rate_type, employee_rate, employer_rate, cap_amount")
      .eq("company_id", companyId)
      .eq("is_active", true);

    const config: PayrollConfig = { ...DEFAULT_CONFIG };

    if (bands && bands.length > 0) {
      config.payeBands = bands.map(b => ({
        min_amount: Number(b.min_amount),
        max_amount: b.max_amount ? Number(b.max_amount) : null,
        rate: Number(b.rate),
      }));
    }

    if (rates) {
      for (const rate of rates) {
        switch (rate.rate_type) {
          case "napsa":
            config.napsa = {
              employeeRate: Number(rate.employee_rate),
              employerRate: Number(rate.employer_rate),
              cap: rate.cap_amount ? Number(rate.cap_amount) : null,
            };
            break;
          case "nhima":
            config.nhima = {
              employeeRate: Number(rate.employee_rate),
              employerRate: Number(rate.employer_rate),
              cap: rate.cap_amount ? Number(rate.cap_amount) : null,
            };
            break;
          case "pension":
            config.pension = {
              employeeRate: Number(rate.employee_rate),
              employerRate: Number(rate.employer_rate),
              cap: rate.cap_amount ? Number(rate.cap_amount) : null,
            };
            break;
          case "wht_local":
            config.whtLocal = Number(rate.employee_rate);
            break;
          case "wht_nonresident":
            config.whtNonResident = Number(rate.employee_rate);
            break;
        }
      }
    }

    return config;
  } catch (error) {
    console.error("Error fetching payroll config:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Calculate PAYE using progressive tax bands
 */
export function calculatePAYE(chargeableIncome: number, bands: PayrollConfig["payeBands"]): number {
  let paye = 0;
  let remainingIncome = chargeableIncome;

  for (const band of bands) {
    if (remainingIncome <= 0) break;

    const bandMax = band.max_amount ?? Infinity;
    const taxableInBand = Math.min(remainingIncome, bandMax - band.min_amount);

    if (taxableInBand > 0) {
      paye += taxableInBand * band.rate;
      remainingIncome -= taxableInBand;
    }
  }

  return Math.round(paye * 100) / 100;
}

/**
 * Calculate complete payroll for an employee
 */
export function calculateEmployeePayroll(
  input: EmployeePayrollInput,
  config: PayrollConfig = DEFAULT_CONFIG
): PayrollCalculationResult {
  const { basicSalary, allowances, advancesDeducted = 0, otherDeductions = 0 } = input;

  // Calculate allowances
  const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
  const taxableAllowances = allowances.filter(a => a.isTaxable).reduce((sum, a) => sum + a.amount, 0);
  
  // Gross salary
  const grossSalary = basicSalary + totalAllowances;

  // Initialize deductions
  let napsaEmployee = 0;
  let napsaEmployer = 0;
  let nhimaEmployee = 0;
  let nhimaEmployer = 0;
  let pensionEmployee = 0;
  let pensionEmployer = 0;
  let paye = 0;
  let whtAmount = 0;

  // For consultants, only apply WHT
  if (input.isConsultant && input.applyWht) {
    const whtRate = input.consultantType === "non_resident" 
      ? config.whtNonResident 
      : config.whtLocal;
    whtAmount = Math.round(grossSalary * whtRate * 100) / 100;
  } else {
    // Standard employee deductions
    
    // NAPSA: Based on gross salary
    if (input.applyNapsa) {
      const uncapped = grossSalary * config.napsa.employeeRate;
      napsaEmployee = config.napsa.cap 
        ? Math.min(uncapped, config.napsa.cap) 
        : uncapped;
      napsaEmployee = Math.round(napsaEmployee * 100) / 100;
      napsaEmployer = napsaEmployee; // Same as employee
    }

    // NHIMA: Based on basic salary
    if (input.applyNhima) {
      const uncapped = basicSalary * config.nhima.employeeRate;
      nhimaEmployee = config.nhima.cap 
        ? Math.min(uncapped, config.nhima.cap) 
        : uncapped;
      nhimaEmployee = Math.round(nhimaEmployee * 100) / 100;
      nhimaEmployer = nhimaEmployee;
    }

    // Pension
    if (input.pensionEnabled) {
      const empRate = input.pensionEmployeeRate ?? config.pension.employeeRate;
      const employerRate = input.pensionEmployerRate ?? config.pension.employerRate;
      
      pensionEmployee = Math.round(grossSalary * empRate * 100) / 100;
      pensionEmployer = Math.round(grossSalary * employerRate * 100) / 100;

      if (config.pension.cap) {
        pensionEmployee = Math.min(pensionEmployee, config.pension.cap);
        pensionEmployer = Math.min(pensionEmployer, config.pension.cap);
      }
    }

    // Calculate chargeable income for PAYE
    // Chargeable = Gross - NAPSA (employee) - Pension (employee)
    const chargeableIncome = grossSalary - napsaEmployee - pensionEmployee;

    // PAYE
    if (input.applyPaye && chargeableIncome > 0) {
      paye = calculatePAYE(chargeableIncome, config.payeBands);
    }
  }

  // Total deductions
  const totalDeductions = paye + napsaEmployee + nhimaEmployee + pensionEmployee + whtAmount + advancesDeducted + otherDeductions;

  // Net salary
  const netSalary = grossSalary - totalDeductions;

  return {
    basicSalary,
    totalAllowances,
    taxableAllowances,
    grossSalary,
    chargeableIncome: grossSalary - napsaEmployee - pensionEmployee,
    paye,
    napsaEmployee,
    napsaEmployer,
    nhimaEmployee,
    nhimaEmployer,
    pensionEmployee,
    pensionEmployer,
    whtAmount,
    advancesDeducted,
    otherDeductions,
    totalDeductions,
    netSalary,
  };
}

/**
 * Format currency for Zambian Kwacha
 */
export function formatZMW(amount: number): string {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
