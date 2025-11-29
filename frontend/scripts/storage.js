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
}
