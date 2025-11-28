// Database utilities for proper table-based operations
// This replaces the KV store approach with proper SQL queries

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Initialize Supabase client with service role (bypasses RLS, but we control access in backend)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

export const db = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================
// USER OPERATIONS
// ============================================

export interface User {
  steam_id: string;
  persona_name: string;
  avatar_url: string | null;
  profile_url: string | null;
  trade_url: string | null;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

/**
 * Create or update a user
 */
export async function upsertUser(user: User): Promise<User> {
  const { data, error } = await db
    .from('users')
    .upsert({
      steam_id: user.steam_id,
      persona_name: user.persona_name,
      avatar_url: user.avatar_url,
      profile_url: user.profile_url,
      trade_url: user.trade_url,
      last_login_at: new Date().toISOString(),
    }, {
      onConflict: 'steam_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting user:', error);
    throw new Error(`Failed to upsert user: ${error.message}`);
  }

  return data;
}

/**
 * Get user by Steam ID
 */
export async function getUser(steamId: string): Promise<User | null> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('steam_id', steamId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return null;
    }
    console.error('Error getting user:', error);
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data;
}

/**
 * Update user's trade URL
 */
export async function updateTradeUrl(steamId: string, tradeUrl: string): Promise<void> {
  const { error } = await db
    .from('users')
    .update({ trade_url: tradeUrl })
    .eq('steam_id', steamId);

  if (error) {
    console.error('Error updating trade URL:', error);
    throw new Error(`Failed to update trade URL: ${error.message}`);
  }
}

/**
 * Get user with reputation stats
 */
