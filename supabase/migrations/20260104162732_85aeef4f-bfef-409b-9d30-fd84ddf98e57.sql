-- Create project_expenses table for tracking project/grant spending
CREATE TABLE public.project_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own project expenses"
ON public.project_expenses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project expenses"
ON public.project_expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project expenses"
ON public.project_expenses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project expenses"
ON public.project_expenses FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_project_expenses_updated_at
BEFORE UPDATE ON public.project_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update project spent amount when expenses change
CREATE OR REPLACE FUNCTION public.update_project_spent()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.projects 
    SET spent = COALESCE((
      SELECT SUM(amount) FROM public.project_expenses WHERE project_id = OLD.project_id
    ), 0)
    WHERE id = OLD.project_id;
    RETURN OLD;
  ELSE
    UPDATE public.projects 
    SET spent = COALESCE((
      SELECT SUM(amount) FROM public.project_expenses WHERE project_id = NEW.project_id
    ), 0)
    WHERE id = NEW.project_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers to auto-update project spent
CREATE TRIGGER update_project_spent_on_insert
AFTER INSERT ON public.project_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_project_spent();

CREATE TRIGGER update_project_spent_on_update
AFTER UPDATE ON public.project_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_project_spent();

CREATE TRIGGER update_project_spent_on_delete
AFTER DELETE ON public.project_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_project_spent();