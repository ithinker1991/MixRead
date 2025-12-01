/**
 * MixRead Content Script
 * Tokenizes page content and highlights difficult words
 * Integrates modular architecture for unknown words management
 */

// ===== Global State =====
let currentDifficultyLevel = "B1";
let highlightedWordsMap = {};
let userVocabulary = new Set();
let isHighlighting = false; // Prevent infinite loop
let showChinese = true; // Show Chinese translation by default
let definitionCache = {}; // Cache for word definitions
let sessionStartTime = Date.now(); // Track reading session start

// ===== Module Instances =====
let userStore;
let unknownWordsStore;
let unknownWordsService;
let contextMenu;
let highlightFilter;

// ===== Initialize Modules =====
async function initializeModules() {
  try {
    console.log('[MixRead] Starting module initialization...');
    logger.info('Initializing MixRead modules...');

    // 1. Initialize user store
    userStore = new UserStore();
    console.log('[MixRead] UserStore created');
    await userStore.initialize();
    const userId = userStore.getUserId();
    const difficultyLevel = userStore.getDifficultyLevel();
    console.log(`[MixRead] User initialized - ID: ${userId}, Difficulty: ${difficultyLevel}`);
    logger.info(`User initialized - ID: ${userId}, Difficulty: ${difficultyLevel}`);

    // 2. Initialize unknown words store
    unknownWordsStore = new UnknownWordsStore();
    console.log('[MixRead] UnknownWordsStore created');
    await unknownWordsStore.load();

    // 3. Initialize unknown words service
    unknownWordsService = new UnknownWordsService(
      unknownWordsStore,
      apiClient,
      userStore
    );
    console.log('[MixRead] UnknownWordsService created');

    // 4. Sync unknown words from backend (with error handling)
    try {
      const backendWords = await unknownWordsService.loadFromBackend();
      backendWords.forEach(word => unknownWordsStore.add(word));
      await unknownWordsStore.sync();
      console.log(`[MixRead] Loaded ${backendWords.length} unknown words from backend`);
      logger.info(`Loaded ${backendWords.length} unknown words from backend`);
    } catch (syncError) {
      console.warn('[MixRead] Failed to sync with backend, continuing offline:', syncError);
      logger.warn('Failed to sync unknown words from backend', syncError);
    }

    // 5. Initialize context menu
    contextMenu = new ContextMenu(unknownWordsService);
    console.log('[MixRead] ContextMenu created');

    // 6. Initialize highlight filter
    highlightFilter = new HighlightFilter(unknownWordsStore, userStore);
    console.log('[MixRead] HighlightFilter created');

    console.log('[MixRead] ✅ All modules initialized successfully');
    logger.info('All modules initialized successfully');
  } catch (error) {
    console.error('[MixRead] ❌ Failed to initialize modules:', error);
    logger.error('Failed to initialize modules', error);
  }
}

// Modules will be initialized after highlighting starts
// (see initializeModules().then(...) below)

// ===== Legacy Settings Initialization =====
// Load settings on startup for backward compatibility
chrome.storage.local.get(
  ["difficultyLevel", "vocabulary", "showChinese"],
  (result) => {
    if (result.difficultyLevel) {
      currentDifficultyLevel = result.difficultyLevel;
    }
    if (result.vocabulary) {
      userVocabulary = new Set(result.vocabulary);
    }
    if (result.showChinese !== undefined) {
      showChinese = result.showChinese;
    }
  }
);

/**
 * Simple tokenizer using regex
 * Extracts words from text
 */
function tokenizeText(text) {
  // Match words (including contractions and hyphenated words)
  const wordPattern = /\b[a-z''-]+\b/gi;
  const words = [];
  let match;

  while ((match = wordPattern.exec(text)) !== null) {
    words.push(match[0]);
  }

  return words;
}

/**
 * Send message to background script with retry logic
 */
