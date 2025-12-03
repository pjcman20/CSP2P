import type { TradeItem, ItemRarity } from '../components/types';

// Cache for item searches to reduce API calls
const itemCache = new Map<string, CachedResult>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedResult {
  data: TradeItem[];
  timestamp: number;
}

// Helper to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Map rarity names to our rarity system
function mapRarity(rarity: string | undefined): ItemRarity {
  if (!rarity) return 'industrial';
  const rarityLower = rarity.toLowerCase();
  
  if (rarityLower.includes('covert') || rarityLower.includes('extraordinary')) return 'covert';
  if (rarityLower.includes('classified')) return 'classified';
  if (rarityLower.includes('restricted')) return 'restricted';
  if (rarityLower.includes('mil-spec') || rarityLower.includes('milspec') || rarityLower.includes('military')) return 'milspec';
  if (rarityLower.includes('industrial')) return 'industrial';
  if (rarityLower.includes('consumer')) return 'consumer';
  if (rarityLower.includes('contraband') || rarityLower.includes('★')) return 'gold';
  
  return 'industrial';
}

// Extract wear from item name
function getWearFromName(name: string): string | undefined {
  if (name.includes('Factory New')) return 'Factory New';
  if (name.includes('Minimal Wear')) return 'Minimal Wear';
  if (name.includes('Field-Tested')) return 'Field-Tested';
  if (name.includes('Well-Worn')) return 'Well-Worn';
  if (name.includes('Battle-Scarred')) return 'Battle-Scarred';
  return undefined;
}

interface SteamMarketItem {
  hash_name: string;
  sell_price?: number;
  sell_price_text?: string;
  sale_price_text?: string;
  asset_description?: {
    icon_url?: string;
    type?: string;
    market_hash_name?: string;
  };
}

interface SteamMarketResponse {
  success: boolean;
  results?: SteamMarketItem[];
  total_count?: number;
  start?: number;
  pagesize?: number;
}

function convertSteamItemsToTradeItems(steamItems: SteamMarketItem[]): TradeItem[] {
  return steamItems
    .filter(item => item.hash_name && item.asset_description?.icon_url)
    .map((item, index) => {
      // Parse price from sell_price_text (e.g., "$123.45" or "$1,234.56")
      let price: number | undefined;
      if (item.sell_price_text) {
        const priceStr = item.sell_price_text.replace(/[$,]/g, '');
        const parsed = parseFloat(priceStr);
        if (!isNaN(parsed)) {
          price = parsed;
        }
      } else if (item.sale_price_text) {
        const priceStr = item.sale_price_text.replace(/[$,]/g, '');
        const parsed = parseFloat(priceStr);
        if (!isNaN(parsed)) {
          price = parsed;
        }
      }

      // Format image URL properly - ensure it has the size suffix if missing
      let imageUrl: string | undefined = undefined;
      if (item.asset_description?.icon_url) {
        const iconUrl = item.asset_description.icon_url.trim();
        
        if (!iconUrl) {
          imageUrl = undefined;
        } else if (iconUrl.startsWith('http')) {
          // Already a full URL - use as-is but try to ensure size suffix
          if (!iconUrl.includes('/62fx62f') && !iconUrl.includes('/360fx360f') && !iconUrl.includes('/128fx128f')) {
            // Try adding size suffix if URL doesn't have one
            imageUrl = iconUrl.endsWith('/') ? `${iconUrl}62fx62f` : `${iconUrl}/62fx62f`;
          } else {
            imageUrl = iconUrl;
          }
        } else {
          // Relative URL or hash - prepend CDN base
          // Try both CDN domains for better reliability
          const cleanUrl = iconUrl.startsWith('/') ? iconUrl.slice(1) : iconUrl;
          
          // Check if it already has size suffix
          if (cleanUrl.includes('/62fx62f') || cleanUrl.includes('/360fx360f') || cleanUrl.includes('/128fx128f')) {
            // Has suffix, use cloudflare CDN
            imageUrl = `https://community.cloudflare.steamstatic.com/economy/image/${cleanUrl}`;
          } else {
            // No suffix, add it - try akamai CDN first (more reliable)
            imageUrl = `https://community.akamai.steamstatic.com/economy/image/${cleanUrl}/62fx62f`;
          }
        }
      }

      return {
        id: `steam_${item.hash_name.replace(/\s/g, '_')}_${Date.now()}_${index}`,
        name: item.hash_name,
        wear: getWearFromName(item.hash_name),
        image: imageUrl,
        rarity: mapRarity(item.asset_description?.type || ''),
        float: undefined,
        price: price
      };
    });
}

