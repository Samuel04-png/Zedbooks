-- =====================================================
-- PHASE 1: ENHANCED COMPANY REGISTRATION & TAX CONFIG
-- =====================================================

-- Create tax type enum
CREATE TYPE public.tax_type AS ENUM ('vat_registered', 'turnover_tax', 'non_vat', 'tax_exempt');

-- Create business type enum
CREATE TYPE public.business_type AS ENUM ('sme', 'ngo', 'school', 'corporate', 'government', 'other');

-- Create payroll status enum for state machine
CREATE TYPE public.payroll_status AS ENUM ('draft', 'trial', 'final', 'reversed');

-- Create fixed asset status enum
CREATE TYPE public.asset_status AS ENUM ('active', 'disposed', 'fully_depreciated', 'under_maintenance');

-- Create depreciation method enum
CREATE TYPE public.depreciation_method AS ENUM ('straight_line', 'reducing_balance', 'units_of_production');

-- Enhance companies table with new fields
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS business_type public.business_type DEFAULT 'sme',
ADD COLUMN IF NOT EXISTS registration_number TEXT,
ADD COLUMN IF NOT EXISTS tax_type public.tax_type DEFAULT 'non_vat',
ADD COLUMN IF NOT EXISTS vat_number TEXT,
ADD COLUMN IF NOT EXISTS turnover_tax_number TEXT,
ADD COLUMN IF NOT EXISTS industry_type TEXT,
ADD COLUMN IF NOT EXISTS fiscal_year_start INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'ZMW';

-- =====================================================
-- PHASE 2: FIXED ASSETS MODULE
-- =====================================================

-- Fixed asset categories
CREATE TABLE public.asset_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  depreciation_method public.depreciation_method DEFAULT 'straight_line',
  useful_life_years INTEGER DEFAULT 5,
  depreciation_rate NUMERIC(5,2),
  asset_account_id UUID REFERENCES public.chart_of_accounts(id),
  depreciation_account_id UUID REFERENCES public.chart_of_accounts(id),
  accumulated_depreciation_account_id UUID REFERENCES public.chart_of_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed assets register
CREATE TABLE public.fixed_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  asset_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.asset_categories(id),
  purchase_date DATE NOT NULL,
  purchase_cost NUMERIC(15,2) NOT NULL,
  residual_value NUMERIC(15,2) DEFAULT 0,
  useful_life_months INTEGER NOT NULL,
  depreciation_method public.depreciation_method DEFAULT 'straight_line',
  depreciation_rate NUMERIC(5,2),
  location TEXT,
  serial_number TEXT,
  status public.asset_status DEFAULT 'active',
  disposal_date DATE,
  disposal_amount NUMERIC(15,2),
  disposal_method TEXT,
  accumulated_depreciation NUMERIC(15,2) DEFAULT 0,
  net_book_value NUMERIC(15,2),
  last_depreciation_date DATE,
  vendor_id UUID REFERENCES public.vendors(id),
  invoice_reference TEXT,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed asset depreciation schedule
CREATE TABLE public.asset_depreciation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  depreciation_amount NUMERIC(15,2) NOT NULL,
  accumulated_depreciation NUMERIC(15,2) NOT NULL,
  net_book_value NUMERIC(15,2) NOT NULL,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  is_posted BOOLEAN DEFAULT FALSE,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PHASE 3: ZRA SMART INVOICE INTEGRATION
-- =====================================================

-- ZRA submission queue
CREATE TABLE public.zra_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id),
  submission_type TEXT NOT NULL DEFAULT 'invoice',
  zra_invoice_number TEXT,
  qr_code TEXT,
  submission_status TEXT DEFAULT 'pending',
  submission_date TIMESTAMPTZ,
  response_code TEXT,
  response_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  raw_request JSONB,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add ZRA fields to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS zra_invoice_number TEXT,
ADD COLUMN IF NOT EXISTS zra_qr_code TEXT,
ADD COLUMN IF NOT EXISTS zra_submission_status TEXT DEFAULT 'not_submitted',
ADD COLUMN IF NOT EXISTS zra_submitted_at TIMESTAMPTZ;

-- =====================================================
-- PHASE 4: MULTI-CURRENCY SUPPORT
-- =====================================================

-- Currencies table
CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  decimal_places INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default currencies
INSERT INTO public.currencies (code, name, symbol) VALUES
('ZMW', 'Zambian Kwacha', 'K'),
('USD', 'US Dollar', '$'),
('EUR', 'Euro', '€'),
('GBP', 'British Pound', '£'),
('ZAR', 'South African Rand', 'R'),
('BWP', 'Botswana Pula', 'P');

-- Exchange rates
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  effective_date DATE NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Add currency fields to transactions
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZMW',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,8) DEFAULT 1,
ADD COLUMN IF NOT EXISTS base_currency_total NUMERIC(15,2);

ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZMW',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,8) DEFAULT 1,
ADD COLUMN IF NOT EXISTS base_currency_total NUMERIC(15,2);

-- =====================================================
-- PHASE 5: ENHANCED PAYROLL STATE MACHINE
-- =====================================================

-- Add state machine fields to payroll_runs
ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS payroll_status public.payroll_status DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS trial_run_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_run_by UUID,
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS finalized_by UUID,
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reversed_by UUID,
ADD COLUMN IF NOT EXISTS reversal_reason TEXT,
ADD COLUMN IF NOT EXISTS gl_posted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gl_journal_id UUID REFERENCES public.journal_entries(id),
ADD COLUMN IF NOT EXISTS payroll_number TEXT;

