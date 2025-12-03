/**
 * MixRead Content Script
 * Tokenizes page content and highlights difficult words
 * Integrates modular architecture for unknown words management
 */

// ===== Extension Context Management =====
// Wrapper to safely handle chrome API calls even after context invalidation
const ChromeAPI = {
  isContextValid() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  storage: {
    get(keys, callback) {
      if (!ChromeAPI.isContextValid()) {
        // console.warn('[MixRead] Extension context invalid, skipping storage.get');
        if (callback) callback({});
        return;
      }
      try {
        chrome.storage.local.get(keys, (result) => {
          try {
            if (chrome.runtime.lastError) {
              if (
                !chrome.runtime.lastError.message.includes(
                  "Extension context invalidated"
                )
              ) {
                console.warn(
                  "[MixRead] Storage error:",
                  chrome.runtime.lastError.message
                );
              }
              if (callback) callback({});
            } else {
              if (callback) callback(result);
            }
          } catch (callbackError) {
            console.warn(
              "[MixRead] Storage callback error:",
              callbackError.message
            );
            if (callback) callback({});
          }
        });
      } catch (e) {
        if (!e.message.includes("Extension context invalidated")) {
          console.warn("[MixRead] Chrome storage error:", e.message);
        }
        if (callback) callback({});
      }
    },

    set(data, callback) {
      if (!ChromeAPI.isContextValid()) {
        // console.warn('[MixRead] Extension context invalid, skipping storage.set');
        if (callback) callback();
        return;
      }
      try {
        chrome.storage.local.set(data, () => {
          try {
            if (chrome.runtime.lastError) {
              if (
                !chrome.runtime.lastError.message.includes(
                  "Extension context invalidated"
                )
              ) {
                console.warn(
                  "[MixRead] Storage set error:",
                  chrome.runtime.lastError.message
                );
              }
            }
            if (callback) callback();
          } catch (callbackError) {
            console.warn(
              "[MixRead] Storage set callback error:",
              callbackError.message
            );
            if (callback) callback();
          }
        });
      } catch (e) {
        if (!e.message.includes("Extension context invalidated")) {
          console.warn("[MixRead] Chrome storage set error:", e.message);
        }
        if (callback) callback();
      }
    },
  },

  runtime: {
    sendMessage(message, callback) {
      if (!ChromeAPI.isContextValid()) {
        // console.warn('[MixRead] Extension context invalid, skipping sendMessage');
        if (callback) callback();
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          try {
            if (chrome.runtime.lastError) {
              if (
                !chrome.runtime.lastError.message.includes(
                  "Extension context invalidated"
                )
              ) {
                console.warn(
                  "[MixRead] Message error:",
                  chrome.runtime.lastError.message
                );
              }
            }
            if (callback) callback(response);
          } catch (callbackError) {
            console.warn(
              "[MixRead] Message callback error:",
              callbackError.message
            );
            if (callback) callback();
          }
        });
      } catch (e) {
        if (!e.message.includes("Extension context invalidated")) {
          console.warn("[MixRead] Chrome sendMessage error:", e.message);
        }
        if (callback) callback();
      }
    },
  },
};

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
let batchMarkingPanel;
let domainPolicyStore;
let shouldExcludeCurrentPage = false;

// ===== Sidebar Panel (Phase 1) =====
let wordCacheManager = null;
let sidebarPanel = null;

// ===== Initialize Modules =====
async function initializeModules() {
  try {
    console.log("[MixRead] Starting module initialization...");
    logger.info("Initializing MixRead modules...");

    // 1. Initialize user store
    userStore = new UserStore();
    console.log("[MixRead] UserStore created");
    await userStore.initialize();

    // Check if there's a pending user ID from popup
    if (window.pendingUserId) {
      console.log("[MixRead] Using pending user ID:", window.pendingUserId);
      userStore.user.id = window.pendingUserId;
      window.pendingUserId = null; // Clear the pending ID
    }

    const userId = userStore.getUserId();
    const difficultyLevel = userStore.getDifficultyLevel();
    console.log(
      `[MixRead] User initialized - ID: ${userId}, Difficulty: ${difficultyLevel}`
    );
    logger.info(
      `User initialized - ID: ${userId}, Difficulty: ${difficultyLevel}`
    );

    // 2. Initialize unknown words store
    unknownWordsStore = new UnknownWordsStore();
    console.log("[MixRead] UnknownWordsStore created");
    await unknownWordsStore.load();

    // 3. Initialize unknown words service
    unknownWordsService = new UnknownWordsService(
      unknownWordsStore,
      apiClient,
      userStore
    );
    console.log("[MixRead] UnknownWordsService created");

    // 4. Sync unknown words from backend (with error handling)
    try {
      const backendWords = await unknownWordsService.loadFromBackend();
      backendWords.forEach((word) => unknownWordsStore.add(word));
      await unknownWordsStore.sync();
      console.log(
        `[MixRead] Loaded ${backendWords.length} unknown words from backend`
      );
      logger.info(`Loaded ${backendWords.length} unknown words from backend`);
    } catch (syncError) {
      console.warn(
        "[MixRead] Failed to sync with backend, continuing offline:",
        syncError
      );
      logger.warn("Failed to sync unknown words from backend", syncError);
    }

    // 5. Initialize context menu
    contextMenu = new ContextMenu(unknownWordsService);
    console.log("[MixRead] ContextMenu created");

    // 6. Initialize highlight filter
    highlightFilter = new HighlightFilter(unknownWordsStore, userStore);
    console.log("[MixRead] HighlightFilter created");

    // 7. Initialize batch marking panel
    batchMarkingPanel = new BatchMarkingPanel(unknownWordsService, userStore);
    batchMarkingPanel.init();
    console.log("[MixRead] BatchMarkingPanel created");

    // 8. Initialize domain policy store
    domainPolicyStore = new DomainPolicyStore();
    await domainPolicyStore.initialize(userId);
    console.log("[MixRead] DomainPolicyStore created and initialized");

    // 9. Initialize sidebar panel with cache manager (Phase 1)
    wordCacheManager = new WordCacheManager();
    console.log("[MixRead] WordCacheManager created");
    sidebarPanel = new SidebarPanel(wordCacheManager);
    // Note: SidebarPanel.init() is async but completes asynchronously
    // The sidebar will be ready shortly; notifyPanelOfNewWords checks if sidebarPanel exists
    console.log("[MixRead] SidebarPanel created");

    // 10. Check if current page should be excluded
    shouldExcludeCurrentPage = DomainPolicyFilter.shouldExcludeCurrentPage(
      window.location.href,
      domainPolicyStore
    );
    if (shouldExcludeCurrentPage) {
      console.log(
        "[MixRead] ⚠️ Current domain is in blacklist - highlighting disabled"
      );
      logger.warn("Domain is blacklisted - highlighting disabled", {
        domain: window.location.hostname,
      });
    } else {
      console.log("[MixRead] ✓ Domain check passed - highlighting enabled");
    }

    console.log("[MixRead] ✅ All modules initialized successfully");
    logger.info("All modules initialized successfully");

    // Mark as initialized for popup detection
    window.MixReadInitialized = true;
  } catch (error) {
    console.error("[MixRead] ❌ Failed to initialize modules:", error);
    logger.error("Failed to initialize modules", error);
  }
}

