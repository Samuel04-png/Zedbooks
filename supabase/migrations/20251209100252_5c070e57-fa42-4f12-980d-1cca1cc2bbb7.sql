-- Create company_settings table for logo and other settings
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'My Organization',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_settings
CREATE POLICY "Users can view their own company settings" 
ON public.company_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company settings" 
ON public.company_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company settings" 
ON public.company_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create payroll_additions table for earnings, bonuses, overtime, advances per payroll run
CREATE TABLE public.payroll_additions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'earning', 'bonus', 'overtime', 'advance'
  name TEXT NOT NULL, -- e.g., 'Commission', 'Performance Bonus', 'Overtime Hours'
  amount NUMERIC NOT NULL,
  -- For advances only
  total_amount NUMERIC, -- Original advance amount
  months_to_pay INTEGER, -- Number of months to repay
  monthly_deduction NUMERIC, -- Calculated monthly deduction
  remaining_balance NUMERIC, -- Remaining balance after this payroll
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payroll_additions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage payroll additions" 
ON public.payroll_additions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM payroll_runs pr 
    WHERE pr.id = payroll_additions.payroll_run_id 
    AND has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users can view payroll additions" 
ON public.payroll_additions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM payroll_runs pr 
    WHERE pr.id = payroll_additions.payroll_run_id 
    AND (pr.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true);

-- Storage policies for company logos
CREATE POLICY "Anyone can view company logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-logos');

CREATE POLICY "Users can upload their own company logo" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own company logo" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own company logo" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();