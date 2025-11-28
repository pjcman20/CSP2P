import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as steam from "./steam.tsx";
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

const app = new Hono();

// Validate required environment variables at startup
const requiredEnvVars = {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  STEAM_API_KEY: Deno.env.get('STEAM_API_KEY'),
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ FATAL: Missing required environment variable: ${key}`);
    // Don't exit in development - just warn
    if (Deno.env.get('ENVIRONMENT') === 'production') {
      Deno.exit(1);
    }
  }
}

// Validate format of critical env vars
if (requiredEnvVars.SUPABASE_URL && !requiredEnvVars.SUPABASE_URL.startsWith('https://')) {
  console.error('❌ FATAL: SUPABASE_URL must start with https://');
  if (Deno.env.get('ENVIRONMENT') === 'production') {
    Deno.exit(1);
  }
}

console.log('✅ Environment variables validated');

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

// Enable CORS for all routes and methods
// TODO: Restrict origins in production - see SECURITY_ROADMAP.md
app.use(
  "/*",
  cors({
    origin: "*", // Allow all origins for now (will restrict in production)
    allowHeaders: ["Content-Type", "Authorization", "X-Session-ID"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

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
    return c.json({ error: 'Failed to generate login URL' }, 500);
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
      return c.json({ error: 'Server configuration error' }, 500);
    }
    console.log('BACKEND /steam/callback: Steam API key found');

    // Fetch user profile
    console.log('BACKEND /steam/callback: Fetching user profile for Steam ID:', steamId);
    const userProfile = await steam.getSteamUserProfile(steamId, steamApiKey);
    console.log('BACKEND /steam/callback: User profile:', userProfile);
    
    if (!userProfile) {
      console.error('BACKEND /steam/callback: Failed to fetch user profile from Steam API');
      return c.json({ error: 'Failed to fetch user profile' }, 500);
    }

    // Store user session in KV store (expires in 7 days)
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    
    console.log('BACKEND /steam/callback: Storing session:', sessionId);
    await kv.set(`session:${sessionId}`, {
      ...userProfile,
      expiresAt,
    });

    console.log('=== BACKEND /steam/callback: Success! ===');
    return c.json({
      success: true,
      sessionId,
      user: userProfile,
    });
  } catch (error) {
    console.error('=== BACKEND /steam/callback: ERROR ===', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Get current user session
app.get("/make-server-e2cf3727/steam/user", async (c) => {
  try {
    console.log('=== BACKEND /steam/user: Request received ===');
    const sessionId = c.req.header('X-Session-ID');
    console.log('BACKEND /steam/user: Session ID:', sessionId ? 'exists' : 'missing');
    
    if (!sessionId) {
      console.log('BACKEND /steam/user: No session ID, returning 401');
      return c.json({ error: 'No session ID provided' }, 401);
    }

    console.log('BACKEND /steam/user: Fetching session from KV store...');
    const session = await kv.get(`session:${sessionId}`);
    console.log('BACKEND /steam/user: Session found?', !!session);
    
    if (!session) {
      console.log('BACKEND /steam/user: Session not found in KV store, returning 401');
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    // Check if session is expired
    if (session.expiresAt && session.expiresAt < Date.now()) {
      console.log('BACKEND /steam/user: Session expired, deleting...');
      await kv.del(`session:${sessionId}`);
      return c.json({ error: 'Session expired' }, 401);
    }

    // Get user profile data (including trade URL) from database
    const { data: userProfile } = await supabase
      .from('users')
      .select('trade_url')
      .eq('steam_id', session.steamId)
      .single();

    const userData = {
      ...session,
      tradeUrl: userProfile?.trade_url || null,
    };

    console.log('BACKEND /steam/user: Session valid, returning user:', userData.personaName);
    return c.json({ user: userData });
  } catch (error) {
    console.error('=== BACKEND /steam/user: ERROR ===', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Update user profile (trade URL)
app.post("/make-server-e2cf3727/steam/profile", async (c) => {
  try {
    console.log('=== BACKEND /steam/profile: Request received ===');
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session' }, 401);
    }

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
        steam_id: session.steamId,
        persona_name: session.personaName,
        avatar_url: session.avatarUrl,
        profile_url: session.profileUrl,
        trade_url: tradeUrl,
        last_login_at: new Date().toISOString(),
      }, {
        onConflict: 'steam_id'
      });

    if (upsertError) {
      console.error('Error updating user profile in database:', upsertError);
      return c.json({ error: 'Failed to update profile', details: upsertError.message }, 500);
    }

    console.log('BACKEND /steam/profile: Trade URL updated for user:', session.steamId);
    return c.json({ success: true, tradeUrl });
  } catch (error) {
    console.error('=== BACKEND /steam/profile: ERROR ===', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Logout - delete session
app.post("/make-server-e2cf3727/steam/logout", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    await kv.del(`session:${sessionId}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error during logout:', error);
    return c.json({ error: 'Logout failed' }, 500);
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
    return c.json({ error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
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
    return c.json({ error: 'Failed to get cache stats', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Create a new trade offer
app.post("/make-server-e2cf3727/offers/create", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session' }, 401);
    }

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

    // Get or create user profile in database
    const { data: existingProfile } = await supabase
      .from('users')
      .select('trade_url')
      .eq('steam_id', session.steamId)
      .single();

    let tradeUrl = existingProfile?.trade_url;

    // If no profile exists, create one
    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          steam_id: session.steamId,
          persona_name: session.personaName,
          avatar_url: session.avatarUrl,
          profile_url: session.profileUrl,
          last_login_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
      }
    }

    // Validate that user has set their trade URL
    if (!tradeUrl) {
      return c.json({ 
        error: 'Trade URL required. Please set your Steam Trade URL in settings before creating offers.' 
      }, 400);
    }

    // Create offer in database
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        user_steam_id: session.steamId,
        offering: sanitized.offering,
        seeking: sanitized.seeking,
        notes: sanitized.notes || null,
        status: 'active',
      })
      .select()
      .single();

    if (offerError) {
      console.error('Error creating offer in database:', offerError);
      return c.json({ error: 'Failed to create offer', details: offerError.message }, 500);
    }

    // Format response to match frontend expectations
    const formattedOffer = {
      id: offer.id,
      userId: session.steamId,
      userName: session.personaName,
      userAvatar: session.avatarUrl,
      userTradeUrl: tradeUrl,
      userProfileUrl: session.profileUrl,
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
    return c.json({ error: 'Failed to create offer' }, 500);
  }
});

