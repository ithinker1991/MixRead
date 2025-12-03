/**
 * Unknown Words Store - State Management
 *
 * Manages the state of unknown words (words user marked as not knowing)
 * Independent from vocabulary - these are just for highlighting
 */

class UnknownWordsStore {
  constructor() {
    this.unknownWords = new Set();
    this.listeners = [];
  }

  /**
   * Load unknown words from storage
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const cached = await StorageManager.getItem("unknown_words");
      if (cached && Array.isArray(cached)) {
        this.unknownWords = new Set(cached.map((w) => w.toLowerCase()));
        logger.info(
          `Loaded ${this.unknownWords.size} unknown words from storage`
        );
      }
    } catch (error) {
      logger.warn("Failed to load unknown words from storage", error);
      this.unknownWords = new Set();
    }
  }

  /**
   * Check if a word is in unknown words
   * @param {string} word - Word to check
   * @returns {boolean}
   */
  has(word) {
    return this.unknownWords.has(word.toLowerCase());
  }

  /**
   * Add a word to unknown words
   * @param {string} word - Word to add
   */
  add(word) {
    const wordLower = word.toLowerCase();
    if (!this.unknownWords.has(wordLower)) {
      this.unknownWords.add(wordLower);
      this.notify();
    }
  }

  /**
   * Remove a word from unknown words
   * @param {string} word - Word to remove
   */
  remove(word) {
    const wordLower = word.toLowerCase();
    if (this.unknownWords.has(wordLower)) {
      this.unknownWords.delete(wordLower);
      this.notify();
    }
  }

  /**
   * Get all unknown words as array
   * @returns {string[]}
   */
  getAll() {
    return Array.from(this.unknownWords);
  }

  /**
   * Subscribe to store changes
   * @param {function} listener - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.unknownWords);
      } catch (error) {
        logger.error("Error in unknown words listener", error);
      }
    });
  }

  /**
   * Sync state to storage
   * @returns {Promise<void>}
   */
  async sync() {
    try {
      await StorageManager.setItem("unknown_words", this.getAll());
      logger.debug("Unknown words synced to storage");
    } catch (error) {
      logger.warn("Failed to sync unknown words to storage", error);
    }
  }

  /**
   * Clear all unknown words
   */
  clear() {
    if (this.unknownWords.size > 0) {
      this.unknownWords.clear();
      this.notify();
    }
  }
}

// Export for use in both module and global scope
if (typeof module !== "undefined" && module.exports) {
  module.exports = UnknownWordsStore;
} else if (typeof window !== "undefined") {
  window.UnknownWordsStore = UnknownWordsStore;
}
