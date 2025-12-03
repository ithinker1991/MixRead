/**
 * Frontend Test Runner (Node.js)
 * Tests DomainPolicyStore, DomainPolicyFilter, and PresetDialog
 */

const assert = require('assert');

// Mock logger
global.logger = {
  log: (msg) => console.log(`[LOG] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  info: (msg) => console.log(`[INFO] ${msg}`)
};

// Mock chrome API
global.chrome = {
  tabs: {
    query: () => {}
  },
  runtime: {
    lastError: null
  }
};

// Mock apiClient (for testing)
global.apiClient = {
  async get(url) {
    if (url.includes('blacklist')) {
      return {success: true, blacklist_domains: ['localhost', 'github.com']};
    }
    if (url.includes('whitelist')) {
      return {success: true, whitelist_domains: []};
    }
    return {success: true};
  },

  async post(url, data) {
    return {success: true, message: 'OK'};
  },

  async delete(url) {
    return {success: true, message: 'OK'};
  }
};

// Mock document (basic)
global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({
    addEventListener: () => {}
  })
};

// DomainPolicyStore implementation (copied for testing)
class DomainPolicyStore {
  constructor() {
    this.blacklist = [];
    this.whitelist = [];
    this.presetDomains = [];
    this.isInitialized = false;
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notify() {
    this.listeners.forEach(callback => {
      try {
        callback({blacklist: this.blacklist, whitelist: this.whitelist});
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  async initialize(userId) {
    try {
      const blacklistResult = await apiClient.get(`/users/${userId}/domain-policies/blacklist`);
      if (blacklistResult.success) {
        this.blacklist = blacklistResult.blacklist_domains || [];
      }

      const whitelistResult = await apiClient.get(`/users/${userId}/domain-policies/whitelist`);
      if (whitelistResult.success) {
        this.whitelist = whitelistResult.whitelist_domains || [];
      }

      this.isInitialized = true;
      this.notify();
      return true;
    } catch (error) {
      this.isInitialized = true;
      this.notify();
      return false;
    }
  }

  shouldExcludeDomain(domain) {
    if (!domain) return false;
    const domainName = this.extractDomain(domain);
    return this.blacklist.includes(domainName);
  }

  extractDomain(urlOrDomain) {
    if (!urlOrDomain) return '';
    try {
      if (urlOrDomain.includes('://')) {
        const url = new URL(urlOrDomain);
        return url.hostname;
      }
      return urlOrDomain.toLowerCase();
    } catch (error) {
      return urlOrDomain.toLowerCase();
    }
  }

  async addBlacklistDomain(userId, domain, description = null) {
    try {
      const response = await apiClient.post(`/users/${userId}/domain-policies/blacklist`, {
        domain: domain,
        description: description
      });

      if (response.success) {
        if (!this.blacklist.includes(domain)) {
          this.blacklist.push(domain);
          this.notify();
        }
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async removeBlacklistDomain(userId, domain) {
    try {
      const response = await apiClient.delete(
        `/users/${userId}/domain-policies/blacklist/${encodeURIComponent(domain)}`
      );

      if (response.success) {
        this.blacklist = this.blacklist.filter(d => d !== domain);
        this.notify();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  getBlacklistDomains() {
    return [...this.blacklist];
  }

  getWhitelistDomains() {
    return [...this.whitelist];
  }

  isBlacklistEmpty() {
    return this.blacklist.length === 0;
  }

  getBlacklistCount() {
    return this.blacklist.length;
  }

  shouldShowPresetDialog() {
    return this.isBlacklistEmpty() && this.isInitialized;
  }
}

// DomainPolicyFilter implementation
class DomainPolicyFilter {
  static shouldExcludeCurrentPage(currentUrl, policyStore) {
    if (!currentUrl || !policyStore) {
      return false;
    }
    const domain = this.extractDomain(currentUrl);
    return policyStore.shouldExcludeDomain(domain);
  }

  static extractDomain(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return '';
    }
  }

  static isDomainInList(domain, domainList) {
    if (!domain || !domainList || domainList.length === 0) {
      return false;
    }
    const normalizedDomain = domain.toLowerCase();
    return domainList.some(d => d.toLowerCase() === normalizedDomain);
  }

  static getExclusionReason(domain, policyStore) {
    if (!policyStore || !domain) {
      return 'none';
    }
    const blacklistDomains = policyStore.getBlacklistDomains();
    if (this.isDomainInList(domain, blacklistDomains)) {
      return 'in_blacklist';
    }
    return 'none';
  }

  static getExclusionStatus(url, policyStore) {
    const domain = this.extractDomain(url);
    const isExcluded = this.shouldExcludeCurrentPage(url, policyStore);
    const reason = this.getExclusionReason(domain, policyStore);
    return {domain, isExcluded, reason, url};
  }
}

// PresetDialog implementation
class PresetDialog {
  constructor() {
    this.isOpen = false;
    this.selectedDomains = new Set();
    this.presetDomains = [
      {domain: 'localhost', category: 'Development'},
      {domain: 'github.com', category: 'Development'},
      {domain: 'stackoverflow.com', category: 'Development'},
      {domain: 'twitter.com', category: 'Social Media'},
      {domain: 'reddit.com', category: 'Social Media'},
      {domain: 'facebook.com', category: 'Social Media'},
      {domain: 'instagram.com', category: 'Social Media'},
      {domain: 'tiktok.com', category: 'Social Media'},
      {domain: 'youtube.com', category: 'Video'}
    ];
  }

  groupByCategory() {
    const categories = {};
    this.presetDomains.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });
    return categories;
  }

  createDialogHTML() {
    const categories = this.groupByCategory();
    return `<div>Preset Dialog with ${Object.keys(categories).length} categories and ${this.presetDomains.length} domains</div>`;
  }

  static shouldShow(policyStore) {
    return policyStore && policyStore.shouldShowPresetDialog();
  }
}

// Test suite
let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ PASSED: ${name}`);
    passedCount++;
  } catch (error) {
    console.error(`✗ FAILED: ${name}`);
    console.error(`  ${error.message}`);
    failedCount++;
  }
}

