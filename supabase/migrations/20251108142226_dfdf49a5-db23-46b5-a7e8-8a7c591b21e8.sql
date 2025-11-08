-- Add contract and gratuity fields to employees table
ALTER TABLE public.employees
ADD COLUMN contract_type text,
ADD COLUMN contract_start_date date,
ADD COLUMN contract_end_date date,
ADD COLUMN has_gratuity boolean DEFAULT false,
ADD COLUMN gratuity_rate numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.employees.contract_type IS 'Type of employment contract: Permanent, Fixed-Term, Temporary, Internship';
COMMENT ON COLUMN public.employees.has_gratuity IS 'Whether this contract attracts gratuity payment';
COMMENT ON COLUMN public.employees.gratuity_rate IS 'Gratuity rate as percentage (e.g., 25 for 25%)';