/**
 * Inventory Caching System
 * Reduces Steam API calls by caching inventory data
 * 
 * NOTE: This is currently NOT USED because Steam blocks cloud IPs entirely.
 * This is here for future use with residential proxies or browser extensions.
 */

export interface CachedInventory {
  data: any;
  timestamp: number;
  steamId: string;
}

interface CacheConfig {
  ttlMinutes: number; // Time to live in minutes
  maxEntries: number; // Maximum number of cached inventories
}

class InventoryCache {
  private cache = new Map<string, CachedInventory>();
  
  constructor(private config: CacheConfig) {
    this.startCleanupInterval();
  }

  /**
   * Get cached inventory if available and not expired
   */
  get(steamId: string): any | null {
    const cached = this.cache.get(steamId);
    
    if (!cached) {
      console.log(`📦 Cache MISS for ${steamId}`);
      return null;
    }

    const age = Date.now() - cached.timestamp;
    const maxAge = this.config.ttlMinutes * 60 * 1000;

    if (age > maxAge) {
      console.log(`⏰ Cache EXPIRED for ${steamId} (age: ${Math.round(age / 1000)}s, max: ${Math.round(maxAge / 1000)}s)`);
      this.cache.delete(steamId);
      return null;
    }

    console.log(`✅ Cache HIT for ${steamId} (age: ${Math.round(age / 1000)}s)`);
    return cached.data;
  }

  /**
   * Store inventory in cache
   */
  set(steamId: string, data: any) {
    // Enforce max entries (LRU-style)
    if (this.cache.size >= this.config.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`🗑️ Evicted oldest cache entry: ${oldestKey}`);
    }

    this.cache.set(steamId, {
      data,
      timestamp: Date.now(),
      steamId,
    });

    console.log(`💾 Cached inventory for ${steamId} (total cached: ${this.cache.size})`);
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidate(steamId: string) {
    const deleted = this.cache.delete(steamId);
    if (deleted) {
      console.log(`🗑️ Invalidated cache for ${steamId}`);
    }
    return deleted;
  }

  /**
   * Clear all cached inventories
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cleared ${size} cached inventories`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      totalEntries: this.cache.size,
      maxEntries: this.config.maxEntries,
      ttlMinutes: this.config.ttlMinutes,
      oldestEntryAge: entries.length > 0 
        ? Math.round((now - Math.min(...entries.map(e => e.timestamp))) / 1000)
        : 0,
      newestEntryAge: entries.length > 0
        ? Math.round((now - Math.max(...entries.map(e => e.timestamp))) / 1000)
        : 0,
      averageAge: entries.length > 0
        ? Math.round(entries.reduce((sum, e) => sum + (now - e.timestamp), 0) / entries.length / 1000)
        : 0,
    };
  }

  /**
   * Clean up expired entries periodically
   */
  private startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const maxAge = this.config.ttlMinutes * 60 * 1000;
      let cleaned = 0;

      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > maxAge) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Check if cache has entry (even if expired)
   */
  has(steamId: string): boolean {
    return this.cache.has(steamId);
  }

  /**
   * Get age of cached entry in seconds
   */
  getAge(steamId: string): number | null {
    const cached = this.cache.get(steamId);
    if (!cached) return null;
    
    return Math.round((Date.now() - cached.timestamp) / 1000);
  }
}

// Create singleton instance with sensible defaults
export const inventoryCache = new InventoryCache({
  ttlMinutes: 5, // Cache for 5 minutes
  maxEntries: 100, // Cache up to 100 user inventories
});

/**
 * Wrapper function for getting inventory with caching
 */
export async function getCachedInventory(
  steamId: string,
  fetchFn: () => Promise<any>
): Promise<any> {
  // Check cache first
  const cached = inventoryCache.get(steamId);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  console.log(`🔄 Fetching fresh inventory for ${steamId}`);
  const data = await fetchFn();

  // Store in cache
  inventoryCache.set(steamId, data);

  return data;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return inventoryCache.getStats();
}

/**
 * Manually invalidate a user's cached inventory
 */
export function invalidateUserCache(steamId: string) {
  return inventoryCache.invalidate(steamId);
}

/**
 * Clear all cached data
 */
export function clearAllCache() {
  inventoryCache.clear();
}
