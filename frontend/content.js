/**
 * MixRead Content Script
 * Tokenizes page content and highlights difficult words
 */

// Track current difficulty level
let currentDifficultyLevel = "B1";
let highlightedWordsMap = {};
let userVocabulary = new Set();
let isHighlighting = false; // Prevent infinite loop
let showChinese = true; // Show Chinese translation by default
let definitionCache = {}; // Cache for word definitions

// Load settings on startup
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
 * Walk through all text nodes and highlight words
 */
function highlightPageWords() {
  // Prevent infinite loop from MutationObserver
  if (isHighlighting) {
    console.log('[MixRead] Already highlighting, skipping...');
    return;
  }

  isHighlighting = true;
  console.log('[MixRead] highlightPageWords called');

  // Get all words from the page
  const textNodes = getTextNodes(document.body);
  const allWords = [];

  for (const node of textNodes) {
    const words = tokenizeText(node.textContent);
    allWords.push(...words);
  }

  // Get unique words and send to backend
  const uniqueWords = [...new Set(allWords)];
  console.log('[MixRead] Found', uniqueWords.length, 'unique words');

  // Send to background script to query API
  chrome.runtime.sendMessage(
    {
      type: "GET_HIGHLIGHTED_WORDS",
      words: uniqueWords,
      difficulty_level: currentDifficultyLevel,
    },
    (response) => {
      if (response.success) {
        highlightedWordsMap = {};
        response.word_details.forEach((detail) => {
          highlightedWordsMap[detail.word.toLowerCase()] = detail;
        });

        console.log('[MixRead] Will highlight', response.highlighted_words.length, 'words');
        console.log('[MixRead] Sample word details:', response.word_details.slice(0, 3));

        // Now walk through and actually highlight the words in the DOM
        highlightWordsInDOM(response.highlighted_words);
      } else {
        console.error("[MixRead] Error getting highlighted words:", response.error);
      }

      // Reset flag after highlighting is complete
      isHighlighting = false;
    }
  );
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
        !node.parentElement.classList.contains("mixread-tooltip")
      ) {
        textNodes.push(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip MixRead elements
      if (!node.classList.contains("mixread-tooltip")) {
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

  // Get word info from backend
  chrome.runtime.sendMessage(
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

  tooltip.querySelector("#btn-close").onclick = () => {
    tooltip.remove();
  };

  document.body.appendChild(tooltip);

  // Close tooltip when clicking outside
  setTimeout(() => {
    document.addEventListener("click", () => {
      tooltip.remove();
    }, { once: true });
  }, 0);
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
 * Add word to user's vocabulary
 */
function addWordToVocabulary(word) {
  userVocabulary.add(word.toLowerCase());

  // Save to storage
  chrome.storage.local.set({
    vocabulary: Array.from(userVocabulary),
  });
}

// Listen for difficulty level changes from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "DIFFICULTY_CHANGED") {
    currentDifficultyLevel = request.difficulty_level;
    chrome.storage.local.set({ difficultyLevel: currentDifficultyLevel });

    // Re-highlight the page
    highlightPageWords();
    sendResponse({ success: true });
  } else if (request.type === "CHINESE_DISPLAY_CHANGED") {
    showChinese = request.showChinese;
    chrome.storage.local.set({ showChinese });

    // Re-highlight the page to show/hide Chinese
    highlightPageWords();
    sendResponse({ success: true });
  }
});

// Start highlighting when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", highlightPageWords);
} else {
  highlightPageWords();
}

// TODO: Re-enable MutationObserver for dynamic content (disabled to prevent infinite loop)
// const observer = new MutationObserver(() => {
//   highlightPageWords();
// });
//
// observer.observe(document.body, {
//   childList: true,
//   subtree: true,
// });
