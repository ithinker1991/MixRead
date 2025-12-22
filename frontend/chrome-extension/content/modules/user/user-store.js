/**
 * User Store - User State Management
 *
 * Manages user-specific state: user_id, difficulty level, etc.
 */

class UserStore {
  constructor() {
    this.user = {
      id: null,
      difficultyLevel: "B1",
      difficultyMRS: 40,
    };
    this.listeners = [];
  }

  /**
   * Initialize user - generate or load user_id
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Get current user ID from popup's user management
      // Priority: testUserId (popup's manual input) > mixread_current_user > mixread_user_id
      const result = await StorageManager.getItems([
        "testUserId",
        "mixread_current_user",
        "mixread_user_id",
      ]);

      let userId =
        result.testUserId ||
        result.mixread_current_user ||
        result.mixread_user_id;

      if (!userId) {
        // Fallback to StorageManager's generation/retrieval logic
        userId = await StorageManager.getUserId();
      }

      this.user.id = userId;

      // Load difficulty level
      const diffResult = await StorageManager.getItems([
        "difficultyLevel",
        "difficulty_mrs",
      ]);
      if (diffResult.difficultyLevel) {
        this.user.difficultyLevel = diffResult.difficultyLevel;
      }
      if (diffResult.difficulty_mrs !== undefined) {
        this.user.difficultyMRS = diffResult.difficulty_mrs;
      }

      logger.log(
        `User initialized - ID: ${userId}, Difficulty: ${this.user.difficultyLevel}, MRS: ${this.user.difficultyMRS}`
      );
    } catch (error) {
      logger.error("Failed to initialize user", error);
      // Fallback to a clean generation if everything fails
      this.user.id = await StorageManager.getUserId();
    }
  }

  /**
   * Get current user_id
   * @returns {string}
   */
  getUserId() {
    return this.user.id;
  }

  /**
   * Get current difficulty level
   * @returns {string}
   */
  getDifficultyLevel() {
    return this.user.difficultyLevel;
  }

  /**
   * Set difficulty level
   * @param {string} level - New difficulty level (A1-C2)
   * @returns {Promise<void>}
   */
  async setDifficultyLevel(level, mrs = null) {
    this.user.difficultyLevel = level;
    if (mrs !== null) {
      this.user.difficultyMRS = mrs;
    }
    await StorageManager.setItems({
      difficultyLevel: level,
      difficulty_mrs: this.user.difficultyMRS,
    });
    this.notify();
    logger.log(
      `Difficulty level changed to: ${level}, MRS: ${this.user.difficultyMRS}`
    );
  }

  /**
   * Switch to a different user_id (multi-device support)
   * @param {string} newUserId - New user_id to switch to
   * @returns {Promise<boolean>} Success status
   */
  async switchUser(newUserId) {
    try {
      // Validate by trying to get user data from backend
      const response = await apiClient.get(`/users/${newUserId}`);

      if (response.success) {
        this.user.id = newUserId;
        await StorageManager.setItem("user_id", newUserId);
        this.notify();
        logger.info(`Switched to user: ${newUserId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.warn(`Failed to switch to user ${newUserId}`, error);
      return false;
    }
  }

  /**
   * Subscribe to user changes
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
   * Notify all listeners
   */
  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.user);
      } catch (error) {
        logger.error("Error in user store listener", error);
      }
    });
  }
}

// Export for use in both module and global scope
if (typeof module !== "undefined" && module.exports) {
  module.exports = UserStore;
} else if (typeof window !== "undefined") {
  window.UserStore = UserStore;
}
