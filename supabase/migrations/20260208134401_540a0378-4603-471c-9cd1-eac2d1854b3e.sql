-- Create products_services table for the catalog
CREATE TABLE public.products_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'service')),
  category TEXT,
  unit_of_measure TEXT DEFAULT 'Unit',
  
  -- Pricing
  selling_price NUMERIC(15, 2) DEFAULT 0,
  cost_price NUMERIC(15, 2) DEFAULT 0,
  
  -- Inventory tracking (for products)
  track_inventory BOOLEAN DEFAULT false,
  quantity_on_hand NUMERIC(15, 2) DEFAULT 0,
  reorder_point NUMERIC(15, 2) DEFAULT 0,
  preferred_vendor_id UUID REFERENCES public.vendors(id),
  
  -- Tax settings
  is_taxable BOOLEAN DEFAULT true,
  tax_rate NUMERIC(5, 2) DEFAULT 16.00,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_lists table for pricing tiers
CREATE TABLE public.price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT DEFAULT 'ZMW',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_list_items for product-specific pricing per list
CREATE TABLE public.price_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products_services(id) ON DELETE CASCADE,
  price NUMERIC(15, 2) NOT NULL,
  discount_percent NUMERIC(5, 2) DEFAULT 0,
  min_quantity NUMERIC(15, 2) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(price_list_id, product_id)
);

-- Create customer_price_lists to assign price lists to customers
CREATE TABLE public.customer_price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, price_list_id)
);

-- Add product_id column to existing stock_movements table
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products_services(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_price_lists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products_services
CREATE POLICY "Users can view products in their company"
  ON public.products_services FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert products in their company"
  ON public.products_services FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update products in their company"
  ON public.products_services FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete products in their company"
  ON public.products_services FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS Policies for price_lists
CREATE POLICY "Users can view price lists in their company"
  ON public.price_lists FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can manage price lists in their company"
  ON public.price_lists FOR ALL
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS Policies for price_list_items
CREATE POLICY "Users can view price list items"
  ON public.price_list_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.price_lists pl 
    WHERE pl.id = price_list_id 
    AND pl.company_id = public.get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can manage price list items"
  ON public.price_list_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.price_lists pl 
    WHERE pl.id = price_list_id 
    AND pl.company_id = public.get_user_company_id(auth.uid())
  ));

-- RLS Policies for customer_price_lists
CREATE POLICY "Users can view customer price lists"
  ON public.customer_price_lists FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_id 
    AND c.company_id = public.get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can manage customer price lists"
  ON public.customer_price_lists FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_id 
    AND c.company_id = public.get_user_company_id(auth.uid())
  ));

-- Create indexes for performance
CREATE INDEX idx_products_services_company ON public.products_services(company_id);
CREATE INDEX idx_products_services_type ON public.products_services(type);
CREATE INDEX idx_products_services_sku ON public.products_services(sku);
CREATE INDEX idx_price_lists_company ON public.price_lists(company_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);

-- Create triggers for updated_at
CREATE TRIGGER update_products_services_updated_at
  BEFORE UPDATE ON public.products_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_lists_updated_at
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_list_items_updated_at
  BEFORE UPDATE ON public.price_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();