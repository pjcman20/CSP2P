/**
 * Caching utilities for CS2 skin data
 * Uses localStorage with TTL to cache API responses
 */

import type { TradeItem } from '../components/types';

const CACHE_PREFIX = 'cs2_skin_cache_';
const CACHE_VERSION = '1.0';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  data: TradeItem[];
  timestamp: number;
  version: string;
}

/**
 * Get cache key for a query
 */
function getCacheKey(query: string, type: 'search' | 'all' | 'category' | 'weapon'): string {
  return `${CACHE_PREFIX}${type}_${query.toLowerCase().replace(/\s+/g, '_')}`;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cached: CachedData | null, ttl: number = DEFAULT_TTL): boolean {
  if (!cached) return false;
  if (cached.version !== CACHE_VERSION) return false;
  return Date.now() - cached.timestamp < ttl;
}

/**
 * Get cached data
 */
export function getCachedSkins(
  query: string,
  type: 'search' | 'all' | 'category' | 'weapon' = 'search',
  ttl?: number
): TradeItem[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = getCacheKey(query, type);
    const cachedStr = localStorage.getItem(cacheKey);
    
    if (!cachedStr) return null;

    const cached: CachedData = JSON.parse(cachedStr);
    
    if (isCacheValid(cached, ttl)) {
      return cached.data;
    } else {
      // Remove expired cache
      localStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    console.warn('Error reading skin cache:', error);
    return null;
  }
}

/**
 * Cache skin data
 */
export function cacheSkins(
  query: string,
  data: TradeItem[],
  type: 'search' | 'all' | 'category' | 'weapon' = 'search'
): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = getCacheKey(query, type);
    const cached: CachedData = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION
    };

    localStorage.setItem(cacheKey, JSON.stringify(cached));
    
    // Clean up old caches if storage is getting full
    cleanupOldCaches();
  } catch (error) {
    // If storage is full, try to clean up and retry
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      cleanupOldCaches();
      try {
        const cacheKey = getCacheKey(query, type);
        const cached: CachedData = {
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
        localStorage.setItem(cacheKey, JSON.stringify(cached));
      } catch (retryError) {
        console.warn('Failed to cache skins after cleanup:', retryError);
      }
    } else {
      console.warn('Error caching skins:', error);
    }
  }
}

/**
 * Clear all cached skins
 */
export function clearSkinCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Error clearing skin cache:', error);
  }
}

/**
 * Clean up old caches to free up space
 */
function cleanupOldCaches(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    // If we have more than 50 cached items, remove oldest ones
    if (cacheKeys.length > 50) {
      const cacheEntries = cacheKeys.map(key => {
        try {
          const cachedStr = localStorage.getItem(key);
          if (cachedStr) {
            const cached: CachedData = JSON.parse(cachedStr);
            return { key, timestamp: cached.timestamp };
          }
        } catch {
          return { key, timestamp: 0 };
        }
        return { key, timestamp: 0 };
      });

      // Sort by timestamp (oldest first)
      cacheEntries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 25% of caches
      const toRemove = Math.floor(cacheEntries.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(cacheEntries[i].key);
      }
    }

    // Also remove expired caches
    cacheKeys.forEach(key => {
      try {
        const cachedStr = localStorage.getItem(key);
        if (cachedStr) {
          const cached: CachedData = JSON.parse(cachedStr);
          if (!isCacheValid(cached)) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Invalid cache entry, remove it
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Error cleaning up cache:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; size: number } {
  if (typeof window === 'undefined') return { count: 0, size: 0 };

  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    let totalSize = 0;
    cacheKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    });

    return {
      count: cacheKeys.length,
      size: totalSize
    };
  } catch (error) {
    console.warn('Error getting cache stats:', error);
    return { count: 0, size: 0 };
  }
}

