-- ============================================
-- Database Organization & Navigation Migration
-- Creates views and indexes for easy Steam ID-based navigation
-- ============================================

-- ============================================
-- 1. USER ACTIVITY SUMMARY VIEW
-- ============================================
-- Complete user activity overview connected via Steam ID
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  u.steam_id,
  u.persona_name,
  u.avatar_url,
  u.profile_url,
  u.trade_url,
  u.created_at as account_created_at,
  u.last_login_at,
  u.auth_user_id,
  -- Offer statistics
  COUNT(DISTINCT o.id) as total_offers,
  COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) as active_offers,
  COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_offers,
  COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_offers,
  SUM(o.views) as total_offer_views,
  -- Trade request statistics
  COUNT(DISTINCT tr_sent.id) as trade_requests_sent,
  COUNT(DISTINCT tr_received.id) as trade_requests_received,
  COUNT(DISTINCT CASE WHEN tr_sent.status = 'pending' THEN tr_sent.id END) as pending_requests_sent,
  COUNT(DISTINCT CASE WHEN tr_received.status = 'pending' THEN tr_received.id END) as pending_requests_received,
  COUNT(DISTINCT CASE WHEN tr_sent.status = 'accepted' THEN tr_sent.id END) as accepted_requests_sent,
  COUNT(DISTINCT CASE WHEN tr_received.status = 'accepted' THEN tr_received.id END) as accepted_requests_received,
  -- Reputation statistics
  COALESCE(r.completion_rate, 0) as completion_rate,
  COALESCE(r.total_votes, 0) as total_reputation_votes,
  COALESCE(r.completed_trades, 0) as completed_trades,
  COALESCE(r.reversed_trades, 0) as reversed_trades,
  -- Recent activity timestamps
  MAX(o.created_at) as last_offer_created_at,
  MAX(tr_sent.created_at) as last_request_sent_at,
  MAX(tr_received.created_at) as last_request_received_at
FROM users u
LEFT JOIN offers o ON u.steam_id = o.user_steam_id AND o.deleted_at IS NULL
LEFT JOIN trade_requests tr_sent ON u.steam_id = tr_sent.requester_steam_id
LEFT JOIN trade_requests tr_received ON u.steam_id = tr_received.offer_owner_steam_id
LEFT JOIN reputation r ON u.steam_id = r.steam_id
GROUP BY u.steam_id, u.persona_name, u.avatar_url, u.profile_url, u.trade_url, 
         u.created_at, u.last_login_at, u.auth_user_id, r.completion_rate, 
         r.total_votes, r.completed_trades, r.reversed_trades;

COMMENT ON VIEW user_activity_summary IS 'Complete user activity overview with all statistics connected via Steam ID';

-- ============================================
-- 2. USER OFFERS DETAILED VIEW
-- ============================================
-- All offers with full user and reputation context
CREATE OR REPLACE VIEW user_offers_detailed AS
SELECT 
  o.*,
  u.steam_id,
  u.persona_name,
  u.avatar_url,
  u.profile_url,
  u.trade_url,
  r.completion_rate,
  r.total_votes as reputation_votes,
  COUNT(DISTINCT ov.id) as unique_viewers_count
FROM offers o
JOIN users u ON o.user_steam_id = u.steam_id
LEFT JOIN reputation r ON u.steam_id = r.steam_id
LEFT JOIN offer_views ov ON o.id = ov.offer_id
WHERE o.deleted_at IS NULL
GROUP BY o.id, u.steam_id, u.persona_name, u.avatar_url, u.profile_url, 
         u.trade_url, r.completion_rate, r.total_votes;

COMMENT ON VIEW user_offers_detailed IS 'All offers with full user profile and reputation context';

-- ============================================
-- 3. USER TRADE REQUESTS DETAILED VIEW
-- ============================================
-- All trade requests with offer and user context
CREATE OR REPLACE VIEW user_trade_requests_detailed AS
SELECT 
  tr.*,
  o.offering,
  o.seeking,
  o.notes as offer_notes,
  o.status as offer_status,
  requester.steam_id as requester_steam_id,
  requester.persona_name as requester_name,
  requester.avatar_url as requester_avatar,
  requester.profile_url as requester_profile_url,
  requester.trade_url as requester_trade_url,
  owner.steam_id as owner_steam_id,
  owner.persona_name as owner_name,
  owner.avatar_url as owner_avatar,
  owner.profile_url as owner_profile_url,
  owner.trade_url as owner_trade_url
