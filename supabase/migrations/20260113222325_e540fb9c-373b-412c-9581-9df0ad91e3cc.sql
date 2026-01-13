
-- Create notifications table for real-time notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  related_table TEXT,
  related_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create approval_workflows table
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL,
  min_amount NUMERIC DEFAULT 0,
  max_amount NUMERIC,
  required_role public.app_role NOT NULL,
  approval_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create approval_requests table
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL,
  record_table TEXT NOT NULL,
  record_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  current_approver_role public.app_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC,
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deleted_records table for soft delete tracking
CREATE TABLE IF NOT EXISTS public.deleted_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  original_table TEXT NOT NULL,
  original_id UUID NOT NULL,
  deleted_by UUID NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  record_data JSONB NOT NULL,
  deletion_reason TEXT,
  can_restore BOOLEAN NOT NULL DEFAULT true
);

-- Create period_locks table
CREATE TABLE IF NOT EXISTS public.period_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  lock_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cash_reconciliations table
CREATE TABLE IF NOT EXISTS public.cash_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  cash_received NUMERIC NOT NULL DEFAULT 0,
  cash_paid NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC NOT NULL DEFAULT 0,
  physical_count NUMERIC NOT NULL DEFAULT 0,
  variance NUMERIC NOT NULL DEFAULT 0,
  variance_reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  prepared_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock_reconciliations table
CREATE TABLE IF NOT EXISTS public.stock_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_items_counted INTEGER NOT NULL DEFAULT 0,
  total_variances INTEGER NOT NULL DEFAULT 0,
  variance_value NUMERIC NOT NULL DEFAULT 0,
  prepared_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock_reconciliation_items table
CREATE TABLE IF NOT EXISTS public.stock_reconciliation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reconciliation_id UUID REFERENCES public.stock_reconciliations(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  system_quantity NUMERIC NOT NULL,
  physical_quantity NUMERIC NOT NULL,
  variance NUMERIC GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  variance_value NUMERIC GENERATED ALWAYS AS ((physical_quantity - system_quantity) * unit_cost) STORED,
  variance_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reconciliation_items ENABLE ROW LEVEL SECURITY;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for approval_workflows
CREATE POLICY "Users can view company approval workflows" ON public.approval_workflows
  FOR SELECT TO authenticated
  USING (user_in_company(auth.uid(), company_id));

CREATE POLICY "Admins can manage approval workflows" ON public.approval_workflows
  FOR ALL TO authenticated
  USING (user_in_company(auth.uid(), company_id) AND (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'financial_manager')
  ));

-- RLS Policies for approval_requests
CREATE POLICY "Users can view company approval requests" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (user_in_company(auth.uid(), company_id));

CREATE POLICY "Users can create approval requests" ON public.approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_in_company(auth.uid(), company_id));

CREATE POLICY "Approvers can update approval requests" ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (user_in_company(auth.uid(), company_id) AND (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'financial_manager') OR
    has_role(auth.uid(), 'accountant')
  ));

-- RLS Policies for deleted_records
CREATE POLICY "Auditors can view deleted records" ON public.deleted_records
  FOR SELECT TO authenticated
  USING (user_in_company(auth.uid(), company_id) AND (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'auditor') OR
    has_role(auth.uid(), 'financial_manager')
  ));

CREATE POLICY "System can insert deleted records" ON public.deleted_records
  FOR INSERT TO authenticated
  WITH CHECK (user_in_company(auth.uid(), company_id));

-- RLS Policies for period_locks
CREATE POLICY "Users can view period locks" ON public.period_locks
  FOR SELECT TO authenticated
  USING (user_in_company(auth.uid(), company_id));

CREATE POLICY "Financial managers can manage period locks" ON public.period_locks
  FOR ALL TO authenticated
  USING (user_in_company(auth.uid(), company_id) AND (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'financial_manager')
  ));

-- RLS Policies for cash_reconciliations
CREATE POLICY "Users can view company cash reconciliations" ON public.cash_reconciliations
  FOR SELECT TO authenticated
  USING (user_in_company(auth.uid(), company_id));

CREATE POLICY "Cashiers and above can create cash reconciliations" ON public.cash_reconciliations
  FOR INSERT TO authenticated
  WITH CHECK (user_in_company(auth.uid(), company_id) AND (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'financial_manager') OR
    has_role(auth.uid(), 'accountant') OR
    has_role(auth.uid(), 'cashier')
  ));

CREATE POLICY "Accountants can update cash reconciliations" ON public.cash_reconciliations
  FOR UPDATE TO authenticated
  USING (user_in_company(auth.uid(), company_id) AND (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'financial_manager') OR
    has_role(auth.uid(), 'accountant')
  ));

-- RLS Policies for stock_reconciliations
CREATE POLICY "Users can view company stock reconciliations" ON public.stock_reconciliations
  FOR SELECT TO authenticated
  USING (user_in_company(auth.uid(), company_id));

CREATE POLICY "Inventory managers can create stock reconciliations" ON public.stock_reconciliations
  FOR INSERT TO authenticated
  WITH CHECK (user_in_company(auth.uid(), company_id) AND (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'financial_manager') OR
    has_role(auth.uid(), 'accountant') OR
    has_role(auth.uid(), 'inventory_manager')
  ));

CREATE POLICY "Managers can update stock reconciliations" ON public.stock_reconciliations
  FOR UPDATE TO authenticated
  USING (user_in_company(auth.uid(), company_id) AND (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'financial_manager') OR
    has_role(auth.uid(), 'accountant')
  ));

-- RLS Policies for stock_reconciliation_items
CREATE POLICY "Users can view stock reconciliation items" ON public.stock_reconciliation_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stock_reconciliations sr 
    WHERE sr.id = reconciliation_id 
    AND user_in_company(auth.uid(), sr.company_id)
  ));

CREATE POLICY "Users can manage stock reconciliation items" ON public.stock_reconciliation_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stock_reconciliations sr 
    WHERE sr.id = reconciliation_id 
    AND user_in_company(auth.uid(), sr.company_id)
    AND (
      has_role(auth.uid(), 'super_admin') OR 
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'financial_manager') OR
      has_role(auth.uid(), 'accountant') OR
      has_role(auth.uid(), 'inventory_manager')
    )
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_company ON public.approval_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_deleted_records_company ON public.deleted_records(company_id);
CREATE INDEX IF NOT EXISTS idx_period_locks_company ON public.period_locks(company_id);