function sendMessageWithRetry(message, callback, maxRetries = 3) {
  let retries = 0;

  function attempt() {
    retries++;
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(`[MixRead] sendMessage error: ${chrome.runtime.lastError.message}`);
          if (retries < maxRetries) {
            console.log(`[MixRead] Retrying message send (attempt ${retries + 1}/${maxRetries})...`);
            setTimeout(attempt, 100 * retries); // Exponential backoff
          } else {
            console.error('[MixRead] Failed to send message after', maxRetries, 'retries');
            callback({ success: false, error: chrome.runtime.lastError.message });
          }
        } else if (response) {
          callback(response);
        } else {
          console.error('[MixRead] No response from background script');
          if (retries < maxRetries) {
            console.log(`[MixRead] Retrying message send (attempt ${retries + 1}/${maxRetries})...`);
            setTimeout(attempt, 100 * retries);
          } else {
            callback({ success: false, error: 'No response from background script' });
          }
        }
      });
    } catch (error) {
      console.error('[MixRead] Exception sending message:', error);
      if (retries < maxRetries) {
        console.log(`[MixRead] Retrying message send (attempt ${retries + 1}/${maxRetries})...`);
        setTimeout(attempt, 100 * retries);
      } else {
        callback({ success: false, error: error.message });
      }
    }
  }

  attempt();
}

/**
 * Walk through all text nodes and highlight words
 */
/**
 * Create a mapping of stems to original words
 * Example: { drop: [drop, dropped, drops, dropping], run: [run, running, runs, ran] }
 */
function createStemMapping(words) {
  const stemMap = {};

  for (const word of words) {
    const stem = Stemmer.stem(word);
    if (!stemMap[stem]) {
      stemMap[stem] = [];
    }
    stemMap[stem].push(word);
  }

  console.log('[MixRead] Created stem mapping for', Object.keys(stemMap).length, 'unique stems');
  return stemMap;
}

function highlightPageWords() {
  // Prevent infinite loop from MutationObserver
  if (isHighlighting) {
    console.log('[MixRead] Already highlighting, skipping...');
    return;
  }

  isHighlighting = true;
  console.log('[MixRead] highlightPageWords called');
  console.log('[MixRead] userStore initialized:', !!userStore);
  console.log('[MixRead] currentDifficultyLevel:', currentDifficultyLevel);

  // Clear previous highlights first to prevent duplicates
  clearHighlights();

  // Get all words from the page
  const textNodes = getTextNodes(document.body);
  const allWords = [];

  for (const node of textNodes) {
    const words = tokenizeText(node.textContent);
    allWords.push(...words);
  }

  // Get unique words
  const uniqueWords = [...new Set(allWords)];
  console.log('[MixRead] Found', uniqueWords.length, 'unique words');
  console.log('[MixRead] Sample words:', uniqueWords.slice(0, 10).join(', '));

  // Create stem mapping: stem → [original words]
  const stemMap = createStemMapping(uniqueWords);

  // Get stems to query (unique stems instead of all words)
  const stemsToQuery = Object.keys(stemMap);
  console.log('[MixRead] Query backend with', stemsToQuery.length, 'unique stems');
  console.log('[MixRead] Sample stems:', stemsToQuery.slice(0, 10).join(', '));

  // Debug: Check if test words are in the mapping
  const testWords = ['stranger', 'strangers', 'dream', 'dreamed', 'make', 'making', 'build', 'building'];
  console.log('[MixRead] Test words stem mapping:');
  testWords.forEach(word => {
    const stem = Stemmer.stem(word);
    const isInQuery = stemsToQuery.includes(stem);
    console.log(`  ${word} → stem: ${stem}, in query: ${isInQuery}`);
  });

  // Get user_id for API call (use userStore if initialized, fallback to legacy)
  const userId = userStore ? userStore.getUserId() : null;
  console.log('[MixRead] user_id for API call:', userId);

  // Send to background script to query API with retry logic
  console.log('[MixRead] === Sending to Background Script ===');
  console.log('[MixRead] words (stemsToQuery):', stemsToQuery.slice(0, 20).join(', '), `... (${stemsToQuery.length} total)`);
  console.log('[MixRead] difficulty_level:', currentDifficultyLevel);
  console.log('[MixRead] user_id:', userId);

  sendMessageWithRetry(
    {
      type: "GET_HIGHLIGHTED_WORDS",
      words: stemsToQuery,  // Send stems instead of all variants
      difficulty_level: currentDifficultyLevel,
      user_id: userId,
    },
    (response) => {
      if (response.success) {
        highlightedWordsMap = {};

        console.log('[MixRead] === API Response ===');
        console.log('[MixRead] API returned highlighted_words:', response.highlighted_words);
        console.log('[MixRead] API returned word_details count:', response.word_details?.length || 0);

        // Expand highlighted stems back to all their original variants
        const highlightedVariants = [];
        response.word_details.forEach((detail) => {
          const stem = detail.word.toLowerCase();

          // Get all variants of this stem from our mapping
          const variants = stemMap[stem] || [stem];

          // Debug: show mapping for test words
          const testWords = ['stranger', 'dream', 'make', 'build', 'explore'];
          if (testWords.includes(stem)) {
            console.log(`[MixRead] Stem "${stem}" maps to variants:`, variants);
          }

          // Map each variant to the detail info
          variants.forEach(variant => {
            highlightedWordsMap[variant.toLowerCase()] = detail;
            highlightedVariants.push(variant);
          });
        });

        console.log('[MixRead] Will highlight', highlightedVariants.length, 'word variants from', response.word_details.length, 'stems');
        console.log('[MixRead] Highlighted stems:', response.highlighted_words);
        console.log('[MixRead] Sample word details:', response.word_details.slice(0, 3));
        console.log('[MixRead] highlightedWordsMap keys:', Object.keys(highlightedWordsMap).slice(0, 20).join(', '));

        // Now walk through and actually highlight the words in the DOM
        highlightWordsInDOM(highlightedVariants);
      } else {
        console.error("[MixRead] Error getting highlighted words:", response.error);
      }

      // Reset flag after highlighting is complete
      isHighlighting = false;
    }
  );
}

