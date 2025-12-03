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
      console.log(`[UnknownWordsService] Marking "${word}" as unknown`);
      logger.log(`Marking "${word}" as unknown`);

      // 1. Immediate local update (UX feedback)
      this.store.add(word);
      console.log(`[UnknownWordsService] Added "${word}" to store. Current words:`, this.store.getAll());
      await this.store.sync();
      console.log(`[UnknownWordsService] Synced store to storage`);

      // 2. Sync to backend (async)
      const userId = this.userStore.getUserId();
      console.log(`[UnknownWordsService] User ID: ${userId}`);
      try {
        await this.apiClient.post(`/users/${userId}/unknown-words`, {
          word: word,
        });
        console.log(`[UnknownWordsService] Successfully synced "${word}" to backend`);
        logger.info(`"${word}" marked as unknown on backend`);
      } catch (error) {
        console.warn(`[UnknownWordsService] Failed to sync "${word}" to backend:`, error);
        logger.warn(`Failed to sync "${word}" to backend`, error);
        // Continue anyway - user can retry next time
      }

      // 3. Trigger page re-highlight
      console.log(`[UnknownWordsService] Dispatching 'unknown-words-updated' event`);
      window.dispatchEvent(new Event('unknown-words-updated'));
      logger.log('Triggered page re-highlight');

      return true;
    } catch (error) {
      console.error(`[UnknownWordsService] Error marking "${word}" as unknown:`, error);
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
      console.log(`[UnknownWordsService] Removing "${word}" from unknown words`);
      logger.log(`Removing "${word}" from unknown words`);

      // 1. Local update
      this.store.remove(word);
      console.log(`[UnknownWordsService] Removed "${word}" from store. Current words:`, this.store.getAll());
      await this.store.sync();
      console.log(`[UnknownWordsService] Synced store to storage`);

      // 2. Sync to backend
      const userId = this.userStore.getUserId();
      console.log(`[UnknownWordsService] User ID: ${userId}`);
      try {
        await this.apiClient.delete(
          `/users/${userId}/unknown-words/${word.toLowerCase()}`
        );
        console.log(`[UnknownWordsService] Successfully removed "${word}" from backend`);
        logger.info(`"${word}" removed from unknown words on backend`);
      } catch (error) {
        console.warn(`[UnknownWordsService] Failed to remove "${word}" from backend:`, error);
        logger.warn(`Failed to sync "${word}" removal to backend`, error);
      }

      // 3. Trigger page re-highlight
      console.log(`[UnknownWordsService] Dispatching 'unknown-words-updated' event`);
      window.dispatchEvent(new Event('unknown-words-updated'));

      return true;
    } catch (error) {
      console.error(`[UnknownWordsService] Error removing "${word}" from unknown:`, error);
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

  /**
   * Mark a word as known (user knows it)
   *
   * This adds the word to the known_words list so it won't be highlighted
   *
   * @param {string} word - Word to mark as known
   * @returns {Promise<boolean>} Success status
   */
  async markAsKnown(word) {
    try {
      console.log(`[UnknownWordsService] Marking "${word}" as known`);
      logger.log(`Marking "${word}" as known`);

      // Also remove from unknown words if it was there
      if (this.store.has(word)) {
        this.store.remove(word);
        await this.store.sync();
        console.log(`[UnknownWordsService] Removed "${word}" from unknown words`);
      }

      // Sync to backend
      const userId = this.userStore.getUserId();
      console.log(`[UnknownWordsService] User ID: ${userId}`);
      try {
        await this.apiClient.post(`/users/${userId}/known-words`, {
          word: word,
        });
        console.log(`[UnknownWordsService] Successfully marked "${word}" as known on backend`);
        logger.info(`"${word}" marked as known on backend`);
      } catch (error) {
        console.warn(`[UnknownWordsService] Failed to mark "${word}" as known on backend:`, error);
        logger.warn(`Failed to sync "${word}" as known to backend`, error);
        // Continue anyway
      }

      // Trigger page re-highlight
      console.log(`[UnknownWordsService] Dispatching 'unknown-words-updated' event`);
      window.dispatchEvent(new Event('unknown-words-updated'));
      logger.log('Triggered page re-highlight');

      return true;
    } catch (error) {
      console.error(`[UnknownWordsService] Error marking "${word}" as known:`, error);
      logger.error(`Failed to mark "${word}" as known`, error);
      return false;
    }
  }

  /**
   * Remove a word from known words
   *
   * @param {string} word - Word to unmark
   * @returns {Promise<boolean>} Success status
   */
  async unmarkAsKnown(word) {
    try {
      console.log(`[UnknownWordsService] Removing "${word}" from known words`);
      logger.log(`Removing "${word}" from known words`);

      // Sync to backend
      const userId = this.userStore.getUserId();
      console.log(`[UnknownWordsService] User ID: ${userId}`);
      try {
        await this.apiClient.delete(
          `/users/${userId}/known-words/${word.toLowerCase()}`
        );
        console.log(`[UnknownWordsService] Successfully removed "${word}" from known words on backend`);
        logger.info(`"${word}" removed from known words on backend`);
      } catch (error) {
        console.warn(`[UnknownWordsService] Failed to remove "${word}" from known words on backend:`, error);
        logger.warn(`Failed to remove "${word}" from known words on backend`, error);
      }

      // Trigger page re-highlight
      console.log(`[UnknownWordsService] Dispatching 'unknown-words-updated' event`);
      window.dispatchEvent(new Event('unknown-words-updated'));

      return true;
    } catch (error) {
      console.error(`[UnknownWordsService] Error removing "${word}" from known:`, error);
      logger.error(`Failed to remove "${word}" from known`, error);
      return false;
    }
  }
}
