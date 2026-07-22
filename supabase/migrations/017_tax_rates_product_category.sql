-- Add product/category scoped tax assignment
ALTER TABLE tax_rates
  ADD COLUMN product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL;

-- Ensure a tax rate targets exactly one scope
ALTER TABLE tax_rates
  ADD CONSTRAINT tax_rate_single_scope CHECK (
    (applies_to_all::int)
    + (product_id IS NOT NULL)::int
    + (category_id IS NOT NULL)::int
    = 1
  );

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_tax_rates_product
  ON tax_rates (organization_id, product_id);

CREATE INDEX IF NOT EXISTS idx_tax_rates_category
  ON tax_rates (organization_id, category_id);
