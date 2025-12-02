import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as steam from "./steam.tsx";
import * as auth from "./auth.tsx";
import { authMiddleware, optionalAuthMiddleware, getAuthFromContext } from "./authMiddleware.tsx";
// Note: kv_store.tsx import removed - no longer used (replaced by Supabase Auth sessions)
import { 
  validate, 
  sanitizeObject,
  CreateOfferSchema,
  UpdateOfferSchema,
  CreateTradeRequestSchema,
  UpdateTradeRequestSchema,
  VoteReputationSchema,
  UpdateProfileSchema,
  ValidationError,
} from "./validation.tsx";
import { rateLimitMiddleware, cleanupExpiredRateLimits } from "./rate_limiter.tsx";

// ===== STARTUP LOGGING =====
console.log('=== EDGE FUNCTION STARTING ===');
console.log('Timestamp:', new Date().toISOString());
console.log('Function: make-server-e2cf3727');

const app = new Hono();

// Validate required environment variables at startup
const requiredEnvVars = {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  STEAM_API_KEY: Deno.env.get('STEAM_API_KEY'),
};

console.log('Checking environment variables...');
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ FATAL: Missing required environment variable: ${key}`);
    // Don't exit in development - just warn
    if (Deno.env.get('ENVIRONMENT') === 'production') {
      Deno.exit(1);
    }
  } else {
    // Log that variable exists (but mask sensitive values)
    const maskedValue = key.includes('KEY') || key.includes('SECRET') 
      ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}` 
      : value;
    console.log(`✅ ${key}: ${maskedValue}`);
  }
}

// Check for ANON_KEY (optional but recommended)
const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
if (anonKey) {
  console.log('✅ ANON_KEY: Available');
} else {
  console.warn('⚠️ ANON_KEY: Not set (token generation may fail)');
}

// Validate format of critical env vars
if (requiredEnvVars.SUPABASE_URL && !requiredEnvVars.SUPABASE_URL.startsWith('https://')) {
  console.error('❌ FATAL: SUPABASE_URL must start with https://');
  if (Deno.env.get('ENVIRONMENT') === 'production') {
    Deno.exit(1);
  }
}

console.log('✅ Environment variables validated');
console.log('=== EDGE FUNCTION INITIALIZED ===');

