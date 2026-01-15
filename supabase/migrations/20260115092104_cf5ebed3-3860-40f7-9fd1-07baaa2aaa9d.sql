-- Fix 1: Audit logs unrestricted insert - Add strict validation policy
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

-- Create policy that enforces user_id and company_id match the authenticated user
CREATE POLICY "Authenticated users can insert validated audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  user_id = auth.uid() AND
  company_id = get_user_company_id(auth.uid())
);

-- Fix 2: Add table whitelist validation to soft_delete_record function
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
  v_allowed_tables TEXT[] := ARRAY[
    'invoices', 'bills', 'expenses', 'journal_entries', 
    'payroll_runs', 'bank_transactions', 'stock_movements'
  ];
BEGIN
  -- Validate table name against whitelist to prevent SQL injection
  IF NOT (p_table_name = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Invalid table name: %. Only allowed tables are: %', p_table_name, array_to_string(v_allowed_tables, ', ');
  END IF;

  v_company_id := get_user_company_id(auth.uid());
  
  -- Get the record data before deletion
  EXECUTE format('SELECT to_jsonb(t.*) FROM %I t WHERE id = $1', p_table_name)
  INTO v_record_data
  USING p_record_id;
  
  IF v_record_data IS NULL THEN
    RETURN false;
  END IF;
  
  -- Store the deleted record for audit/recovery
  INSERT INTO public.deleted_records (
    company_id, original_table, original_id, deleted_by, record_data, deletion_reason
  ) VALUES (
    v_company_id, p_table_name, p_record_id, auth.uid(), v_record_data, p_deletion_reason
  );
  
  -- Soft delete the record
  EXECUTE format('UPDATE %I SET is_deleted = true, deleted_at = now(), deleted_by = $1 WHERE id = $2', p_table_name)
  USING auth.uid(), p_record_id;
  
  -- Log the audit event
  PERFORM log_audit('DELETE', p_table_name, p_record_id, v_record_data, NULL);
  
  RETURN true;
END;
$$;