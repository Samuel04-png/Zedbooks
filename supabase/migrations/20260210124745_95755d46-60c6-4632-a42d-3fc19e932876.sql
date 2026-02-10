-- Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financial_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistant_accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';
