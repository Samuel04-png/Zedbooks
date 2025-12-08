-- Add approval tracking columns to payroll_runs
ALTER TABLE public.payroll_runs 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Drop and recreate the status check constraint with updated values
ALTER TABLE public.payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_status_check;
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_status_check 
CHECK (status IN ('draft', 'pending_approval', 'approved', 'completed'));