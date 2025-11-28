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

// Session management
export function getSessionId(): string | null {
  return localStorage.getItem('steam_session_id');
}

export function setSessionId(sessionId: string): void {
  localStorage.setItem('steam_session_id', sessionId);
}

export function clearSessionId(): void {
  localStorage.removeItem('steam_session_id');
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

// Test inventory access (diagnostic tool)
export async function testInventoryAccess(): Promise<any> {
  try {
    const sessionId = getSessionId();
    if (!sessionId) {
      throw new Error('No session found. Please log in first.');
    }

    console.log('🔍 Running inventory diagnostic test...');
    
    const response = await fetch(`${SERVER_URL}/steam/inventory/test`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
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
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText };
      }
      
      throw new Error(error.error || 'Authentication failed');
    }

    const data = await response.json();
    
    console.log('processSteamCallback: Response data:', data);
    
    if (!data.success || !data.sessionId || !data.user) {
      throw new Error('Invalid response from server');
    }

    // Store session
    setSessionId(data.sessionId);
    setCachedUser(data.user);

    console.log('processSteamCallback: Success, user:', data.user.personaName);

    return data.user;
  } catch (error) {
    console.error('Error processing Steam callback:', error);
    throw error;
  }
}

// Get current user
export async function getCurrentUser(): Promise<SteamUser | null> {
  const sessionId = getSessionId();
  console.log('getCurrentUser: Session ID:', sessionId ? 'exists' : 'none');
  
  if (!sessionId) {
    console.log('getCurrentUser: No session ID, returning null');
    return null;
  }

  try {
    console.log('getCurrentUser: Fetching user from server...');
    const response = await fetch(`${SERVER_URL}/steam/user`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
      },
    });

    console.log('getCurrentUser: Response status:', response.status);

    if (!response.ok) {
      // Session invalid or expired
      console.log('getCurrentUser: Session invalid, clearing');
      clearSessionId();
      return null;
    }

    const data = await response.json();
    console.log('getCurrentUser: Response data:', data);
    
    if (data.user) {
      setCachedUser(data.user);
      console.log('getCurrentUser: User found:', data.user.personaName);
      return data.user;
    }

    console.log('getCurrentUser: No user in response');
    return null;
  } catch (error) {
    console.error('Error fetching current user:', error);
    clearSessionId();
    return null;
  }
}

// Logout
export async function logout(): Promise<void> {
  const sessionId = getSessionId();
  
  if (sessionId) {
    try {
      await fetch(`${SERVER_URL}/steam/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Session-ID': sessionId,
        },
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  clearSessionId();
}

// Get user inventory - BACKEND PROXY
export async function getUserInventory(): Promise<InventoryItem[]> {
  const sessionId = getSessionId();
  const cachedUser = getCachedUser();
  
  if (!sessionId || !cachedUser) {
    throw new Error('Not authenticated');
  }

  try {
    console.log('🎮 Fetching inventory via backend...');

    const response = await fetch(`${SERVER_URL}/steam/inventory`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
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
  const sessionId = getSessionId();
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`${SERVER_URL}/steam/profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-ID': sessionId,
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