/**
 * CS2 Skin API Client
 * Provides comprehensive access to CS2 skins from multiple sources
 * Falls back to Steam Market API if other sources fail
 */

import type { TradeItem, ItemRarity } from '../components/types';
import { getCachedSkins, cacheSkins } from './skinCache';
import { searchSteamItems, searchMultipleCategories } from './steamApi';
import { CS2_ITEMS_DATABASE } from './cs2ItemDatabase';

// API Configuration
const STEAM_MARKET_API = 'https://steamcommunity.com/market/search/render/';
const CORS_PROXY = 'https://corsproxy.io/?';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 300; // 300ms between requests

/**
 * Add delay to respect rate limits
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Map Steam rarity to our rarity system
 */
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

/**
 * Extract weapon type from item name
 */
function extractWeaponType(name: string): string | undefined {
  const weapons = [
    'AK-47', 'M4A4', 'M4A1-S', 'AWP', 'Desert Eagle', 'Glock-18', 'USP-S',
    'P250', 'Five-SeveN', 'CZ75-Auto', 'Dual Berettas', 'Tec-9', 'P2000',
    'R8 Revolver', 'Nova', 'XM1014', 'MAG-7', 'Sawed-Off', 'M249', 'Negev',
    'MP9', 'MP7', 'MAC-10', 'P90', 'UMP-45', 'PP-Bizon', 'MP5-SD',
    'Karambit', 'Butterfly', 'M9 Bayonet', 'Bayonet', 'Talon', 'Ursus',
    'Stiletto', 'Gut Knife', 'Huntsman', 'Bowie', 'Falchion', 'Navaja',
    'Shadow Daggers', 'Flip', 'Skeleton', 'Survival', 'Paracord', 'Nomad'
  ];

  for (const weapon of weapons) {
    if (name.includes(weapon)) {
      return weapon;
    }
  }

  return undefined;
}

/**
 * Extract category from weapon type
 */
function getCategoryFromWeapon(weapon: string | undefined): 'knife' | 'rifle' | 'pistol' | 'smg' | 'heavy' | 'gloves' | undefined {
  if (!weapon) return undefined;

  const weaponLower = weapon.toLowerCase();
  
  if (weaponLower.includes('knife') || weaponLower.includes('karambit') || 
      weaponLower.includes('butterfly') || weaponLower.includes('bayonet') ||
      weaponLower.includes('talon') || weaponLower.includes('ursus') ||
      weaponLower.includes('stiletto') || weaponLower.includes('gut') ||
      weaponLower.includes('huntsman') || weaponLower.includes('bowie') ||
      weaponLower.includes('falchion') || weaponLower.includes('navaja') ||
      weaponLower.includes('dagger') || weaponLower.includes('flip') ||
      weaponLower.includes('skeleton') || weaponLower.includes('survival') ||
      weaponLower.includes('paracord') || weaponLower.includes('nomad')) {
    return 'knife';
  }

  if (weaponLower.includes('rifle') || weaponLower.includes('ak-47') ||
      weaponLower.includes('m4a4') || weaponLower.includes('m4a1') ||
      weaponLower.includes('awp') || weaponLower.includes('ssg') ||
      weaponLower.includes('aug') || weaponLower.includes('sg') ||
      weaponLower.includes('scar') || weaponLower.includes('galil') ||
      weaponLower.includes('famas') || weaponLower.includes('g3sg1') ||
      weaponLower.includes('scar')) {
    return 'rifle';
  }

  if (weaponLower.includes('pistol') || weaponLower.includes('deagle') ||
      weaponLower.includes('glock') || weaponLower.includes('usp') ||
      weaponLower.includes('p250') || weaponLower.includes('five') ||
      weaponLower.includes('cz75') || weaponLower.includes('dual') ||
      weaponLower.includes('tec') || weaponLower.includes('p2000') ||
      weaponLower.includes('r8') || weaponLower.includes('revolver')) {
    return 'pistol';
  }

  if (weaponLower.includes('smg') || weaponLower.includes('mp9') ||
      weaponLower.includes('mp7') || weaponLower.includes('mac') ||
      weaponLower.includes('p90') || weaponLower.includes('ump') ||
      weaponLower.includes('bizon') || weaponLower.includes('mp5')) {
    return 'smg';
  }

  if (weaponLower.includes('heavy') || weaponLower.includes('nova') ||
      weaponLower.includes('xm1014') || weaponLower.includes('mag-7') ||
      weaponLower.includes('sawed') || weaponLower.includes('m249') ||
      weaponLower.includes('negev')) {
    return 'heavy';
  }

  if (weaponLower.includes('glove')) {
    return 'gloves';
  }

  return undefined;
}

