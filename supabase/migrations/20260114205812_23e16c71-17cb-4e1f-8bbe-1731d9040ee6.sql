-- Fix employees table RLS policies to restrict sensitive data access to privileged roles only

-- Drop existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view employees in their company" ON public.employees;

-- Create policy for privileged users who can view all employee data (HR, Admin, Accountant, Super Admin, Financial Manager)
CREATE POLICY "Privileged users can view all employees"
ON public.employees FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid()) AND
  (has_role(auth.uid(), 'hr_manager') OR 
   has_role(auth.uid(), 'admin') OR 
   has_role(auth.uid(), 'accountant') OR
   has_role(auth.uid(), 'super_admin') OR
   has_role(auth.uid(), 'financial_manager'))
);

-- Create policy for regular users to view their own employee record only (by matching email)
CREATE POLICY "Users can view their own employee record"
ON public.employees FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid()) AND
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);