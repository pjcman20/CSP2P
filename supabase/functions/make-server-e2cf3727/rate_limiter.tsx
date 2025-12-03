// Rate limiting middleware using Supabase database
// Prevents API abuse, spam, and DoS attacks

import { Context } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Rate limit configurations (requests per time window)
export const RATE_LIMITS = {
  // Offer operations
  CREATE_OFFER: { maxRequests: 10, windowSeconds: 3600 }, // 10 per hour
  UPDATE_OFFER: { maxRequests: 20, windowSeconds: 3600 }, // 20 per hour
  DELETE_OFFER: { maxRequests: 20, windowSeconds: 3600 }, // 20 per hour
  
  // Trade requests
  CREATE_REQUEST: { maxRequests: 20, windowSeconds: 3600 }, // 20 per hour
  UPDATE_REQUEST: { maxRequests: 50, windowSeconds: 3600 }, // 50 per hour
  
  // Reputation
  VOTE_REPUTATION: { maxRequests: 50, windowSeconds: 86400 }, // 50 per day
  
  // Profile updates
  UPDATE_PROFILE: { maxRequests: 10, windowSeconds: 3600 }, // 10 per hour
  
  // General API (fallback)
  GENERAL_API: { maxRequests: 100, windowSeconds: 60 }, // 100 per minute
};

/**
 * Check and enforce rate limit for a specific operation
 * @param identifier - Unique identifier (usually steamId or IP)
 * @param operation - Operation name (e.g., 'CREATE_OFFER')
 * @returns true if allowed, false if rate limited
 */
export async function checkRateLimit(
  identifier: string,
  operation: keyof typeof RATE_LIMITS
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = RATE_LIMITS[operation];
  const key = `${operation}:${identifier}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);

  try {
    // Check existing rate limit record
    const { data: existing, error: fetchError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .gt('expires_at', now.toISOString())
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error)
      console.error('Rate limit check error:', fetchError);
      // On error, allow the request (fail open for better UX)
      return { allowed: true };
    }

    if (existing) {
      // Rate limit record exists
      if (existing.count >= config.maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.ceil(
          (new Date(existing.expires_at).getTime() - now.getTime()) / 1000
        );
        
        console.warn(`⚠️ Rate limit exceeded for ${key}: ${existing.count}/${config.maxRequests}`);
        
        return {
          allowed: false,
          retryAfter,
        };
      }

      // Increment count
      const { error: updateError } = await supabase
        .from('rate_limits')
        .update({ count: existing.count + 1 })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Rate limit update error:', updateError);
      }

      return { allowed: true };
    } else {
      // No rate limit record exists, create one
      const expiresAt = new Date(now.getTime() + config.windowSeconds * 1000);
      
      const { error: insertError } = await supabase
        .from('rate_limits')
        .insert({
          key,
          count: 1,
          window_start: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error('Rate limit insert error:', insertError);
        // On error, allow the request (fail open)
      }

      return { allowed: true };
    }
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request (fail open for better UX)
    return { allowed: true };
  }
}

/**
 * Hono middleware factory for rate limiting
 * Usage: app.post('/endpoint', rateLimitMiddleware('CREATE_OFFER'), async (c) => {...})
 */
export function rateLimitMiddleware(operation: keyof typeof RATE_LIMITS) {
  return async (c: Context, next: () => Promise<void>) => {
    // Get identifier from session or IP
    let identifier = c.req.header('X-Session-ID');
    
    if (identifier) {
      // Use session ID as identifier (preferred - tracks by user)
      identifier = `session:${identifier}`;
    } else {
      // Fall back to IP address (for unauthenticated requests)
      const forwarded = c.req.header('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : c.req.header('x-real-ip') || 'unknown';
      identifier = `ip:${ip}`;
    }

    const result = await checkRateLimit(identifier, operation);

    if (!result.allowed) {
      return c.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many ${operation.toLowerCase().replace('_', ' ')} requests. Please try again later.`,
          retryAfter: result.retryAfter,
        },
        429,
        {
          'Retry-After': String(result.retryAfter || 60),
          'X-RateLimit-Limit': String(RATE_LIMITS[operation].maxRequests),
          'X-RateLimit-Reset': String(result.retryAfter || 60),
        }
      );
    }

    // Add rate limit headers to response
    c.header('X-RateLimit-Limit', String(RATE_LIMITS[operation].maxRequests));
    
    await next();
  };
}

/**
 * Clean up expired rate limit records
 * Should be called periodically (e.g., via cron job or on startup)
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const { error, count } = await supabase
      .from('rate_limits')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Failed to cleanup expired rate limits:', error);
      return 0;
    }

    if (count && count > 0) {
      console.log(`🧹 Cleaned up ${count} expired rate limit records`);
    }

    return count || 0;
  } catch (error) {
    console.error('Rate limit cleanup failed:', error);
    return 0;
  }
}

/**
 * Get rate limit status for a user (for debugging/monitoring)
 */
export async function getRateLimitStatus(identifier: string, operation: keyof typeof RATE_LIMITS) {
  const config = RATE_LIMITS[operation];
  const key = `${operation}:${identifier}`;
  const now = new Date();

  const { data, error } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .gt('expires_at', now.toISOString())
    .single();

  if (error || !data) {
    return {
      operation,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: null,
    };
  }

  return {
    operation,
    limit: config.maxRequests,
    used: data.count,
    remaining: Math.max(0, config.maxRequests - data.count),
    resetAt: data.expires_at,
  };
}