function assertEquals(actual, expected, message) {
  assert.strictEqual(actual, expected, message || `Expected ${expected}, got ${actual}`);
}

function assertTrue(value, message) {
  assert.strictEqual(value, true, message);
}

function assertFalse(value, message) {
  assert.strictEqual(value, false, message);
}

// ========== DomainPolicyStore Tests ==========
console.log('\n========== DomainPolicyStore Tests ==========\n');

test('Store initialization', () => {
  const store = new DomainPolicyStore();
  assertEquals(store !== null, true, 'Store should be created');
  assertFalse(store.isInitialized, 'Store should not be initialized initially');
});

test('Get empty blacklist', () => {
  const store = new DomainPolicyStore();
  assertEquals(store.getBlacklistCount(), 0, 'Count should be 0');
  assertTrue(store.isBlacklistEmpty(), 'Blacklist should be empty');
});

test('Extract domain from URL', () => {
  const store = new DomainPolicyStore();
  const domain = store.extractDomain('https://github.com/user/repo');
  assertEquals(domain, 'github.com', 'Should extract github.com from URL');
});

test('Should exclude domain in blacklist', () => {
  const store = new DomainPolicyStore();
  store.blacklist = ['example.com', 'test.com'];
  assertTrue(store.shouldExcludeDomain('example.com'), 'Should exclude domain in blacklist');
});

test('Should not exclude domain', () => {
  const store = new DomainPolicyStore();
  store.blacklist = ['example.com'];
  assertFalse(store.shouldExcludeDomain('github.com'), 'Should not exclude domain not in blacklist');
});

test('Listener notification', () => {
  const store = new DomainPolicyStore();
  let notified = false;
  store.addListener(() => {
    notified = true;
  });
  store.notify();
  assertTrue(notified, 'Should notify listeners');
});

// ========== DomainPolicyFilter Tests ==========
console.log('\n========== DomainPolicyFilter Tests ==========\n');

