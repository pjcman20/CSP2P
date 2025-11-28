/**
 * Professional Steam Inventory Management
 * 
 * IMPORTANT: Steam does NOT support CORS (no Access-Control-Allow-Origin header)
 * This means client-side fetching is IMPOSSIBLE without a proxy.
 * 
 * Real trading platforms handle this by:
 * 1. Backend proxy (our approach)
 * 2. Browser extension (not feasible for web apps)
 * 3. Manual item entry (fallback)
 * 4. Trade bots (for actual trade execution, not discovery)
 * 
 * Our strategy:
 * - Try backend proxy (only reliable method)
 * - Aggressive caching (15min) to reduce Steam API calls
 * - Rate limiting to avoid getting blocked
 * - Clear error messages + manual entry fallback
 */

import { getCachedUser, getSessionId } from './steamAuth';
import { projectId, publicAnonKey } from './supabase/info';

export interface InventoryItem {
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  name: string;
  market_hash_name: string;
  icon_url: string;
  type: string;
  rarity: string;
}

interface CachedInventory {
  items: InventoryItem[];
  timestamp: number;
  steamId: string;
}

// Cache configuration (prevent hammering Steam)
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_DELAY = 3000; // 3 seconds between requests
let lastFetchTime = 0;

// In-memory cache
let inventoryCache: CachedInventory | null = null;

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e2cf3727`;

/**
 * Extract rarity from item description
 */
function extractRarity(description: any): string {
  if (!description.tags) return 'common';
  
  const rarityTag = description.tags.find((tag: any) => tag.category === 'Rarity');
  if (!rarityTag) return 'common';
  
  const rarity = rarityTag.internal_name || rarityTag.localized_tag_name || '';
  return rarity.toLowerCase();
}

/**
 * Fetch inventory via backend proxy
 * This is the ONLY reliable method due to CORS restrictions
 */
async function fetchInventoryViaBackend(sessionId: string): Promise<InventoryItem[]> {
  console.log('🎮 Fetching inventory via backend proxy...');
  
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
    
    // Steam-specific error handling
    if (response.status === 403) {
      throw new Error(
        '🔒 Your Steam inventory is private or inaccessible.\n\n' +
        'To fix this:\n' +
        '1. Go to Steam → Profile → Edit Profile → Privacy Settings\n' +
        '2. Set "My Profile" to Public\n' +
        '3. Set "Game details" to Public\n' +
        '4. Set "Inventory" to Public\n' +
        '5. Wait 1-2 minutes for changes to propagate\n' +
        '6. Try again'
      );
    }
    
    if (response.status === 429) {
      throw new Error(
        '⚠️ Steam is rate limiting requests.\n\n' +
        'Please wait 5 minutes before trying again.\n' +
        'This happens when too many requests are made to Steam\'s servers.'
      );
    }

    if (errorData.steamResponse) {
      console.error('🎮 Raw Steam response:', errorData.steamResponse);
    }
    
    // Generic error with details
    throw new Error(
      errorData.message || 
      errorData.error || 
      `Failed to fetch inventory (Status: ${response.status})`
    );
  }

  const data = await response.json();
  console.log('🎮 Backend response received, success:', data.success);
  
  if (!data.success || !data.assets || !data.descriptions) {
    throw new Error('Invalid response from Steam API');
  }

  return processInventoryData(data);
}

/**
 * Process raw Steam inventory data into our format
 */
function processInventoryData(data: any): InventoryItem[] {
  const assets = data.assets || [];
  const descriptions = data.descriptions || [];
  
  console.log('🎮 Processing', assets.length, 'assets and', descriptions.length, 'descriptions');
  
  if (assets.length === 0) {
    console.log('🎮 No items in inventory');
    return [];
  }
  
  // Create description map
  const descriptionMap = new Map<string, any>();
  for (const desc of descriptions) {
    const key = `${desc.classid}_${desc.instanceid}`;
    descriptionMap.set(key, desc);
  }
  
  // Combine assets with descriptions
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
}

/**
 * Main function: Fetch inventory with caching and rate limiting
 * 
 * Professional approach:
 * 1. Check cache first (15min TTL)
 * 2. Rate limit requests (3s delay)
 * 3. Fetch via backend proxy (only reliable method)
 * 4. Cache successful results
 * 5. Provide clear error messages
 */
export async function fetchUserInventory(): Promise<InventoryItem[]> {
  const cachedUser = getCachedUser();
  const sessionId = getSessionId();
  
  if (!cachedUser?.steamId || !sessionId) {
    throw new Error('Not authenticated with Steam');
  }

  const steamId = cachedUser.steamId;
  
  // Step 1: Check cache (CRITICAL - prevents rate limiting)
  if (inventoryCache && 
      inventoryCache.steamId === steamId && 
      Date.now() - inventoryCache.timestamp < CACHE_DURATION) {
    const cacheAge = Math.round((Date.now() - inventoryCache.timestamp) / 1000);
    console.log(`🎮 ✅ Returning cached inventory (${inventoryCache.items.length} items, age: ${cacheAge}s)`);
    return inventoryCache.items;
  }
  
  // Step 2: Rate limiting (CRITICAL - prevents blocking)
  const timeSinceLastFetch = Date.now() - lastFetchTime;
  if (timeSinceLastFetch < RATE_LIMIT_DELAY) {
    const waitTime = Math.ceil((RATE_LIMIT_DELAY - timeSinceLastFetch) / 1000);
    throw new Error(
      `⏳ Please wait ${waitTime} seconds before fetching inventory again.\n\n` +
      `This prevents Steam from rate limiting or blocking our requests.`
    );
  }
  
  console.log('🎮 Fetching fresh inventory for Steam ID:', steamId);
  
  lastFetchTime = Date.now();
  
  try {
    // Step 3: Fetch via backend (only reliable method)
    const items = await fetchInventoryViaBackend(sessionId);
    
    // Step 4: Cache successful result
    inventoryCache = {
      items,
      timestamp: Date.now(),
      steamId,
    };
    
    console.log(`🎮 ✅ Successfully fetched and cached ${items.length} items`);
    return items;
  } catch (error) {
    console.error('🎮 ❌ Failed to fetch inventory:', error);
    
    // Re-throw with context if not already a user-friendly error
    if (error instanceof Error && (error.message.includes('🔒') || error.message.includes('⚠️') || error.message.includes('⏳'))) {
      throw error;
    }
    
    throw new Error(
      'Failed to load your CS:GO inventory.\n\n' +
      'Common causes:\n' +
      '• Steam inventory privacy is not set to Public\n' +
      '• Your Steam profile is private\n' +
      '• Steam is temporarily blocking requests\n' +
      '• You have no CS:GO items\n\n' +
      'Error details: ' + (error instanceof Error ? error.message : String(error))
    );
  }
}

/**
 * Clear the cache (for manual refresh)
 */
export function clearInventoryCache(): void {
  inventoryCache = null;
  lastFetchTime = 0;
  console.log('🎮 Inventory cache cleared');
}

/**
 * Get cache status (for debugging UI)
 */
export function getInventoryCacheStatus(): {
  cached: boolean;
  age: number | null;
  itemCount: number | null;
  canRefresh: boolean;
} {
  const timeSinceLastFetch = Date.now() - lastFetchTime;
  const canRefresh = timeSinceLastFetch >= RATE_LIMIT_DELAY;
  
  if (!inventoryCache) {
    return { 
      cached: false, 
      age: null, 
      itemCount: null,
      canRefresh,
    };
  }
  
  return {
    cached: true,
    age: Date.now() - inventoryCache.timestamp,
    itemCount: inventoryCache.items.length,
    canRefresh,
  };
}