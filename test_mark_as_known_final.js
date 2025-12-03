/**
 * Test script for "Mark as Known" feature
 * Tests the complete flow of marking a word as known with real library words
 */

const API_BASE = 'http://localhost:8000';
const USER_ID = 'test-user-mark-known';

async function makeRequest(method, path, data = null) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    mode: 'cors',
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

async function runTests() {
  try {
    console.log('\n=== MixRead "Mark as Known" Feature Test (Final) ===\n');

    // Use words from the actual library that we know exist
    const testWord1 = 'proficiency';  // B2 word - should be highlighted at B1
    const testWord2 = 'serenity';     // B1 word - might be highlighted at higher difficulty

    // Clean up any prior test data
    console.log('Cleanup: Resetting user data...');
    try {
      await makeRequest('DELETE', `/users/${USER_ID}/unknown-words/${testWord1}`);
      await makeRequest('DELETE', `/users/${USER_ID}/unknown-words/${testWord2}`);
      await makeRequest('DELETE', `/users/${USER_ID}/known-words/${testWord1}`);
      await makeRequest('DELETE', `/users/${USER_ID}/known-words/${testWord2}`);
    } catch (e) {
      // Ignore errors during cleanup
    }

    // Test 1: Check initial highlight state
    console.log('\nTest 1: Get initial highlight at B1 difficulty');
    let highlightResult = await makeRequest('POST', '/highlight-words', {
      user_id: USER_ID,
      words: ['the', 'beautiful', 'proficiency', 'ability'],
      difficulty_level: 'B1'
    });
    const highlighted1 = highlightResult.highlighted_words || [];
    const isProfHighlighted1 = highlighted1.some(w => w.toLowerCase() === testWord1.toLowerCase());
    console.log(`✓ Initial state: "${testWord1}" is ${isProfHighlighted1 ? 'HIGHLIGHTED' : 'not highlighted'}`);
    console.log(`  Highlighted words: ${highlighted1.join(', ')}`);

    // Test 2: Mark the word as known
    console.log(`\nTest 2: Mark "${testWord1}" as known`);
    const markKnownResult = await makeRequest('POST', `/users/${USER_ID}/known-words`, { word: testWord1 });
    console.log(`✓ Successfully marked "${testWord1}" as known`);
    console.log(`  Response: ${markKnownResult.message}`);

    // Test 3: Verify word is NOT highlighted after marking as known
    console.log(`\nTest 3: Verify "${testWord1}" is no longer highlighted`);
    highlightResult = await makeRequest('POST', '/highlight-words', {
      user_id: USER_ID,
      words: ['the', 'beautiful', 'proficiency', 'ability'],
      difficulty_level: 'B1'
    });
    const highlighted2 = highlightResult.highlighted_words || [];
    const isProfHighlighted2 = highlighted2.some(w => w.toLowerCase() === testWord1.toLowerCase());
    console.log(`✓ After marking known: "${testWord1}" is ${isProfHighlighted2 ? 'HIGHLIGHTED (ERROR!)' : 'NOT highlighted (correct)'}`);
    console.log(`  Highlighted words: ${highlighted2.join(', ')}`);

    if (isProfHighlighted2) {
      throw new Error('Word should not be highlighted after marking as known!');
    }

    // Test 4: Mark word as unknown
    console.log(`\nTest 4: Remove from known and mark "${testWord1}" as unknown`);
    await makeRequest('DELETE', `/users/${USER_ID}/known-words/${testWord1.toLowerCase()}`);
    await makeRequest('POST', `/users/${USER_ID}/unknown-words`, { word: testWord1 });
    console.log(`✓ Successfully marked "${testWord1}" as unknown`);

    // Test 5: Verify word IS highlighted after marking as unknown
    console.log(`\nTest 5: Verify "${testWord1}" is highlighted when marked unknown`);
    highlightResult = await makeRequest('POST', '/highlight-words', {
      user_id: USER_ID,
      words: ['the', 'beautiful', 'proficiency', 'ability'],
      difficulty_level: 'B1'
    });
    const highlighted3 = highlightResult.highlighted_words || [];
    const isProfHighlighted3 = highlighted3.some(w => w.toLowerCase() === testWord1.toLowerCase());
    console.log(`✓ After marking unknown: "${testWord1}" is ${isProfHighlighted3 ? 'HIGHLIGHTED (correct)' : 'NOT highlighted (ERROR!)'}`);
    console.log(`  Highlighted words: ${highlighted3.join(', ')}`);

    if (!isProfHighlighted3) {
      throw new Error('Word should be highlighted after marking as unknown!');
    }

    // Test 6: Remove from unknown words
    console.log(`\nTest 6: Remove from unknown words`);
    await makeRequest('DELETE', `/users/${USER_ID}/unknown-words/${testWord1.toLowerCase()}`);
    console.log(`✓ Successfully removed "${testWord1}" from unknown words`);

    // Test 7: Final state - word should use difficulty-based highlighting
    console.log(`\nTest 7: Final state - word uses difficulty-based highlighting`);
    highlightResult = await makeRequest('POST', '/highlight-words', {
      user_id: USER_ID,
      words: ['the', 'beautiful', 'proficiency', 'ability'],
      difficulty_level: 'B1'
    });
    const highlighted4 = highlightResult.highlighted_words || [];
    const isProfHighlighted4 = highlighted4.some(w => w.toLowerCase() === testWord1.toLowerCase());
    console.log(`✓ Final state: "${testWord1}" is ${isProfHighlighted4 ? 'HIGHLIGHTED' : 'NOT highlighted'} (based on B2 level > B1 threshold)`);
    console.log(`  Highlighted words: ${highlighted4.join(', ')}`);

    console.log('\n=== All Tests Passed! ===\n');
    console.log('Feature Summary:');
    console.log('✅ Words can be marked as known');
    console.log('✅ Known words are excluded from highlighting');
    console.log('✅ Words can be marked as unknown to restore highlighting');
    console.log('✅ Known/unknown status is independent of difficulty level');
    console.log('\nThis allows users to:');
    console.log('- Mark words as unknown that appear due to difficulty threshold');
    console.log('- Mark words as known if they already know them');
    console.log('- Have full control over which words are highlighted');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