test('Extract domain from URL', () => {
  const domain = DomainPolicyFilter.extractDomain('https://example.com/path');
  assertEquals(domain, 'example.com', 'Should extract domain correctly');
});

test('Check if domain in list', () => {
  const result = DomainPolicyFilter.isDomainInList('github.com', ['github.com', 'example.com']);
  assertTrue(result, 'Should find domain in list');
});

test('Case insensitive domain matching', () => {
  const result = DomainPolicyFilter.isDomainInList('GitHub.com', ['github.com']);
  assertTrue(result, 'Should do case-insensitive matching');
});

test('Get exclusion reason for blacklisted domain', () => {
  const store = new DomainPolicyStore();
  store.blacklist = ['example.com'];
  const reason = DomainPolicyFilter.getExclusionReason('example.com', store);
  assertEquals(reason, 'in_blacklist', 'Should return in_blacklist reason');
});

test('Get exclusion reason for non-blacklisted domain', () => {
  const store = new DomainPolicyStore();
  store.blacklist = ['example.com'];
  const reason = DomainPolicyFilter.getExclusionReason('github.com', store);
  assertEquals(reason, 'none', 'Should return none reason');
});

test('Get exclusion status', () => {
  const store = new DomainPolicyStore();
  store.blacklist = ['example.com'];
  const status = DomainPolicyFilter.getExclusionStatus('https://example.com/page', store);
  assertTrue(status.isExcluded, 'Should be excluded');
  assertEquals(status.domain, 'example.com', 'Should have correct domain');
});

// ========== PresetDialog Tests ==========
console.log('\n========== PresetDialog Tests ==========\n');

test('Dialog instantiation', () => {
  const dialog = new PresetDialog();
  assertEquals(dialog !== null, true, 'Dialog should be created');
  assertTrue(Array.isArray(dialog.presetDomains), 'Should have preset domains');
  assertEquals(dialog.presetDomains.length > 0, true, 'Should have domains');
});

test('Preset domains count', () => {
  const dialog = new PresetDialog();
  assertEquals(dialog.presetDomains.length, 9, 'Should have 9 preset domains');
});

test('Group domains by category', () => {
  const dialog = new PresetDialog();
  const groups = dialog.groupByCategory();
  assertEquals(Object.keys(groups).length > 0, true, 'Should have categories');
  assertEquals(groups['Development'] !== undefined, true, 'Should have Development category');
});

test('Should show condition for empty blacklist', () => {
  const store = new DomainPolicyStore();
  store.blacklist = [];
  store.isInitialized = true;
  assertTrue(PresetDialog.shouldShow(store), 'Should show when no blacklist');
});

test('Should not show condition for non-empty blacklist', () => {
  const store = new DomainPolicyStore();
  store.blacklist = ['example.com'];
  store.isInitialized = true;
  assertFalse(PresetDialog.shouldShow(store), 'Should not show when has blacklist');
});

// ========== Integration Tests ==========
console.log('\n========== Integration Tests ==========\n');

test('Store listener receives updates', () => {
  const store = new DomainPolicyStore();
  let callCount = 0;
  store.addListener(() => {
    callCount++;
  });
  store.notify();
  assertEquals(callCount, 1, 'Listener should be called once');
});

test('Multiple listeners are notified', () => {
  const store = new DomainPolicyStore();
  let count1 = 0, count2 = 0;
  store.addListener(() => count1++);
  store.addListener(() => count2++);
  store.notify();
  assertEquals(count1, 1, 'First listener should be called');
  assertEquals(count2, 1, 'Second listener should be called');
});

test('Remove listener', () => {
  const store = new DomainPolicyStore();
  let callCount = 0;
  const listener = () => callCount++;
  store.addListener(listener);
  store.removeListener(listener);
  store.notify();
  assertEquals(callCount, 0, 'Removed listener should not be called');
});

// ========== Test Results ==========
console.log('\n========== Test Results ==========\n');
console.log(`✓ Passed: ${passedCount}`);
console.log(`✗ Failed: ${failedCount}`);
console.log(`Total: ${passedCount + failedCount}`);

if (failedCount === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failedCount} test(s) failed`);
  process.exit(1);
}
