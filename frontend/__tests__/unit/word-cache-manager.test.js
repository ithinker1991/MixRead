/**
 * WordCacheManager Unit Tests
 * Standalone test runner (no external dependencies)
 */

// Mock StorageManager
global.StorageManager = {
  getItem: async (key) => {
    return global.mockStorage[key] || null;
  },
  setItem: async (key, value) => {
    global.mockStorage[key] = value;
  },
  removeItem: async (key) => {
    delete global.mockStorage[key];
  },
  getItems: async () => {
    return global.mockStorage;
  }
};

global.mockStorage = {};

// Load the class
const WordCacheManager = require('../../modules/panel/word-cache-manager.js');

// Test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n🧪 WordCacheManager Unit Tests\n');

    for (const { name, fn } of this.tests) {
      try {
        // Reset storage before each test
        global.mockStorage = {};
        await fn();
        console.log(`  ✅ ${name}`);
        this.passed++;
      } catch (e) {
        console.log(`  ❌ ${name}`);
        console.log(`     Error: ${e.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Results: ${this.passed}/${this.tests.length} tests passed\n`);
    return this.failed === 0;
  }
}

// Create test runner
const runner = new TestRunner();

// ===== TESTS =====

runner.test('Should initialize with default options', () => {
  const manager = new WordCacheManager();
  if (manager.maxCacheSize !== 20) throw new Error('maxCacheSize should be 20');
  if (manager.cacheExpiryMs !== 86400000) throw new Error('cacheExpiryMs should be 24 hours');
});

runner.test('Should generate correct cache key from URL', () => {
  const manager = new WordCacheManager();

  const key1 = manager.getCacheKey('https://twitter.com/home');
  if (key1 !== 'twitter.com|/home') throw new Error(`Got "${key1}"`);

  const key2 = manager.getCacheKey('https://github.com/explore');
  if (key2 !== 'github.com|/explore') throw new Error(`Got "${key2}"`);

  const key3 = manager.getCacheKey('https://example.com/');
  if (key3 !== 'example.com|/') throw new Error(`Got "${key3}"`);
});

runner.test('Should handle invalid URL gracefully', () => {
  const manager = new WordCacheManager();
  const key = manager.getCacheKey('not-a-url');
  if (key !== null) throw new Error('Should return null for invalid URL');
});

runner.test('Should detect cache expiration correctly', () => {
  const manager = new WordCacheManager();

  const oldTimestamp = Date.now() - 86400001; // 24h + 1ms ago
  if (!manager.isExpired(oldTimestamp)) throw new Error('Old timestamp should be expired');

  const newTimestamp = Date.now() - 3600000; // 1h ago
  if (manager.isExpired(newTimestamp)) throw new Error('Recent timestamp should not be expired');
});

runner.test('Should maintain LRU index correctly', () => {
  const manager = new WordCacheManager();

  manager.updateLRUIndex('page1');
  manager.updateLRUIndex('page2');
  manager.updateLRUIndex('page3');
  manager.updateLRUIndex('page1'); // Re-add moves to end

  const expected = ['page2', 'page3', 'page1'];
  if (JSON.stringify(manager.cacheIndex) !== JSON.stringify(expected)) {
    throw new Error(`Got ${JSON.stringify(manager.cacheIndex)}`);
  }
});

runner.test('Should save to memory cache', () => {
  const manager = new WordCacheManager();
  const cacheKey = 'test.com|/';
  const wordState = { hello: { count: 1 } };

  manager.memoryCache.set(cacheKey, wordState);

  if (!manager.memoryCache.has(cacheKey)) throw new Error('Not in cache');
  if (manager.memoryCache.get(cacheKey) !== wordState) throw new Error('Wrong value');
});

runner.test('Should generate correct storage key', () => {
  const manager = new WordCacheManager();
  const storageKey = manager.getStorageKey('user123', 'test.com|/home');

  if (!storageKey.includes('cache_user123_')) throw new Error(`Got "${storageKey}"`);
});

runner.test('Should enforce LRU cache size limits', async () => {
  const manager = new WordCacheManager();
  const userId = 'user123';

  // Add 21 caches (exceeds maxCacheSize of 20)
  for (let i = 0; i < 21; i++) {
    await manager.setToCache(`site${i}.com|/`, { test: i }, userId);
  }

  // Should only have 20
  if (manager.cacheIndex.length !== 20) throw new Error(`Size is ${manager.cacheIndex.length}, expected 20`);
  if (manager.memoryCache.size !== 20) throw new Error(`Memory cache size is ${manager.memoryCache.size}, expected 20`);
});

runner.test('Should return null on cache miss', async () => {
  const manager = new WordCacheManager();
  const result = await manager.getFromCache('nonexistent.com|/', 'user123');

  if (result !== null) throw new Error(`Expected null, got ${result}`);
});

runner.test('Should retrieve from memory cache', async () => {
  const manager = new WordCacheManager();
  const cacheKey = 'test.com|/';
  const wordState = { word1: { count: 5 } };

  manager.memoryCache.set(cacheKey, wordState);
  const result = await manager.getFromCache(cacheKey, 'user123');

  if (result !== wordState) throw new Error('Cache retrieval failed');
});

runner.test('Should get cache statistics', () => {
  const manager = new WordCacheManager();

  manager.memoryCache.set('page1', {});
  manager.memoryCache.set('page2', {});
  manager.cacheIndex = ['page1', 'page2'];

  const stats = manager.getStats();

  if (stats.memoryCacheSize !== 2) throw new Error(`memoryCacheSize is ${stats.memoryCacheSize}`);
  if (stats.cacheIndexLength !== 2) throw new Error(`cacheIndexLength is ${stats.cacheIndexLength}`);
  if (stats.maxCacheSize !== 20) throw new Error(`maxCacheSize is ${stats.maxCacheSize}`);
});

runner.test('Should handle missing userId gracefully', async () => {
  const manager = new WordCacheManager();
  const result = await manager.getFromCache('test.com|/', null);

  if (result !== null) throw new Error('Should return null for missing userId');
});

runner.test('Should handle missing cacheKey gracefully', async () => {
  const manager = new WordCacheManager();
  const result = await manager.getFromCache(null, 'user123');

  if (result !== null) throw new Error('Should return null for missing cacheKey');
});

// ===== RUN TESTS =====
runner.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