/**
 * Search for skins by query
 * @param query Search query
 * @param limit Maximum number of results (default: unlimited, set to 10000 for practical limit)
 */
export async function searchSkins(query: string, limit: number = 10000): Promise<TradeItem[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  // Check cache first
  const cached = getCachedSkins(query, 'search');
  if (cached) {
    return cached.slice(0, limit);
  }

  await rateLimit();

  try {
    // Try Steam Market API first (most reliable)
    // Use a very broad search if query is short to get more results
    const searchTerm = query.length < 3 ? `CS ${query}` : query;
    const items = await searchSteamItems(searchTerm, limit);
    
    if (items.length > 0) {
      // Enhance items with weapon type and category
      const enhancedItems = items.map(item => ({
        ...item,
        weapon: extractWeaponType(item.name) || item.weapon,
        category: getCategoryFromWeapon(extractWeaponType(item.name)) || item.category
      }));

      // Cache results
      cacheSkins(query, enhancedItems, 'search');
      
      return enhancedItems;
    }

    // Fallback to local database
    const localResults = CS2_ITEMS_DATABASE.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.weapon?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);

    if (localResults.length > 0) {
      const tradeItems: TradeItem[] = localResults.map(item => ({
        id: `local_${item.name.replace(/\s/g, '_')}_${Date.now()}`,
        name: item.name,
        image: item.icon,
        rarity: item.rarity as ItemRarity,
        category: item.category,
        weapon: item.weapon
      }));

      cacheSkins(query, tradeItems, 'search');
      return tradeItems;
    }

    return [];
  } catch (error) {
    console.error('Error searching skins:', error);
    
    // Fallback to local database on error
    const localResults = CS2_ITEMS_DATABASE.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.weapon?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);

    return localResults.map(item => ({
      id: `local_${item.name.replace(/\s/g, '_')}_${Date.now()}`,
      name: item.name,
      image: item.icon,
      rarity: item.rarity as ItemRarity,
      category: item.category,
      weapon: item.weapon
    }));
  }
}

/**
 * Get all skins (popular items from multiple categories)
 * @param limit Maximum number of results (default: unlimited, set to 10000 for practical limit)
 */
export async function getAllSkins(limit: number = 10000): Promise<TradeItem[]> {
  // Check cache
  const cached = getCachedSkins('all', 'all', 12 * 60 * 60 * 1000); // 12 hour cache for all skins
  if (cached) {
    return cached.slice(0, limit);
  }

  await rateLimit();

  try {
    const categories = [
      'knife',
      'AK-47',
      'AWP',
      'M4A4',
      'M4A1-S',
      'Desert Eagle',
      'Glock-18',
      'USP-S',
      'gloves'
    ];

    const items = await searchMultipleCategories(categories, Math.ceil(limit / categories.length), 300);
    
    // Enhance items
    const enhancedItems = items.map(item => ({
      ...item,
      weapon: extractWeaponType(item.name) || item.weapon,
      category: getCategoryFromWeapon(extractWeaponType(item.name)) || item.category
    }));

    // Deduplicate
    const unique = Array.from(
      new Map(enhancedItems.map(item => [item.name, item])).values()
    );

    const result = unique.slice(0, limit);
    cacheSkins('all', result, 'all');
    
    return result;
  } catch (error) {
    console.error('Error fetching all skins:', error);
    
    // Fallback to local database
    const localItems = CS2_ITEMS_DATABASE.slice(0, limit).map(item => ({
      id: `local_${item.name.replace(/\s/g, '_')}_${Date.now()}`,
      name: item.name,
      image: item.icon,
      rarity: item.rarity as ItemRarity,
      category: item.category,
      weapon: item.weapon
    }));

    return localItems;
  }
}

/**
 * Get skins by weapon type
 * @param weapon Weapon name
 * @param limit Maximum number of results (default: unlimited, set to 10000 for practical limit)
 */
export async function getSkinsByWeapon(weapon: string, limit: number = 10000): Promise<TradeItem[]> {
  if (!weapon) return [];

  // Check cache
  const cached = getCachedSkins(weapon, 'weapon');
  if (cached) {
    return cached.slice(0, limit);
  }

  await rateLimit();

  try {
    const items = await searchSteamItems(weapon, limit);
    
    // Filter to exact weapon match
    const filtered = items.filter(item => 
      item.name.toLowerCase().includes(weapon.toLowerCase())
    );

    const enhancedItems = filtered.map(item => ({
      ...item,
      weapon: extractWeaponType(item.name) || weapon,
      category: getCategoryFromWeapon(extractWeaponType(item.name))
    }));

    cacheSkins(weapon, enhancedItems, 'weapon');
    return enhancedItems;
  } catch (error) {
    console.error('Error fetching skins by weapon:', error);
    return [];
  }
}

