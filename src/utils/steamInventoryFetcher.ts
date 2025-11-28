/**
 * Steam Inventory Fetcher
 * Fetches CS2 inventory from Steam Community using client-side requests
 * This bypasses backend IP blocking issues
 */

export interface SteamInventoryItem {
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  name: string;
  market_hash_name: string;
  market_name: string;
  type: string;
  icon_url: string;
  name_color?: string;
  background_color?: string;
  descriptions?: Array<{
    type: string;
    value: string;
    color?: string;
  }>;
  tradable: number;
  marketable: number;
  commodity: number;
  market_tradable_restriction?: number;
  fraudwarnings?: string[];
  tags?: Array<{
    category: string;
    internal_name: string;
    localized_category_name: string;
    localized_tag_name: string;
    color?: string;
  }>;
}

export interface ParsedInventoryItem {
  id: string;
  name: string;
  marketName: string;
  type: string;
  rarity: string;
  iconUrl: string;
  tradable: boolean;
  marketable: boolean;
  color?: string;
  wear?: string;
  statTrak?: boolean;
  souvenir?: boolean;
}

/**
 * Fetch CS2 inventory from Steam Community
 * Uses client-side fetch to bypass cloud IP blocks
 */
export async function fetchSteamInventory(steamId: string): Promise<ParsedInventoryItem[]> {
  console.log('🎮 Fetching Steam inventory for:', steamId);
  
  // CS2 App ID: 730, Context: 2 (tradeable items)
  const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;
  
  try {
    const response = await fetch(inventoryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Use no-cors if CORS is blocked, but this limits response access
      // credentials: 'omit',
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Steam inventory is private. Please set your inventory to Public in Steam Privacy Settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limited by Steam. Please wait a few minutes and try again.');
      }
      throw new Error(`Failed to fetch inventory: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Steam returned unsuccessful response. Inventory may be private.');
    }

    if (!data.assets || !data.descriptions) {
      console.warn('Empty inventory or invalid response');
      return [];
    }

    // Map assets to descriptions
    const items: ParsedInventoryItem[] = [];
    
    for (const asset of data.assets) {
      const description = data.descriptions.find(
        (desc: any) => desc.classid === asset.classid && desc.instanceid === asset.instanceid
      );
      
      if (!description) continue;
      
      // Only include tradable items
      if (description.tradable !== 1) continue;
      
      // Parse item details
      const item = parseInventoryItem(asset, description);
      items.push(item);
    }

    console.log(`✅ Fetched ${items.length} tradable items from Steam inventory`);
    return items;
    
  } catch (error) {
    console.error('❌ Error fetching Steam inventory:', error);
    
    if (error instanceof TypeError && error.message.includes('CORS')) {
      throw new Error('CORS error: Steam is blocking direct browser requests. Using fallback method...');
    }
    
    throw error;
  }
}

/**
 * Parse raw Steam inventory item into our format
 */
function parseInventoryItem(asset: any, description: SteamInventoryItem): ParsedInventoryItem {
  const name = description.market_name || description.name;
  
  // Detect wear (FN, MW, FT, WW, BS)
  let wear: string | undefined;
  const wearMatch = name.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/);
  if (wearMatch) {
    wear = wearMatch[1];
  }
  
  // Detect StatTrak
  const statTrak = name.includes('StatTrak™');
  
  // Detect Souvenir
  const souvenir = name.includes('Souvenir');
  
  // Get rarity from tags
  let rarity = 'Common';
  const rarityTag = description.tags?.find(tag => tag.category === 'Rarity');
  if (rarityTag) {
    rarity = rarityTag.localized_tag_name;
  }
  
  // Get color (rarity color)
  let color = description.name_color;
  if (!color && rarityTag?.color) {
    color = rarityTag.color;
  }
  
  return {
    id: asset.assetid,
    name: description.name,
    marketName: description.market_hash_name || name,
    type: description.type,
    rarity,
    iconUrl: `https://community.cloudflare.steamstatic.com/economy/image/${description.icon_url}`,
    tradable: description.tradable === 1,
    marketable: description.marketable === 1,
    color,
    wear,
    statTrak,
    souvenir,
  };
}

/**
 * Use a CORS proxy to fetch inventory (fallback method)
 */
export async function fetchSteamInventoryWithProxy(steamId: string): Promise<ParsedInventoryItem[]> {
  console.log('🔄 Using CORS proxy to fetch inventory...');
  
  // Use a public CORS proxy
  const corsProxy = 'https://api.allorigins.win/raw?url=';
  const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;
  const proxyUrl = corsProxy + encodeURIComponent(inventoryUrl);
  
  try {
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Proxy request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.assets || !data.descriptions) {
      throw new Error('Invalid inventory data from proxy');
    }
    
    // Parse items same way
    const items: ParsedInventoryItem[] = [];
    
    for (const asset of data.assets) {
      const description = data.descriptions.find(
        (desc: any) => desc.classid === asset.classid && desc.instanceid === asset.instanceid
      );
      
      if (!description || description.tradable !== 1) continue;
      
      const item = parseInventoryItem(asset, description);
      items.push(item);
    }
    
    console.log(`✅ Fetched ${items.length} items via proxy`);
    return items;
    
  } catch (error) {
    console.error('❌ Proxy fetch failed:', error);
    throw error;
  }
}

/**
 * Smart inventory fetcher - tries direct first, then proxy
 */
export async function fetchInventory(steamId: string): Promise<ParsedInventoryItem[]> {
  try {
    // Try direct fetch first
    return await fetchSteamInventory(steamId);
  } catch (error) {
    console.warn('Direct fetch failed, trying proxy...', error);
    
    try {
      // Fallback to proxy
      return await fetchSteamInventoryWithProxy(steamId);
    } catch (proxyError) {
      console.error('Both direct and proxy fetch failed');
      throw new Error('Failed to fetch inventory. Please ensure your Steam inventory is public and try again later.');
    }
  }
}