-- Payroll journals linking table
CREATE TABLE public.payroll_journals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  journal_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PHASE 6: FINANCIAL PERIOD MANAGEMENT ENHANCEMENT
-- =====================================================

-- Financial years
CREATE TABLE public.financial_years (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  year_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  is_adjusting_period BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial periods (months)
CREATE TABLE public.financial_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_year_id UUID REFERENCES public.financial_years(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL,
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  is_adjusting_period BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ENABLE RLS ON ALL NEW TABLES
-- =====================================================

ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zra_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Asset Categories policies
CREATE POLICY "Users can view asset categories in their company"
ON public.asset_categories FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert asset categories in their company"
ON public.asset_categories FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update asset categories in their company"
ON public.asset_categories FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

-- Fixed Assets policies
CREATE POLICY "Users can view fixed assets in their company"
ON public.fixed_assets FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert fixed assets in their company"
ON public.fixed_assets FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can update fixed assets in their company"
ON public.fixed_assets FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

-- Asset Depreciation policies
CREATE POLICY "Users can view depreciation in their company"
ON public.asset_depreciation FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.fixed_assets fa 
  WHERE fa.id = asset_id AND fa.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Users can insert depreciation in their company"
ON public.asset_depreciation FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.fixed_assets fa 
  WHERE fa.id = asset_id AND fa.company_id = get_user_company_id(auth.uid())
));

-- ZRA Submissions policies
CREATE POLICY "Users can view ZRA submissions in their company"
ON public.zra_submissions FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert ZRA submissions in their company"
ON public.zra_submissions FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update ZRA submissions in their company"
ON public.zra_submissions FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

-- Currencies (public read)
CREATE POLICY "Anyone can view currencies"
ON public.currencies FOR SELECT
USING (true);

-- Exchange Rates policies
CREATE POLICY "Users can view exchange rates in their company"
ON public.exchange_rates FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert exchange rates in their company"
ON public.exchange_rates FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Payroll Journals policies
CREATE POLICY "Users can view payroll journals in their company"
ON public.payroll_journals FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.payroll_runs pr 
  WHERE pr.id = payroll_run_id AND pr.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Users can insert payroll journals in their company"
ON public.payroll_journals FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.payroll_runs pr 
  WHERE pr.id = payroll_run_id AND pr.company_id = get_user_company_id(auth.uid())
));

-- Financial Years policies
CREATE POLICY "Users can view financial years in their company"
ON public.financial_years FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert financial years in their company"
ON public.financial_years FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update financial years in their company"
ON public.financial_years FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

-- Financial Periods policies
CREATE POLICY "Users can view financial periods in their company"
ON public.financial_periods FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert financial periods in their company"
ON public.financial_periods FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update financial periods in their company"
ON public.financial_periods FOR UPDATE
USING (company_id = get_user_company_id(auth.uid()));

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER update_asset_categories_updated_at
BEFORE UPDATE ON public.asset_categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fixed_assets_updated_at
BEFORE UPDATE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zra_submissions_updated_at
BEFORE UPDATE ON public.zra_submissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_years_updated_at
BEFORE UPDATE ON public.financial_years
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_periods_updated_at
BEFORE UPDATE ON public.financial_periods
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to generate payroll number
CREATE OR REPLACE FUNCTION public.generate_payroll_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_year TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count 
  FROM public.payroll_runs 
  WHERE company_id = p_company_id 
  AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  RETURN 'PAY-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

-- Function to calculate asset depreciation
CREATE OR REPLACE FUNCTION public.calculate_monthly_depreciation(
  p_purchase_cost NUMERIC,
  p_residual_value NUMERIC,
  p_useful_life_months INTEGER,
  p_depreciation_method public.depreciation_method,
  p_depreciation_rate NUMERIC DEFAULT NULL,
  p_current_nbv NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_depreciation NUMERIC;
BEGIN
  IF p_depreciation_method = 'straight_line' THEN
    v_monthly_depreciation := (p_purchase_cost - p_residual_value) / p_useful_life_months;
  ELSIF p_depreciation_method = 'reducing_balance' THEN
    IF p_current_nbv IS NULL THEN
      p_current_nbv := p_purchase_cost;
    END IF;
    v_monthly_depreciation := (p_current_nbv * COALESCE(p_depreciation_rate, 20) / 100) / 12;
  ELSE
    v_monthly_depreciation := (p_purchase_cost - p_residual_value) / p_useful_life_months;
  END IF;
  
  RETURN ROUND(v_monthly_depreciation, 2);
END;
$$;

-- Function to validate payroll status transition
CREATE OR REPLACE FUNCTION public.validate_payroll_transition(
  p_current_status public.payroll_status,
  p_new_status public.payroll_status
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Valid transitions:
  -- draft -> trial
  -- trial -> draft (reverse trial)
  -- trial -> final
  -- final -> reversed (with reversing journal)
  
  IF p_current_status = 'draft' AND p_new_status = 'trial' THEN
    RETURN TRUE;
  ELSIF p_current_status = 'trial' AND p_new_status IN ('draft', 'final') THEN
    RETURN TRUE;
  ELSIF p_current_status = 'final' AND p_new_status = 'reversed' THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;