export async function getUserWithReputation(steamId: string): Promise<any> {
  const { data, error } = await db
    .from('users')
    .select(`
      *,
      reputation (
        completed_trades,
        reversed_trades,
        total_votes,
        completion_rate
      )
    `)
    .eq('steam_id', steamId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get user with reputation: ${error.message}`);
  }

  return data;
}

// ============================================
// SESSION OPERATIONS
// ============================================

export interface Session {
  id: string;
  steam_id: string;
  expires_at: string;
  created_at?: string;
  last_active_at?: string;
  ip_address?: string | null;
  user_agent?: string | null;
  fingerprint?: string | null;
}

/**
 * Create a new session
 */
export async function createSession(
  steamId: string, 
  expiresAt: Date,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    fingerprint?: string;
  }
): Promise<Session> {
  const { data, error } = await db
    .from('sessions')
    .insert({
      steam_id: steamId,
      expires_at: expiresAt.toISOString(),
      ip_address: metadata?.ipAddress,
      user_agent: metadata?.userAgent,
      fingerprint: metadata?.fingerprint,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating session:', error);
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error getting session:', error);
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return data;
}

/**
 * Update session activity
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  const { error } = await db
    .from('sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    console.error('Error updating session activity:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Delete session (logout)
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await db
    .from('sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('Error deleting session:', error);
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(steamId: string): Promise<void> {
  const { error } = await db
    .from('sessions')
    .delete()
    .eq('steam_id', steamId);

  if (error) {
    console.error('Error deleting user sessions:', error);
    throw new Error(`Failed to delete sessions: ${error.message}`);
  }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const { data, error } = await db.rpc('cleanup_expired_sessions');

  if (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }

  return data || 0;
}

// ============================================
// OFFER OPERATIONS
// ============================================

export interface Offer {
  id: string;
  user_steam_id: string;
  offering: any[];
  seeking: any[];
  notes: string | null;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  views: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OfferWithUser extends Offer {
  user: {
    persona_name: string;
    avatar_url: string | null;
    profile_url: string | null;
    steam_id: string;
  };
  reputation: {
    completion_rate: number;
    total_votes: number;
  } | null;
}

/**
 * Create a new offer
 */
export async function createOffer(
  steamId: string,
  offering: any[],
  seeking: any[],
  notes?: string
): Promise<Offer> {
  const { data, error } = await db
    .from('offers')
    .insert({
      user_steam_id: steamId,
      offering,
      seeking,
      notes: notes || null,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating offer:', error);
    throw new Error(`Failed to create offer: ${error.message}`);
  }

  return data;
}

/**
 * Get offer by ID
 */
export async function getOffer(offerId: string): Promise<Offer | null> {
  const { data, error } = await db
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error getting offer:', error);
    throw new Error(`Failed to get offer: ${error.message}`);
  }

  return data;
}

/**
 * Get offer with user and reputation data
 */
export async function getOfferWithUser(offerId: string): Promise<OfferWithUser | null> {
  const { data, error } = await db
    .from('offers')
    .select(`
      *,
      user:users!user_steam_id (
        steam_id,
        persona_name,
        avatar_url,
        profile_url
      ),
      reputation:reputation!user_steam_id (
        completion_rate,
        total_votes
      )
    `)
    .eq('id', offerId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error getting offer with user:', error);
    throw new Error(`Failed to get offer: ${error.message}`);
  }

  // Transform data to match interface
  return {
    ...data,
    user: Array.isArray(data.user) ? data.user[0] : data.user,
    reputation: Array.isArray(data.reputation) ? data.reputation[0] : data.reputation,
  } as OfferWithUser;
}

/**
 * Get all offers with pagination and filtering
 */
export async function getOffers(options: {
  limit?: number;
  offset?: number;
  status?: string;
  steamId?: string;
  sortBy?: 'created_at' | 'views';
  sortOrder?: 'asc' | 'desc';
}): Promise<{ offers: OfferWithUser[]; total: number }> {
  const {
    limit = 50,
    offset = 0,
    status = 'active',
    steamId,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  // Build query
  let query = db
    .from('offers')
    .select(`
      *,
      user:users!user_steam_id (
        steam_id,
        persona_name,
        avatar_url,
        profile_url
      ),
      reputation:reputation!user_steam_id (
        completion_rate,
        total_votes
      )
    `, { count: 'exact' })
    .is('deleted_at', null);

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }

  if (steamId) {
    query = query.eq('user_steam_id', steamId);
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error getting offers:', error);
    throw new Error(`Failed to get offers: ${error.message}`);
  }

  // Transform data
  const offers = (data || []).map(offer => ({
    ...offer,
    user: Array.isArray(offer.user) ? offer.user[0] : offer.user,
    reputation: Array.isArray(offer.reputation) ? offer.reputation[0] : offer.reputation,
  })) as OfferWithUser[];

  return {
    offers,
    total: count || 0,
  };
}

/**
 * Update offer
 */
export async function updateOffer(
  offerId: string,
  updates: {
    offering?: any[];
    seeking?: any[];
    notes?: string;
    status?: string;
  }
): Promise<Offer> {
  const { data, error } = await db
    .from('offers')
    .update(updates)
    .eq('id', offerId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    console.error('Error updating offer:', error);
    throw new Error(`Failed to update offer: ${error.message}`);
  }

  return data;
}

/**
 * Soft delete offer
 */
export async function deleteOffer(offerId: string): Promise<void> {
  const { error } = await db
    .from('offers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', offerId);

  if (error) {
    console.error('Error deleting offer:', error);
    throw new Error(`Failed to delete offer: ${error.message}`);
  }
}

/**
 * Record offer view
 */
export async function recordOfferView(
  offerId: string,
  viewerSteamId: string | null,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
  }
): Promise<void> {
  const { error } = await db
    .from('offer_views')
    .insert({
      offer_id: offerId,
      viewer_steam_id: viewerSteamId,
      ip_address: metadata?.ipAddress,
      user_agent: metadata?.userAgent,
      referrer: metadata?.referrer,
    });

  if (error) {
    // Ignore duplicate view errors (unique constraint)
    if (error.code !== '23505') {
      console.error('Error recording offer view:', error);
    }
  }
}

// ============================================
// TRADE REQUEST OPERATIONS
// ============================================

export interface TradeRequest {
  id: string;
  offer_id: string;
  requester_steam_id: string;
  offer_owner_steam_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  responded_at: string | null;
}

export interface TradeRequestWithDetails extends TradeRequest {
  requester: User;
  offer: Offer;
}

/**
 * Create trade request
 */
export async function createTradeRequest(
  offerId: string,
  requesterSteamId: string,
  offerOwnerSteamId: string,
  message?: string
): Promise<TradeRequest> {
  const { data, error } = await db
    .from('trade_requests')
    .insert({
      offer_id: offerId,
      requester_steam_id: requesterSteamId,
      offer_owner_steam_id: offerOwnerSteamId,
      message: message || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating trade request:', error);
    throw new Error(`Failed to create trade request: ${error.message}`);
  }

  return data;
}

/**
 * Get trade request by ID
 */
export async function getTradeRequest(requestId: string): Promise<TradeRequest | null> {
  const { data, error } = await db
    .from('trade_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error getting trade request:', error);
    throw new Error(`Failed to get trade request: ${error.message}`);
  }

  return data;
}

/**
 * Get trade requests for a user (sent or received)
 */
export async function getTradeRequests(steamId: string, type: 'sent' | 'received'): Promise<TradeRequestWithDetails[]> {
  const column = type === 'sent' ? 'requester_steam_id' : 'offer_owner_steam_id';

  const { data, error } = await db
    .from('trade_requests')
    .select(`
      *,
      requester:users!requester_steam_id (*),
      offer:offers (*)
    `)
    .eq(column, steamId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting trade requests:', error);
    throw new Error(`Failed to get trade requests: ${error.message}`);
  }

  return (data || []).map(req => ({
    ...req,
    requester: Array.isArray(req.requester) ? req.requester[0] : req.requester,
    offer: Array.isArray(req.offer) ? req.offer[0] : req.offer,
  })) as TradeRequestWithDetails[];
}

/**
 * Update trade request status
 */
export async function updateTradeRequestStatus(
  requestId: string,
  status: 'accepted' | 'rejected' | 'completed' | 'cancelled'
): Promise<TradeRequest> {
  const { data, error } = await db
    .from('trade_requests')
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    console.error('Error updating trade request:', error);
    throw new Error(`Failed to update trade request: ${error.message}`);
  }

  return data;
}

// ============================================
// REPUTATION OPERATIONS
// ============================================

export interface Reputation {
  steam_id: string;
  completed_trades: number;
  reversed_trades: number;
  total_votes: number;
  completion_rate: number;
  updated_at: string;
}

/**
 * Get user reputation
 */
export async function getReputation(steamId: string): Promise<Reputation | null> {
  const { data, error } = await db
    .from('reputation')
    .select('*')
    .eq('steam_id', steamId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error getting reputation:', error);
    throw new Error(`Failed to get reputation: ${error.message}`);
  }

  return data;
}

/**
 * Cast or update a reputation vote
 */
export async function castReputationVote(
  targetSteamId: string,
  voterSteamId: string,
  voteType: 'completed' | 'reversed',
  tradeRequestId?: string
): Promise<void> {
  const { error } = await db
    .from('reputation_votes')
    .upsert({
      target_steam_id: targetSteamId,
      voter_steam_id: voterSteamId,
      vote_type: voteType,
      trade_request_id: tradeRequestId || null,
    }, {
      onConflict: 'target_steam_id,voter_steam_id',
    });

  if (error) {
    console.error('Error casting reputation vote:', error);
    throw new Error(`Failed to cast vote: ${error.message}`);
  }

  // Trigger will automatically update reputation table
}

/**
 * Get user's vote for a target
 */
export async function getUserVote(voterSteamId: string, targetSteamId: string): Promise<{ vote_type: string } | null> {
  const { data, error } = await db
    .from('reputation_votes')
    .select('vote_type')
    .eq('voter_steam_id', voterSteamId)
    .eq('target_steam_id', targetSteamId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error getting user vote:', error);
    return null;
  }

  return data;
}

// ============================================
// RATE LIMITING
// ============================================

/**
 * Check and increment rate limit
 * Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  // Try to get existing rate limit record
  const { data: existing } = await db
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .gt('expires_at', now.toISOString())
    .single();

  if (existing) {
    // Check if limit exceeded
    if (existing.count >= maxRequests) {
      return false; // Rate limited
    }

    // Increment counter
    await db
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id);

    return true; // Allowed
  }

  // Create new rate limit record
  await db
    .from('rate_limits')
    .insert({
      key,
      count: 1,
      window_start: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

  return true; // Allowed
}

/**
 * Cleanup expired rate limits
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const { data, error } = await db.rpc('cleanup_expired_rate_limits');

  if (error) {
    console.error('Error cleaning up rate limits:', error);
    return 0;
  }

  return data || 0;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Execute raw SQL query (use sparingly)
 */
export async function executeRawQuery(query: string, params?: any[]): Promise<any> {
  const { data, error } = await db.rpc('exec', { query, params });

  if (error) {
    console.error('Error executing raw query:', error);
    throw new Error(`Query failed: ${error.message}`);
  }

  return data;
}

/**
 * Health check - verify database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const { error } = await db.from('users').select('steam_id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
