/**
 * Word Cache Manager
 * Manages caching of page word lists by domain + path
 *
 * Features:
 * - LRU (Least Recently Used) cache with max size limit
 * - Dual-layer storage: in-memory (fast) + chrome.storage (persistent)
 * - Per-user cache isolation
 * - 24-hour auto expiration
 * - Graceful error handling
 */

class WordCacheManager {
  constructor(options = {}) {
    // Configuration
    this.maxCacheSize = options.maxCacheSize || 20;  // Max URLs to cache
    this.cacheExpiryMs = options.cacheExpiryMs || 86400000;  // 24 hours

    // In-memory cache layer
    this.memoryCache = new Map();  // {cacheKey → wordState}
    this.cacheIndex = [];           // LRU index

    console.log('[WordCacheManager] Initialized with maxSize=' + this.maxCacheSize);
  }

  /**
   * Generate cache key from URL
   * Format: "domain.com|/path"
   * Examples: "twitter.com|/home", "github.com|/explore"
   */
  getCacheKey(url) {
    try {
      const urlObj = new URL(url);
      // Normalize: remove trailing slash for root
      let path = urlObj.pathname;
      if (path === '/' && url.includes('?')) {
        path = '/?';  // Add ? if query params
      }
      return `${urlObj.hostname}|${path}`;
    } catch (e) {
      console.warn('[WordCacheManager] Invalid URL:', url, e);
      return null;
    }
  }

  /**
   * Get cached word state (try memory first, then storage)
   */
  async getFromCache(cacheKey, userId) {
    if (!cacheKey || !userId) return null;

    // 1. Check memory cache (fastest)
    if (this.memoryCache.has(cacheKey)) {
      console.log(`[WordCacheManager] Memory HIT: ${cacheKey}`);
      this.updateLRUIndex(cacheKey);
      return this.memoryCache.get(cacheKey);
    }

    // 2. Check persistent storage
    try {
      const storageKey = this.getStorageKey(userId, cacheKey);
      const stored = await StorageManager.getItem(storageKey);

      if (stored && !this.isExpired(stored.timestamp)) {
        console.log(`[WordCacheManager] Storage HIT: ${cacheKey}`);
        // Restore to memory cache
        this.memoryCache.set(cacheKey, stored.wordState);
        this.updateLRUIndex(cacheKey);
        return stored.wordState;
      }

      // Expired, remove from storage
      if (stored && this.isExpired(stored.timestamp)) {
        console.log(`[WordCacheManager] Cache expired: ${cacheKey}`);
        await StorageManager.removeItem(storageKey);
      }
    } catch (e) {
      console.warn('[WordCacheManager] Storage read error:', e);
    }

    console.log(`[WordCacheManager] Cache MISS: ${cacheKey}`);
    return null;
  }

  /**
   * Save word state to cache
   */
  async setToCache(cacheKey, wordState, userId) {
    if (!cacheKey || !userId || !wordState) return;

    // 1. Save to memory cache
    this.memoryCache.set(cacheKey, wordState);
    this.updateLRUIndex(cacheKey);

    // 2. Check LRU limit and evict if necessary
    while (this.cacheIndex.length > this.maxCacheSize) {
      const oldestKey = this.cacheIndex.shift();
      this.memoryCache.delete(oldestKey);

      // Also remove from storage
      try {
        const storageKey = this.getStorageKey(userId, oldestKey);
        await StorageManager.removeItem(storageKey);
      } catch (e) {
        console.warn('[WordCacheManager] Storage cleanup error:', e);
      }
    }

    // 3. Persist to storage (async, non-blocking)
    this.persistToStorage(cacheKey, wordState, userId)
      .catch(e => console.warn('[WordCacheManager] Persist error:', e));
  }

  /**
   * Persist cache to chrome.storage (non-blocking)
   */
  async persistToStorage(cacheKey, wordState, userId) {
    try {
      const storageKey = this.getStorageKey(userId, cacheKey);
      const data = {
        wordState: wordState,
        timestamp: Date.now(),
        version: 1,
        url: cacheKey
      };
      await StorageManager.setItem(storageKey, data);
      console.log(`[WordCacheManager] Persisted: ${cacheKey}`);
    } catch (e) {
      console.warn('[WordCacheManager] Storage persist error:', e);
      // Don't throw - cache still works from memory
    }
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(timestamp) {
    return Date.now() - timestamp > this.cacheExpiryMs;
  }

  /**
   * Update LRU index (move to end = most recent)
   */
  updateLRUIndex(cacheKey) {
    // Remove if exists
    const index = this.cacheIndex.indexOf(cacheKey);
    if (index > -1) {
      this.cacheIndex.splice(index, 1);
    }
    // Add to end (most recent)
    this.cacheIndex.push(cacheKey);
  }

  /**
   * Generate storage key for persistence
   */
  getStorageKey(userId, cacheKey) {
    return `cache_${userId}_${cacheKey.replace(/[|\/]/g, '_')}`;
  }

  /**
   * Clear all cache for a user
   */
  async clearUserCache(userId) {
    if (!userId) return;

    console.log(`[WordCacheManager] Clearing cache for user: ${userId}`);

    // Clear memory
    this.memoryCache.clear();
    this.cacheIndex = [];

    // Clear storage - need to get all keys and filter
    try {
      // Get all storage keys (workaround: iterate known keys)
      const prefix = `cache_${userId}_`;

      // In chrome.storage, we need to clear by prefix
      // Get all items and filter
      const allItems = await StorageManager.getItems();
      const keysToRemove = Object.keys(allItems)
        .filter(key => key.startsWith(prefix));

      for (const key of keysToRemove) {
        await StorageManager.removeItem(key);
      }

      console.log(`[WordCacheManager] Cleared ${keysToRemove.length} cache entries`);
    } catch (e) {
      console.warn('[WordCacheManager] Clear error:', e);
    }
  }

  /**
   * Clear expired entries (maintenance)
   */
  async clearExpiredCache(userId) {
    if (!userId) return;

    try {
      const prefix = `cache_${userId}_`;
      const allItems = await StorageManager.getItems();
      let cleared = 0;

      for (const [key, value] of Object.entries(allItems)) {
        if (key.startsWith(prefix) && value?.timestamp) {
          if (this.isExpired(value.timestamp)) {
            await StorageManager.removeItem(key);
            cleared++;
          }
        }
      }

      if (cleared > 0) {
        console.log(`[WordCacheManager] Cleared ${cleared} expired entries`);
      }
    } catch (e) {
      console.warn('[WordCacheManager] Maintenance error:', e);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      cacheIndexLength: this.cacheIndex.length,
      maxCacheSize: this.maxCacheSize,
      expiryTimeHours: this.cacheExpiryMs / 3600000,
      cacheKeys: Array.from(this.cacheIndex)
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WordCacheManager;
}