/**
 * Clear all previous highlights before re-highlighting
 * This prevents duplicate highlights and Chinese translations
 */
function clearHighlights() {
  console.log('[MixRead] Clearing previous highlights...');

  // Find all highlight spans
  const highlightSpans = document.querySelectorAll('.mixread-highlight');
  const chineseSpans = document.querySelectorAll('.mixread-chinese');

  console.log('[MixRead] Found', highlightSpans.length, 'highlight spans and', chineseSpans.length, 'chinese spans to remove');

  // For each highlight span, replace it with just the text
  highlightSpans.forEach(span => {
    const text = span.textContent;
    const textNode = document.createTextNode(text);
    span.parentNode.replaceChild(textNode, span);
  });

  // Remove all Chinese translation spans
  chineseSpans.forEach(span => {
    span.remove();
  });

  console.log('[MixRead] Highlights cleared');
}

/**
 * Get all text nodes from an element
 */
function getTextNodes(element) {
  const textNodes = [];

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Skip if parent is script, style, or our own elements
      if (
        !["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.parentElement.tagName) &&
        !node.parentElement.classList.contains("mixread-tooltip") &&
        !node.parentElement.classList.contains("mixread-highlight") &&
        !node.parentElement.classList.contains("mixread-chinese")
      ) {
        textNodes.push(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip MixRead elements
      if (!node.classList.contains("mixread-tooltip") &&
          !node.classList.contains("mixread-highlight") &&
          !node.classList.contains("mixread-chinese")) {
        for (let child of node.childNodes) {
          walk(child);
        }
      }
    }
  }

  walk(element);
  return textNodes;
}

/**
 * Actually highlight words in the DOM
 */
function highlightWordsInDOM(highlightedWords) {
  const wordSet = new Set(highlightedWords.map((w) => w.toLowerCase()));

  const textNodes = getTextNodes(document.body);

  for (const node of textNodes) {
    if (wordSet.size === 0) break;

    const text = node.textContent;
    const words = tokenizeText(text);
    let hasMatch = false;

    // Check if any words in this node need highlighting
    for (const word of words) {
      if (wordSet.has(word.toLowerCase())) {
        hasMatch = true;
        break;
      }
    }

    if (!hasMatch) continue;

    // Split text and create span elements for matching words
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const wordPattern = /\b[a-z''-]+\b/gi;
    let match;

    while ((match = wordPattern.exec(text)) !== null) {
      const word = match[0];
      const wordLower = word.toLowerCase();

      // Add text before the word
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, match.index))
        );
      }

      // Check if word should be highlighted
      if (wordSet.has(wordLower)) {
        const span = document.createElement("span");
        span.className = "mixread-highlight";
        span.textContent = word;
        span.dataset.word = word;

        // Add click handler to show tooltip
        span.addEventListener("click", (e) => {
          console.log('[MixRead] Click event triggered for word:', word);
          e.stopPropagation();
          showTooltip(e, word);
        });

        fragment.appendChild(span);

        // Add Chinese translation if enabled and available
        if (showChinese && highlightedWordsMap[wordLower]?.chinese) {
          const chineseSpan = document.createElement("span");
          chineseSpan.className = "mixread-chinese";
          chineseSpan.textContent = highlightedWordsMap[wordLower].chinese;
          fragment.appendChild(chineseSpan);
          console.log(`[MixRead] Added Chinese for "${word}": ${highlightedWordsMap[wordLower].chinese}`);
        } else if (showChinese) {
          console.log(`[MixRead] No Chinese for "${word}" (showChinese=${showChinese}, hasData=${!!highlightedWordsMap[wordLower]}, chinese=${highlightedWordsMap[wordLower]?.chinese})`);
        }
      } else {
        fragment.appendChild(document.createTextNode(word));
      }

      lastIndex = wordPattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    // Replace original node with processed fragment
    node.parentNode.replaceChild(fragment, node);
  }
}

