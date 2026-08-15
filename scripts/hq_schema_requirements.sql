-- Cervos HQ Console - Supabase Schema Setup
-- Run this SQL in Supabase Dashboard > SQL Editor to create all missing tables and columns
-- Also create the storage bucket: Supabase Dashboard > Storage > New Bucket > Name: "app-releases" (private)

-- ============================================
-- MISSING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_name TEXT,
  phone TEXT,
  region TEXT,
  role TEXT,
  tech_comfort TEXT,
  goals TEXT[],
  onboarding_completed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_monthly_tzs NUMERIC NOT NULL DEFAULT 0,
  price_annual_tzs NUMERIC NOT NULL DEFAULT 0,
  max_branches INTEGER NOT NULL DEFAULT 1,
  max_operators INTEGER NOT NULL DEFAULT 5,
  features TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount_tzs NUMERIC NOT NULL,
  reference TEXT NOT NULL,
  note TEXT,
  status TEXT DEFAULT 'paid',
  recorded_by_hq_admin_id UUID REFERENCES hq_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID REFERENCES quote_requests(id),
  invite_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  invited_by_hq_admin_id UUID REFERENCES hq_admins(id),
  supplier_account_id UUID REFERENCES accounts(id),
  status TEXT DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_quote_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  expected_branches INTEGER,
  annual_volume TEXT,
  current_supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quote_request_id, account_id)
);

CREATE TABLE IF NOT EXISTS news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image_url TEXT,
  author_name TEXT,
  category TEXT DEFAULT 'Company',
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  version TEXT NOT NULL,
  release_notes TEXT,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MISSING COLUMNS ON EXISTING TABLES
-- ============================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_plan UUID REFERENCES subscription_plans(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ltv NUMERIC DEFAULT 0;

ALTER TABLE branches ADD COLUMN IF NOT EXISTS locked_manually_at TIMESTAMPTZ;

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS expected_branches INTEGER;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS current_supplier TEXT;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS annual_volume TEXT;

ALTER TABLE hq_admins ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';
ALTER TABLE hq_admins ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT false;
ALTER TABLE hq_admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- ============================================
-- RLS POLICIES (allow service role full access)
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quote_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_releases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RPC FUNCTION: set_current_release
-- ============================================

CREATE OR REPLACE FUNCTION set_current_release(p_release_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE app_releases
  SET is_current = false
  WHERE platform = (SELECT platform FROM app_releases WHERE id = p_release_id)
    AND is_current = true;
  UPDATE app_releases
  SET is_current = true
  WHERE id = p_release_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SEED DEFAULT NEWS CATEGORIES
-- ============================================

INSERT INTO news_categories (name, slug) VALUES
  ('Product Updates', 'product-updates'),
  ('Industry News', 'industry-news'),
  ('Regulatory', 'regulatory'),
  ('Company', 'company')
ON CONFLICT DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_account_id ON user_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_branches_account_id ON branches(account_id);
CREATE INDEX IF NOT EXISTS idx_operators_branch_id ON operators(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_branch_id ON activity_log(branch_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_status ON supplier_invites(status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_account_id ON billing_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_published ON news_posts(published);
CREATE INDEX IF NOT EXISTS idx_app_releases_platform ON app_releases(platform);
