const assert = require("assert");

// Mock DomainPolicyStore
class DomainPolicyStore {
  constructor() {
    this.blacklist = [];
  }

  getBlacklistDomains() {
    return this.blacklist;
  }

  /**
   * Extract domain from URL (preserves port if present)
   * Example: "https://github.com/user/repo" => "github.com"
   * Example: "http://localhost:8002/page" => "localhost:8002"
   */
  extractDomain(urlOrDomain) {
    if (!urlOrDomain) return "";

    try {
      // If it's a full URL, extract domain
      if (urlOrDomain.includes("://")) {
        const url = new URL(urlOrDomain);
        // Include port in domain if it exists
        // url.host includes both hostname and port
        return url.host;
      }
      // Otherwise assume it's already a domain
      return urlOrDomain.toLowerCase();
    } catch (error) {
      console.warn("[DomainPolicy] Failed to extract domain from:", urlOrDomain);
      return urlOrDomain.toLowerCase();
    }
  }

  /**
   * Check if domain should be excluded (in blacklist)
   */
  shouldExcludeDomain(domain) {
    if (!domain) return false;

    // Extract domain from URL if needed
    const domainName = this.extractDomain(domain).toLowerCase();

    // Check if domain is in blacklist (case-insensitive)
    return this.blacklist.some(
      (blacklistedDomain) => blacklistedDomain.toLowerCase() === domainName
    );
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

  console.log("✅ Domain Filter tests passed!");
}

/**
 * Test cases for DomainPolicyStore with port number handling
 */
function runPortNumberTests() {
  console.log("\nRunning Domain Policy Store Port Number Tests...");

  const store = new DomainPolicyStore();

  // Test 1: Extract domain from URL without port
  assert.strictEqual(
    store.extractDomain("https://github.com/user/repo"),
    "github.com",
    "Should extract domain without port"
  );

  // Test 2: Extract domain from URL with port
  assert.strictEqual(
    store.extractDomain("http://localhost:8002/library-viewer.html"),
    "localhost:8002",
    "Should extract domain with port"
  );

  // Test 3: Extract domain from URL with port and query parameters
  assert.strictEqual(
    store.extractDomain("http://localhost:8002/page?user=123"),
    "localhost:8002",
    "Should extract domain with port, ignoring query params"
  );

  // Test 4: Extract plain domain (already normalized)
  assert.strictEqual(
    store.extractDomain("localhost:8002"),
    "localhost:8002",
    "Should return plain domain as-is"
  );

  console.log("✅ Domain extraction tests passed!");

  // Test 5: Blacklist with port - exact match
  store.blacklist = ["localhost:8002"];
  assert.strictEqual(
    store.shouldExcludeDomain("http://localhost:8002/library-viewer.html"),
    true,
    "Should exclude URL with matching port"
  );

  // Test 6: Blacklist with port - different port should NOT match
  assert.strictEqual(
    store.shouldExcludeDomain("http://localhost:8001/page"),
    false,
    "Should NOT exclude URL with different port"
  );

  // Test 7: Blacklist without port - should NOT match port variants
  store.blacklist = ["localhost"];
  assert.strictEqual(
    store.shouldExcludeDomain("http://localhost:8002/page"),
    false,
    "Should NOT exclude localhost:8002 when blacklist has only localhost"
  );

  // Test 8: Blacklist with standard port (80 for http, 443 for https)
  store.blacklist = ["example.com"];
  assert.strictEqual(
    store.shouldExcludeDomain("https://example.com/page"),
    true,
    "Should exclude standard https domain"
  );

  // Test 9: Blacklist with explicit port 443
  store.blacklist = ["example.com:443"];
  assert.strictEqual(
    store.shouldExcludeDomain("https://example.com/page"),
    false,
    "Should NOT exclude https domain when blacklist specifies port 443 explicitly"
  );

  // Test 10: Case insensitive with port
  store.blacklist = ["LOCALHOST:8002"];
  assert.strictEqual(
    store.shouldExcludeDomain("http://localhost:8002/page"),
    true,
    "Should be case insensitive even with port"
  );

  // Test 11: Mixed case domain with port
  store.blacklist = ["localhost:8002"];
  assert.strictEqual(
    store.shouldExcludeDomain("http://LOCALHOST:8002/page"),
    true,
    "Should match mixed case domain with port"
  );

  // Test 12: Multiple domains in blacklist with and without ports
  store.blacklist = ["github.com", "localhost:8002", "example.com:3000"];
  assert.strictEqual(
    store.shouldExcludeDomain("http://localhost:8002/page"),
    true,
    "Should exclude localhost:8002 from mixed blacklist"
  );
  assert.strictEqual(
    store.shouldExcludeDomain("https://github.com/repo"),
    true,
    "Should exclude github.com from mixed blacklist"
  );
  assert.strictEqual(
    store.shouldExcludeDomain("http://example.com:3000/page"),
    true,
    "Should exclude example.com:3000 from mixed blacklist"
  );
  assert.strictEqual(
    store.shouldExcludeDomain("http://example.com:8080/page"),
    false,
    "Should NOT exclude example.com:8080 when blacklist specifies :3000"
  );

  console.log("✅ Port number blacklist tests passed!");
}

/**
 * Test cases for edge cases
 */
function runEdgeCaseTests() {
  console.log("\nRunning Edge Case Tests...");

  const store = new DomainPolicyStore();

  // Test 1: Empty URL
  assert.strictEqual(
    store.extractDomain(""),
    "",
    "Should handle empty URL"
  );

  // Test 2: Invalid URL
  assert.strictEqual(
    store.extractDomain("not a valid url at all"),
    "not a valid url at all",
    "Should return input as-is for invalid URL"
  );

  // Test 3: shouldExcludeDomain with empty string
  store.blacklist = ["example.com"];
  assert.strictEqual(
    store.shouldExcludeDomain(""),
    false,
    "Should return false for empty domain"
  );

  // Test 4: shouldExcludeDomain with null
  assert.strictEqual(
    store.shouldExcludeDomain(null),
    false,
    "Should return false for null domain"
  );

  // Test 5: Empty blacklist
  store.blacklist = [];
  assert.strictEqual(
    store.shouldExcludeDomain("http://localhost:8002/page"),
    false,
    "Should return false when blacklist is empty"
  );

  console.log("✅ Edge case tests passed!");
}

function runAllTests() {
  runTests();
  runPortNumberTests();
  runEdgeCaseTests();
  console.log("\n✅✅✅ ALL TESTS PASSED! ✅✅✅");
}

runAllTests();
