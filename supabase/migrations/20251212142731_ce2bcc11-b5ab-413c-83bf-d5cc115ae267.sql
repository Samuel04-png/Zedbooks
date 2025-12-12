-- Add repayment schedule fields to advances table
ALTER TABLE public.advances 
ADD COLUMN IF NOT EXISTS months_to_repay integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS monthly_deduction numeric,
ADD COLUMN IF NOT EXISTS remaining_balance numeric,
ADD COLUMN IF NOT EXISTS months_deducted integer DEFAULT 0;