/**
 * Show tooltip with word definition
 */
function showTooltip(event, word) {
  console.log('[MixRead] showTooltip called with word:', word);

  // Remove existing tooltip
  const existingTooltip = document.querySelector(".mixread-tooltip");
  if (existingTooltip) {
    existingTooltip.remove();
  }

  // Get word info from backend with retry logic
  sendMessageWithRetry(
    {
      type: "GET_WORD_INFO",
      word: word,
    },
    (response) => {
      console.log('[MixRead] Received response:', response);

      if (!response) {
        console.error('[MixRead] No response received from background script');
        return;
      }

      if (response.success) {
        const wordInfo = response.word_info;
        console.log('[MixRead] Creating tooltip with word info:', wordInfo);
        createTooltip(event, word, wordInfo);
      } else {
        console.error('[MixRead] Error getting word info:', response.error);
      }
    }
  );
}

/**
 * Create and display tooltip element
 */
function createTooltip(event, word, wordInfo) {
  const tooltip = document.createElement("div");
  tooltip.className = "mixread-tooltip";

  let html = `
    <div class="mixread-tooltip-header">
      <div class="mixread-tooltip-word">${word}</div>
  `;

  if (wordInfo.cefr_level) {
    html += `<span class="mixread-tooltip-cefr">${wordInfo.cefr_level}</span>`;
  }

  html += `
    </div>
  `;

  // English definition - FIRST (most important)
  if (wordInfo.definition) {
    html += `
      <div class="mixread-tooltip-section">
        <div class="mixread-tooltip-label">📖 Definition</div>
        <div class="mixread-tooltip-definition">${wordInfo.definition}</div>
      </div>
    `;
  }

  // Example sentence
  if (wordInfo.example) {
    html += `
      <div class="mixread-tooltip-section">
        <div class="mixread-tooltip-label">💡 Example</div>
        <div class="mixread-tooltip-example">"${wordInfo.example}"</div>
      </div>
    `;
  }

  // Pronunciation button and Chinese (collapsible)
  html += `
    <div class="mixread-tooltip-section">
      <button class="mixread-btn-pronounce" id="btn-pronounce" title="Click to pronounce">
        🔊 Pronounce
      </button>
  `;

  if (wordInfo.chinese) {
    html += `
      <div class="mixread-tooltip-chinese-toggle">
        <input type="checkbox" id="toggle-chinese-detail" checked>
        <label for="toggle-chinese-detail">中文: <strong>${wordInfo.chinese}</strong></label>
      </div>
    `;
  }

  html += `
    </div>
    <div class="mixread-tooltip-actions">
      <button class="mixread-btn primary" id="btn-add-to-vocab">Add to Library</button>
      <button class="mixread-btn success" id="btn-mark-known">Mark as Known</button>
      <button class="mixread-btn" id="btn-close">Close</button>
    </div>
  `;

  tooltip.innerHTML = html;

  // Position tooltip at cursor
  const rect = event.target.getBoundingClientRect();
  tooltip.style.top = rect.bottom + 5 + window.scrollY + "px";
  tooltip.style.left = rect.left + window.scrollX + "px";

  // Add pronunciation button handler
  const pronounceBtn = tooltip.querySelector("#btn-pronounce");
  if (pronounceBtn) {
    pronounceBtn.onclick = (e) => {
      e.stopPropagation();
      speakWord(word);
    };
  }

  // Add Chinese toggle handler
  const chineseToggle = tooltip.querySelector("#toggle-chinese-detail");
  if (chineseToggle) {
    const chineseLabel = tooltip.querySelector("label[for='toggle-chinese-detail']");
    chineseToggle.onchange = () => {
      chineseLabel.style.display = chineseToggle.checked ? "block" : "none";
    };
  }

  // Add button handlers
  tooltip.querySelector("#btn-add-to-vocab").onclick = () => {
    addWordToVocabulary(word);
    tooltip.querySelector("#btn-add-to-vocab").textContent = "Added! ✓";
    setTimeout(() => tooltip.remove(), 1500);
  };

  // Mark as Known button handler
  tooltip.querySelector("#btn-mark-known").onclick = () => {
    markWordAsKnown(word);
    tooltip.querySelector("#btn-mark-known").textContent = "Marked as Known ✓";
    setTimeout(() => tooltip.remove(), 1500);
  };

  tooltip.querySelector("#btn-close").onclick = () => {
    tooltip.remove();
  };

  document.body.appendChild(tooltip);

  // Close tooltip when clicking outside (only click once)
  const closeOnClickOutside = (e) => {
    // Don't close if clicking inside the tooltip
    if (!tooltip.contains(e.target)) {
      document.removeEventListener("click", closeOnClickOutside);
      tooltip.remove();
    }
  };
  document.addEventListener("click", closeOnClickOutside);
}

