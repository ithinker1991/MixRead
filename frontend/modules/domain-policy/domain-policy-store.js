/**
 * Domain Policy Store - Domain Management State
 *
 * Manages blacklist/whitelist domain policies
 * Handles local caching and backend synchronization
 */

class DomainPolicyStore {
  constructor() {
    this.blacklist = [];
    this.whitelist = [];
    this.presetDomains = []; // Default preset domains
    this.isInitialized = false;
    this.listeners = [];
    this.isSyncing = false;
  }

  /**
   * Add a listener to be notified of changes
   * @param {Function} callback - Function to call when state changes
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a listener
   * @param {Function} callback - Function to remove
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  /**
   * Notify all listeners of state change
   */
  notify() {
    this.listeners.forEach((callback) => {
      try {
        callback({
          blacklist: this.blacklist,
          whitelist: this.whitelist,
          isInitialized: this.isInitialized,
        });
      } catch (error) {
        logger.error("Error in domain policy listener", error);
      }
    });
  }

  /**
   * Initialize domain policies from backend
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async initialize(userId) {
    if (this.isInitialized) {
      logger.log("[DomainPolicy] Already initialized, skipping");
      return true;
    }

    try {
      logger.log("[DomainPolicy] Initializing domain policies...");

      // Load blacklist from backend
      const blacklistResult = await apiClient.get(
        `/users/${userId}/domain-policies/blacklist`
      );

      if (blacklistResult.success) {
        this.blacklist = blacklistResult.blacklist_domains || [];
        logger.log(
          `[DomainPolicy] Loaded ${this.blacklist.length} blacklist domains`
        );
      }

      // Load whitelist from backend
      const whitelistResult = await apiClient.get(
        `/users/${userId}/domain-policies/whitelist`
      );

      if (whitelistResult.success) {
        this.whitelist = whitelistResult.whitelist_domains || [];
        logger.log(
          `[DomainPolicy] Loaded ${this.whitelist.length} whitelist domains`
        );
      }

      this.isInitialized = true;
      this.notify();
      return true;
    } catch (error) {
      logger.error("[DomainPolicy] Initialization failed", error);
      // Continue anyway with empty lists
      this.isInitialized = true;
      this.notify();
      return false;
    }
  }

  /**
   * Reload domain policies from backend
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async reload(userId) {
    this.isInitialized = false;
    return this.initialize(userId);
  }

  /**
   * Check if domain should be excluded (in blacklist)
   * @param {string} domain - Domain to check
   * @returns {boolean} True if domain should be excluded
   */
  shouldExcludeDomain(domain) {
    if (!domain) return false;

    // Extract domain from URL if needed
    const domainName = this.extractDomain(domain);

    // Check if domain is in blacklist
    return this.blacklist.includes(domainName);
  }

  /**
   * Extract domain from URL
   * Example: "https://github.com/user/repo" => "github.com"
   * @param {string} urlOrDomain - URL or domain string
   * @returns {string} Domain name
   */
  extractDomain(urlOrDomain) {
    if (!urlOrDomain) return "";

    try {
      // If it's a full URL, extract domain
      if (urlOrDomain.includes("://")) {
        const url = new URL(urlOrDomain);
        return url.hostname;
      }
      // Otherwise assume it's already a domain
      return urlOrDomain.toLowerCase();
    } catch (error) {
      logger.warn("[DomainPolicy] Failed to extract domain from:", urlOrDomain);
      return urlOrDomain.toLowerCase();
    }
  }

