-- ============================================
-- CS Trading Hub - Production Database Schema
-- Migration 001: Initial Schema Creation
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
  steam_id TEXT PRIMARY KEY,
  persona_name TEXT NOT NULL,
  avatar_url TEXT,
  profile_url TEXT,
  trade_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_steam_id CHECK (steam_id ~ '^\d{17}$'),
  CONSTRAINT valid_trade_url CHECK (
    trade_url IS NULL OR 
    trade_url ~ '^https://steamcommunity\.com/tradeoffer/new/\?partner=\d+&token=[\w-]+$'
  )
);

-- Indexes
CREATE INDEX idx_users_persona_name ON users(persona_name);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_last_login_at ON users(last_login_at DESC);

-- Full-text search on persona name
CREATE INDEX idx_users_persona_name_trgm ON users USING gin(persona_name gin_trgm_ops);

COMMENT ON TABLE users IS 'Steam authenticated users';
COMMENT ON COLUMN users.steam_id IS 'Steam ID64 format (17 digits)';
COMMENT ON COLUMN users.trade_url IS 'Steam trade offer URL with partner ID and token';

-- ============================================
-- 2. SESSIONS TABLE
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  steam_id TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
  
  -- Session data
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Security metadata
  ip_address INET,
  user_agent TEXT,
  fingerprint TEXT, -- Browser fingerprint hash
  
  -- Constraints
  CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX idx_sessions_steam_id ON sessions(steam_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_last_active_at ON sessions(last_active_at DESC);

COMMENT ON TABLE sessions IS 'User authentication sessions';
COMMENT ON COLUMN sessions.fingerprint IS 'Hash of browser fingerprint for session hijacking detection';

-- ============================================
-- 3. OFFERS TABLE
-- ============================================
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_steam_id TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
  
  -- Offer content
  offering JSONB NOT NULL,
  seeking JSONB NOT NULL,
  notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' NOT NULL,
  
  -- Analytics
  views INTEGER DEFAULT 0 NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
  CONSTRAINT valid_offering CHECK (jsonb_array_length(offering) > 0),
  CONSTRAINT valid_seeking CHECK (jsonb_array_length(seeking) > 0),
  CONSTRAINT valid_notes_length CHECK (notes IS NULL OR length(notes) <= 5000),
  CONSTRAINT valid_views CHECK (views >= 0)
);

-- Indexes for performance
CREATE INDEX idx_offers_user_steam_id ON offers(user_steam_id);
CREATE INDEX idx_offers_status ON offers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_offers_created_at ON offers(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_offers_active ON offers(created_at DESC) 
  WHERE status = 'active' AND deleted_at IS NULL;

-- GIN indexes for JSONB searching (find offers by item name)
CREATE INDEX idx_offers_offering_gin ON offers USING gin(offering jsonb_path_ops);
CREATE INDEX idx_offers_seeking_gin ON offers USING gin(seeking jsonb_path_ops);

-- Full-text search on notes
CREATE INDEX idx_offers_notes_trgm ON offers USING gin(notes gin_trgm_ops);

COMMENT ON TABLE offers IS 'Trade offers created by users';
COMMENT ON COLUMN offers.offering IS 'Array of items user is offering (JSONB array)';
COMMENT ON COLUMN offers.seeking IS 'Array of items user is seeking (JSONB array)';
COMMENT ON COLUMN offers.deleted_at IS 'Soft delete timestamp - NULL means active';

-- ============================================
-- 4. OFFER VIEWS TABLE
-- ============================================
CREATE TABLE offer_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  viewer_steam_id TEXT REFERENCES users(steam_id) ON DELETE SET NULL,
  
  -- View metadata
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  
  -- Prevent counting multiple views from same user in short time
  CONSTRAINT unique_recent_view UNIQUE (offer_id, viewer_steam_id, viewed_at)
);

-- Indexes
CREATE INDEX idx_offer_views_offer_id ON offer_views(offer_id);
CREATE INDEX idx_offer_views_viewer_steam_id ON offer_views(viewer_steam_id);
CREATE INDEX idx_offer_views_viewed_at ON offer_views(viewed_at DESC);

COMMENT ON TABLE offer_views IS 'Analytics tracking for offer views';

-- ============================================
-- 5. TRADE REQUESTS TABLE
-- ============================================
CREATE TABLE trade_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  requester_steam_id TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
  offer_owner_steam_id TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
  
  -- Request content
  message TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  CONSTRAINT valid_message_length CHECK (message IS NULL OR length(message) <= 2000),
  CONSTRAINT different_users CHECK (requester_steam_id != offer_owner_steam_id),
  
  -- Prevent duplicate pending requests
  CONSTRAINT unique_pending_request UNIQUE (offer_id, requester_steam_id, status)
);

