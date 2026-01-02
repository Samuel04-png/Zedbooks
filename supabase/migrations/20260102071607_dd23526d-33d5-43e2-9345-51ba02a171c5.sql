-- Update the app_role enum to include more accounting-specific roles
-- First, add the new roles to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bookkeeper';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inventory_manager';

-- Note: We already have hr_manager which covers HR for payroll
-- We already have admin, finance_officer which can be used

-- Update the handle_new_user function to assign super_admin to first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, organization_name, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'organization_name', 'My Organization'),
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  
  -- Assign super_admin role to first user, otherwise bookkeeper (lowest access)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'read_only');
  END IF;
  
  RETURN new;
END;
$$;