// ===== RESPONSE CACHING =====
// Simple in-memory cache for GET requests (resets on function restart)
// Reduces REST requests by caching frequently accessed endpoints
const responseCache = new Map<string, { data: any; expires: number }>();

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of responseCache.entries()) {
    if (value.expires <= now) {
      responseCache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cache cleanup: Removed ${cleaned} expired entries`);
  }
}, 60000); // Clean every minute

// ===== SAFE ERROR RESPONSE HELPER =====
/**
 * Returns a safe error response that doesn't leak internal details in production
 * Logs full error details server-side for debugging
 */
function safeErrorResponse(c: Context, userMessage: string, error: any, status: number = 500) {
  const requestId = crypto.randomUUID().substring(0, 8);
  const isDev = Deno.env.get('ENVIRONMENT') !== 'production';
  
  // Log full error server-side
  console.error(`[${requestId}] Error:`, error);
  if (error instanceof Error) {
    console.error(`[${requestId}] Error message:`, error.message);
    console.error(`[${requestId}] Error stack:`, error.stack);
  }
  console.error(`[${requestId}] Error type:`, error?.constructor?.name);
  
  // Return safe response
  return c.json({
    error: userMessage,
    requestId: isDev ? requestId : undefined,
    details: isDev ? (error instanceof Error ? error.message : String(error)) : undefined
  }, status);
}

// Initialize Supabase client with service role key for server-side operations
const supabaseUrl = requiredEnvVars.SUPABASE_URL!;
const supabaseServiceKey = requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Clean up expired rate limits on startup
cleanupExpiredRateLimits().then(count => {
  if (count > 0) {
    console.log(`🧹 Startup: Cleaned up ${count} expired rate limit records`);
  }
});

// Schedule periodic cleanup (every hour)
setInterval(() => {
  cleanupExpiredRateLimits();
}, 3600 * 1000);

// Enable logger
app.use('*', logger(console.log));

// ===== RESPONSE CACHING MIDDLEWARE =====
// Cache GET requests for frequently accessed endpoints to reduce REST requests
app.use('*', async (c, next) => {
  // Only cache GET requests for specific endpoints
  const cacheablePaths = ['/offers/list', '/reputation/'];
  const isCacheable = c.req.method === 'GET' && 
    cacheablePaths.some(path => c.req.path.includes(path));
  
  if (isCacheable) {
    const cacheKey = c.req.url;
    const cached = responseCache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      console.log(`✅ Cache hit: ${c.req.path} (saved REST request)`);
      return c.json(cached.data);
    }
  }
  
  await next();
});

// ===== CORS CONFIGURATION =====
// Configure allowed origins from environment variable or use defaults
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || [
  // Add your production domain here
  // 'https://your-production-domain.com',
  ...(Deno.env.get('ENVIRONMENT') === 'development' 
    ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'] 
    : [])
];

console.log('CORS allowed origins:', allowedOrigins.length > 0 ? allowedOrigins : 'None configured - using wildcard');

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return origin;
      
      // Check if origin is in allowlist
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return origin;
      }
      
      // If no origins configured, allow all (development only)
      if (allowedOrigins.length === 0) {
        console.warn(`⚠️ CORS: No origins configured, allowing all (development mode)`);
        return origin;
      }
      
      // Reject unauthorized origins
      console.warn(`🚫 CORS: Rejected origin: ${origin}`);
      return allowedOrigins[0]; // Return first allowed origin as fallback
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// ===== SECURITY HEADERS MIDDLEWARE =====
app.use('*', async (c, next) => {
  await next();
  
  // Add security headers to all responses
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-XSS-Protection', '1; mode=block');
  
  // Add HSTS header in production (HTTPS only)
  if (Deno.env.get('ENVIRONMENT') === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy (adjust based on your needs)
  const cspHeader = [
    "default-src 'self'",
    "img-src 'self' https://steamcdn-a.akamaihd.net https://community.cloudflare.steamstatic.com https://avatars.steamstatic.com data:",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'",
  ].join('; ');
  
  c.header('Content-Security-Policy', cspHeader);
});

// Health check endpoint
app.get("/make-server-e2cf3727/health", (c) => {
  return c.json({ status: "ok" });
});

// Steam Authentication Routes

// Get Steam login URL
app.get("/make-server-e2cf3727/steam/login", (c) => {
  try {
    console.log('=== BACKEND /steam/login: Request received ===');
    const returnUrl = c.req.query('return_url');
    console.log('BACKEND /steam/login: return_url param:', returnUrl);
    
    if (!returnUrl) {
      console.error('BACKEND /steam/login: Missing return_url parameter');
      return c.json({ error: 'return_url parameter is required' }, 400);
    }

    console.log('BACKEND /steam/login: Generating Steam login URL...');
    const loginUrl = steam.generateSteamLoginUrl(returnUrl);
    console.log('BACKEND /steam/login: Generated login URL:', loginUrl);
    
    return c.json({ loginUrl });
  } catch (error) {
    console.error('=== BACKEND /steam/login: ERROR ===', error);
    return safeErrorResponse(c, 'Failed to generate login URL', error, 500);
  }
});

// Verify Steam login callback
app.get("/make-server-e2cf3727/steam/callback", async (c) => {
  try {
    console.log('=== BACKEND /steam/callback: Request received ===');
    console.log('BACKEND /steam/callback: Full URL:', c.req.url);
    
    const params = new URLSearchParams(c.req.url.split('?')[1]);
    console.log('BACKEND /steam/callback: Parsed params count:', params.size);
    console.log('BACKEND /steam/callback: Has openid.claimed_id?', params.has('openid.claimed_id'));
    
    // Verify the OpenID response
    console.log('BACKEND /steam/callback: Verifying Steam login...');
    const steamId = await steam.verifySteamLogin(params);
    console.log('BACKEND /steam/callback: Steam ID from verification:', steamId);
    
    if (!steamId) {
      console.error('BACKEND /steam/callback: Steam verification failed - no Steam ID returned');
      return c.json({ error: 'Steam authentication failed' }, 401);
    }

    // Get Steam API key from environment
    const steamApiKey = Deno.env.get('STEAM_API_KEY');
    if (!steamApiKey) {
      console.error('BACKEND /steam/callback: STEAM_API_KEY environment variable not set');
      return safeErrorResponse(c, 'Server configuration error', new Error('STEAM_API_KEY not set'), 500);
    }
    console.log('BACKEND /steam/callback: Steam API key found');

    // Fetch user profile
    console.log('BACKEND /steam/callback: Fetching user profile for Steam ID:', steamId);
    const userProfile = await steam.getSteamUserProfile(steamId, steamApiKey);
    console.log('BACKEND /steam/callback: User profile:', userProfile);
    
    if (!userProfile) {
      console.error('BACKEND /steam/callback: Failed to fetch user profile from Steam API');
      return safeErrorResponse(c, 'Failed to fetch user profile', new Error('User profile not found'), 500);
    }

    // Create or get Supabase Auth user and generate session
    console.log('BACKEND /steam/callback: Creating/getting Supabase Auth user...');
    const authResult = await auth.createOrGetSupabaseUser({
      steamId: userProfile.steamId,
      personaName: userProfile.personaName,
      avatarUrl: userProfile.avatarUrl,
      profileUrl: userProfile.profileUrl,
    });
    console.log('BACKEND /steam/callback: Supabase Auth user created:', authResult.user.id);

    // Upsert user in our custom users table (link to Supabase Auth user)
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        steam_id: userProfile.steamId,
        persona_name: userProfile.personaName,
        avatar_url: userProfile.avatarUrl,
        profile_url: userProfile.profileUrl,
        auth_user_id: authResult.user.id, // Link to Supabase Auth user
        last_login_at: new Date().toISOString(),
      }, {
        onConflict: 'steam_id',
      });

    if (userError) {
      console.error('BACKEND /steam/callback: Error upserting user:', userError);
      // Continue anyway - auth user is created
    }

    console.log('=== BACKEND /steam/callback: Success! ===');
    return c.json({
      success: true,
      session: {
        access_token: authResult.accessToken,
        refresh_token: authResult.refreshToken,
        expires_in: 3600 * 24 * 7, // 7 days
        token_type: 'bearer',
        user: authResult.user,
      },
      user: {
        steamId: userProfile.steamId,
        personaName: userProfile.personaName,
        avatarUrl: userProfile.avatarUrl,
        profileUrl: userProfile.profileUrl,
        authUserId: authResult.user.id,
      },
    });
  } catch (error) {
    console.error('=== BACKEND /steam/callback: ERROR ===', error);
    return safeErrorResponse(c, 'Authentication failed', error, 500);
  }
});

// Get current user session (using Supabase Auth)
app.get("/make-server-e2cf3727/steam/user", authMiddleware, async (c) => {
  try {
    console.log('=== BACKEND /steam/user: Request received ===');
    const { steamId, authUser } = getAuthFromContext(c);
    console.log('BACKEND /steam/user: Authenticated user Steam ID:', steamId);

    // Get user activity summary from view (includes all user data and statistics)
    const { data: userActivity, error: viewError } = await supabase
      .from('user_activity_summary')
      .select('*')
      .eq('steam_id', steamId)
      .single();

    if (viewError && viewError.code !== 'PGRST116') {
      console.error('Error fetching user activity summary:', viewError);
      // Fallback to basic user query if view fails
    const { data: userProfile } = await supabase
      .from('users')
        .select('trade_url, persona_name, avatar_url, profile_url')
        .eq('steam_id', steamId)
      .single();

    const userData = {
        steamId: steamId,
        personaName: authUser.user_metadata?.persona_name || userProfile?.persona_name || 'Steam User',
        avatarUrl: authUser.user_metadata?.avatar_url || userProfile?.avatar_url || '',
        profileUrl: authUser.user_metadata?.profile_url || userProfile?.profile_url || '',
      tradeUrl: userProfile?.trade_url || null,
        authUserId: authUser.id,
      };

      console.log('BACKEND /steam/user: Session valid, returning user:', userData.personaName);
      return c.json({ user: userData });
    }

    // Use data from view
    const userData = {
      steamId: userActivity?.steam_id || steamId,
      personaName: userActivity?.persona_name || authUser.user_metadata?.persona_name || 'Steam User',
      avatarUrl: userActivity?.avatar_url || authUser.user_metadata?.avatar_url || '',
      profileUrl: userActivity?.profile_url || authUser.user_metadata?.profile_url || '',
      tradeUrl: userActivity?.trade_url || null,
      authUserId: authUser.id,
      // Include statistics from view
      statistics: {
        totalOffers: userActivity?.total_offers || 0,
        activeOffers: userActivity?.active_offers || 0,
        tradeRequestsSent: userActivity?.trade_requests_sent || 0,
        tradeRequestsReceived: userActivity?.trade_requests_received || 0,
        completionRate: userActivity?.completion_rate || 0,
        reputationVotes: userActivity?.total_reputation_votes || 0,
      },
    };

    console.log('BACKEND /steam/user: Session valid, returning user:', userData.personaName);
    return c.json({ user: userData });
  } catch (error) {
    console.error('=== BACKEND /steam/user: ERROR ===', error);
    return safeErrorResponse(c, 'Failed to fetch user', error, 500);
  }
});

// Update user profile (trade URL)
app.post("/make-server-e2cf3727/steam/profile", authMiddleware, async (c) => {
  try {
    console.log('=== BACKEND /steam/profile: Request received ===');
    const { steamId, authUser } = getAuthFromContext(c);
    const body = await c.req.json();
    const { tradeUrl } = body;

    if (!tradeUrl) {
      return c.json({ error: 'Trade URL is required' }, 400);
    }

    // Validate trade URL format
    const tradeUrlPattern = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+$/;
    if (!tradeUrlPattern.test(tradeUrl)) {
      return c.json({ error: 'Invalid trade URL format. Should be: https://steamcommunity.com/tradeoffer/new/?partner=XXXXX&token=XXXXX' }, 400);
    }

    // Upsert user profile in database
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        steam_id: steamId,
        persona_name: authUser.user_metadata?.persona_name,
        avatar_url: authUser.user_metadata?.avatar_url,
        profile_url: authUser.user_metadata?.profile_url,
        trade_url: tradeUrl,
        auth_user_id: authUser.id,
        last_login_at: new Date().toISOString(),
      }, {
        onConflict: 'steam_id'
      });

    if (upsertError) {
      console.error('Error updating user profile in database:', upsertError);
      return safeErrorResponse(c, 'Failed to update profile', upsertError, 500);
    }

    console.log('BACKEND /steam/profile: Trade URL updated for user:', steamId);
    return c.json({ success: true, tradeUrl });
  } catch (error) {
    console.error('=== BACKEND /steam/profile: ERROR ===', error);
    return safeErrorResponse(c, 'Failed to update profile', error, 500);
  }
});

// Logout - Supabase Auth handles session management, this is just for cleanup
app.post("/make-server-e2cf3727/steam/logout", async (c) => {
  try {
    // With Supabase Auth, logout is handled client-side
    // This endpoint can be used for any server-side cleanup if needed
    return c.json({ success: true, message: 'Logout handled by Supabase Auth client' });
  } catch (error) {
    console.error('Error during logout:', error);
    return safeErrorResponse(c, 'Logout failed', error, 500);
  }
});

// Get user's Steam inventory - DISABLED (Steam blocks cloud IPs)
// We now use manual item entry in the frontend instead
// See /components/ManualItemEntry.tsx for the manual entry implementation
/*
app.get("/make-server-e2cf3727/steam/inventory", async (c) => {
  try {
    console.log('🎮 BACKEND: Fetching inventory...');
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      console.log('🎮 BACKEND: No session ID provided');
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      console.log('🎮 BACKEND: Invalid session');
      return c.json({ error: 'Invalid session' }, 401);
    }

    const steamId = session.steamId;
    console.log('🎮 BACKEND: Steam ID:', steamId);

    // CS2 App ID: 730, Context: 2 (tradeable items)
    const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;
    
    console.log('🎮 BACKEND: Fetching from Steam:', inventoryUrl);
    
    // Add random delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    const response = await fetch(inventoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, *!/!*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://steamcommunity.com/profiles/${steamId}/inventory/`,
      },
    });

    console.log('🎮 BACKEND: Steam response status:', response.status);
    console.log('🎮 BACKEND: Steam response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const responseText = await response.text();
      console.error('🎮 BACKEND: Steam returned error status:', response.status);
      console.error('🎮 BACKEND: Steam response body:', responseText);
      
      if (response.status === 403) {
        return c.json({ 
          error: 'Steam inventory is private or inaccessible',
          status: 403,
          steamResponse: responseText.substring(0, 500),
          message: 'Please ensure your Steam profile and inventory are set to Public in your Steam Privacy Settings'
        }, 403);
      }
      
      if (response.status === 429) {
        return c.json({ 
          error: 'Rate limited by Steam',
          status: 429,
          steamResponse: responseText.substring(0, 500),
          message: 'Steam is temporarily rate limiting requests. Please wait 2-3 minutes and try again.'
        }, 429);
      }
      
      return c.json({ 
        error: 'Failed to fetch inventory from Steam',
        status: response.status,
        steamResponse: responseText.substring(0, 500),
        details: 'Steam returned an error. This may be due to IP blocking or privacy settings.'
      }, response.status);
    }

    const responseText = await response.text();
    console.log('🎮 BACKEND: Steam raw response (first 500 chars):', responseText.substring(0, 500));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('🎮 BACKEND: Failed to parse Steam response as JSON');
      console.error('🎮 BACKEND: Parse error:', parseError);
      return c.json({
        error: 'Steam returned invalid response',
        steamResponse: responseText.substring(0, 500)
      }, 500);
    }
    
    console.log('🎮 BACKEND: Steam response has assets:', !!data.assets);
    console.log('🎮 BACKEND: Steam response has descriptions:', !!data.descriptions);
    console.log('🎮 BACKEND: Steam response keys:', Object.keys(data));
    
    if (data.success === false || data.error) {
      console.error('🎮 BACKEND: Steam returned error:', data.error);
      return c.json({ 
        error: data.error || 'Steam returned an error',
        steamError: true,
        steamResponse: data
      }, 400);
    }

    console.log('🎮 BACKEND: Successfully fetched inventory');
    return c.json({
      assets: data.assets || [],
      descriptions: data.descriptions || [],
      success: true
    });
  } catch (error) {
    console.error('🎮 BACKEND: Error fetching inventory:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch inventory',
      details: String(error)
    }, 500);
  }
});
*/