-- Indexes
CREATE INDEX idx_trade_requests_offer_id ON trade_requests(offer_id);
CREATE INDEX idx_trade_requests_requester_steam_id ON trade_requests(requester_steam_id);
CREATE INDEX idx_trade_requests_offer_owner_steam_id ON trade_requests(offer_owner_steam_id);
CREATE INDEX idx_trade_requests_status ON trade_requests(status);
CREATE INDEX idx_trade_requests_created_at ON trade_requests(created_at DESC);

COMMENT ON TABLE trade_requests IS 'Trade requests sent by users for specific offers';
COMMENT ON CONSTRAINT different_users ON trade_requests IS 'User cannot request their own offer';

-- ============================================
-- 6. REPUTATION TABLE
-- ============================================
CREATE TABLE reputation (
  steam_id TEXT PRIMARY KEY REFERENCES users(steam_id) ON DELETE CASCADE,
  
  -- Reputation stats
  completed_trades INTEGER DEFAULT 0 NOT NULL,
  reversed_trades INTEGER DEFAULT 0 NOT NULL,
  total_votes INTEGER DEFAULT 0 NOT NULL,
  completion_rate DECIMAL(5,2) DEFAULT 0 NOT NULL,
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_completed_trades CHECK (completed_trades >= 0),
  CONSTRAINT valid_reversed_trades CHECK (reversed_trades >= 0),
  CONSTRAINT valid_total_votes CHECK (total_votes >= 0),
  CONSTRAINT valid_completion_rate CHECK (completion_rate >= 0 AND completion_rate <= 100),
  CONSTRAINT votes_sum CHECK (total_votes = completed_trades + reversed_trades)
);

-- Index
CREATE INDEX idx_reputation_completion_rate ON reputation(completion_rate DESC);
CREATE INDEX idx_reputation_total_votes ON reputation(total_votes DESC);

COMMENT ON TABLE reputation IS 'Aggregated reputation statistics per user';
COMMENT ON COLUMN reputation.completion_rate IS 'Percentage of completed trades (0-100)';

-- ============================================
-- 7. REPUTATION VOTES TABLE
-- ============================================
CREATE TABLE reputation_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_steam_id TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
  voter_steam_id TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
  trade_request_id UUID REFERENCES trade_requests(id) ON DELETE SET NULL,
  
  -- Vote data
  vote_type TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_vote_type CHECK (vote_type IN ('completed', 'reversed')),
  CONSTRAINT different_users CHECK (target_steam_id != voter_steam_id),
  
  -- One vote per voter per target (can update vote type)
  CONSTRAINT unique_vote UNIQUE (target_steam_id, voter_steam_id)
);

-- Indexes
CREATE INDEX idx_reputation_votes_target_steam_id ON reputation_votes(target_steam_id);
CREATE INDEX idx_reputation_votes_voter_steam_id ON reputation_votes(voter_steam_id);
CREATE INDEX idx_reputation_votes_trade_request_id ON reputation_votes(trade_request_id);
CREATE INDEX idx_reputation_votes_created_at ON reputation_votes(created_at DESC);

COMMENT ON TABLE reputation_votes IS 'Individual reputation votes from users';
COMMENT ON CONSTRAINT unique_vote ON reputation_votes IS 'Each user can only vote once per target';

-- ============================================
-- 8. RATE LIMITING TABLE
-- ============================================
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Rate limit key (e.g., "offers:create:76561198...")
  key TEXT NOT NULL,
  
  -- Tracking
  count INTEGER DEFAULT 1 NOT NULL,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Constraints
  CONSTRAINT unique_key UNIQUE (key)
);

-- Index
CREATE INDEX idx_rate_limits_key ON rate_limits(key);
CREATE INDEX idx_rate_limits_expires_at ON rate_limits(expires_at);

COMMENT ON TABLE rate_limits IS 'Rate limiting buckets for API endpoints';

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at 
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at 
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trade_requests_updated_at 
  BEFORE UPDATE ON trade_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reputation_updated_at 
  BEFORE UPDATE ON reputation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reputation_votes_updated_at 
  BEFORE UPDATE ON reputation_votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-increment offer views when inserting view record
CREATE OR REPLACE FUNCTION increment_offer_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE offers 
  SET views = views + 1 
  WHERE id = NEW.offer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_offer_views_trigger
  AFTER INSERT ON offer_views
  FOR EACH ROW EXECUTE FUNCTION increment_offer_views();

