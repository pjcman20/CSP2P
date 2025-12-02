import { projectId, publicAnonKey } from './supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e2cf3727`;

export interface SteamUser {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  tradeUrl?: string | null;
}

export interface InventoryItem {
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

// Session management - DEPRECATED: Now using Supabase Auth sessions
// Keeping these for backward compatibility during migration, but they're no longer used
// TODO: Remove after confirming no components use them
export function getSessionId(): string | null {
  // Deprecated - Supabase Auth handles sessions now
  return null;
}

export function setSessionId(_sessionId: string): void {
  // Deprecated - Supabase Auth handles sessions now
  // No-op
}

export function clearSessionId(): void {
  // Deprecated - Supabase Auth handles sessions now
  // No-op
}

// User caching
export function getCachedUser(): SteamUser | null {
  const cached = localStorage.getItem('steam_user');
  if (!cached) return null;
  
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export function setCachedUser(user: SteamUser): void {
  localStorage.setItem('steam_user', JSON.stringify(user));
}

export function clearCachedUser(): void {
  localStorage.removeItem('steam_user');
}

// Test inventory access (diagnostic tool) - DISABLED (inventory endpoint disabled)
export async function testInventoryAccess(): Promise<any> {
  throw new Error('Inventory access is disabled. Steam blocks cloud IPs. Use manual item entry instead.');
  
  /* Old implementation (disabled):
  try {
    const { getAccessToken } = await import('./supabaseClient');
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('No session found. Please log in first.');
    }

    console.log('🔍 Running inventory diagnostic test...');
    
    const response = await fetch(`${SERVER_URL}/steam/inventory/test`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Test failed');
    }

    const data = await response.json();
    console.log('📊 Diagnostic Results:', data);
    return data;
  } catch (error) {
    console.error('🔍 Diagnostic test failed:', error);
    throw error;
  }
  */
}

// Initiate Steam login
export async function initiatesteamLogin(): Promise<void> {
  try {
    console.log('=== STEAM LOGIN: Starting ===');
    
    // The callback URL that Steam will redirect back to
    const returnUrl = `${window.location.origin}/steam-callback`;
    console.log('STEAM LOGIN: Return URL:', returnUrl);
    
    const serverUrl = `${SERVER_URL}/steam/login?return_url=${encodeURIComponent(returnUrl)}`;
    console.log('STEAM LOGIN: Calling server at:', serverUrl);
    
    const response = await fetch(serverUrl, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    console.log('STEAM LOGIN: Server response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('STEAM LOGIN: Server error response:', errorText);
      throw new Error('Failed to get Steam login URL');
    }

    const data = await response.json();
    console.log('STEAM LOGIN: Server response data:', data);
    
    if (!data.loginUrl) {
      console.error('STEAM LOGIN: No login URL in response');
      throw new Error('No login URL returned');
    }

    console.log('STEAM LOGIN: Redirecting to Steam at:', data.loginUrl);
    // Redirect to Steam login page
    window.location.href = data.loginUrl;
  } catch (error) {
    console.error('=== STEAM LOGIN: ERROR ===', error);
    throw error;
  }
}

// Process Steam callback (called after Steam redirects back)
export async function processSteamCallback(queryParams: URLSearchParams): Promise<SteamUser> {
  try {
    console.log('processSteamCallback: Starting');
    console.log('processSteamCallback: Building callback URL');
    
    // Forward all OpenID parameters to backend for verification
    const callbackUrl = `${SERVER_URL}/steam/callback?${queryParams.toString()}`;
    
    console.log('processSteamCallback: Calling backend:', callbackUrl);
    
    const response = await fetch(callbackUrl, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    console.log('processSteamCallback: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('processSteamCallback: Error response:', errorText);
      console.error('processSteamCallback: Response status:', response.status);
      console.error('processSteamCallback: Response headers:', Object.fromEntries(response.headers.entries()));
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText };
      }
      
      // Include more details in error message - prioritize message field
      const errorMessage = error.message || error.error || error.details || errorText || 'Authentication failed';
      console.error('processSteamCallback: Parsed error:', error);
      console.error('processSteamCallback: Error message:', errorMessage);
      console.error('processSteamCallback: Full error object:', JSON.stringify(error, null, 2));
      
      const fullError = new Error(`${errorMessage} (Status: ${response.status})`);
      (fullError as any).status = response.status;
      (fullError as any).details = error;
      throw fullError;
    }

    const data = await response.json();
    
    console.log('processSteamCallback: Response data:', data);
    
    // Validate response structure
    if (!data.success) {
      throw new Error(data.error || 'Authentication failed');
    }
    
    if (!data.session || !data.session.access_token || !data.session.refresh_token) {
      console.error('processSteamCallback: Invalid session data:', data);
      throw new Error('Invalid response from server: missing session tokens');
    }
    
    if (!data.user) {
      console.error('processSteamCallback: Missing user data:', data);
      throw new Error('Invalid response from server: missing user data');
    }

    // Set Supabase Auth session using the tokens from backend
    console.log('processSteamCallback: Setting Supabase Auth session...');
    const { supabase } = await import('./supabaseClient');
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    if (sessionError) {
      console.error('processSteamCallback: Error setting session:', sessionError);
      throw new Error('Failed to set authentication session');
    }

    console.log('processSteamCallback: Supabase Auth session set successfully');

    // Cache user info (for backward compatibility)
    setCachedUser(data.user);

    console.log('processSteamCallback: Success, user:', data.user.personaName);

    return data.user;
  } catch (error) {
    console.error('Error processing Steam callback:', error);
    throw error;
  }
}

// User cache to prevent excessive REST requests
let userCache: { user: SteamUser; expires: number } | null = null;
const USER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get current user (using Supabase Auth)
export async function getCurrentUser(forceRefresh = false): Promise<SteamUser | null> {
  try {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh && userCache && userCache.expires > Date.now()) {
      console.log('getCurrentUser: Returning cached user (saved REST request)');
      return userCache.user;
    }

    // Check Supabase Auth session first
    const { supabase, getAccessToken } = await import('./supabaseClient');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('getCurrentUser: No Supabase Auth session');
      userCache = null; // Clear cache if no session
      return null;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('getCurrentUser: No access token');
      userCache = null; // Clear cache if no token
      return null;
    }

    // Fetch user from backend API (which has trade URL from database)
    console.log('getCurrentUser: Fetching user from server...');
    const response = await fetch(`${SERVER_URL}/steam/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.log('getCurrentUser: Session invalid, signing out');
      userCache = null; // Clear cache on error
      await supabase.auth.signOut();
      return null;
    }

    const data = await response.json();
    if (data.user) {
      // Cache user data to reduce REST requests
      userCache = {
        user: data.user,
        expires: Date.now() + USER_CACHE_DURATION
      };
      setCachedUser(data.user);
      console.log('getCurrentUser: User found and cached:', data.user.personaName);
      return data.user;
    }

    userCache = null;
    return null;
  } catch (error) {
    console.error('Error fetching current user:', error);
    userCache = null; // Clear cache on error
    return null;
  }
}

// Clear user cache (call when user logs out or updates profile)
export function clearUserCache(): void {
  userCache = null;
  clearCachedUser(); // Also clear localStorage cache
}

// Logout (using Supabase Auth)
export async function logout(): Promise<void> {
  try {
    const { supabase } = await import('./supabaseClient');
    await supabase.auth.signOut();
    clearUserCache(); // Clear both cache and localStorage
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
}

// Get user inventory - BACKEND PROXY
export async function getUserInventory(): Promise<InventoryItem[]> {
  const cachedUser = getCachedUser();
  
  if (!cachedUser) {
    throw new Error('Not authenticated');
  }

  try {
    const { getAccessToken } = await import('./supabaseClient');
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    console.log('🎮 Fetching inventory via backend...');

    const response = await fetch(`${SERVER_URL}/steam/inventory`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log('🎮 Backend response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('🎮 Backend error:', errorData);
      
      if (response.status === 403) {
        throw new Error('🔒 Your Steam inventory is private.\n\nTo fix this:\n1. Go to Steam → Profile → Edit Profile → Privacy Settings\n2. Set "My Profile" to Public\n3. Set "Game details" to Public\n4. Set "Inventory" to Public\n5. Try again');
      }
      
      if (response.status === 429) {
        throw new Error('⚠️ Steam is temporarily rate limiting requests.\n\nPlease wait 2-3 minutes before trying again.');
      }
      
      throw new Error(errorData.message || errorData.error || 'Failed to fetch inventory');
    }

    const data = await response.json();
    console.log('🎮 Backend response data:', data);
    
    if (!data.success) {
      throw new Error('Failed to fetch inventory from Steam');
    }

    const assets = data.assets || [];
    const descriptions = data.descriptions || [];

    console.log('🎮 Found', assets.length, 'assets and', descriptions.length, 'descriptions');

    if (assets.length === 0) {
      console.log('🎮 No items in inventory');
      return [];
    }

    // Create a map of descriptions by classid + instanceid
    const descriptionMap = new Map<string, any>();
    for (const desc of descriptions) {
      const key = `${desc.classid}_${desc.instanceid}`;
      descriptionMap.set(key, desc);
    }

    // Combine assets with their descriptions
    const items: InventoryItem[] = assets.map((asset: any) => {
      const key = `${asset.classid}_${asset.instanceid}`;
      const description = descriptionMap.get(key) || {};

      return {
        assetid: asset.assetid,
        classid: asset.classid,
        instanceid: asset.instanceid,
        amount: asset.amount || '1',
        name: description.name || description.market_hash_name || 'Unknown Item',
        market_hash_name: description.market_hash_name || '',
        icon_url: description.icon_url || '',
        type: description.type || '',
        rarity: extractRarity(description),
      };
    });

    console.log('🎮 Successfully processed', items.length, 'items');
    return items;
  } catch (error) {
    console.error('🎮 Error fetching inventory:', error);
    
    // Re-throw with user-friendly message if not already formatted
    if (error instanceof Error && error.message.includes('🔒')) {
      throw error;
    }
    
    throw new Error('Failed to load inventory. Please ensure your Steam profile and inventory are set to public.');
  }
}

// Helper to extract rarity from Steam item description
function extractRarity(description: any): string {
  if (!description.tags) return 'common';
  
  // Find the rarity tag
  const rarityTag = description.tags.find((tag: any) => tag.category === 'Rarity');
  if (!rarityTag) return 'common';
  
  // Map Steam rarity names to our format
  const rarityMap: Record<string, string> = {
    'Rarity_Common': 'consumer',
    'Rarity_Common_Weapon': 'consumer',
    'Rarity_Uncommon': 'industrial',
    'Rarity_Uncommon_Weapon': 'industrial',
    'Rarity_Rare': 'milspec',
    'Rarity_Rare_Weapon': 'milspec',
    'Rarity_Mythical': 'restricted',
    'Rarity_Mythical_Weapon': 'restricted',
    'Rarity_Legendary': 'classified',
    'Rarity_Legendary_Weapon': 'classified',
    'Rarity_Ancient': 'covert',
    'Rarity_Ancient_Weapon': 'covert',
    'Rarity_Contraband': 'gold',
  };
  
  return rarityMap[rarityTag.internal_name] || 'common';
}

// Update user's trade URL
export async function updateTradeUrl(tradeUrl: string): Promise<void> {
  try {
    const { getAccessToken } = await import('./supabaseClient');
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${SERVER_URL}/steam/profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tradeUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update trade URL');
    }

    // Update cached user
    const currentUser = getCachedUser();
    if (currentUser) {
      currentUser.tradeUrl = tradeUrl;
      setCachedUser(currentUser);
    }
  } catch (error) {
    console.error('Error updating trade URL:', error);
    throw error;
  }
}