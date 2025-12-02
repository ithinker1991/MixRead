/**
 * Storage Manager - Wrapper around Chrome Storage API
 *
 * Provides Promise-based interface to Chrome's storage.local
 * Used for caching and local state management
 */

class StorageManager {
  /**
   * Get item from storage
   * @param {string} key - Storage key
   * @returns {Promise<*>} Stored value or undefined
   */
  static async getItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  /**
   * Set item in storage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
   */
  static async setItem(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  static async removeItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    });
  }

  /**
   * Get multiple items
   * @param {string[]} keys - Array of storage keys
   * @returns {Promise<object>} Object with key-value pairs
   */
  static async getItems(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Set multiple items
   * @param {object} items - Object with key-value pairs
   * @returns {Promise<void>}
   */
  static async setItems(items) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, () => {
        resolve();
      });
    });
  }

  /**
   * Clear all storage
   * @returns {Promise<void>}
   */
  static async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve();
      });
    });
  }

  /**
   * Generate or get user ID
   * @returns {Promise<string>} User ID
   */
  static async getUserId() {
    let userId = await this.getItem('mixread_user_id');

    if (!userId) {
      // Generate a unique user ID
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await this.setItem('mixread_user_id', userId);
      console.log('[Storage] Generated new user ID:', userId);
    }

    return userId;
  }

  /**
   * Get user display info (name, stats, etc.)
   * @returns {Promise<object>} User info object
   */
  static async getUserInfo() {
    const userId = await this.getUserId();
    const userStats = await this.getItem('mixread_user_stats') || {
      wordsHighlighted: 0,
      wordsMarkedKnown: 0,
      wordsMarkedUnknown: 0,
      wordsAddedToLibrary: 0,
      createdAt: new Date().toISOString()
    };

    return {
      id: userId,
      stats: userStats
    };
  }
}
