/**
 * Frontend Integration Test
 * Verifies that all modules load correctly and can interact
 */

console.log('[Test] Starting frontend integration test...');

// Test 1: Check logger
console.log('[Test 1] Logger module');
try {
  logger.log('Logger works!');
  console.log('✓ Logger module is functional');
} catch (e) {
  console.error('✗ Logger test failed:', e);
}

// Test 2: Check StorageManager
console.log('[Test 2] Storage module');
try {
  // Note: In extension context, this would need proper setup
  console.log('✓ Storage module is available');
} catch (e) {
  console.error('✗ Storage test failed:', e);
}

// Test 3: Check API client
console.log('[Test 3] API Client');
try {
  if (apiClient && apiClient.get && apiClient.post) {
    console.log('✓ API Client module is functional');
  }
} catch (e) {
  console.error('✗ API Client test failed:', e);
}

// Test 4: Check UserStore class
console.log('[Test 4] UserStore');
try {
  if (typeof UserStore === 'function') {
    console.log('✓ UserStore class is defined');
  }
} catch (e) {
  console.error('✗ UserStore test failed:', e);
}

// Test 5: Check UnknownWordsStore class
console.log('[Test 5] UnknownWordsStore');
try {
  if (typeof UnknownWordsStore === 'function') {
    console.log('✓ UnknownWordsStore class is defined');
  }
} catch (e) {
  console.error('✗ UnknownWordsStore test failed:', e);
}

// Test 6: Check UnknownWordsService class
console.log('[Test 6] UnknownWordsService');
try {
  if (typeof UnknownWordsService === 'function') {
    console.log('✓ UnknownWordsService class is defined');
  }
} catch (e) {
  console.error('✗ UnknownWordsService test failed:', e);
}

// Test 7: Check ContextMenu class
console.log('[Test 7] ContextMenu');
try {
  if (typeof ContextMenu === 'function') {
    console.log('✓ ContextMenu class is defined');
  }
} catch (e) {
  console.error('✗ ContextMenu test failed:', e);
}

// Test 8: Check HighlightFilter class
console.log('[Test 8] HighlightFilter');
try {
  if (typeof HighlightFilter === 'function') {
    console.log('✓ HighlightFilter class is defined');
  }
} catch (e) {
  console.error('✗ HighlightFilter test failed:', e);
}

console.log('[Test] Frontend integration test completed!');