FROM trade_requests tr
JOIN offers o ON tr.offer_id = o.id
JOIN users requester ON tr.requester_steam_id = requester.steam_id
JOIN users owner ON tr.offer_owner_steam_id = owner.steam_id;

COMMENT ON VIEW user_trade_requests_detailed IS 'All trade requests with full offer and user context for both requester and owner';

-- ============================================
-- 4. COMPOSITE INDEXES FOR OPTIMIZATION
-- ============================================
-- Optimize common queries filtering by Steam ID + status

-- For finding user's offers by status
CREATE INDEX IF NOT EXISTS idx_offers_user_status 
  ON offers(user_steam_id, status) 
  WHERE deleted_at IS NULL;

-- For finding user's trade requests by status (sent)
CREATE INDEX IF NOT EXISTS idx_trade_requests_requester_status 
  ON trade_requests(requester_steam_id, status);

-- For finding user's trade requests by status (received)
CREATE INDEX IF NOT EXISTS idx_trade_requests_owner_status 
  ON trade_requests(offer_owner_steam_id, status);

-- For finding reputation votes by target and voter
CREATE INDEX IF NOT EXISTS idx_reputation_votes_target_voter 
  ON reputation_votes(target_steam_id, voter_steam_id);

-- ============================================
-- 5. HELPER FUNCTION FOR USER DATA RETRIEVAL
-- ============================================
-- Easy retrieval of complete user data by Steam ID
CREATE OR REPLACE FUNCTION get_user_complete_data(p_steam_id TEXT)
RETURNS TABLE (
  -- User profile
  steam_id TEXT,
  persona_name TEXT,
  avatar_url TEXT,
  profile_url TEXT,
  trade_url TEXT,
  created_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  auth_user_id UUID,
  -- Reputation
  completion_rate DECIMAL,
  total_votes INTEGER,
  completed_trades INTEGER,
  reversed_trades INTEGER,
  -- Statistics
  total_offers BIGINT,
  active_offers BIGINT,
  trade_requests_sent BIGINT,
  trade_requests_received BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.steam_id,
    u.persona_name,
    u.avatar_url,
    u.profile_url,
    u.trade_url,
    u.created_at,
    u.last_login_at,
    u.auth_user_id,
    COALESCE(r.completion_rate, 0),
    COALESCE(r.total_votes, 0),
    COALESCE(r.completed_trades, 0),
    COALESCE(r.reversed_trades, 0),
    (SELECT COUNT(*) FROM offers WHERE user_steam_id = p_steam_id AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM offers WHERE user_steam_id = p_steam_id AND status = 'active' AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM trade_requests WHERE requester_steam_id = p_steam_id),
    (SELECT COUNT(*) FROM trade_requests WHERE offer_owner_steam_id = p_steam_id)
  FROM users u
  LEFT JOIN reputation r ON u.steam_id = r.steam_id
  WHERE u.steam_id = p_steam_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_complete_data IS 'Retrieve complete user data including profile, reputation, and statistics by Steam ID';

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================
-- Grant service role access to views and function
GRANT SELECT ON user_activity_summary TO service_role;
GRANT SELECT ON user_offers_detailed TO service_role;
GRANT SELECT ON user_trade_requests_detailed TO service_role;
GRANT EXECUTE ON FUNCTION get_user_complete_data TO service_role;

-- ============================================
-- 7. VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Database organization migration completed successfully!';
  RAISE NOTICE 'Views created: user_activity_summary, user_offers_detailed, user_trade_requests_detailed';
  RAISE NOTICE 'Indexes created: idx_offers_user_status, idx_trade_requests_requester_status, idx_trade_requests_owner_status, idx_reputation_votes_target_voter';
  RAISE NOTICE 'Function created: get_user_complete_data';
END $$;

