-- ============================================
-- JUNGLEFY: Plant Catalog
-- ============================================

-- ============================================
-- PLANT CATALOG TABLE (Global, shared across tenants)
-- ============================================

CREATE TABLE plant_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  botanical_name VARCHAR(255) NOT NULL UNIQUE,
  common_names JSONB DEFAULT '[]',
  species VARCHAR(255),
  category VARCHAR(100),
  plant_type VARCHAR(20) CHECK (plant_type IN ('indoor', 'outdoor', 'both')),
  light_requirement VARCHAR(30) CHECK (light_requirement IN ('low', 'medium', 'bright_indirect', 'direct_sun')),
  water_frequency VARCHAR(20) CHECK (water_frequency IN ('rare', 'weekly', 'frequent', 'daily')),
  difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'expert')),
  pet_friendly BOOLEAN DEFAULT false,
  air_purifying BOOLEAN DEFAULT false,
  growth_rate VARCHAR(20) CHECK (growth_rate IN ('slow', 'moderate', 'fast')),
  max_height_cm INTEGER,
  bloom_season JSONB DEFAULT '[]',
  fragrant BOOLEAN DEFAULT false,
  origin VARCHAR(255),
  origin_country VARCHAR(100),
  is_hybrid BOOLEAN DEFAULT false,
  has_iridescent_leaves BOOLEAN DEFAULT false,
  care_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plant_catalog_botanical_name ON plant_catalog(botanical_name);
CREATE INDEX idx_plant_catalog_species ON plant_catalog(species);
CREATE INDEX idx_plant_catalog_category ON plant_catalog(category);
CREATE INDEX idx_plant_catalog_plant_type ON plant_catalog(plant_type);
CREATE INDEX idx_plant_catalog_light ON plant_catalog(light_requirement);
CREATE INDEX idx_plant_catalog_difficulty ON plant_catalog(difficulty_level);
CREATE INDEX idx_plant_catalog_pet_friendly ON plant_catalog(pet_friendly) WHERE pet_friendly = true;
CREATE INDEX idx_plant_catalog_air_purifying ON plant_catalog(air_purifying) WHERE air_purifying = true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE plant_catalog ENABLE ROW LEVEL SECURITY;

-- Plant catalog is readable by all authenticated users (shared data)
CREATE POLICY "plant_catalog_select" ON plant_catalog
  FOR SELECT USING (true);

-- Only Supabase service role can insert/update/delete plant catalog entries
-- No INSERT/UPDATE/DELETE policies = only service_role can modify

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER plant_catalog_updated_at
  BEFORE UPDATE ON plant_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