// Modules will be initialized after highlighting starts
// (see initializeModules().then(...) below)

// ===== Legacy Settings Initialization =====
// Load settings on startup for backward compatibility
ChromeAPI.storage.get(
  ["difficultyLevel", "vocabulary", "showChinese"],
  (result) => {
    try {
      if (result.difficultyLevel) {
        currentDifficultyLevel = result.difficultyLevel;
      }
      if (result.vocabulary) {
        userVocabulary = new Set(result.vocabulary);
      }
      if (result.showChinese !== undefined) {
        showChinese = result.showChinese;
      }
      console.log("[MixRead] Settings loaded successfully");
    } catch (error) {
      console.error("[MixRead] Error loading settings:", error);
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
  // Check if chrome runtime is available
  if (!ChromeAPI.isContextValid()) {
    console.warn("[MixRead] Chrome runtime not available, cannot send message");
    callback({ success: false, error: "Extension context not available" });
    return;
  }

  let retries = 0;

  function attempt() {
    retries++;
    try {
      ChromeAPI.runtime.sendMessage(message, (response) => {
        if (response) {
          callback(response);
        } else {
          console.warn("[MixRead] No response from background script");
          if (retries < maxRetries) {
            console.log(
              `[MixRead] Retrying message send (attempt ${
                retries + 1
              }/${maxRetries})...`
            );
            setTimeout(attempt, 100 * retries);
          } else {
            callback({
              success: false,
              error: "No response from background script",
            });
          }
        }
      });
    } catch (error) {
      console.error("[MixRead] Exception sending message:", error);
      if (retries < maxRetries) {
        console.log(
          `[MixRead] Retrying message send (attempt ${
            retries + 1
          }/${maxRetries})...`
        );
        setTimeout(attempt, 100 * retries);
      } else {
        callback({ success: false, error: error.message });
      }
    }
  }

  attempt();
}

// Listen for domain policy changes from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "DOMAIN_POLICY_CHANGED") {
    console.log("[MixRead] Domain policy changed, reloading...");

    // Reload policy store
    if (domainPolicyStore && request.userId) {
      domainPolicyStore.reload(request.userId).then(() => {
        // Re-check if current page should be excluded
        const wasExcluded = shouldExcludeCurrentPage;
        shouldExcludeCurrentPage = DomainPolicyFilter.shouldExcludeCurrentPage(
          window.location.href,
          domainPolicyStore
        );

        console.log(
          `[MixRead] Domain re-check: excluded=${shouldExcludeCurrentPage} (was=${wasExcluded})`
        );

        if (shouldExcludeCurrentPage && !wasExcluded) {
          // Now excluded: clear highlights
          console.log(
            "[MixRead] Domain is now blacklisted, clearing highlights"
          );
          clearHighlights();
        } else if (!shouldExcludeCurrentPage && wasExcluded) {
          // No longer excluded: highlight if not already highlighting
          console.log(
            "[MixRead] Domain is no longer blacklisted, enabling highlighting"
          );
          if (!isHighlighting) {
            highlightPageWords();
          }
        }
      });
    }

    sendResponse({ success: true });
  }
});

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

  console.log(
    "[MixRead] Created stem mapping for",
    Object.keys(stemMap).length,
    "unique stems"
  );
  return stemMap;
}

