-- Create advances table for tracking employee advances/loans
CREATE TABLE public.advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  reason TEXT,
  date_given DATE NOT NULL,
  date_to_deduct DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deducted', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage advances"
ON public.advances
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view advances"
ON public.advances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = advances.employee_id
    AND (e.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_advances_updated_at
BEFORE UPDATE ON public.advances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add advances_deducted column to payroll_items
ALTER TABLE public.payroll_items
ADD COLUMN advances_deducted NUMERIC DEFAULT 0;