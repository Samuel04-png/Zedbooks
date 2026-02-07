-- ============================================
-- PAYROLL CONFIGURATION TABLES
-- ============================================

-- 1. PAYE Tax Bands (configurable per company)
CREATE TABLE public.paye_tax_bands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  band_order INTEGER NOT NULL,
  min_amount NUMERIC NOT NULL DEFAULT 0,
  max_amount NUMERIC, -- NULL means infinity
  rate NUMERIC NOT NULL DEFAULT 0, -- Decimal (e.g., 0.20 for 20%)
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Statutory Rates Configuration
CREATE TABLE public.payroll_statutory_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  rate_type TEXT NOT NULL, -- 'napsa', 'nhima', 'pension', 'wht_local', 'wht_nonresident'
  employee_rate NUMERIC NOT NULL DEFAULT 0,
  employer_rate NUMERIC NOT NULL DEFAULT 0,
  cap_amount NUMERIC, -- Maximum amount cap (e.g., K1,342 for NAPSA)
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, rate_type, effective_from)
);

-- 3. Employee Payroll Profile (per-employee payroll settings)
CREATE TABLE public.employee_payroll_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  
  -- Rate and pay settings
  rate_type TEXT DEFAULT 'monthly', -- 'monthly', 'daily', 'hourly'
  pay_rate NUMERIC, -- Rate per period
  overtime_rate_multiplier NUMERIC DEFAULT 1.5,
  pay_point TEXT,
  currency TEXT DEFAULT 'ZMW',
  
  -- Statutory deduction flags
  apply_paye BOOLEAN DEFAULT true,
  apply_napsa BOOLEAN DEFAULT true,
  apply_nhima BOOLEAN DEFAULT true,
  pension_enabled BOOLEAN DEFAULT false,
  pension_employee_rate NUMERIC, -- Override company default
  pension_employer_rate NUMERIC, -- Override company default
  
  -- Consultant/WHT settings
  is_consultant BOOLEAN DEFAULT false,
  consultant_type TEXT, -- 'local', 'non_resident'
  apply_wht BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

-- 4. Employee Allowances (dynamic allowances per employee)
CREATE TABLE public.employee_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  allowance_type TEXT NOT NULL, -- 'housing', 'transport', 'meal', 'medical', 'other', 'custom'
  allowance_name TEXT NOT NULL, -- Display name
  amount NUMERIC NOT NULL DEFAULT 0,
  is_taxable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Allowance Types (company-defined allowance catalog)
CREATE TABLE public.allowance_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  default_amount NUMERIC,
  is_taxable BOOLEAN DEFAULT true,
  is_statutory BOOLEAN DEFAULT false, -- System-defined allowances
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Add new columns to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS nrc_number TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Zambian',
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS division TEXT,
ADD COLUMN IF NOT EXISTS job_grade TEXT,
ADD COLUMN IF NOT EXISTS cost_centre TEXT;

-- Add pension columns to payroll_items
ALTER TABLE public.payroll_items
ADD COLUMN IF NOT EXISTS pension_employee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pension_employer NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wht_amount NUMERIC DEFAULT 0;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- PAYE Tax Bands
ALTER TABLE public.paye_tax_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PAYE bands in their company"
ON public.paye_tax_bands FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage PAYE bands"
ON public.paye_tax_bands FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- Payroll Statutory Rates
ALTER TABLE public.payroll_statutory_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view statutory rates in their company"
ON public.payroll_statutory_rates FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage statutory rates"
ON public.payroll_statutory_rates FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- Employee Payroll Profiles
ALTER TABLE public.employee_payroll_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payroll profiles in their company"
ON public.employee_payroll_profiles FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "HR and admins can manage payroll profiles"
ON public.employee_payroll_profiles FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'hr_manager'::app_role) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
  )
);

-- Employee Allowances
ALTER TABLE public.employee_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view allowances in their company"
ON public.employee_allowances FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "HR and admins can manage allowances"
ON public.employee_allowances FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'hr_manager'::app_role) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
  )
);

-- Allowance Types
ALTER TABLE public.allowance_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view allowance types in their company"
ON public.allowance_types FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage allowance types"
ON public.allowance_types FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_paye_tax_bands_updated_at
BEFORE UPDATE ON public.paye_tax_bands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_statutory_rates_updated_at
BEFORE UPDATE ON public.payroll_statutory_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_payroll_profiles_updated_at
BEFORE UPDATE ON public.employee_payroll_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_allowances_updated_at
BEFORE UPDATE ON public.employee_allowances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_allowance_types_updated_at
BEFORE UPDATE ON public.allowance_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();