// Test endpoint to diagnose inventory issues - ALSO DISABLED
/*
app.get("/make-server-e2cf3727/steam/inventory/test", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session', sessionExists: !!session, hasSteamId: !!session?.steamId }, 401);
    }

    const inventoryUrl = `https://steamcommunity.com/inventory/${session.steamId}/730/2?l=english&count=5000`;
    const profileUrl = `https://steamcommunity.com/id/${session.steamId}`;
    const profileSettingsUrl = 'https://steamcommunity.com/my/edit/settings';
    
    // Try to fetch the inventory directly to see what error we get
    let fetchResult = { status: 0, statusText: '', body: '', headers: {} as any };
    try {
      const testResponse = await fetch(inventoryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });
      
      fetchResult.status = testResponse.status;
      fetchResult.statusText = testResponse.statusText;
      fetchResult.headers = Object.fromEntries(testResponse.headers.entries());
      
      try {
        const text = await testResponse.text();
        fetchResult.body = text.substring(0, 500); // First 500 chars
      } catch (e) {
        fetchResult.body = 'Could not read response body';
      }
    } catch (fetchError) {
      fetchResult.body = `Fetch failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`;
    }
    
    return c.json({
      success: true,
      diagnostics: {
        steamId: session.steamId,
        personaName: session.personaName,
        profileUrl: session.profileUrl,
        inventoryUrl: inventoryUrl,
        
        fetchTest: fetchResult,
        
        possibleIssues: [
          {
            issue: 'Profile is Private',
            check: 'Open your profile and ensure "My Profile" is set to Public',
            settingsUrl: profileSettingsUrl,
          },
          {
            issue: 'Inventory is Private',
            check: 'Go to Privacy Settings and set "Inventory" to Public',
            settingsUrl: profileSettingsUrl,
          },
          {
            issue: 'No CS2 Items',
            check: 'You need at least one CS2 item in your inventory',
            howToCheck: `Visit ${inventoryUrl} in your browser`,
          },
          {
            issue: 'Steam Blocking Supabase IPs (Most Likely)',
            check: 'Steam may be blocking requests from cloud servers',
            solution: 'This is a known issue with Steam\'s anti-bot protection',
            workaround: 'We may need to implement a proxy or use Steam Web API instead',
          },
        ],
        
        nextSteps: [
          '1. Copy the inventoryUrl above and paste it in your browser',
          '2. If you see JSON data, your inventory is public and has items',
          '3. If you see an error, check your Steam privacy settings',
          '4. If your browser shows data but the app fails, Steam is blocking cloud IPs',
        ],
      }
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return safeErrorResponse(c, 'Test failed', error, 500);
  }
});
*/

