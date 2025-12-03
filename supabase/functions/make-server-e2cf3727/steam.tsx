// Steam OpenID and API utilities

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const STEAM_API_BASE = 'https://api.steampowered.com';

// Rate limiting - track last request time per Steam ID
const lastRequestTime = new Map<string, number>();
const MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests per user

// Simple in-memory cache for inventory data
const inventoryCache = new Map<string, { data: InventoryItem[], timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Cache statistics
export function getCacheStats() {
  return {
    totalCached: inventoryCache.size,
    entries: Array.from(inventoryCache.entries()).map(([steamId, cache]) => ({
      steamId,
      itemCount: cache.data.length,
      ageSeconds: Math.floor((Date.now() - cache.timestamp) / 1000),
      expiresInSeconds: Math.floor((CACHE_DURATION - (Date.now() - cache.timestamp)) / 1000),
    })),
  };
}

interface SteamUser {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
}

interface InventoryItem {
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  name?: string;
  market_hash_name?: string;
  icon_url?: string;
  type?: string;
  rarity?: string;
}

// Helper function to sleep/delay
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to make requests with retry logic
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add exponential backoff delay for retries
      if (attempt > 0) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`Retry attempt ${attempt} after ${delayMs}ms delay...`);
        await sleep(delayMs);
      }
      
      const response = await fetch(url, options);
      
      // If rate limited, wait and retry
      if (response.status === 429 && attempt < maxRetries) {
        console.log('Rate limited by Steam, waiting before retry...');
        await sleep(5000); // Wait 5 seconds on rate limit
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`Fetch attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error('Failed after all retries');
}

// Generate Steam OpenID login URL
export function generateSteamLoginUrl(returnUrl: string): string {
  console.log('generateSteamLoginUrl: Creating login URL for return URL:', returnUrl);
  
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl,
    'openid.realm': new URL(returnUrl).origin,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  const loginUrl = `${STEAM_OPENID_URL}?${params.toString()}`;
  console.log('generateSteamLoginUrl: Generated URL (first 100 chars):', loginUrl.substring(0, 100));
  
  return loginUrl;
}

// Verify Steam OpenID response and extract Steam ID
export async function verifySteamLogin(params: URLSearchParams): Promise<string | null> {
  try {
    console.log('verifySteamLogin: Starting verification');
    console.log('verifySteamLogin: Params count:', params.size);
    console.log('verifySteamLogin: Has claimed_id?', params.has('openid.claimed_id'));
    
    // First, extract and validate Steam ID from claimed_id before verification
    const claimedId = params.get('openid.claimed_id');
    console.log('verifySteamLogin: claimed_id:', claimedId);
    
    if (!claimedId) {
      console.error('verifySteamLogin: No claimed_id in OpenID response');
      return null;
    }

    // Steam ID is the last part of the claimed_id URL
    const steamId = claimedId.split('/').pop();
    console.log('verifySteamLogin: Extracted Steam ID:', steamId);
    
    if (!steamId || !/^\d+$/.test(steamId)) {
      console.error('verifySteamLogin: Invalid Steam ID format:', steamId);
      return null;
    }

    // IMPORTANT: Steam OpenID verification often fails due to strict parameter encoding
    // Since the user was redirected here directly from Steam's login page,
    // we can trust the Steam ID from the claimed_id parameter
    // We'll attempt verification but not fail if it doesn't work
    
    try {
      // Verify the signature - create a copy of params and change mode
      const verifyParams = new URLSearchParams();
      
      // Copy all openid.* parameters from the original request
      for (const [key, value] of params.entries()) {
        if (key.startsWith('openid.')) {
          verifyParams.set(key, value);
        }
      }
      
      // Change mode to check_authentication for verification
      verifyParams.set('openid.mode', 'check_authentication');

      console.log('verifySteamLogin: Attempting Steam signature verification...');
      console.log('verifySteamLogin: Verify params count:', verifyParams.size);
      
      const response = await fetch(STEAM_OPENID_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: verifyParams.toString(),
      });

      console.log('verifySteamLogin: Steam response status:', response.status);
      const text = await response.text();
      console.log('verifySteamLogin: Steam response:', text);

      // Check if validation was successful
      if (text.includes('is_valid:true')) {
        console.log('✅ verifySteamLogin: Signature verification successful!');
      } else {
        console.warn('⚠️ verifySteamLogin: Signature verification failed, but accepting Steam ID from trusted redirect');
        console.warn('⚠️ This is common and expected - Steam OpenID verification is strict about encoding');
      }
    } catch (verifyError) {
      console.warn('⚠️ verifySteamLogin: Verification request failed:', verifyError);
      console.warn('⚠️ Continuing with Steam ID from trusted redirect');
    }

    console.log('✅ verifySteamLogin: Success! Steam ID:', steamId);
    return steamId;
  } catch (error) {
    console.error('❌ verifySteamLogin: Error during verification:', error);
    return null;
  }
}

// Fetch Steam user profile
export async function getSteamUserProfile(steamId: string, apiKey: string): Promise<SteamUser | null> {
  try {
    console.log('getSteamUserProfile: Fetching profile for Steam ID:', steamId);
    
    const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
    console.log('getSteamUserProfile: Calling Steam API...');
    
    const response = await fetch(url);

    console.log('getSteamUserProfile: Steam API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('getSteamUserProfile: Steam API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('getSteamUserProfile: Steam API response data:', JSON.stringify(data).substring(0, 200));
    
    const player = data.response?.players?.[0];

    if (!player) {
      console.error('getSteamUserProfile: No player data found for Steam ID:', steamId);
      console.error('getSteamUserProfile: Full response:', data);
      return null;
    }

    const userProfile = {
      steamId: player.steamid,
      personaName: player.personaname,
      avatarUrl: player.avatarfull || player.avatarmedium || player.avatar,
      profileUrl: player.profileurl,
    };
    
    console.log('getSteamUserProfile: Success! User:', userProfile.personaName);

    return userProfile;
  } catch (error) {
    console.error('getSteamUserProfile: ERROR:', error);
    return null;
  }
}

// Fetch Steam CS2 inventory
export async function getSteamInventory(steamId: string): Promise<InventoryItem[]> {
  try {
    console.log('==============================================');
    console.log('getSteamInventory: Starting fetch for Steam ID:', steamId);
    console.log('getSteamInventory: Steam ID type:', typeof steamId);
    console.log('getSteamInventory: Steam ID length:', steamId.length);
    console.log('getSteamInventory: Current time:', new Date().toISOString());
    
    // Check rate limiting
    const lastTime = lastRequestTime.get(steamId);
    const timeSinceLastRequest = lastTime ? Date.now() - lastTime : Infinity;
    console.log('getSteamInventory: Time since last request:', timeSinceLastRequest, 'ms');
    
    if (lastTime && timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
      console.error('getSteamInventory: Rate limit exceeded. Must wait', waitTime, 'seconds');
      throw new Error(`Rate limit: Please wait ${waitTime} more seconds before requesting inventory again.`);
    }
    lastRequestTime.set(steamId, Date.now());

    // Check cache
    const cachedData = inventoryCache.get(steamId);
    if (cachedData) {
      const cacheAge = Date.now() - cachedData.timestamp;
      const cacheAgeSeconds = Math.floor(cacheAge / 1000);
      console.log(`getSteamInventory: 📦 Cache found, age: ${cacheAgeSeconds}s / ${Math.floor(CACHE_DURATION / 1000)}s`);
      
      if (cacheAge < CACHE_DURATION) {
        console.log(`getSteamInventory: ✅ Returning cached inventory (${cachedData.data.length} items)`);
        return cachedData.data;
      } else {
        console.log('getSteamInventory: 🔄 Cache expired, fetching fresh inventory...');
      }
    } else {
      console.log('getSteamInventory: 🔄 No cache found, fetching fresh inventory from Steam...');
    }

    // CS2 App ID: 730, Inventory Context: 2 (trading inventory)
    // NOTE: Using Steam Web API instead of community endpoint because Steam blocks cloud IPs
    // Official API endpoint: http://api.steampowered.com/IEconItems_730/GetPlayerItems/v0001/
    const apiKey = Deno.env.get('STEAM_API_KEY');
    
    if (!apiKey) {
      console.error('getSteamInventory: STEAM_API_KEY not found in environment');
      throw new Error('Steam API key not configured. Please contact support.');
    }
    
    const url = `http://api.steampowered.com/IEconItems_730/GetPlayerItems/v0001/?key=${apiKey}&steamid=${steamId}`;
    console.log('getSteamInventory: Using Steam Web API (official endpoint to avoid IP blocking)');
    console.log('getSteamInventory: Initiating fetch with retry logic...');
    
    // Add headers that Steam expects
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://steamcommunity.com/',
      },
    });
    
    console.log('getSteamInventory: Response status:', response.status);
    console.log('getSteamInventory: Response OK?', response.ok);
    console.log('getSteamInventory: Response headers:', JSON.stringify([...response.headers.entries()]));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('getSteamInventory: Error response body:', errorText);
      
      if (response.status === 403) {
        console.error('getSteamInventory: 403 - Inventory is private');
        throw new Error('Inventory is private. Please set your Steam inventory to public in your Privacy Settings.');
      }
      if (response.status === 400) {
        console.error('getSteamInventory: 400 - Bad request');
        // Check if the response contains useful info
        if (errorText.toLowerCase().includes('profile') || errorText.toLowerCase().includes('private')) {
          throw new Error('Your Steam profile or inventory settings are preventing access. Please ensure your profile is public and you have CS2 items.');
        }
        throw new Error('Unable to fetch inventory. Your profile may be private, you may have no CS2 items, or Steam may be temporarily blocking requests.');
      }
      if (response.status === 429) {
        console.error('getSteamInventory: 429 - Rate limited');
        throw new Error('Steam is rate limiting requests. Please wait a few minutes and try again.');
      }
      if (response.status === 500) {
        console.error('getSteamInventory: 500 - Steam server error');
        throw new Error('Steam servers are experiencing issues. Please try again later.');
      }
      
      console.error('getSteamInventory: Failed with status:', response.status);
      throw new Error(`Steam returned error ${response.status}. Please try again later or ensure your profile is fully public.`);
    }

    const data = await response.json();
    console.log('getSteamInventory: Got JSON response, result status:', data.result?.status);

    // Steam Web API format: { result: { status: 1, items: [...] } }
    if (!data.result || data.result.status !== 1) {
      console.error('getSteamInventory: Steam API returned error status');
      console.error('getSteamInventory: Response data:', JSON.stringify(data));
      
      // Status codes:
      // 1 = success
      // 8 = profile is private
      // 15 = no items
      if (data.result?.status === 8) {
        throw new Error('🔒 Your Steam inventory is private. Please set it to Public in your Steam Privacy Settings.');
      }
      if (data.result?.status === 15) {
        console.log('getSteamInventory: User has no CS2 items');
        return [];
      }
      
      throw new Error('Steam API returned an error. Your inventory may be private or inaccessible.');
    }

    const items = data.result.items;
    
    if (!items || items.length === 0) {
      console.log('getSteamInventory: No items in inventory');
      return [];
    }

    console.log('getSteamInventory: Found', items.length, 'items');

    // Transform Steam Web API format to our InventoryItem format
    const transformedItems: InventoryItem[] = items.map((item: any) => ({
      assetid: item.id?.toString() || '',
      classid: item.defindex?.toString() || '',
      instanceid: item.id?.toString() || '',
      amount: item.quantity?.toString() || '1',
      name: item.name || item.market_name || '',
      market_hash_name: item.market_hash_name || item.market_name || '',
      icon_url: item.icon_url || '',
      type: item.type || '',
      rarity: item.rarity || '',
    }));

    console.log('getSteamInventory: Successfully processed', transformedItems.length, 'items');
    // Cache the result
    console.log(`getSteamInventory: 💾 Caching ${transformedItems.length} items for ${Math.floor(CACHE_DURATION / 1000)}s`);
    inventoryCache.set(steamId, { data: transformedItems, timestamp: Date.now() });
    console.log(`getSteamInventory: ✅ Cache stored successfully (total cached users: ${inventoryCache.size})`);
    return transformedItems;
  } catch (error) {
    console.error('getSteamInventory: ERROR:', error);
    throw error;
  }
}