// Get all active offers (marketplace feed)
app.get("/make-server-e2cf3727/offers/list", async (c) => {
  try {
    // Get all active offers from database
    const { data: offers, error } = await supabase
      .from('offers')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching offers from database:', error);
      return c.json({ error: 'Failed to fetch offers', details: error.message }, 500);
    }

    // Get unique user Steam IDs
    const userSteamIds = [...new Set(offers.map((offer: any) => offer.user_steam_id))];
    
    // Fetch user profiles for all users
    const { data: userProfiles, error: profileError } = await supabase
      .from('users')
      .select('steam_id, persona_name, avatar_url, profile_url, trade_url')
      .in('steam_id', userSteamIds);

    if (profileError) {
      console.error('Error fetching user profiles:', profileError);
      // Continue without user profiles
    }

    // Create a map of user profiles for quick lookup
    const profileMap = new Map();
    if (userProfiles) {
      userProfiles.forEach((profile: any) => {
        profileMap.set(profile.steam_id, profile);
      });
    }

    // Format offers to match frontend expectations
    const formattedOffers = offers.map((offer: any) => {
      const userProfile = profileMap.get(offer.user_steam_id);
      return {
        id: offer.id,
        userId: offer.user_steam_id,
        userName: userProfile?.persona_name || 'Unknown User',
        userAvatar: userProfile?.avatar_url || '',
        userTradeUrl: userProfile?.trade_url || null,
        userProfileUrl: userProfile?.profile_url || '',
        offering: offer.offering,
        seeking: offer.seeking,
        notes: offer.notes,
        timestamp: new Date(offer.created_at).getTime(),
        status: offer.status,
        views: offer.views || 0,
        uniqueViewers: [], // Not tracking this in new schema yet
      };
    });

    return c.json({ offers: formattedOffers });
  } catch (error) {
    console.error('Error fetching offers:', error);
    return c.json({ error: 'Failed to fetch offers', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Get single offer by ID
app.get("/make-server-e2cf3727/offers/:id", async (c) => {
  try {
    const offerId = c.req.param('id');
    
    const { data: offer, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (error) {
      console.error('Error fetching offer from database:', error);
      return c.json({ error: 'Failed to fetch offer' }, 500);
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    return c.json({ offer });
  } catch (error) {
    console.error('Error fetching offer:', error);
    return c.json({ error: 'Failed to fetch offer' }, 500);
  }
});

// Track offer view (real-time analytics)
app.post("/make-server-e2cf3727/offers/:id/view", async (c) => {
  try {
    const offerId = c.req.param('id');
    const sessionId = c.req.header('X-Session-ID');
    
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

    // Track viewer
    let viewerId = null;
    if (sessionId) {
      const session = await kv.get(`session:${sessionId}`) as any;
      if (session && session.steamId) {
        viewerId = session.steamId;
      }
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
    return c.json({ error: 'Failed to track view' }, 500);
  }
});

// Get user's own offers
app.get("/make-server-e2cf3727/offers/user/mine", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    const { data: offers, error } = await supabase
      .from('offers')
      .select('*')
      .eq('user_steam_id', session.steamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user offers from database:', error);
      return c.json({ error: 'Failed to fetch user offers' }, 500);
    }

    return c.json({ offers });
  } catch (error) {
    console.error('Error fetching user offers:', error);
    return c.json({ error: 'Failed to fetch user offers' }, 500);
  }
});

// Delete an offer
app.delete("/make-server-e2cf3727/offers/:id", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    const offerId = c.req.param('id');
    const { data: offer, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (error) {
      console.error('Error fetching offer from database:', error);
      return c.json({ error: 'Failed to fetch offer' }, 500);
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Verify ownership
    if (offer.user_steam_id !== session.steamId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Delete offer
    const { error: deleteError } = await supabase
      .from('offers')
      .delete()
      .eq('id', offerId);

    if (deleteError) {
      console.error('Error deleting offer from database:', deleteError);
      return c.json({ error: 'Failed to delete offer' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting offer:', error);
    return c.json({ error: 'Failed to delete offer' }, 500);
  }
});

// Update an offer
app.put("/make-server-e2cf3727/offers/:id", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    const offerId = c.req.param('id');
    const { data: offer, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (error) {
      console.error('Error fetching offer from database:', error);
      return c.json({ error: 'Failed to fetch offer' }, 500);
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Verify ownership
    if (offer.user_steam_id !== session.steamId) {
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
      return c.json({ error: 'Failed to update offer' }, 500);
    }

    console.log('Offer updated:', offerId);
    return c.json({ success: true, offer });
  } catch (error) {
    console.error('Error updating offer:', error);
    return c.json({ error: 'Failed to update offer' }, 500);
  }
});

// Initiate trade request (when user finds a match)
app.post("/make-server-e2cf3727/offers/:id/request", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    const offerId = c.req.param('id');
    const { data: offer, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (error) {
      console.error('Error fetching offer from database:', error);
      return c.json({ error: 'Failed to fetch offer' }, 500);
    }

    if (!offer) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    // Can't request your own offer
    if (offer.user_steam_id === session.steamId) {
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
        requester_steam_id: session.steamId,
        offer_owner_steam_id: offer.user_steam_id,
        message: sanitized.message || null,
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating trade request in database:', requestError);
      return c.json({ error: 'Failed to create trade request', details: requestError.message }, 500);
    }

    // Format response to match frontend expectations
    const formattedRequest = {
      id: request.id,
      offerId: request.offer_id,
      requesterId: session.steamId,
      requesterName: session.personaName,
      requesterAvatar: session.avatarUrl,
      offerOwnerId: offer.user_steam_id,
      message: request.message,
      timestamp: new Date(request.created_at).getTime(),
      status: request.status,
    };

    console.log('Trade request created in database:', request.id);
    return c.json({ success: true, request: formattedRequest });
  } catch (error) {
    console.error('Error creating trade request:', error);
    return c.json({ error: 'Failed to create trade request' }, 500);
  }
});

// Get user's trade requests (received)
app.get("/make-server-e2cf3727/requests/received", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    // Get all trade requests where user is the offer owner
    const { data: requests, error } = await supabase
      .from('trade_requests')
      .select(`
        *,
        offers!trade_requests_offer_id_fkey (
          offering,
          seeking,
          notes
        )
      `)
      .eq('offer_owner_steam_id', session.steamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trade requests from database:', error);
      return c.json({ error: 'Failed to fetch trade requests' }, 500);
    }

    // Format requests to match frontend expectations
    // Note: We don't have requester profile data yet, would need to join with user_statistics
    const formattedRequests = requests.map((request: any) => ({
      id: request.id,
      offerId: request.offer_id,
      requesterId: request.requester_steam_id,
      requesterName: 'Steam User', // Would need to join with user_statistics
      requesterAvatar: '', // Would need to join with user_statistics
      offerOwnerId: request.offer_owner_steam_id,
      message: request.message,
      timestamp: new Date(request.created_at).getTime(),
      status: request.status,
    }));

    return c.json({ requests: formattedRequests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    return c.json({ error: 'Failed to fetch requests' }, 500);
  }
});

// ===== REPUTATION SYSTEM =====

// Submit a reputation vote (completed trade or reversed trade)
app.post("/make-server-e2cf3727/reputation/vote", async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({ error: 'No session ID provided' }, 401);
    }

    const session = await kv.get(`session:${sessionId}`) as any;
    
    if (!session || !session.steamId) {
      return c.json({ error: 'Invalid session' }, 401);
    }

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
    if (targetSteamId === session.steamId) {
      return c.json({ error: 'Cannot vote for yourself' }, 400);
    }

    const voterSteamId = session.steamId;

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
          return c.json({ error: 'Failed to update vote' }, 500);
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
        return c.json({ error: 'Failed to submit vote', details: insertError.message }, 500);
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
    return c.json({ error: 'Failed to submit vote' }, 500);
  }
});

// Get reputation for a specific user
app.get("/make-server-e2cf3727/reputation/:steamId", async (c) => {
  try {
    const steamId = c.req.param('steamId');
    
    if (!steamId) {
      return c.json({ error: 'steamId is required' }, 400);
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

    // Check if current user has voted
    let userVote = null;
    const sessionId = c.req.header('X-Session-ID');
    if (sessionId) {
      const session = await kv.get(`session:${sessionId}`) as any;
      if (session?.steamId) {
        const { data: vote } = await supabase
          .from('reputation_votes')
          .select('vote_type')
          .eq('voter_steam_id', session.steamId)
          .eq('target_steam_id', steamId)
          .single();
        
        if (vote) {
          userVote = vote.vote_type;
        }
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
    return c.json({ error: 'Failed to fetch reputation' }, 500);
  }
});

Deno.serve(app.fetch);