// Cache stats endpoint for debugging
app.get("/make-server-e2cf3727/steam/cache-stats", async (c) => {
  try {
    const stats = steam.getCacheStats();
    return c.json({
      success: true,
      cache: {
        totalEntries: stats.totalCached,
        cacheDurationMinutes: 15,
        entries: stats.entries,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache stats endpoint error:', error);
    return safeErrorResponse(c, 'Failed to get cache stats', error, 500);
  }
});

// Create a new trade offer
app.post("/make-server-e2cf3727/offers/create", authMiddleware, async (c) => {
  try {
    const { steamId, authUser } = getAuthFromContext(c);

    const body = await c.req.json();

    // Validate and sanitize input
    let validated;
    try {
      validated = validate(CreateOfferSchema, body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    // Sanitize HTML in notes to prevent XSS
    const sanitized = sanitizeObject(validated);

    // Debug: Log what we're about to save
    console.log('💾 Saving offer with items:', {
      offering: sanitized.offering.map((item: any) => ({
        name: item.name,
        isPlaceholder: item.isPlaceholder,
        category: item.category
      })),
      seeking: sanitized.seeking.map((item: any) => ({
        name: item.name,
        isPlaceholder: item.isPlaceholder,
        category: item.category
      }))
    });

    // Upsert user profile in single operation (reduces from 2 REST requests to 1)
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .upsert({
        steam_id: steamId,
        persona_name: authUser.user_metadata?.persona_name || 'Steam User',
        avatar_url: authUser.user_metadata?.avatar_url || '',
        profile_url: authUser.user_metadata?.profile_url || '',
        auth_user_id: authUser.id,
        last_login_at: new Date().toISOString(),
      }, {
        onConflict: 'steam_id',
        ignoreDuplicates: false, // Update if exists
      })
      .select('trade_url, persona_name, avatar_url, profile_url')
      .single();

      if (profileError) {
      console.error('Error upserting user profile:', profileError);
      return safeErrorResponse(c, 'Failed to update user profile', profileError, 500);
    }

    // Validate that user has set their trade URL
    if (!userProfile?.trade_url) {
      return c.json({ 
        error: 'Trade URL required. Please set your Steam Trade URL in settings before creating offers.' 
      }, 400);
    }

    // Create offer in database with user data join (1 REST request with join instead of separate queries)
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        user_steam_id: steamId,
        offering: sanitized.offering,
        seeking: sanitized.seeking,
        notes: sanitized.notes || null,
        status: 'active',
      })
      .select(`
        *,
        user:users!user_steam_id (
          steam_id,
          persona_name,
          avatar_url,
          profile_url,
          trade_url
        )
      `)
      .single();

    if (offerError) {
      console.error('Error creating offer in database:', offerError);
      return safeErrorResponse(c, 'Failed to create offer', offerError, 500);
    }

    // Format response to match frontend expectations
    // Use user data from join or fallback to authUser metadata
    const userData = Array.isArray(offer.user) ? offer.user[0] : offer.user;
    const formattedOffer = {
      id: offer.id,
      userId: steamId,
      userName: userData?.persona_name || authUser.user_metadata?.persona_name || userProfile?.persona_name || 'Steam User',
      userAvatar: userData?.avatar_url || authUser.user_metadata?.avatar_url || userProfile?.avatar_url || '',
      userTradeUrl: userData?.trade_url || userProfile?.trade_url || null,
      userProfileUrl: userData?.profile_url || authUser.user_metadata?.profile_url || userProfile?.profile_url || '',
      offering: offer.offering,
      seeking: offer.seeking,
      notes: offer.notes,
      timestamp: new Date(offer.created_at).getTime(),
      status: offer.status,
      views: 0,
      uniqueViewers: [],
    };

    console.log('Offer created in database:', offer.id);
    return c.json({ success: true, offer: formattedOffer });
  } catch (error) {
    console.error('Error creating offer:', error);
    return safeErrorResponse(c, 'Failed to create offer', error, 500);
  }
});

// Get all active offers (marketplace feed)
app.get("/make-server-e2cf3727/offers/list", async (c) => {
  try {
    // Use user_offers_detailed view for cleaner query with all user/reputation data
    const { data: offers, error } = await supabase
      .from('user_offers_detailed')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching offers from database:', error);
      return safeErrorResponse(c, 'Failed to fetch offers', error, 500);
    }

    // Format offers to match frontend expectations (view already includes user data)
    const formattedOffers = (offers || []).map((offer: any) => ({
        id: offer.id,
        userId: offer.user_steam_id,
      userName: offer.persona_name || 'Unknown User',
      userAvatar: offer.avatar_url || '',
      userTradeUrl: offer.trade_url || null,
      userProfileUrl: offer.profile_url || '',
        offering: offer.offering,
        seeking: offer.seeking,
        notes: offer.notes,
        timestamp: new Date(offer.created_at).getTime(),
        status: offer.status,
        views: offer.views || 0,
      uniqueViewers: offer.unique_viewers_count || 0,
      // Include reputation data from view
      userReputation: {
        completionRate: offer.completion_rate || 0,
        reputationVotes: offer.reputation_votes || 0,
      },
    }));

    const responseData = { offers: formattedOffers };
    
    // Cache response for 30 seconds to reduce REST requests from polling
    const cacheKey = c.req.url;
    responseCache.set(cacheKey, {
      data: responseData,
      expires: Date.now() + 30000 // 30 seconds
    });
    
    console.log(`💾 Cached /offers/list response (expires in 30s, ${formattedOffers.length} offers)`);

    return c.json(responseData);
  } catch (error) {
    console.error('Error fetching offers:', error);
    return safeErrorResponse(c, 'Failed to fetch offers', error, 500);
  }
});

// Get single offer by ID
app.get("/make-server-e2cf3727/offers/:id", async (c) => {
  try {
    const offerId = c.req.param('id');
    
    // Use user_offers_detailed view to get offer with user/reputation data in single query (1 REST request instead of 2)
    const { data: offer, error } = await supabase
      .from('user_offers_detailed')
      .select('*')
      .eq('id', offerId)
      .single();

    if (error) {
      // Fallback to basic query if view doesn't exist yet
      const { data: basicOffer, error: basicError } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .is('deleted_at', null)
        .single();

      if (basicError) {
        console.error('Error fetching offer from database:', basicError);
        return safeErrorResponse(c, 'Failed to fetch offer', basicError, 500);
      }

      if (!basicOffer) {
        return c.json({ error: 'Offer not found' }, 404);
      }

      return c.json({ offer: basicOffer });
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Format offer with user/reputation data from view
    const formattedOffer = {
      ...offer,
      user: {
        steamId: offer.user_steam_id,
        personaName: offer.persona_name,
        avatarUrl: offer.avatar_url,
        profileUrl: offer.profile_url,
        tradeUrl: offer.trade_url,
      },
      reputation: {
        completionRate: offer.completion_rate || 0,
        reputationVotes: offer.reputation_votes || 0,
      },
      uniqueViewers: offer.unique_viewers_count || 0,
    };

    return c.json({ offer: formattedOffer });
  } catch (error) {
    console.error('Error fetching offer:', error);
    return safeErrorResponse(c, 'Failed to fetch offer', error, 500);
  }
});

// Track offer view (real-time analytics) - Optional auth (can track anonymous views)
app.post("/make-server-e2cf3727/offers/:id/view", optionalAuthMiddleware, async (c) => {
  try {
    const offerId = c.req.param('id');
    const auth = c.get('auth'); // May be undefined for anonymous views
    
    // Verify offer exists
    const { data: offer, error } = await supabase
      .from('offers')
      .select('id, user_steam_id, views')
      .eq('id', offerId)
      .single();

    if (error) {
      console.error('Error fetching offer from database:', error);
      return c.json({ error: 'Failed to fetch offer' }, 500);
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Track viewer (if authenticated)
    let viewerId = null;
    if (auth) {
      viewerId = auth.steamId;
    }

    // Don't track views from the offer owner
    if (viewerId && viewerId === offer.user_steam_id) {
      return c.json({ 
        success: true, 
        views: offer.views || 0,
        uniqueViewers: 0 // Not tracking for owner's own views
      });
    }

    // Insert view record into offer_views table
    // The database trigger will automatically increment the views count
    const { error: viewError } = await supabase
      .from('offer_views')
      .insert({
        offer_id: offerId,
        viewer_steam_id: viewerId,
        viewed_at: new Date().toISOString(),
      });

    if (viewError) {
      // If it's a unique constraint error (duplicate view), that's ok - just don't count it
      if (viewError.code !== '23505') {
        console.error('Error recording view:', viewError);
      }
    }

    // Get updated view count
    const { data: updatedOffer } = await supabase
      .from('offers')
      .select('views')
      .eq('id', offerId)
      .single();

    // Get unique viewer count
    const { data: uniqueViewsData, error: uniqueError } = await supabase
      .from('offer_views')
      .select('viewer_steam_id', { count: 'exact', head: false })
      .eq('offer_id', offerId)
      .not('viewer_steam_id', 'is', null);

    const uniqueViewers = uniqueViewsData ? new Set(uniqueViewsData.map((v: any) => v.viewer_steam_id)).size : 0;

    return c.json({ 
      success: true, 
      views: updatedOffer?.views || offer.views || 0,
      uniqueViewers: uniqueViewers
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    return safeErrorResponse(c, 'Failed to track view', error, 500);
  }
});

// Get user's own offers
app.get("/make-server-e2cf3727/offers/user/mine", authMiddleware, async (c) => {
  try {
    const { steamId } = getAuthFromContext(c);
    // Use user_offers_detailed view for cleaner query with reputation data
    const { data: offers, error } = await supabase
      .from('user_offers_detailed')
      .select('*')
      .eq('steam_id', steamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user offers from database:', error);
      return safeErrorResponse(c, 'Failed to fetch user offers', error, 500);
    }

    return c.json({ offers: offers || [] });
  } catch (error) {
    console.error('Error fetching user offers:', error);
    return safeErrorResponse(c, 'Failed to fetch user offers', error, 500);
  }
});

// Delete an offer
app.delete("/make-server-e2cf3727/offers/:id", authMiddleware, async (c) => {
  try {
    const { steamId } = getAuthFromContext(c);
    const offerId = c.req.param('id');
    const { data: offer, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (error) {
      console.error('Error fetching offer from database:', error);
      return safeErrorResponse(c, 'Failed to fetch offer', error, 500);
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Verify ownership
    if (offer.user_steam_id !== steamId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Delete offer
    const { error: deleteError } = await supabase
      .from('offers')
      .delete()
      .eq('id', offerId);

    if (deleteError) {
      console.error('Error deleting offer from database:', deleteError);
      return safeErrorResponse(c, 'Failed to delete offer', deleteError, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting offer:', error);
    return safeErrorResponse(c, 'Failed to delete offer', error, 500);
  }
});

// Update an offer
app.put("/make-server-e2cf3727/offers/:id", authMiddleware, async (c) => {
  try {
    const { steamId } = getAuthFromContext(c);
    const offerId = c.req.param('id');
    
    const { data: offer, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (error) {
      console.error('Error fetching offer from database:', error);
      return safeErrorResponse(c, 'Failed to fetch offer', error, 500);
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Verify ownership
    if (offer.user_steam_id !== steamId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const body = await c.req.json();

    // Validate and sanitize input
    let validated;
    try {
      validated = validate(UpdateOfferSchema, body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    // Sanitize HTML in notes to prevent XSS
    const sanitized = sanitizeObject(validated);

    // Update offer fields
    const { error: updateError } = await supabase
      .from('offers')
      .update({
        offering: sanitized.offering,
        seeking: sanitized.seeking,
        notes: sanitized.notes || null,
      })
      .eq('id', offerId);

    if (updateError) {
      console.error('Error updating offer in database:', updateError);
      return safeErrorResponse(c, 'Failed to update offer', updateError, 500);
    }

    console.log('Offer updated:', offerId);
    return c.json({ success: true, offer });
  } catch (error) {
    console.error('Error updating offer:', error);
    return safeErrorResponse(c, 'Failed to update offer', error, 500);
  }
});

// Initiate trade request (when user finds a match)
app.post("/make-server-e2cf3727/offers/:id/request", authMiddleware, async (c) => {
  try {
    const { steamId, authUser } = getAuthFromContext(c);
    const offerId = c.req.param('id');
    
    const { data: offer, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (error) {
      console.error('Error fetching offer from database:', error);
      return safeErrorResponse(c, 'Failed to fetch offer', error, 500);
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Can't request your own offer
    if (offer.user_steam_id === steamId) {
      return c.json({ error: 'Cannot request your own offer' }, 400);
    }

    const body = await c.req.json();

    // Validate and sanitize input
    let validated;
    try {
      validated = validate(CreateTradeRequestSchema, { offerId, ...body });
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    // Sanitize HTML in message to prevent XSS
    const sanitized = sanitizeObject(validated);

    // Create trade request in database
    const { data: request, error: requestError } = await supabase
      .from('trade_requests')
      .insert({
        offer_id: offerId,
        requester_steam_id: steamId,
        offer_owner_steam_id: offer.user_steam_id,
        message: sanitized.message || null,
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating trade request in database:', requestError);
      return safeErrorResponse(c, 'Failed to create trade request', requestError, 500);
    }

    // Get requester profile info from database
    const { data: requesterProfile } = await supabase
      .from('users')
      .select('persona_name, avatar_url')
      .eq('steam_id', steamId)
      .single();

    // Format response to match frontend expectations
    const formattedRequest = {
      id: request.id,
      offerId: request.offer_id,
      requesterId: steamId,
      requesterName: authUser.user_metadata?.persona_name || requesterProfile?.persona_name || 'Steam User',
      requesterAvatar: authUser.user_metadata?.avatar_url || requesterProfile?.avatar_url || '',
      offerOwnerId: offer.user_steam_id,
      message: request.message,
      timestamp: new Date(request.created_at).getTime(),
      status: request.status,
    };

    console.log('Trade request created in database:', request.id);
    return c.json({ success: true, request: formattedRequest });
  } catch (error) {
    console.error('Error creating trade request:', error);
    return safeErrorResponse(c, 'Failed to create trade request', error, 500);
  }
});

// Get user's trade requests (received)
app.get("/make-server-e2cf3727/requests/received", authMiddleware, async (c) => {
  try {
    const { steamId } = getAuthFromContext(c);

    // Use user_trade_requests_detailed view for cleaner query with all context
    const { data: requests, error } = await supabase
      .from('user_trade_requests_detailed')
      .select('*')
      .eq('owner_steam_id', steamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trade requests from database:', error);
      return safeErrorResponse(c, 'Failed to fetch trade requests', error, 500);
    }

    // Format requests to match frontend expectations (view already includes all user data)
    const formattedRequests = (requests || []).map((request: any) => ({
      id: request.id,
      offerId: request.offer_id,
      requesterId: request.requester_steam_id,
      requesterName: request.requester_name || 'Steam User',
      requesterAvatar: request.requester_avatar || '',
      requesterProfileUrl: request.requester_profile_url || '',
      requesterTradeUrl: request.requester_trade_url || null,
      offerOwnerId: request.owner_steam_id,
      ownerName: request.owner_name || 'Steam User',
      ownerAvatar: request.owner_avatar || '',
      message: request.message,
      timestamp: new Date(request.created_at).getTime(),
      status: request.status,
      // Include offer details from view
      offer: {
        offering: request.offering,
        seeking: request.seeking,
        notes: request.offer_notes,
        status: request.offer_status,
      },
    }));

    return c.json({ requests: formattedRequests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    return safeErrorResponse(c, 'Failed to fetch requests', error, 500);
  }
});

// ===== REPUTATION SYSTEM =====

// Submit a reputation vote (completed trade or reversed trade)
app.post("/make-server-e2cf3727/reputation/vote", authMiddleware, async (c) => {
  try {
    const { steamId: voterSteamId } = getAuthFromContext(c);
    const body = await c.req.json();
    
    // Validate input
    let validated;
    try {
      validated = validate(VoteReputationSchema, body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    const { targetSteamId, voteType } = validated;

    // Prevent self-voting
    if (targetSteamId === voterSteamId) {
      return c.json({ error: 'Cannot vote for yourself' }, 400);
    }

    // Check if user has already voted for this target
    const { data: existingVote } = await supabase
      .from('reputation_votes')
      .select('*')
      .eq('voter_steam_id', voterSteamId)
      .eq('target_steam_id', targetSteamId)
      .single();

    if (existingVote) {
      // Update existing vote if it changed
      if (existingVote.vote_type !== voteType) {
        const { error: updateError } = await supabase
          .from('reputation_votes')
          .update({ vote_type: voteType })
          .eq('id', existingVote.id);

        if (updateError) {
          console.error('Error updating reputation vote:', updateError);
          return safeErrorResponse(c, 'Failed to update vote', updateError, 500);
        }
      }
    } else {
      // Create new vote
      const { error: insertError } = await supabase
        .from('reputation_votes')
        .insert({
          voter_steam_id: voterSteamId,
          target_steam_id: targetSteamId,
          vote_type: voteType,
        });

      if (insertError) {
        console.error('Error creating reputation vote:', insertError);
        return safeErrorResponse(c, 'Failed to submit vote', insertError, 500);
      }
    }

    // Get updated reputation counts
    const { data: reputation } = await supabase
      .from('user_reputation')
      .select('*')
      .eq('steam_id', targetSteamId)
      .single();

    console.log(`Reputation vote recorded: ${voterSteamId} -> ${targetSteamId} (${voteType})`);
    
    return c.json({ 
      success: true, 
      reputation: {
        completed: reputation?.completed_trades || 0,
        reversed: reputation?.reversed_trades || 0,
        totalVotes: (reputation?.completed_trades || 0) + (reputation?.reversed_trades || 0),
      }
    });
  } catch (error) {
    console.error('Error submitting reputation vote:', error);
    return safeErrorResponse(c, 'Failed to submit vote', error, 500);
  }
});

// Get reputation for a specific user (public endpoint, optional auth to check user's vote)
app.get("/make-server-e2cf3727/reputation/:steamId", optionalAuthMiddleware, async (c) => {
  try {
    const steamId = c.req.param('steamId');
    
    if (!steamId) {
      return c.json({ error: 'steamId is required' }, 400);
    }

    // Validate Steam ID format
    if (!/^\d{17}$/.test(steamId)) {
      return c.json({ error: 'Invalid Steam ID format' }, 400);
    }

    // Get reputation data from database
    const { data: reputation } = await supabase
      .from('user_reputation')
      .select('*')
      .eq('steam_id', steamId)
      .single();

    const completed = reputation?.completed_trades || 0;
    const reversed = reputation?.reversed_trades || 0;
    const totalVotes = completed + reversed;
    const completionRate = totalVotes > 0 
      ? Math.round((completed / totalVotes) * 100) 
      : 0;

    // Check if current user has voted (if authenticated)
    let userVote = null;
    const auth = c.get('auth');
    if (auth) {
        const { data: vote } = await supabase
          .from('reputation_votes')
          .select('vote_type')
        .eq('voter_steam_id', auth.steamId)
          .eq('target_steam_id', steamId)
          .single();
        
        if (vote) {
          userVote = vote.vote_type;
      }
    }

    return c.json({ 
      success: true,
      reputation: {
        completed,
        reversed,
        totalVotes,
        completionRate,
        userVote,
      }
    });
  } catch (error) {
    console.error('Error fetching reputation:', error);
    return safeErrorResponse(c, 'Failed to fetch reputation', error, 500);
  }
});

// Wrap in comprehensive error handler to catch any unhandled errors
Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();
  
  try {
    console.log(`=== EDGE FUNCTION REQUEST [${requestId}] ===`);
    console.log(`[${requestId}] Method:`, req.method);
    console.log(`[${requestId}] URL:`, req.url);
    console.log(`[${requestId}] Timestamp:`, new Date().toISOString());
    
    // Log headers (but mask sensitive ones)
    const headers: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      if (key.toLowerCase() === 'authorization') {
        headers[key] = value.substring(0, 20) + '...';
      } else {
        headers[key] = value;
      }
    }
    console.log(`[${requestId}] Headers:`, headers);
    
    const response = await app.fetch(req);
    
    const duration = Date.now() - startTime;
    console.log(`=== EDGE FUNCTION RESPONSE [${requestId}] ===`);
    console.log(`[${requestId}] Status:`, response.status);
    console.log(`[${requestId}] Duration:`, `${duration}ms`);
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`=== UNHANDLED ERROR IN EDGE FUNCTION [${requestId}] ===`);
    console.error(`[${requestId}] Error type:`, error?.constructor?.name);
    console.error(`[${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    console.error(`[${requestId}] Error stack:`, error instanceof Error ? error.stack : 'No stack');
    console.error(`[${requestId}] Duration before error:`, `${duration}ms`);
    console.error(`[${requestId}] Full error:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        requestId: requestId
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});