/**
 * Speak word pronunciation using Web Speech API
 */
function speakWord(word) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8; // Slower speed for clarity
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('Speech Synthesis API not supported');
  }
}

/**
 * Add word to user's vocabulary with timestamp
 */
function addWordToVocabulary(word) {
  const wordLower = word.toLowerCase();
  userVocabulary.add(wordLower);

  // Get current vocabulary dates
  chrome.storage.local.get(["vocabulary_dates"], (result) => {
    const dates = result.vocabulary_dates || {};
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    dates[wordLower] = today; // Record when word was added

    // Save to storage
    chrome.storage.local.set({
      vocabulary: Array.from(userVocabulary),
      vocabulary_dates: dates,
    });
  });
}

/**
 * Mark a word as known (user already knows it)
 * Calls backend API to persist the marking
 */
function markWordAsKnown(word) {
  const wordLower = word.toLowerCase();

  // Get user ID from userStore
  if (!userStore) {
    console.warn('[MixRead] userStore not initialized');
    logger.warn('Failed to mark word as known: userStore not initialized');
    return;
  }

  const userId = userStore.getUserId();
  if (!userId) {
    console.warn('[MixRead] No user ID available');
    logger.warn('Failed to mark word as known: no user ID');
    return;
  }

  console.log(`[MixRead] Marking "${word}" as known for user: ${userId}`);
  logger.log(`Marking "${word}" as known`);

  // Call backend API to mark word as known
  chrome.runtime.sendMessage(
    {
      type: "MARK_AS_KNOWN",
      user_id: userId,
      word: wordLower,
    },
    (response) => {
      if (response?.success) {
        console.log(`[MixRead] Successfully marked "${word}" as known`);
        logger.info(`"${word}" marked as known`);

        // Trigger page re-highlight to update highlights
        highlightPageWords();
      } else {
        console.error(`[MixRead] Failed to mark "${word}" as known:`, response?.error);
        logger.error(`Failed to mark "${word}" as known`, response?.error);
      }
    }
  );
}