function highlightPageWords() {
  // Prevent infinite loop from MutationObserver
  if (isHighlighting) {
    console.log("[MixRead] Already highlighting, skipping...");
    return;
  }

  // Check if current domain is excluded (domain blacklist)
  if (shouldExcludeCurrentPage) {
    console.log("[MixRead] ⚠️ Skipping: domain is in blacklist");
    return;
  }

  isHighlighting = true;
  console.log("[MixRead] highlightPageWords called");
  console.log("[MixRead] userStore initialized:", !!userStore);
  console.log("[MixRead] currentDifficultyLevel:", currentDifficultyLevel);

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
  console.log("[MixRead] Found", uniqueWords.length, "unique words");
  console.log("[MixRead] Sample words:", uniqueWords.slice(0, 10).join(", "));

  // Create stem mapping: stem → [original words]
  const stemMap = createStemMapping(uniqueWords);

  // Get stems to query (unique stems instead of all words)
  const stemsToQuery = Object.keys(stemMap);
  console.log(
    "[MixRead] Query backend with",
    stemsToQuery.length,
    "unique stems"
  );
  console.log("[MixRead] Sample stems:", stemsToQuery.slice(0, 10).join(", "));

  // Debug: Check if test words are in the mapping
  const testWords = [
    "stranger",
    "strangers",
    "dream",
    "dreamed",
    "make",
    "making",
    "build",
    "building",
  ];
  console.log("[MixRead] Test words stem mapping:");
  testWords.forEach((word) => {
    const stem = Stemmer.stem(word);
    const isInQuery = stemsToQuery.includes(stem);
    console.log(`  ${word} → stem: ${stem}, in query: ${isInQuery}`);
  });

  // Get user_id for API call (use userStore if initialized, fallback to legacy)
  const userId = userStore ? userStore.getUserId() : null;
  console.log("[MixRead] user_id for API call:", userId);

  // Send to background script to query API with retry logic
  console.log("[MixRead] === Sending to Background Script ===");
  console.log(
    "[MixRead] words (stemsToQuery):",
    stemsToQuery.slice(0, 20).join(", "),
    `... (${stemsToQuery.length} total)`
  );
  console.log("[MixRead] difficulty_level:", currentDifficultyLevel);
  console.log("[MixRead] user_id:", userId);

  sendMessageWithRetry(
    {
      type: "GET_HIGHLIGHTED_WORDS",
      words: stemsToQuery, // Send stems instead of all variants
      difficulty_level: currentDifficultyLevel,
      user_id: userId,
    },
    (response) => {
      if (response.success) {
        highlightedWordsMap = {};

        console.log("[MixRead] === API Response ===");
        console.log(
          "[MixRead] API returned highlighted_words:",
          response.highlighted_words
        );
        console.log(
          "[MixRead] API returned word_details count:",
          response.word_details?.length || 0
        );

        // Expand highlighted stems back to all their original variants
        const highlightedVariants = [];
        response.word_details.forEach((detail) => {
          const stem = detail.word.toLowerCase();

          // Get all variants of this stem from our mapping
          const variants = stemMap[stem] || [stem];

          // Debug: show mapping for test words
          const testWords = ["stranger", "dream", "make", "build", "explore"];
          if (testWords.includes(stem)) {
            console.log(`[MixRead] Stem "${stem}" maps to variants:`, variants);
          }

          // Map each variant to the detail info
          variants.forEach((variant) => {
            highlightedWordsMap[variant.toLowerCase()] = detail;
            highlightedVariants.push(variant);
          });
        });

        console.log(
          "[MixRead] Will highlight",
          highlightedVariants.length,
          "word variants from",
          response.word_details.length,
          "stems"
        );
        console.log("[MixRead] Highlighted stems:", response.highlighted_words);
        console.log(
          "[MixRead] Sample word details:",
          response.word_details.slice(0, 3)
        );
        console.log(
          "[MixRead] highlightedWordsMap keys:",
          Object.keys(highlightedWordsMap).slice(0, 20).join(", ")
        );

        // Now walk through and actually highlight the words in the DOM
        highlightWordsInDOM(highlightedVariants).then(() => {
          // Reset flag after highlighting is complete
          isHighlighting = false;
        });
      } else {
        console.error(
          "[MixRead] Error getting highlighted words:",
          response.error
        );
        isHighlighting = false;
      }
    }
  );
}

/**
 * Clear all previous highlights before re-highlighting
 * This prevents duplicate highlights and Chinese translations
 */
function clearHighlights() {
  console.log("[MixRead] Clearing previous highlights...");

  // Find all highlight spans
  const highlightSpans = document.querySelectorAll(".mixread-highlight");
  const chineseSpans = document.querySelectorAll(".mixread-chinese");

  console.log(
    "[MixRead] Found",
    highlightSpans.length,
    "highlight spans and",
    chineseSpans.length,
    "chinese spans to remove"
  );

  // For each highlight span, replace it with just the text
  highlightSpans.forEach((span) => {
    const text = span.textContent;
    const textNode = document.createTextNode(text);
    span.parentNode.replaceChild(textNode, span);
  });

  // Remove all Chinese translation spans
  chineseSpans.forEach((span) => {
    span.remove();
  });

  console.log("[MixRead] Highlights cleared");
}

/**
 * Get all text nodes from a DOM element (excluding scripts, styles, etc.)
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
      if (
        !node.classList.contains("mixread-tooltip") &&
        !node.classList.contains("mixread-highlight") &&
        !node.classList.contains("mixread-chinese")
      ) {
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
 * Extract sentence context for a given word from a text node
 * @param {Node} textNode - The text node containing the word
 * @param {string} word - The word to find context for
 * @returns {string|null} - The sentence containing the word, or null if not found
 */
