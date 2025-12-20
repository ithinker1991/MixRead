/**
 * MixRead Navigation Utility
 *
 * Provides cross-environment navigation between:
 * - Chrome extension popup
 * - Web pages (review, library)
 *
 * Usage in extension:
 *   MixReadNavigation.openPage('review', { user_id: 'user123' })
 *
 * Usage in web pages:
 *   MixReadNavigation.openPage('library', { user_id: 'user123' })
 */

const MixReadNavigation = {
  // Configuration
  config: {
    webBaseUrl: "http://localhost:8001", // TODO: Change to production URL (e.g., https://app.mixread.com) when deploying
    pageMap: {
      review: "/pages/review/",
      library: "/pages/library/",
    },
  },

  /**
   * Get the environment type (extension or web)
   */
  getEnvironment() {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      return "extension";
    }
    return "web";
  },

  /**
   * Get current page parameters from URL
   */
  getPageParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    return result;
  },

  /**
   * Open a page with given type and parameters
   *
   * @param {string} pageType - 'review' or 'library'
   * @param {object} params - Query parameters
   */
  openPage(pageType, params = {}) {
    if (!this.config.pageMap[pageType]) {
      console.error(`[MixRead Navigation] Unknown page type: ${pageType}`);
      return;
    }

    const path = this.config.pageMap[pageType];
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.config.webBaseUrl}${path}?${queryString}`;

    console.log(`[MixRead Navigation] Opening page: ${pageType} at ${url}`);

    const env = this.getEnvironment();

    if (env === "extension") {
      // Extension environment: open in new tab
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.create({ url });
      }
    } else {
      // Web page environment: navigate directly
      window.location.href = url;
    }
  },

  /**
   * Get current user ID from page parameters or extension storage
   */
  async getCurrentUserId() {
    // First try to get from URL params
    const params = this.getPageParams();
    if (params.user_id) {
      return params.user_id;
    }

    // If in extension, try to get from storage
    if (this.getEnvironment() === "extension") {
      return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.local.get("userId", (result) => {
            resolve(result.userId || null);
          });
        } else {
          resolve(null);
        }
      });
    }

    return null;
  },

  /**
   * Set current user ID (for extension storage)
   */
  setCurrentUserId(userId) {
    if (
      this.getEnvironment() === "extension" &&
      typeof chrome !== "undefined" &&
      chrome.storage
    ) {
      chrome.storage.local.set({ userId });
    }
  },

  /**
   * Go back to previous page (if in web context with referrer)
   */
  goBack() {
    const env = this.getEnvironment();

    if (env === "web" && document.referrer) {
      window.history.back();
    } else {
      // If no referrer, go to main page
      window.location.href = this.config.webBaseUrl;
    }
  },
};

// Export for different environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = MixReadNavigation;
}
