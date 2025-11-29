/**
 * Unknown Words Service - Business Logic
 *
 * Handles use cases related to marking words as unknown
 * Coordinates with API, store, and other modules
 */

class UnknownWordsService {
  constructor(store, apiClient, userStore) {
    this.store = store;
    this.apiClient = apiClient;
    this.userStore = userStore;
  }

  /**
   * Mark a word as unknown (user doesn't know it)
   *
   * Flow:
   * 1. Add to local store (immediate feedback)
   * 2. Call backend API (background sync)
   * 3. Trigger page re-highlight
   *
   * @param {string} word - Word to mark
   * @returns {Promise<boolean>} Success status
   */
  async markAsUnknown(word) {
    try {
      logger.log(`Marking "${word}" as unknown`);

      // 1. Immediate local update (UX feedback)
      this.store.add(word);
      await this.store.sync();

      // 2. Sync to backend (async)
      const userId = this.userStore.getUserId();
      try {
        await this.apiClient.post(`/users/${userId}/unknown-words`, {
          word: word,
        });
        logger.info(`"${word}" marked as unknown on backend`);
      } catch (error) {
        logger.warn(`Failed to sync "${word}" to backend`, error);
        // Continue anyway - user can retry next time
      }

      // 3. Trigger page re-highlight
      window.dispatchEvent(new Event('unknown-words-updated'));
      logger.log('Triggered page re-highlight');

      return true;
    } catch (error) {
      logger.error(`Failed to mark "${word}" as unknown`, error);
      return false;
    }
  }

  /**
   * Remove a word from unknown words
   *
   * @param {string} word - Word to unmark
   * @returns {Promise<boolean>} Success status
   */
  async unmarkAsUnknown(word) {
    try {
      logger.log(`Removing "${word}" from unknown words`);

      // 1. Local update
      this.store.remove(word);
      await this.store.sync();

      // 2. Sync to backend
      const userId = this.userStore.getUserId();
      try {
        await this.apiClient.delete(
          `/users/${userId}/unknown-words/${word.toLowerCase()}`
        );
        logger.info(`"${word}" removed from unknown words on backend`);
      } catch (error) {
        logger.warn(`Failed to sync "${word}" removal to backend`, error);
      }

      // 3. Trigger page re-highlight
      window.dispatchEvent(new Event('unknown-words-updated'));

      return true;
    } catch (error) {
      logger.error(`Failed to remove "${word}" from unknown`, error);
      return false;
    }
  }

  /**
   * Load unknown words from backend for multi-device sync
   *
   * Called on startup to sync data from other devices
   *
   * @returns {Promise<string[]>} List of unknown words
   */
  async loadFromBackend() {
    try {
      const userId = this.userStore.getUserId();
      const response = await this.apiClient.get(
        `/users/${userId}/unknown-words`
      );

      if (response.success && response.unknown_words) {
        logger.info(
          `Loaded ${response.unknown_words.length} unknown words from backend`
        );
        return response.unknown_words;
      }

      return [];
    } catch (error) {
      logger.warn('Failed to load unknown words from backend', error);
      return [];
    }
  }

  /**
   * Sync unknown words with backend
   *
   * Merges local and backend data
   *
   * @returns {Promise<void>}
   */
  async syncWithBackend() {
    try {
      logger.log('Syncing unknown words with backend');

      // Load backend data
      const backendWords = await this.loadFromBackend();
      const backendSet = new Set(
        backendWords.map(w => w.toLowerCase())
      );

      // Merge with local data
      const merged = new Set([...this.store.unknownWords, ...backendSet]);

      // Update local store
      this.store.unknownWords = merged;
      await this.store.sync();

      logger.info(`Synced ${merged.size} unknown words`);
    } catch (error) {
      logger.error('Failed to sync unknown words', error);
    }
  }

  /**
   * Check if a word is marked as unknown
   *
   * @param {string} word - Word to check
   * @returns {boolean}
   */
  isUnknown(word) {
    return this.store.has(word);
  }

  /**
   * Get all unknown words
   *
   * @returns {string[]}
   */
  getAll() {
    return this.store.getAll();
  }
}

// Create global service instance (will be initialized in content.js)
let unknownWordsService;