function extractSentenceContext(textNode, word) {
  try {
    // Get the paragraph/container text
    let container = textNode.parentElement;

    // Walk up to find a good container (p, div, li, td, etc.)
    while (
      container &&
      !["P", "DIV", "LI", "TD", "TH", "ARTICLE", "SECTION"].includes(
        container.tagName
      )
    ) {
      container = container.parentElement;
      if (!container || container === document.body) break;
    }

    if (!container) return null;

    // Get text content and remove Chinese characters that may have been added
    let text = container.textContent || "";

    // Remove Chinese characters (Unicode range: \u4e00-\u9fff)
    text = text.replace(/[\u4e00-\u9fff]/g, "");

    // Normalize whitespace
    text = text.replace(/\s+/g, " ").trim();

    if (!text) return null;

    // Use Intl.Segmenter for sentence boundary detection
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
      const segments = Array.from(segmenter.segment(text));

      // Find sentence containing the word (case-insensitive)
      const wordLower = word.toLowerCase();
      for (const segment of segments) {
        const sentence = segment.segment.trim();
        const sentenceLower = sentence.toLowerCase();

        // Check if word is in this sentence as a whole word
        const wordRegex = new RegExp(`\\b${wordLower}\\b`, "i");
        if (wordRegex.test(sentenceLower)) {
          // Basic quality filter: not too short, not too many special chars
          if (sentence.length > 15 && sentence.length < 500) {
            return sentence;
          }
        }
      }
    } else {
      // Fallback: simple split by period/question/exclamation
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const wordLower = word.toLowerCase();

      for (const sentence of sentences) {
        const sentenceLower = sentence.toLowerCase();
        const wordRegex = new RegExp(`\\b${wordLower}\\b`, "i");

        if (wordRegex.test(sentenceLower)) {
          const trimmed = sentence.trim();
          if (trimmed.length > 15 && trimmed.length < 500) {
            return trimmed + "."; // Add period back
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.warn("[MixRead] Error extracting sentence context:", error);
    return null;
  }
}

/**
 * Process a single text node to highlight words
 * Returns true if node was modified
 */
function processTextNode(node, wordSet) {
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

  if (!hasMatch) return false;

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

      // Extract and cache sentence context
      const sentenceContext = extractSentenceContext(node, word);
      if (sentenceContext) {
        span.dataset.sentenceContext = sentenceContext;
      }

      // Add word stem for easy querying
      if (typeof Stemmer !== "undefined" && Stemmer.stem) {
        const stem = Stemmer.stem(wordLower);
        span.dataset.wordStem = stem;
      } else {
        span.dataset.wordStem = wordLower;
      }

      // Add translation if available
      if (highlightedWordsMap[wordLower]?.chinese) {
        span.dataset.translation = highlightedWordsMap[wordLower].chinese;
      }

      // Add click handler to show tooltip
      span.addEventListener("click", (e) => {
        console.log("[MixRead] Click event triggered for word:", word);
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
        console.log(
          `[MixRead] Added Chinese for "${word}": ${highlightedWordsMap[wordLower].chinese}`
        );
      } else if (showChinese) {
        console.log(
          `[MixRead] No Chinese for "${word}" (showChinese=${showChinese}, hasData=${!!highlightedWordsMap[
            wordLower
          ]}, chinese=${highlightedWordsMap[wordLower]?.chinese})`
        );
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
  if (node.parentNode) {
    node.parentNode.replaceChild(fragment, node);
    return true;
  }
  return false;
}

/**
 * Process a list of nodes in batches using requestAnimationFrame
 * @param {Array} nodes - List of nodes to process
 * @param {Function} processor - Function to call for each node
 * @returns {Promise} - Resolves when all nodes are processed
 */
function processNodesInBatches(nodes, processor) {
  let processedCount = 0;
  return new Promise((resolve) => {
    function processBatch() {
      const batchStart = performance.now();

      // Process nodes for up to 10ms
      while (processedCount < nodes.length) {
        if (performance.now() - batchStart > 10) {
          requestAnimationFrame(processBatch);
          return;
        }

        processor(nodes[processedCount]);
        processedCount++;
      }
      resolve();
    }
    processBatch();
  });
}

/**
 * Actually highlight words in the DOM (Batched)
 */
function highlightWordsInDOM(highlightedWords) {
  const startTime = performance.now();
  console.log("[MixRead] Starting batched highlightWordsInDOM...");

  // Clear pending nodes as we are about to scan the full DOM
  if (typeof pendingNodes !== "undefined") {
    pendingNodes.clear();
  }

  const wordSet = new Set(highlightedWords.map((w) => w.toLowerCase()));
  const textNodes = getTextNodes(document.body);
  console.log(`[MixRead] Found ${textNodes.length} text nodes to scan`);

  let nodesModified = 0;

  return processNodesInBatches(textNodes, (node) => {
    if (processTextNode(node, wordSet)) {
      nodesModified++;
    }
  }).then(() => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(
      `[MixRead Performance] Highlighting finished. Modified ${nodesModified} nodes.`
    );
    console.log(
      `[MixRead Performance] Total execution time: ${duration.toFixed(2)}ms`
    );

    if (duration > 50) {
      console.warn(
        `[MixRead Performance] ⚠️ Long task detected! Highlighting took ${duration.toFixed(
          2
        )}ms, which exceeds the 50ms budget for smooth frame rendering.`
      );
    }
  });
}
/**
 * Show tooltip with word definition
 */
function showTooltip(event, word) {
  console.log("[MixRead] showTooltip called with word:", word);

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
      console.log("[MixRead] Received response:", response);

      if (!response) {
        console.error("[MixRead] No response received from background script");
        return;
      }

      if (response.success) {
        const wordInfo = response.word_info;
        console.log("[MixRead] Creating tooltip with word info:", wordInfo);
        createTooltip(event, word, wordInfo);
      } else {
        console.error("[MixRead] Error getting word info:", response.error);
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
    const chineseLabel = tooltip.querySelector(
      "label[for='toggle-chinese-detail']"
    );
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
  if ("speechSynthesis" in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.8; // Slower speed for clarity
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("Speech Synthesis API not supported");
  }
}

/**
 * Add word to user's vocabulary with timestamp
 */
function addWordToVocabulary(word) {
  console.log(`[MixRead] Adding word to vocabulary: ${word}`);

  if (!userStore) {
    console.warn("[MixRead] userStore not initialized");
    return;
  }

  const userId = userStore.getUserId();
  if (!userId) {
    console.warn("[MixRead] No user ID available");
    return;
  }

  // Also add to local vocabulary for statistics
  const wordLower = word.toLowerCase();
  userVocabulary.add(wordLower);

  // Get current vocabulary dates
  ChromeAPI.storage.get(["vocabulary_dates"], (result) => {
    try {
      const dates = result.vocabulary_dates || {};
      const today = new Date().toISOString().split("T")[0];
      dates[wordLower] = today;

      // Save to local storage
      ChromeAPI.storage.set(
        {
          vocabulary: Array.from(userVocabulary),
          vocabulary_dates: dates,
        },
        () => {
          console.debug("[MixRead] Vocabulary saved for word:", wordLower);
        }
      );
    } catch (error) {
      console.error("[MixRead] Error saving vocabulary:", error);
    }
  });

  // Extract sentence context for the word
  const pageUrl = window.location.href;
  const pageTitle = document.title;

  // Find the paragraph or container with the word
  let paragraph = document.body;
  const allElements = document.querySelectorAll("p, div, article, section");
  for (let el of allElements) {
    if (el.textContent.toLowerCase().includes(word.toLowerCase())) {
      paragraph = el;
      break;
    }
  }

  // Extract sentences using Intl.Segmenter for robust boundary detection
  let text = paragraph.textContent || paragraph.innerText || "";

  console.log(`[MixRead DEBUG] Extracting sentences for word "${word}"`);
  console.log(
    `[MixRead DEBUG] Original text (first 200 chars):`,
    text.substring(0, 200)
  );

  // CRITICAL: Clean up frequency markers like (1×), (2×), etc. that some websites embed
  text = text.replace(/\(\d+×\)/g, ""); // Remove (1×), (2×), (3×), etc.
  text = text.replace(/→\s*/g, " "); // Replace arrows with spaces

  // CRITICAL: Remove Chinese translations that MixRead extension adds to the DOM
  // Pattern: "word 中文翻译" where Chinese follows English word
  // This prevents Chinese chars from triggering the non-ASCII filter
  text = text.replace(
    /[\u4E00-\u9FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF61-\uFF64\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF60\uFFE0-\uFFE6\u2000-\u206F\u2070-\u209F\u20A0-\u20CF\u20D0-\u20FF\u2100-\u214F\u2150-\u218F\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u2400-\u243F\u2440-\u245F\u2460-\u24FF\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u27C0-\u27EF\u27F0-\u27FF\u2800-\u28FF\u2900-\u297F\u2980-\u29FF\u2A00-\u2AFF\u2B00-\u2BFF\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2DE0-\u2DFF\u2E00-\u2E7F\u2E80-\u2EFF\u2F00-\u2FDF\u2FF0-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31A0-\u31BF\u31C0-\u31EF\u31F0-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA4D0-\uA4FF\uA500-\uA63F\uA640-\uA69F\uA6A0-\uA6FF\uA700-\uA71F\uA720-\uA7FF\uA800-\uA82F\uA830-\uA83F\uA840-\uA87F\uA880-\uA8DF\uA8E0-\uA8FF\uA900-\uA92F\uA930-\uA95F\uA960-\uA97F\uA980-\uA9DF\uA9E0-\uA9FF\uAA00-\uAA3F\uAA40-\uAA6F\uAA70-\uAA7F\uAA80-\uAADF\uAAE0-\uAAFF\uAB00-\uAB2F\uAB30-\uAB6F\uAB70-\uABBF\uABC0-\uABFF\uAC00-\uD7AF\uD7B0-\uD7FF\uD800-\uDB7F\uDB80-\uDBFF\uDC00-\uDFFF\uE000-\uF8FF\uF900-\uFAFF\uFB00-\uFB4F\uFB50-\uFDFF\uFE00-\uFE0F\uFE10-\uFE1F\uFE20-\uFE2F\uFE30-\uFE4F\uFE50-\uFE6F\uFE70-\uFEFF\uFF00-\uFFEF\uFFF0-\uFFFF]+/g,
    " "
  );

  text = text.replace(/\s+/g, " ").trim();

  console.log(
    `[MixRead DEBUG] Cleaned text (first 200 chars):`,
    text.substring(0, 200)
  );

  let sentences = [];
  const wordLowerVar = word.toLowerCase();

  try {
    // Use Intl.Segmenter if available (supported in modern Chrome)
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const segments = segmenter.segment(text);

    for (const segment of segments) {
      const sentence = segment.segment.trim();
      if (sentence.toLowerCase().includes(wordLowerVar)) {
        sentences.push(sentence);
      }
    }
    console.log(
      `[MixRead DEBUG] Segmenter extracted ${sentences.length} sentences containing "${word}"`
    );
  } catch (e) {
    console.warn(
      "[MixRead] Intl.Segmenter not supported or failed, falling back to simple split",
      e
    );
    // Fallback to simple split if Intl.Segmenter fails
    sentences = text
      .split(/[.!?]+/)
      .filter((s) => s.toLowerCase().includes(wordLowerVar));
    console.log(
      `[MixRead DEBUG] Fallback extracted ${sentences.length} sentences containing "${word}"`
    );
  }

  // Clean up sentences
  sentences = sentences.map((s) => {
    let clean = s.trim();
    // Ensure it ends with punctuation if it looks like a complete sentence
    if (clean.length > 0 && !/[.!?]$/.test(clean)) {
      clean += ".";
    }
    return clean;
  });

  // Remove duplicates
  sentences = [...new Set(sentences)];
  console.log(
    `[MixRead DEBUG] After cleanup: ${sentences.length} unique sentences`
  );

  // Filter sentences
  const beforeFilter = sentences.length;
  sentences = sentences
    .filter((s) => {
      // Basic length checks
      if (s.length < 10) {
        console.log(
          `[MixRead DEBUG] Filtered out (too short): "${s.substring(0, 50)}..."`
        );
        return false;
      }
      // Relaxed word count check (2 words might be enough for short exclamations or commands, but 3 is safer)
      if (s.split(/\s+/).length < 3) {
        console.log(
          `[MixRead DEBUG] Filtered out (< 3 words): "${s.substring(0, 50)}..."`
        );
        return false;
      }

      // Relaxed special character check
      // Allow more special characters, especially parentheses and brackets which are common in examples
      const specialCharCount = (s.match(/[×→]/g) || []).length; // Only count "bad" special chars
      if (specialCharCount > 2) {
        console.log(
          `[MixRead DEBUG] Filtered out (special chars): "${s.substring(
            0,
            50
          )}..."`
        );
        return false;
      }

      // Skip if looks like it's mixing different languages/formats
      if (s.includes("1x") || s.includes("→") || s.match(/\d+×/)) {
        console.log(
          `[MixRead DEBUG] Filtered out (format chars): "${s.substring(
            0,
            50
          )}..."`
        );
        return false;
      }

      // CRITICAL: Skip sentences that contain multiple word-form patterns like "word(1×)"
      const wordFormPatterns = (s.match(/\([0-9×]+\)/g) || []).length;
      if (wordFormPatterns > 3) {
        console.log(
          `[MixRead DEBUG] Filtered out (word-form patterns): "${s.substring(
            0,
            50
          )}..."`
        );
        return false;
      }

      // Skip sentences with non-ASCII characters mixed in (multilingual content)
      // But allow common punctuation
      if (/[\u4E00-\u9FFF]/.test(s) || /[\u3040-\u309F]/.test(s)) {
        console.log(
          `[MixRead DEBUG] Filtered out (non-ASCII): "${s.substring(0, 50)}..."`
        );
        return false;
      }

      return true;
    })
    .slice(0, 3);

  console.log(
    `[MixRead DEBUG] After filtering: ${sentences.length}/${beforeFilter} sentences kept`
  );

  // Fallback if no sentences found
  if (sentences.length === 0) {
    // If we have the word but no valid sentences passed filter, just return the word context
    // Try to find a small window around the word
    const index = text.toLowerCase().indexOf(wordLowerVar);
    if (index !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + word.length + 20);
      let snippet = text.substring(start, end).trim();
      if (start > 0) snippet = "..." + snippet;
      if (end < text.length) snippet = snippet + "...";
      sentences = [snippet];
    } else {
      sentences = [`${word} was found on this page.`];
    }
  }

  // DEBUG: Log exactly what we're about to send
  console.log(
    `[MixRead DEBUG] About to send word "${word}" with ${sentences.length} sentences:`,
    sentences
  );

  // Send to backend
  try {
    const sendAddToLibrary = () => {
      try {
        ChromeAPI.runtime.sendMessage(
          {
            type: "ADD_TO_LIBRARY",
            user_id: userId,
            words: [word],
            contexts: [
              {
                page_url: pageUrl,
                page_title: pageTitle,
                sentences: sentences,
              },
            ],
          },
          (response) => {
            try {
              if (response && response.success) {
                console.log(
                  `[MixRead] Successfully added "${word}" to library`
                );
              } else if (response) {
                console.error(
                  `[MixRead] Failed to add word to library:`,
                  response
                );
              } else {
                console.warn(
                  `[MixRead] Extension context invalidated, retrying...`
                );
                // Retry after a short delay
                setTimeout(sendAddToLibrary, 500);
              }
            } catch (e) {
              console.error(`[MixRead] Error in callback:`, e.message);
            }
          }
        );
      } catch (e) {
        console.error(`[MixRead] Failed to send message:`, e.message);
      }
    };

    sendAddToLibrary();
  } catch (error) {
    console.error(`[MixRead] Error setting up message:`, error.message);
  }
}

/**
 * Mark a word as known (user already knows it)
 * Calls backend API to persist the marking
 */
function markWordAsKnown(word) {
  // Check if extension context is still valid
  if (!chrome || !chrome.runtime) {
    console.warn(
      "[MixRead] Extension context invalidated, cannot mark word as known"
    );
    return;
  }

  // Use stemmer to normalize word form (evaluates → evalu)
  const stemmedWord = Stemmer.stem(word);

  // Get user ID from userStore
  if (!userStore) {
    console.warn("[MixRead] userStore not initialized");
    logger.warn("Failed to mark word as known: userStore not initialized");
    return;
  }

  const userId = userStore.getUserId();
  if (!userId) {
    console.warn("[MixRead] No user ID available");
    logger.warn("Failed to mark word as known: no user ID");
    return;
  }

  console.log(
    `[MixRead] Marking "${word}" as known (stem: "${stemmedWord}") for user: ${userId}`
  );
  logger.log(`Marking "${word}" as known`);

  // Call backend API to mark word as known
  try {
    const sendMarkAsKnown = () => {
      try {
        ChromeAPI.runtime.sendMessage(
          {
            type: "MARK_AS_KNOWN",
            user_id: userId,
            word: stemmedWord,
          },
          (response) => {
            try {
              if (response?.success) {
                console.log(
                  `[MixRead] Successfully marked "${stemmedWord}" as known`
                );
                logger.info(`"${word}" marked as known`);

                // Trigger page re-highlight to update highlights
                highlightPageWords();
              } else {
                console.error(
                  `[MixRead] Failed to mark "${word}" as known:`,
                  response?.error
                );
                logger.error(
                  `Failed to mark "${word}" as known`,
                  response?.error
                );
              }
            } catch (e) {
              console.error(
                `[MixRead] Error in mark-as-known callback:`,
                e.message
              );
            }
          }
        );
      } catch (e) {
        console.error(
          `[MixRead] Failed to send mark-as-known message:`,
          e.message
        );
      }
    };

    sendMarkAsKnown();
  } catch (error) {
    console.error(
      `[MixRead] Error setting up mark-as-known message:`,
      error.message
    );
  }
}

// ===== Event Listeners =====

// Listen for unknown words updates (from context menu)
window.addEventListener("unknown-words-updated", () => {
  console.log(
    '[MixRead] Received "unknown-words-updated" event, re-highlighting page'
  );
  logger.log("Unknown words updated, re-highlighting page");

  if (unknownWordsStore) {
    console.log(
      "[MixRead] Current unknown words in store:",
      unknownWordsStore.getAll()
    );
  }

  highlightPageWords();
});

// Global context menu for any text on page
// Note: Custom context menu disabled to allow Chrome native context menus
// Users now use Chrome's native right-click menu with "Mark as Unknown" and "Mark as Known" options
// See background.js for chrome.contextMenus implementation

// Listen for difficulty level changes from popup
if (ChromeAPI.isContextValid()) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "DIFFICULTY_CHANGED") {
      currentDifficultyLevel = request.difficulty_level;
      ChromeAPI.storage.set({ difficultyLevel: currentDifficultyLevel });

      // Update user store if initialized
      if (userStore) {
        userStore.setDifficultyLevel(request.difficulty_level);
      }

      // Re-highlight the page
      highlightPageWords();
      sendResponse({ success: true });
    } else if (request.type === "CHINESE_DISPLAY_CHANGED") {
      showChinese = request.showChinese;
      ChromeAPI.storage.set({ showChinese });

      // Re-highlight the page to show/hide Chinese
      highlightPageWords();
      sendResponse({ success: true });
    } else if (request.type === "UPDATE_CURRENT_USER") {
      // Update current user ID in user store
      console.log("[MixRead] Updating current user to:", request.userId);
      if (userStore && userStore.user) {
        userStore.user.id = request.userId;
        console.log("[MixRead] User updated in userStore");
        sendResponse({ success: true });
      } else {
        console.log("[MixRead] User store not initialized, storing for later");
        // Store for later when userStore initializes
        window.pendingUserId = request.userId;
        sendResponse({ success: true });
      }
    } else if (request.type === "CONTEXT_MARK_UNKNOWN") {
      // Handle Mark as Unknown from context menu
      const word = request.word;
      // Use stemmer to normalize word form (recognizing → recogniz)
      const stemmedWord = Stemmer.stem(word);
      console.log(
        `[MixRead] Context menu: Marking as unknown: "${word}" (stem: "${stemmedWord}")`
      );
      unknownWordsService
        .markAsUnknown(stemmedWord)
        .then(() => {
          console.log("[MixRead] Successfully marked as unknown:", stemmedWord);
          highlightPageWords();
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("[MixRead] Error marking as unknown:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep the message channel open for async response
    } else if (request.type === "CONTEXT_MARK_KNOWN") {
      // Handle Mark as Known from context menu
      const word = request.word;
      // Use stemmer to normalize word form (emphasizes → emphas)
      const stemmedWord = Stemmer.stem(word);
      console.log(
        `[MixRead] Context menu: Marking as known: "${word}" (stem: "${stemmedWord}")`
      );
      markWordAsKnown(word); // markWordAsKnown will apply stemming internally
      sendResponse({ success: true });
    } else if (request.type === "OPEN_BATCH_PANEL") {
      // Handle batch marking panel open request
      console.log("[MixRead] Opening batch marking panel");
      if (batchMarkingPanel) {
        batchMarkingPanel.toggle();
        sendResponse({ success: true });
      } else {
        console.error("[MixRead] Batch marking panel not initialized");
        console.log("[MixRead] Waiting for initialization...");
        setTimeout(() => {
          if (batchMarkingPanel) {
            console.log("[MixRead] Panel initialized, now opening");
            batchMarkingPanel.toggle();
            sendResponse({ success: true });
          } else {
            sendResponse({
              success: false,
              error: "Panel initialization failed",
            });
          }
        }, 1000);
      }
      return true; // Keep message channel open
    }
  });
}

// Start highlighting when page loads (after modules are initialized)
function startHighlighting() {
  console.log("[MixRead] Starting page highlighting...");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      console.log("[MixRead] DOMContentLoaded, calling highlightPageWords");
      highlightPageWords();
    });
  } else {
    console.log(
      "[MixRead] Document already loaded, calling highlightPageWords"
    );
    highlightPageWords();
  }
}