// ===== Event Listeners =====

// Listen for unknown words updates (from context menu)
window.addEventListener('unknown-words-updated', () => {
  console.log('[MixRead] Received "unknown-words-updated" event, re-highlighting page');
  logger.log('Unknown words updated, re-highlighting page');

  if (unknownWordsStore) {
    console.log('[MixRead] Current unknown words in store:', unknownWordsStore.getAll());
  }

  highlightPageWords();
});

// Global context menu for any text on page
// Note: Custom context menu disabled to allow Chrome native context menus
// Users now use Chrome's native right-click menu with "Mark as Unknown" and "Mark as Known" options
// See background.js for chrome.contextMenus implementation

// Listen for difficulty level changes from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "DIFFICULTY_CHANGED") {
    currentDifficultyLevel = request.difficulty_level;
    chrome.storage.local.set({ difficultyLevel: currentDifficultyLevel });

    // Update user store if initialized
    if (userStore) {
      userStore.setDifficultyLevel(request.difficulty_level);
    }

    // Re-highlight the page
    highlightPageWords();
    sendResponse({ success: true });
  } else if (request.type === "CHINESE_DISPLAY_CHANGED") {
    showChinese = request.showChinese;
    chrome.storage.local.set({ showChinese });

    // Re-highlight the page to show/hide Chinese
    highlightPageWords();
    sendResponse({ success: true });
  } else if (request.type === "CONTEXT_MARK_UNKNOWN") {
    // Handle Mark as Unknown from context menu
    const word = request.word;
    console.log('[MixRead] Context menu: Marking as unknown:', word);
    unknownWordsService.markAsUnknown(word).then(() => {
      console.log('[MixRead] Successfully marked as unknown:', word);
      highlightPageWords();
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('[MixRead] Error marking as unknown:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for async response
  } else if (request.type === "CONTEXT_MARK_KNOWN") {
    // Handle Mark as Known from context menu
    const word = request.word;
    console.log('[MixRead] Context menu: Marking as known:', word);
    markWordAsKnown(word);
    sendResponse({ success: true });
  }
});

// Start highlighting when page loads (after modules are initialized)
function startHighlighting() {
  console.log('[MixRead] Starting page highlighting...');
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      console.log('[MixRead] DOMContentLoaded, calling highlightPageWords');
      highlightPageWords();
    });
  } else {
    console.log('[MixRead] Document already loaded, calling highlightPageWords');
    highlightPageWords();
  }
}

// Call after initialization
initializeModules().then(() => {
  console.log('[MixRead] Modules initialized, starting highlighting');
  startHighlighting();
}).catch((error) => {
  console.error('[MixRead] Initialization failed, but attempting to highlight anyway:', error);
  startHighlighting();
});

// TODO: Re-enable MutationObserver for dynamic content (disabled to prevent infinite loop)
// const observer = new MutationObserver(() => {
//   highlightPageWords();
// });
//
// observer.observe(document.body, {
//   childList: true,
//   subtree: true,
// });

/**
 * Track reading session time and update stats
 */
function recordReadingSession() {
  const sessionDurationMs = Date.now() - sessionStartTime;
  const sessionDurationMinutes = Math.round(sessionDurationMs / 60000); // Convert to minutes

  if (sessionDurationMinutes > 0) {
    chrome.storage.local.get(["reading_sessions"], (result) => {
      const sessions = result.reading_sessions || {};
      const today = new Date().toISOString().split("T")[0];

      // Add session duration to today's total
      sessions[today] = (sessions[today] || 0) + sessionDurationMinutes;

      chrome.storage.local.set({
        reading_sessions: sessions,
      });

      console.log(`[MixRead] Recorded ${sessionDurationMinutes} minutes of reading for ${today}`);
    });
  }
}

// Record session time when user leaves the page
window.addEventListener("beforeunload", recordReadingSession);

// Also record session periodically (every 5 minutes)
setInterval(() => {
  recordReadingSession();
  sessionStartTime = Date.now(); // Reset for next interval
}, 5 * 60 * 1000);