  /**
   * Add domain to blacklist
   * @param {string} userId - User ID
   * @param {string} domain - Domain to add
   * @param {string} description - Optional description
   * @returns {Promise<boolean>} Success status
   */
  async addBlacklistDomain(userId, domain, description = null) {
    try {
      const response = await apiClient.post(
        `/users/${userId}/domain-policies/blacklist`,
        {
          domain: domain,
          description: description,
        }
      );

      if (response.success) {
        if (!this.blacklist.includes(domain)) {
          this.blacklist.push(domain);
          this.notify();
        }
        logger.log(`[DomainPolicy] Added to blacklist: ${domain}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[DomainPolicy] Failed to add blacklist domain", error);
      return false;
    }
  }

  /**
   * Remove domain from blacklist
   * @param {string} userId - User ID
   * @param {string} domain - Domain to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeBlacklistDomain(userId, domain) {
    try {
      const response = await apiClient.delete(
        `/users/${userId}/domain-policies/blacklist/${encodeURIComponent(
          domain
        )}`
      );

      if (response.success) {
        this.blacklist = this.blacklist.filter((d) => d !== domain);
        this.notify();
        logger.log(`[DomainPolicy] Removed from blacklist: ${domain}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[DomainPolicy] Failed to remove blacklist domain", error);
      return false;
    }
  }

  /**
   * Add multiple domains to blacklist
   * @param {string} userId - User ID
   * @param {string[]} domains - Domains to add
   * @returns {Promise<boolean>} Success status
   */
  async addBlacklistDomainsBatch(userId, domains) {
    try {
      const response = await apiClient.post(
        `/users/${userId}/domain-policies/blacklist/batch`,
        { domains: domains }
      );

      if (response.success) {
        // Add new domains to local list (avoid duplicates)
        domains.forEach((domain) => {
          if (!this.blacklist.includes(domain)) {
            this.blacklist.push(domain);
          }
        });
        this.notify();
        logger.log(
          `[DomainPolicy] Added ${domains.length} domains to blacklist`
        );
        return true;
      }
      return false;
    } catch (error) {
      logger.error(
        "[DomainPolicy] Failed to add blacklist domains batch",
        error
      );
      return false;
    }
  }

  /**
   * Remove multiple domains from blacklist
   * @param {string} userId - User ID
   * @param {string[]} domains - Domains to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeBlacklistDomainsBatch(userId, domains) {
    try {
      const response = await apiClient.post(
        `/users/${userId}/domain-policies/blacklist/batch-remove`,
        { domains: domains }
      );

      if (response.success) {
        this.blacklist = this.blacklist.filter((d) => !domains.includes(d));
        this.notify();
        logger.log(
          `[DomainPolicy] Removed ${domains.length} domains from blacklist`
        );
        return true;
      }
      return false;
    } catch (error) {
      logger.error(
        "[DomainPolicy] Failed to remove blacklist domains batch",
        error
      );
      return false;
    }
  }

  /**
   * Get all blacklist domains
   * @returns {string[]} List of blacklist domains
   */
  getBlacklistDomains() {
    return [...this.blacklist];
  }

  /**
   * Get all whitelist domains
   * @returns {string[]} List of whitelist domains
   */
  getWhitelistDomains() {
    return [...this.whitelist];
  }

  /**
   * Check if blacklist is empty
   * @returns {boolean}
   */
  isBlacklistEmpty() {
    return this.blacklist.length === 0;
  }

  /**
   * Get count of blacklist domains
   * @returns {number}
   */
  getBlacklistCount() {
    return this.blacklist.length;
  }

  /**
   * Get count of whitelist domains
   * @returns {number}
   */
  getWhitelistCount() {
    return this.whitelist.length;
  }

  /**
   * Clear all local data (for testing/reset)
   */
  clear() {
    this.blacklist = [];
    this.whitelist = [];
    this.presetDomains = [];
    this.isInitialized = false;
    this.notify();
    logger.log("[DomainPolicy] Cleared all policies");
  }

  /**
   * Set preset domains (default domains for new users)
   * @param {string[]} domains - List of preset domains
   */
  setPresetDomains(domains) {
    this.presetDomains = domains;
    logger.log(`[DomainPolicy] Set ${domains.length} preset domains`);
  }

  /**
   * Get preset domains
   * @returns {string[]} List of preset domains
   */
  getPresetDomains() {
    return [...this.presetDomains];
  }

  /**
   * Check if user should see preset dialog (no policies yet)
   * @returns {boolean}
   */
  shouldShowPresetDialog() {
    return this.isBlacklistEmpty() && this.isInitialized;
  }
}