// Call after initialization
initializeModules()
  .then(() => {
    console.log("[MixRead] Modules initialized, starting highlighting");
    startHighlighting();
  })
  .catch((error) => {
    console.error(
      "[MixRead] Initialization failed, but attempting to highlight anyway:",
      error
    );
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

// Clean up when page unloads to prevent context invalidated errors
window.addEventListener("beforeunload", () => {
  console.log("[MixRead] Page unloading, cleaning up...");

  // Record final session if extension context is still valid
  if (chrome && chrome.storage && !window.mixReadUnloaded) {
    recordReadingSession();
    window.mixReadUnloaded = true;
  }

  // Cancel any ongoing speech
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  // Remove any tooltips
  const tooltips = document.querySelectorAll(".mixread-tooltip");
  tooltips.forEach((tooltip) => tooltip.remove());

  // Remove batch marking panel if it exists
  const panel = document.getElementById("mixread-batch-panel");
  if (panel) {
    panel.remove();
  }
});

// Also clean up on visibility change (when switching tabs)
document.addEventListener("visibilitychange", () => {
  if (document.hidden && chrome && chrome.storage && !window.mixReadUnloaded) {
    // Record session when tab becomes hidden
    recordReadingSession();
  }
});

/**
 * Track reading session time and update stats
 */
function recordReadingSession() {
  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime) {
    console.warn(
      "[MixRead] Extension context invalidated, cannot record session"
    );
    return;
  }

  const sessionDurationMs = Date.now() - sessionStartTime;
  const sessionDurationMinutes = Math.round(sessionDurationMs / 60000); // Convert to minutes

  if (sessionDurationMinutes > 0) {
    ChromeAPI.storage.get(["reading_sessions"], (result) => {
      try {
        const sessions = result.reading_sessions || {};
        const today = new Date().toISOString().split("T")[0];

        // Add session duration to today's total
        sessions[today] = (sessions[today] || 0) + sessionDurationMinutes;

        ChromeAPI.storage.set(
          {
            reading_sessions: sessions,
          },
          () => {
            console.log(
              `[MixRead] Recorded ${sessionDurationMinutes} minutes of reading for ${today}`
            );
          }
        );
      } catch (error) {
        console.error("[MixRead] Error recording session:", error);
      }
    });
  }
}

// Wrapper to handle extension context invalidation
function safeRecordReadingSession() {
  try {
    // Check if extension context is valid before calling
    if (ChromeAPI.isContextValid()) {
      recordReadingSession();
    }
  } catch (error) {
    // Silently handle extension context errors
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.debug(
        "[MixRead] Extension context invalidated, skipping session recording"
      );
    } else {
      console.error("[MixRead] Unexpected error in session recording:", error);
    }
  }
}

