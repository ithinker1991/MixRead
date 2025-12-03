/**
 * User Store - User State Management
 *
 * Manages user-specific state: user_id, difficulty level, etc.
 */

class UserStore {
  constructor() {
    this.user = {
      id: null,
      difficultyLevel: 'B1',
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
      const result = await StorageManager.getItems(['mixread_current_user', 'mixread_user_id']);
      let userId = result.mixread_current_user || result.mixread_user_id;

      if (!userId) {
        // Fallback to generate new user
        userId = await StorageManager.getUserId();
      }

      this.user.id = userId;

      // Load difficulty level
      const difficulty = await StorageManager.getItem('difficulty_level');
      if (difficulty) {
        this.user.difficultyLevel = difficulty;
      }

      logger.log(`User initialized - ID: ${userId}, Difficulty: ${this.user.difficultyLevel}`);
    } catch (error) {
      logger.error('Failed to initialize user', error);
      this.user.id = this.generateUserId();
    }
  }

  /**
   * Generate a unique user_id
   * Format: mixread-user-{timestamp}-{random}
   * @returns {string}
   */
  generateUserId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `mixread-user-${timestamp}-${random}`;
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
  async setDifficultyLevel(level) {
    this.user.difficultyLevel = level;
    await StorageManager.setItem('difficulty_level', level);
    this.notify();
    logger.log(`Difficulty level changed to: ${level}`);
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
        await StorageManager.setItem('user_id', newUserId);
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
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners
   */
  notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.user);
      } catch (error) {
        logger.error('Error in user store listener', error);
      }
    });
  }
}
