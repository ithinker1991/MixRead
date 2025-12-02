/**
 * Domain Policy Filter - Runtime Domain Checking
 *
 * Checks if the current page's domain should be excluded
 * from highlighting based on user's domain policies
 */

class DomainPolicyFilter {
  /**
   * Check if current tab should be excluded
   * @param {string} currentUrl - Current tab URL
   * @param {DomainPolicyStore} policyStore - Domain policy store
   * @returns {boolean} True if page should be excluded
   */
  static shouldExcludeCurrentPage(currentUrl, policyStore) {
    if (!currentUrl || !policyStore) {
      return false;
    }

    const domain = this.extractDomain(currentUrl);
    return policyStore.shouldExcludeDomain(domain);
  }

  /**
   * Extract domain from URL
   * @param {string} url - Full URL
   * @returns {string} Domain name or empty string if invalid
   */
  static extractDomain(url) {
    if (!url) return '';

    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      logger.warn('[DomainFilter] Invalid URL:', url);
      return '';
    }
  }

  /**
   * Match domain against list (exact match)
   * @param {string} domain - Domain to check
   * @param {string[]} domainList - List of domains
   * @returns {boolean} True if domain is in list
   */
  static isDomainInList(domain, domainList) {
    if (!domain || !domainList || domainList.length === 0) {
      return false;
    }

    const normalizedDomain = domain.toLowerCase();
    return domainList.some(d => d.toLowerCase() === normalizedDomain);
  }

  /**
   * Get reason why domain is excluded
   * @param {string} domain - Domain to check
   * @param {DomainPolicyStore} policyStore - Domain policy store
   * @returns {string} Reason for exclusion or 'none'
   */
  static getExclusionReason(domain, policyStore) {
    if (!policyStore || !domain) {
      return 'none';
    }

    // Check blacklist
    const blacklistDomains = policyStore.getBlacklistDomains();
    if (this.isDomainInList(domain, blacklistDomains)) {
      return 'in_blacklist';
    }

    return 'none';
  }

  /**
   * Get exclusion status for logging/debugging
   * @param {string} url - Current URL
   * @param {DomainPolicyStore} policyStore - Domain policy store
   * @returns {Object} Status object with domain and reason
   */
  static getExclusionStatus(url, policyStore) {
    const domain = this.extractDomain(url);
    const isExcluded = this.shouldExcludeCurrentPage(url, policyStore);
    const reason = this.getExclusionReason(domain, policyStore);

    return {
      domain: domain,
      isExcluded: isExcluded,
      reason: reason,
      url: url
    };
  }

  /**
   * Report domain status to backend (for analytics, Phase 2+)
   * @param {string} userId - User ID
   * @param {string} domain - Domain to report
   * @param {boolean} isExcluded - Whether domain is excluded
   * @param {string} reason - Exclusion reason
   * @returns {Promise<void>}
   */
  static async reportDomainStatus(userId, domain, isExcluded, reason) {
    if (!userId) {
      return;
    }

    try {
      // Backend endpoint for analytics (Phase 2+)
      // await apiClient.post(`/users/${userId}/analytics/domain-access`, {
      //   domain: domain,
      //   isExcluded: isExcluded,
      //   reason: reason,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      logger.error('[DomainFilter] Failed to report domain status', error);
    }
  }

  /**
   * Initialize filter with current tab information
   * @param {Function} callback - Callback with status
   * @returns {Promise<void>}
   */
  static async initializeForCurrentTab(callback) {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (tab && tab.url) {
        const status = this.getExclusionStatus(tab.url, domainPolicyStore);
        logger.log('[DomainFilter] Current tab status:', status);

        if (callback) {
          callback(status);
        }

        return status;
      }
    } catch (error) {
      logger.error('[DomainFilter] Failed to initialize for current tab', error);
    }

    return null;
  }
}
