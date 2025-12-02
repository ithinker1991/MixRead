const assert = require("assert");

// Mock DomainPolicyStore
class DomainPolicyStore {
  constructor() {
    this.blacklist = [];
  }

  getBlacklistDomains() {
    return this.blacklist;
  }
}

// Mock Logger
const logger = {
  warn: console.log,
  log: console.log,
  error: console.error,
};

// Paste the updated DomainPolicyFilter class here (simplified for testing)
class DomainPolicyFilter {
  static isDomainInList(domain, domainList) {
    if (!domain || !domainList || domainList.length === 0) {
      return false;
    }

    const normalizedDomain = domain.toLowerCase();
    return domainList.some((d) => {
      const listedDomain = d.toLowerCase();
      // Match exact domain or subdomain (e.g., "www.example.com" matches "example.com")
      return (
        normalizedDomain === listedDomain ||
        normalizedDomain.endsWith("." + listedDomain)
      );
    });
  }
}

// Test Cases
function runTests() {
  console.log("Running Domain Matching Tests...");

  const blacklist = ["example.com", "test.org"];

  // 1. Exact match
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("example.com", blacklist),
    true,
    "Should match exact domain"
  );

  // 2. Subdomain match
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("www.example.com", blacklist),
    true,
    "Should match www subdomain"
  );
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("blog.example.com", blacklist),
    true,
    "Should match blog subdomain"
  );
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("a.b.example.com", blacklist),
    true,
    "Should match nested subdomain"
  );

  // 3. No match
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("google.com", blacklist),
    false,
    "Should not match unrelated domain"
  );
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("myexample.com", blacklist),
    false,
    "Should not match suffix without dot"
  );
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("example.com.org", blacklist),
    false,
    "Should not match as prefix"
  );

  // 4. Case insensitivity
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("EXAMPLE.COM", blacklist),
    true,
    "Should be case insensitive"
  );
  assert.strictEqual(
    DomainPolicyFilter.isDomainInList("Www.Example.Com", blacklist),
    true,
    "Should match mixed case subdomain"
  );

  console.log("✅ All tests passed!");
}

runTests();
