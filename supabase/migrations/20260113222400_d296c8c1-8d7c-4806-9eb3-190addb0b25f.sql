
-- Fix overly permissive RLS policy on notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can create notifications for company" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_in_company(auth.uid(), company_id));

-- Add soft delete fields to transaction tables
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft';

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft';

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft';

ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft';

ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Create indexes for soft delete fields
CREATE INDEX IF NOT EXISTS idx_invoices_is_deleted ON public.invoices(is_deleted);
CREATE INDEX IF NOT EXISTS idx_expenses_is_deleted ON public.expenses(is_deleted);
CREATE INDEX IF NOT EXISTS idx_bills_is_deleted ON public.bills(is_deleted);

-- Create function to check if a date is in a locked period
CREATE OR REPLACE FUNCTION public.is_period_locked(check_date DATE, check_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.period_locks
    WHERE company_id = check_company_id
    AND is_active = true
    AND check_date BETWEEN period_start AND period_end
  );
$$;

-- Create function to soft delete a record
CREATE OR REPLACE FUNCTION public.soft_delete_record(
  p_table_name TEXT,
  p_record_id UUID,
  p_deletion_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_data JSONB;
  v_company_id UUID;
BEGIN
  v_company_id := get_user_company_id(auth.uid());
  
  EXECUTE format('SELECT to_jsonb(t.*) FROM %I t WHERE id = $1', p_table_name)
  INTO v_record_data
  USING p_record_id;
  
  IF v_record_data IS NULL THEN
    RETURN false;
  END IF;
  
  INSERT INTO public.deleted_records (
    company_id, original_table, original_id, deleted_by, record_data, deletion_reason
  ) VALUES (
    v_company_id, p_table_name, p_record_id, auth.uid(), v_record_data, p_deletion_reason
  );
  
  EXECUTE format('UPDATE %I SET is_deleted = true, deleted_at = now(), deleted_by = $1 WHERE id = $2', p_table_name)
  USING auth.uid(), p_record_id;
  
  PERFORM log_audit('DELETE', p_table_name, p_record_id, v_record_data, NULL);
  
  RETURN true;
END;
$$;

-- Create function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_related_table TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_company_id UUID;
BEGIN
  v_company_id := get_user_company_id(p_user_id);
  
  INSERT INTO public.notifications (
    user_id, company_id, title, message, type, related_table, related_id
  ) VALUES (
    p_user_id, v_company_id, p_title, p_message, p_type, p_related_table, p_related_id
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;