// Record session time when user leaves the page
window.addEventListener("beforeunload", safeRecordReadingSession);

// Also record session periodically (every 5 minutes)
setInterval(() => {
  safeRecordReadingSession();
  sessionStartTime = Date.now(); // Reset for next interval
}, 5 * 60 * 1000);

// ===== Dynamic Content Support =====

let mutationTimeout;
const pendingNodes = new Set();

/**
 * Highlight words in newly added dynamic content
 */
async function highlightDynamicContent(addedNodes) {
  console.log(
    `[MixRead Debug] highlightDynamicContent called with ${addedNodes.length} nodes`
  );

  // 1. Extract words from new nodes
  const textNodes = [];
  for (const node of addedNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      textNodes.push(...getTextNodes(node));
    }
  }
  if (textNodes.length === 0) return;

  const allWords = [];
  for (const node of textNodes) {
    const words = tokenizeText(node.textContent);
    allWords.push(...words);
  }
  const uniqueWords = [...new Set(allWords)];
  if (uniqueWords.length === 0) return;

  // 2. Query Backend
  const stemMap = createStemMapping(uniqueWords);
  const stemsToQuery = Object.keys(stemMap);
  const userId = userStore ? userStore.getUserId() : null;

  console.log(
    `[MixRead] Querying ${stemsToQuery.length} stems for dynamic content`
  );

  sendMessageWithRetry(
    {
      type: "GET_HIGHLIGHTED_WORDS",
      words: stemsToQuery,
      difficulty_level: currentDifficultyLevel,
      user_id: userId,
    },
    async (response) => {
      if (response.success) {
        // 3. Update Map
        const highlightedVariants = [];
        if (response.word_details) {
          response.word_details.forEach((detail) => {
            const stem = detail.word.toLowerCase();
            const variants = stemMap[stem] || [stem];
            variants.forEach((variant) => {
              highlightedWordsMap[variant.toLowerCase()] = detail;
              highlightedVariants.push(variant);
            });
          });
        }

        console.log(
          `[MixRead] Dynamic query returned ${highlightedVariants.length} variants to highlight`
        );

        // 4. Apply Highlights
        // We use the updated global map
        const wordSet = new Set(Object.keys(highlightedWordsMap));
        if (wordSet.size === 0) return;

        await processNodesInBatches(textNodes, (node) => {
          processTextNode(node, wordSet);
        });

        // 5. Notify batch panel of new highlighted words
        notifyPanelOfNewWords(response.word_details);
      } else {
        console.error(
          "[MixRead] Error querying dynamic words:",
          response.error
        );
      }
    }
  );
}

