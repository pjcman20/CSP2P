import type { TradeItem } from '../components/types';
import { searchSteamItems, searchMultipleCategories, getPopularSearchTerms as getSteamPopularSearchTerms } from './steamApi';

// Re-export Steam API functions with simpler names
export async function getAllSkins(): Promise<TradeItem[]> {
  // Get a variety of popular items
  const categories = [
    'AK-47',
    'AWP', 
    'M4A4',
    'M4A1-S',
    'Desert Eagle',
    'Glock-18',
    'USP-S',
    'knife',
    'gloves'
  ];
  
  try {
    return await searchMultipleCategories(categories, 50, 300);
  } catch (error) {
    console.error('Error loading skins:', error);
    return [];
  }
}

// Alias for getAllSkins - used by BrowseInventorySection
export async function getPopularItems(): Promise<TradeItem[]> {
  return getAllSkins();
}

export async function searchSkins(query: string): Promise<TradeItem[]> {
  return searchSteamItems(query, 100);
}

export function getPopularSearchTerms() {
  return getSteamPopularSearchTerms();
}