/**
 * Get skins by category
 * @param category Skin category
 * @param limit Maximum number of results (default: unlimited, set to 10000 for practical limit)
 */
export async function getSkinsByCategory(
  category: 'knife' | 'rifle' | 'pistol' | 'smg' | 'heavy' | 'gloves',
  limit: number = 10000
): Promise<TradeItem[]> {
  // Check cache
  const cached = getCachedSkins(category, 'category');
  if (cached && cached.length >= Math.min(limit, 200)) {
    return cached.slice(0, limit);
  }

  await rateLimit();

  try {
    // Map category to comprehensive search terms - expanded lists for better coverage
    const searchTerms: Record<string, string[]> = {
      knife: ['knife', 'karambit', 'butterfly', 'bayonet', 'm9 bayonet', 'talon', 'ursus', 'stiletto', 'gut knife', 'huntsman', 'bowie', 'falchion', 'navaja', 'shadow daggers', 'flip knife', 'skeleton knife'],
      rifle: ['AK-47', 'AWP', 'M4A4', 'M4A1-S', 'Galil', 'FAMAS', 'AUG', 'SG 553', 'SCAR-20', 'G3SG1', 'SSG 08'],
      pistol: ['Desert Eagle', 'Glock-18', 'USP-S', 'P250', 'Five-SeveN', 'CZ75-Auto', 'Dual Berettas', 'Tec-9', 'P2000', 'R8 Revolver'],
      smg: ['MP9', 'MP7', 'MAC-10', 'P90', 'UMP-45', 'PP-Bizon', 'MP5-SD'],
      heavy: ['Nova', 'XM1014', 'MAG-7', 'Sawed-Off', 'M249', 'Negev'],
      gloves: ['gloves', 'hand wraps', 'sport gloves', 'driver gloves', 'hand wraps', 'moto gloves', 'specialist gloves', 'bloodhound gloves']
    };

    const terms = searchTerms[category] || [category];
    // Request more items per term to ensure we get enough after filtering
    const itemsPerTerm = Math.max(100, Math.ceil(limit / terms.length) * 2);
    const items = await searchMultipleCategories(terms, itemsPerTerm, 300);

    // Filter by category (but be less strict - include items that match the category)
    const filtered = items.filter(item => {
      const itemCategory = getCategoryFromWeapon(extractWeaponType(item.name)) || item.category;
      // Also check if the name contains category-related keywords
      const nameLower = item.name.toLowerCase();
      if (category === 'knife' && (nameLower.includes('knife') || nameLower.includes('karambit') || nameLower.includes('butterfly') || nameLower.includes('bayonet'))) {
        return true;
      }
      if (category === 'rifle' && (nameLower.includes('ak-47') || nameLower.includes('awp') || nameLower.includes('m4a4') || nameLower.includes('m4a1') || nameLower.includes('galil') || nameLower.includes('famas'))) {
        return true;
      }
      if (category === 'pistol' && (nameLower.includes('deagle') || nameLower.includes('glock') || nameLower.includes('usp') || nameLower.includes('p250'))) {
        return true;
      }
      if (category === 'smg' && (nameLower.includes('mp9') || nameLower.includes('mp7') || nameLower.includes('mac-10') || nameLower.includes('p90'))) {
        return true;
      }
      if (category === 'heavy' && (nameLower.includes('nova') || nameLower.includes('xm1014') || nameLower.includes('mag-7') || nameLower.includes('m249'))) {
        return true;
      }
      if (category === 'gloves' && (nameLower.includes('glove') || nameLower.includes('hand wrap'))) {
        return true;
      }
      return itemCategory === category;
    });

    const enhancedItems = filtered.map(item => ({
      ...item,
      weapon: extractWeaponType(item.name) || item.weapon,
      category: category
    }));

    // Deduplicate
    const unique = Array.from(
      new Map(enhancedItems.map(item => [item.name, item])).values()
    );

    const result = unique.slice(0, limit);
    cacheSkins(category, result, 'category');
    
    return result;
  } catch (error) {
    console.error('Error fetching skins by category:', error);
    
    // Fallback to local database
    const localItems = CS2_ITEMS_DATABASE.filter(item => item.category === category)
      .slice(0, limit)
      .map(item => ({
        id: `local_${item.name.replace(/\s/g, '_')}_${Date.now()}`,
        name: item.name,
        image: item.icon,
        rarity: item.rarity as ItemRarity,
        category: item.category,
        weapon: item.weapon
      }));

    return localItems;
  }
}

/**
 * Get popular search terms
 */
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

