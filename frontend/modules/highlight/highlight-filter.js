/**
 * Highlight Filter - Local filtering before API call
 *
 * Optimizes API calls by filtering known/unknown words on frontend first
 * This is a performance optimization - backend will filter again
 */

class HighlightFilter {
  constructor(unknownWordsStore, userStore) {
    this.unknownWordsStore = unknownWordsStore;
    this.userStore = userStore;
  }

  /**
   * Get highlighted words based on user's state
   *
   * Flow:
   * 1. Filter out known words (local optimization)
   * 2. Call backend API with remaining words
   * 3. Backend filters again using full logic
   *
   * @param {string[]} words - Words to check
   * @returns {Promise<object>} Highlighted words response
   */
  async getHighlightedWords(words) {
    try {
      const userId = this.userStore.getUserId();
      const difficultyLevel = this.userStore.getDifficultyLevel();

      // API call with all words - backend will handle full filtering logic
      const response = await apiClient.post("/highlight-words", {
        user_id: userId,
        words: words,
        difficulty_level: difficultyLevel,
      });

      if (response.success) {
        logger.debug(
          `Got ${response.highlighted_count} highlighted words out of ${response.total_words}`
        );
        return response;
      }

      logger.warn("Highlight API returned error", response.error);
      return {
        success: false,
        highlighted_words: [],
        word_details: [],
      };
    } catch (error) {
      logger.error("Failed to get highlighted words", error);
      return {
        success: false,
        highlighted_words: [],
        word_details: [],
        error: error.message,
      };
    }
  }

  /**
   * Check if a word should be highlighted (local check only)
   * Note: This is a quick local check - backend has the authoritative decision
   *
   * @param {string} word - Word to check
   * @returns {boolean}
   */
  shouldHighlightLocally(word) {
    // Unknown words should be highlighted
    if (this.unknownWordsStore.has(word)) {
      return true;
    }

    // Default: likely should be highlighted (backend will decide)
    return true;
  }
}

// Export for use in both module and global scope
if (typeof module !== "undefined" && module.exports) {
  module.exports = HighlightFilter;
} else if (typeof window !== "undefined") {
  window.HighlightFilter = HighlightFilter;
}
