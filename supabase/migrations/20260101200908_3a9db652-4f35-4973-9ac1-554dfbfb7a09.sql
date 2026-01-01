-- Create inventory items table
CREATE TABLE public.inventory_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    description TEXT,
    unit_of_measure TEXT DEFAULT 'units',
    quantity_on_hand NUMERIC DEFAULT 0,
    reorder_point NUMERIC DEFAULT 0,
    unit_cost NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage inventory" ON public.inventory_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert inventory" ON public.inventory_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view inventory" ON public.inventory_items FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create stock movements table
CREATE TABLE public.stock_movements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
    quantity NUMERIC NOT NULL,
    reference_number TEXT,
    notes TEXT,
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stock movements" ON public.stock_movements FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert stock movements" ON public.stock_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view stock movements" ON public.stock_movements FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Create bank accounts table
CREATE TABLE public.bank_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT,
    bank_name TEXT NOT NULL,
    branch TEXT,
    account_type TEXT DEFAULT 'checking',
    currency TEXT DEFAULT 'ZMW',
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank accounts" ON public.bank_accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert bank accounts" ON public.bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view bank accounts" ON public.bank_accounts FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create bank transactions table
CREATE TABLE public.bank_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer')),
    amount NUMERIC NOT NULL,
    description TEXT,
    reference_number TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank transactions" ON public.bank_transactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert bank transactions" ON public.bank_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view bank transactions" ON public.bank_transactions FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Create reconciliations table
CREATE TABLE public.reconciliations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    reconciliation_date DATE NOT NULL,
    statement_balance NUMERIC NOT NULL,
    book_balance NUMERIC NOT NULL,
    difference NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reconciliations" ON public.reconciliations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert reconciliations" ON public.reconciliations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view reconciliations" ON public.reconciliations FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_reconciliations_updated_at BEFORE UPDATE ON public.reconciliations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create contractors table
CREATE TABLE public.contractors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    specialty TEXT,
    hourly_rate NUMERIC DEFAULT 0,
    daily_rate NUMERIC DEFAULT 0,
    tpin TEXT,
    bank_name TEXT,
    bank_account_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contractors" ON public.contractors FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert contractors" ON public.contractors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view contractors" ON public.contractors FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_contractors_updated_at BEFORE UPDATE ON public.contractors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create time entries table
CREATE TABLE public.time_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    contractor_id UUID REFERENCES public.contractors(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    project_name TEXT,
    description TEXT,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hours_worked NUMERIC NOT NULL,
    hourly_rate NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage time entries" ON public.time_entries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert time entries" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view time entries" ON public.time_entries FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create chart of accounts table for proper accounting
CREATE TABLE public.chart_of_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_account_id UUID REFERENCES public.chart_of_accounts(id),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, account_code)
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage chart of accounts" ON public.chart_of_accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert chart of accounts" ON public.chart_of_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view chart of accounts" ON public.chart_of_accounts FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create journal entries table
CREATE TABLE public.journal_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number TEXT,
    description TEXT,
    is_posted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage journal entries" ON public.journal_entries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert journal entries" ON public.journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view journal entries" ON public.journal_entries FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create journal entry lines table
CREATE TABLE public.journal_entry_lines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
    debit_amount NUMERIC DEFAULT 0,
    credit_amount NUMERIC DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage journal entry lines" ON public.journal_entry_lines FOR ALL USING (
    EXISTS (SELECT 1 FROM journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND has_role(auth.uid(), 'admin'::app_role))
);
CREATE POLICY "Users can view journal entry lines" ON public.journal_entry_lines FOR SELECT USING (
    EXISTS (SELECT 1 FROM journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND ((je.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
);