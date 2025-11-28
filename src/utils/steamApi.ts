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

      return {
        id: `steam_${item.hash_name.replace(/\s/g, '_')}_${Date.now()}_${index}`,
        name: item.hash_name,
        wear: getWearFromName(item.hash_name),
        image: item.asset_description?.icon_url 
          ? `https://community.cloudflare.steamstatic.com/economy/image/${item.asset_description.icon_url}`
          : undefined,
        rarity: mapRarity(item.asset_description?.type || ''),
        float: undefined,
        price: price
      };
    });
}

// Direct search of Steam Market API
export async function searchSteamItems(query: string, count: number = 100): Promise<TradeItem[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  // Check cache first
  const cacheKey = `${query}_${count}`;
  const cached = itemCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      query: query,
      start: '0',
      count: count.toString(),
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
      
      // Cache the results
      itemCache.set(cacheKey, {
        data: items,
        timestamp: Date.now()
      });

      return items;
    }

    return [];
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