-- Update reputation statistics automatically
CREATE OR REPLACE FUNCTION update_reputation_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
BEGIN
  -- Determine which steam_id to update
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.target_steam_id;
  ELSE
    target_id := NEW.target_steam_id;
  END IF;

  -- Upsert reputation record
  INSERT INTO reputation (steam_id, completed_trades, reversed_trades, total_votes, completion_rate)
  VALUES (
    target_id,
    (SELECT COUNT(*) FROM reputation_votes WHERE target_steam_id = target_id AND vote_type = 'completed'),
    (SELECT COUNT(*) FROM reputation_votes WHERE target_steam_id = target_id AND vote_type = 'reversed'),
    (SELECT COUNT(*) FROM reputation_votes WHERE target_steam_id = target_id),
    0 -- Will be updated below
  )
  ON CONFLICT (steam_id) DO UPDATE SET
    completed_trades = (SELECT COUNT(*) FROM reputation_votes WHERE target_steam_id = target_id AND vote_type = 'completed'),
    reversed_trades = (SELECT COUNT(*) FROM reputation_votes WHERE target_steam_id = target_id AND vote_type = 'reversed'),
    total_votes = (SELECT COUNT(*) FROM reputation_votes WHERE target_steam_id = target_id);
  
  -- Update completion rate
  UPDATE reputation SET
    completion_rate = CASE 
      WHEN total_votes > 0 THEN ROUND((completed_trades::DECIMAL / total_votes * 100), 2)
      ELSE 0
    END
  WHERE steam_id = target_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reputation_votes_insert_trigger
  AFTER INSERT ON reputation_votes
  FOR EACH ROW EXECUTE FUNCTION update_reputation_stats();

CREATE TRIGGER reputation_votes_update_trigger
  AFTER UPDATE ON reputation_votes
  FOR EACH ROW EXECUTE FUNCTION update_reputation_stats();

CREATE TRIGGER reputation_votes_delete_trigger
  AFTER DELETE ON reputation_votes
  FOR EACH ROW EXECUTE FUNCTION update_reputation_stats();

-- Cleanup expired sessions (call manually or via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired rate limits
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role (backend) has full access
CREATE POLICY "service_full_access_users" ON users 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_sessions" ON sessions 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_offers" ON offers 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_offer_views" ON offer_views 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_trade_requests" ON trade_requests 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_reputation" ON reputation 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_reputation_votes" ON reputation_votes 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_access_rate_limits" ON rate_limits 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Block all anonymous access (force through backend)
CREATE POLICY "block_anon_users" ON users 
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "block_anon_sessions" ON sessions 
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "block_anon_offers" ON offers 
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "block_anon_offer_views" ON offer_views 
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "block_anon_trade_requests" ON trade_requests 
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "block_anon_reputation" ON reputation 
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "block_anon_reputation_votes" ON reputation_votes 
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "block_anon_rate_limits" ON rate_limits 
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Grant necessary permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active offers with user info
CREATE OR REPLACE VIEW active_offers_with_users AS
SELECT 
  o.*,
  u.persona_name,
  u.avatar_url,
  u.profile_url,
  r.completion_rate,
  r.total_votes
FROM offers o
JOIN users u ON o.user_steam_id = u.steam_id
LEFT JOIN reputation r ON u.steam_id = r.steam_id
WHERE o.status = 'active' AND o.deleted_at IS NULL;

-- User statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
  u.steam_id,
  u.persona_name,
  u.avatar_url,
  COUNT(DISTINCT o.id) as total_offers,
  COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) as active_offers,
  COUNT(DISTINCT tr.id) as total_requests_sent,
  COUNT(DISTINCT tro.id) as total_requests_received,
  COALESCE(r.completion_rate, 0) as completion_rate,
  COALESCE(r.total_votes, 0) as total_reputation_votes
FROM users u
LEFT JOIN offers o ON u.steam_id = o.user_steam_id AND o.deleted_at IS NULL
LEFT JOIN trade_requests tr ON u.steam_id = tr.requester_steam_id
LEFT JOIN trade_requests tro ON u.steam_id = tro.offer_owner_steam_id
LEFT JOIN reputation r ON u.steam_id = r.steam_id
GROUP BY u.steam_id, u.persona_name, u.avatar_url, r.completion_rate, r.total_votes;

GRANT SELECT ON active_offers_with_users TO service_role;
GRANT SELECT ON user_statistics TO service_role;

-- ============================================
-- INITIAL DATA & CONSTRAINTS
-- ============================================

-- Create indexes concurrently for large tables (if needed later)
-- CREATE INDEX CONCURRENTLY idx_name ON table(column);

COMMENT ON SCHEMA public IS 'CS Trading Hub production schema v1.0';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verification queries
DO $$
BEGIN
  RAISE NOTICE 'Migration 001 completed successfully!';
  RAISE NOTICE 'Tables created: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE');
  RAISE NOTICE 'Indexes created: %', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public');
  RAISE NOTICE 'RLS enabled on all tables: %', (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true);
END $$;