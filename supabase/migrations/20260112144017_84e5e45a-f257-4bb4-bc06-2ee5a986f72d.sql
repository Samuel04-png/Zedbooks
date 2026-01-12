
-- Add 'staff' role to enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'staff' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'staff';
  END IF;
END $$;

-- Create function to get user's company_id (if not exists)
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Create function to check if user belongs to a company
CREATE OR REPLACE FUNCTION public.user_in_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _user_id AND company_id = _company_id
  );
$$;

-- Update log_audit function to include company_id
CREATE OR REPLACE FUNCTION public.log_audit(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    company_id,
    created_at
  ) VALUES (
    p_table_name,
    p_record_id,
    p_action,
    p_old_values,
    p_new_values,
    auth.uid(),
    get_user_company_id(auth.uid()),
    now()
  );
END;
$$;

-- Create indexes for company_id on tables that need them
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_company_id ON public.payroll_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_bills_company_id ON public.bills(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company_id ON public.vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_company_id ON public.inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company_id ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_advances_company_id ON public.advances(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);

-- Drop and recreate RLS policies for employees with company scoping
DROP POLICY IF EXISTS "Users can view employees in their organization" ON public.employees;
DROP POLICY IF EXISTS "Admins can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can update employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can delete employees" ON public.employees;

CREATE POLICY "Users can view employees in their company"
ON public.employees FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "HR and admins can insert employees"
ON public.employees FOR INSERT
WITH CHECK (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr_manager') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "HR and admins can update employees"
ON public.employees FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr_manager') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Admins can delete employees"
ON public.employees FOR DELETE
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Drop and recreate RLS policies for payroll_runs with company scoping
DROP POLICY IF EXISTS "Users can view payroll runs in their organization" ON public.payroll_runs;
DROP POLICY IF EXISTS "Admins can manage payroll runs" ON public.payroll_runs;

CREATE POLICY "Users can view payroll runs in their company"
ON public.payroll_runs FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Finance and admins can manage payroll runs"
ON public.payroll_runs FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'super_admin'))
);

-- Drop and recreate RLS policies for invoices with company scoping
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;

CREATE POLICY "Users can view invoices in their company"
ON public.invoices FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Finance can insert invoices"
ON public.invoices FOR INSERT
WITH CHECK (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'bookkeeper') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Finance can update invoices"
ON public.invoices FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'bookkeeper') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Admins can delete invoices"
ON public.invoices FOR DELETE
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Drop and recreate RLS policies for bills with company scoping
DROP POLICY IF EXISTS "Users can view their own bills" ON public.bills;
DROP POLICY IF EXISTS "Users can insert their own bills" ON public.bills;
DROP POLICY IF EXISTS "Admins can manage bills" ON public.bills;

CREATE POLICY "Users can view bills in their company"
ON public.bills FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Finance can manage bills"
ON public.bills FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'bookkeeper') OR has_role(auth.uid(), 'super_admin'))
);

-- Drop and recreate RLS policies for expenses with company scoping
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can manage expenses" ON public.expenses;

CREATE POLICY "Users can view expenses in their company"
ON public.expenses FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert expenses"
ON public.expenses FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Finance can manage expenses"
ON public.expenses FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'super_admin'))
);

-- Drop and recreate RLS policies for projects with company scoping
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;

CREATE POLICY "Users can view projects in their company"
ON public.projects FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Project managers can manage projects"
ON public.projects FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'project_manager') OR has_role(auth.uid(), 'super_admin'))
);

-- Drop and recreate RLS policies for inventory with company scoping
DROP POLICY IF EXISTS "Users can view inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can insert inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins can manage inventory" ON public.inventory_items;

CREATE POLICY "Users can view inventory in their company"
ON public.inventory_items FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Inventory managers can manage inventory"
ON public.inventory_items FOR ALL
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory_manager') OR has_role(auth.uid(), 'super_admin'))
);

-- Drop and recreate RLS policies for audit_logs with company scoping
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs in their company"
ON public.audit_logs FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'auditor'))
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);
