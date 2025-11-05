-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  employee_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  position TEXT,
  basic_salary DECIMAL(15,2) NOT NULL,
  housing_allowance DECIMAL(15,2) DEFAULT 0,
  transport_allowance DECIMAL(15,2) DEFAULT 0,
  other_allowances DECIMAL(15,2) DEFAULT 0,
  napsa_number TEXT,
  nhima_number TEXT,
  tpin TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_branch TEXT,
  employment_date DATE NOT NULL,
  employment_status TEXT DEFAULT 'active' CHECK (employment_status IN ('active', 'suspended', 'terminated')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payroll_runs table
CREATE TABLE public.payroll_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  run_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  total_gross DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  total_net DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payroll_items table
CREATE TABLE public.payroll_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  basic_salary DECIMAL(15,2) NOT NULL,
  housing_allowance DECIMAL(15,2) DEFAULT 0,
  transport_allowance DECIMAL(15,2) DEFAULT 0,
  other_allowances DECIMAL(15,2) DEFAULT 0,
  gross_salary DECIMAL(15,2) NOT NULL,
  napsa_employee DECIMAL(15,2) DEFAULT 0,
  napsa_employer DECIMAL(15,2) DEFAULT 0,
  nhima_employee DECIMAL(15,2) DEFAULT 0,
  nhima_employer DECIMAL(15,2) DEFAULT 0,
  paye DECIMAL(15,2) DEFAULT 0,
  other_deductions DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) NOT NULL,
  net_salary DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Users can view employees in their organization"
  ON public.employees FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert employees"
  ON public.employees FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update employees"
  ON public.employees FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for payroll_runs
CREATE POLICY "Users can view payroll runs in their organization"
  ON public.payroll_runs FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage payroll runs"
  ON public.payroll_runs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for payroll_items
CREATE POLICY "Users can view payroll items"
  ON public.payroll_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      WHERE pr.id = payroll_items.payroll_run_id
      AND (pr.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Admins can manage payroll items"
  ON public.payroll_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      WHERE pr.id = payroll_items.payroll_run_id
      AND has_role(auth.uid(), 'admin')
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();