/**
 * Notify sidebar panel of newly highlighted words
 * This enables the sidebar to update incrementally when feed content loads
 */
function notifyPanelOfNewWords(wordDetails) {
  if (!wordDetails || wordDetails.length === 0) return;

  // Collect information about newly highlighted words from DOM
  const newWordsMap = {};

  wordDetails.forEach((detail) => {
    // Apply stemming to match DOM data-word-stem attribute
    let stem = detail.word.toLowerCase();
    if (typeof Stemmer !== 'undefined' && Stemmer.stem) {
      try {
        stem = Stemmer.stem(stem);
      } catch (e) {
        console.warn('[MixRead] Stemming error in notifyPanelOfNewWords:', e);
      }
    }

    const elements = document.querySelectorAll(
      `.mixread-highlight[data-word-stem="${stem}"]`
    );

    if (elements.length > 0) {
      const firstElement = elements[0];
      const word = firstElement.dataset.word || stem;

      // Normalize word consistently (must match sidebar-panel.js normalizeWord logic)
      let normalizedWord = word.toLowerCase();
      if (typeof Stemmer !== 'undefined' && Stemmer.stem) {
        try {
          normalizedWord = Stemmer.stem(normalizedWord);
        } catch (e) {
          console.warn('[MixRead] Stemming error:', e);
        }
      }

      if (!newWordsMap[normalizedWord]) {
        newWordsMap[normalizedWord] = {
          count: elements.length,
          originalWords: [],  // Use array instead of Set for serialization
          chinese: firstElement.dataset.translation || "",
          definition: firstElement.dataset.definition || "",
        };
      }

      elements.forEach((el) => {
        const word = el.dataset.word || el.textContent;
        if (!newWordsMap[normalizedWord].originalWords.includes(word)) {
          newWordsMap[normalizedWord].originalWords.push(word);
        }
      });
    }
  });

  if (Object.keys(newWordsMap).length === 0) return;

  console.log(
    `[MixRead] Notifying sidebar of ${Object.keys(newWordsMap).length} new highlighted words`
  );

  // Notify sidebar directly (if available)
  if (sidebarPanel) {
    sidebarPanel.onNewWordsHighlighted(newWordsMap);
  }

  // Also send message for any other listeners
  if (ChromeAPI.isContextValid()) {
    try {
      chrome.runtime.sendMessage({
        type: "NEW_WORDS_HIGHLIGHTED",
        newWords: newWordsMap,
      });
    } catch (e) {
      console.warn("[MixRead] Failed to send NEW_WORDS_HIGHLIGHTED message:", e);
    }
  }
}