// Direct search of Steam Market API with pagination support
export async function searchSteamItems(query: string, count: number = 10000): Promise<TradeItem[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  // Check cache first - use 'all' key for unlimited results
  const cacheKey = `${query}_all`;
  const cached = itemCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data.slice(0, count);
  }

  try {
    const allItems: TradeItem[] = [];
    const pageSize = 100; // Steam Market API max per request
    let start = 0;
    let hasMore = true;
    let totalCount = 0;

    // Fetch pages until we have enough items or no more available
    while (hasMore && allItems.length < count) {
      const params = new URLSearchParams({
        query: query,
        start: start.toString(),
        count: pageSize.toString(),
        search_descriptions: '0',
        sort_column: 'popular',
        sort_dir: 'desc',
        appid: '730',
        norender: '1'
      });

      const steamUrl = `https://steamcommunity.com/market/search/render/?${params.toString()}`;
      
      // Try direct fetch first (may work in some environments)
      let response;
      try {
        response = await fetch(steamUrl);
      } catch (corsError) {
        // If CORS blocks it, use proxy
        const corsProxy = 'https://corsproxy.io/?';
        const proxyUrl = corsProxy + encodeURIComponent(steamUrl);
        response = await fetch(proxyUrl);
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: SteamMarketResponse = await response.json();

      if (data.success && data.results && data.results.length > 0) {
        const items = convertSteamItemsToTradeItems(data.results);
        allItems.push(...items);
        
        // Update total count from API response if available
        if (data.total_count !== undefined) {
          totalCount = data.total_count;
        }

        // Check if we have more pages
        hasMore = items.length === pageSize && allItems.length < (totalCount || count);
        start += pageSize;

        // Small delay between requests to avoid rate limiting
        if (hasMore && allItems.length < count) {
          await delay(200);
        }
      } else {
        hasMore = false;
      }
    }

    // Cache all results
    itemCache.set(cacheKey, {
      data: allItems,
      timestamp: Date.now()
    });

    return allItems.slice(0, count);
  } catch (error) {
    console.error('Error fetching Steam items:', error);
    throw new Error('Unable to fetch items. Please try again.');
  }
}

// Batch search multiple categories with rate limiting
export async function searchMultipleCategories(
  categories: string[], 
  itemsPerCategory: number = 30,
  delayMs: number = 300
): Promise<TradeItem[]> {
  const allItems: TradeItem[] = [];
  
  // Process in batches of 5 to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < categories.length; i += batchSize) {
    const batch = categories.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (category) => {
      try {
        await delay(delayMs * (i / batchSize)); // Stagger requests
        return await searchSteamItems(category, itemsPerCategory);
      } catch (error) {
        console.warn(`Failed to fetch ${category}, skipping...`);
        return [];
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(items => allItems.push(...items));
    
    // Small delay between batches
    if (i + batchSize < categories.length) {
      await delay(500);
    }
  }
  
  // Deduplicate by name
  const unique = Array.from(
    new Map(allItems.map(item => [item.name, item])).values()
  );
  
  return unique;
}

// Get popular search terms for quick access
export function getPopularSearchTerms(): Array<{ label: string; query: string }> {
  return [
    { label: 'Knives', query: 'knife' },
    { label: 'AK-47', query: 'AK-47' },
    { label: 'AWP', query: 'AWP' },
    { label: 'M4A4', query: 'M4A4' },
    { label: 'M4A1-S', query: 'M4A1-S' },
    { label: 'Gloves', query: 'gloves' },
    { label: 'Desert Eagle', query: 'Desert Eagle' },
    { label: 'Glock-18', query: 'Glock-18' },
    { label: 'USP-S', query: 'USP-S' }
  ];
}