function setupMutationObserver() {
  console.log("[MixRead Debug] setupMutationObserver called");
  if (window.mixreadObserver) {
    console.log("[MixRead Debug] Observer already exists");
    return;
  }

  const observer = new MutationObserver((mutations) => {
    // console.log(`[MixRead Debug] Mutation callback with ${mutations.length} mutations`);
    let hasRelevantAdded = false;
    let hasRelevantRemoved = false;
    const removedStems = [];

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        // Track added nodes (existing logic)
        for (const node of mutation.addedNodes) {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            !node.classList.contains("mixread-ui") &&
            !node.closest(".mixread-ui") &&
            !node.closest("#mixread-batch-panel") &&
            !node.closest("#mixread-sidebar")
          ) {
            pendingNodes.add(node);
            hasRelevantAdded = true;
          }
        }

        // Track removed nodes (Phase 1 - Feed flow fix)
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if node contains any highlights
            const highlightElements = node.querySelectorAll('.mixread-highlight');
            if (highlightElements.length > 0) {
              // Extract word stems from removed elements
              highlightElements.forEach((el) => {
                const stem = el.dataset.wordStem;
                if (stem) {
                  removedStems.push(stem);
                }
              });
              hasRelevantRemoved = true;
            }
          }
        }
      }
    }

    // Notify sidebar of removed words
    if (hasRelevantRemoved && removedStems.length > 0 && sidebarPanel) {
      console.log(`[MixRead] Feed removed ${removedStems.length} words`);
      sidebarPanel.onWordsRemoved(removedStems);
    }

    if (hasRelevantAdded) {
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => {
        console.log("[MixRead Debug] Debounce fired, processing pending nodes");
        const nodesToProcess = Array.from(pendingNodes);
        pendingNodes.clear();
        highlightDynamicContent(nodesToProcess);
      }, 1000); // Debounce 1s
    }
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.mixreadObserver = observer;
    console.log("[MixRead] MutationObserver set up for dynamic content");
  }
}

// Start observer immediately
setupMutationObserver();
