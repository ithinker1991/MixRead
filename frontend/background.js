/**
 * MixRead Background Service Worker
 * Handles API requests and communication between content script and backend
 */

const API_BASE = "http://localhost:8000";

// ===== Context Menu Setup =====

/**
 * Create context menu items
 */
function createContextMenus() {
  console.log('[Background] Creating context menus');

  // Clear existing context menus first
  chrome.contextMenus.removeAll(() => {
    console.log('[Background] Cleared old context menus');
  });

  // Create context menu for marking unknown
  chrome.contextMenus.create({
    id: 'mixread-mark-unknown',
    title: 'Mark as Unknown (MixRead)',
    contexts: ['selection'],
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Background] Error creating mark-unknown menu:', chrome.runtime.lastError);
    } else {
      console.log('[Background] Created mark-unknown context menu');
    }
  });

  // Create context menu for marking known
  chrome.contextMenus.create({
    id: 'mixread-mark-known',
    title: 'Mark as Known (MixRead)',
    contexts: ['selection'],
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Background] Error creating mark-known menu:', chrome.runtime.lastError);
    } else {
      console.log('[Background] Created mark-known context menu');
    }
  });
}

/**
 * Create context menus when extension loads
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed/updated, setting up context menus');
  createContextMenus();
});

// Also try to create menus on startup (in case onInstalled didn't trigger)
createContextMenus();

/**
 * Handle context menu item clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('[Background] Context menu clicked:', info.menuItemId);
  console.log('[Background] Selected text:', info.selectionText);

  const word = info.selectionText?.trim().toLowerCase();

  if (!word) {
    console.warn('[Background] No word selected');
    return;
  }

  try {
    // Send message to content script to handle the action
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: info.menuItemId === 'mixread-mark-unknown' ? 'CONTEXT_MARK_UNKNOWN' : 'CONTEXT_MARK_KNOWN',
      word: word,
    });

    console.log('[Background] Content script response:', response);
  } catch (error) {
    console.error('[Background] Error sending message to content script:', error);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_HIGHLIGHTED_WORDS") {
    handleGetHighlightedWords(request, sendResponse);
  } else if (request.type === "GET_WORD_INFO") {
    handleGetWordInfo(request, sendResponse);
  } else if (request.type === "GET_USER_DATA") {
    handleGetUserData(request, sendResponse);
  } else if (request.type === "MARK_AS_KNOWN") {
    handleMarkAsKnown(request, sendResponse);
  }
  return true; // Keep the message channel open for async response
});

/**
 * Get list of words that should be highlighted
 */
async function handleGetHighlightedWords(request, sendResponse) {
  try {
    const { words, difficulty_level, user_id } = request;

    console.log('[Background] === Handling GET_HIGHLIGHTED_WORDS ===');
    console.log('[Background] Received words:', words?.slice(0, 20).join(', '), `... (${words?.length || 0} total)`);
    console.log('[Background] difficulty_level:', difficulty_level);
    console.log('[Background] user_id:', user_id);

    const response = await fetch(`${API_BASE}/highlight-words`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user_id,
        words: words,
        difficulty_level: difficulty_level,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Background] API Response received');
    console.log('[Background] highlighted_words:', data.highlighted_words?.slice(0, 20));
    console.log('[Background] word_details count:', data.word_details?.length || 0);

    sendResponse({
      success: true,
      highlighted_words: data.highlighted_words,
      word_details: data.word_details,
    });
  } catch (error) {
    console.error("Error in handleGetHighlightedWords:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get detailed information for a single word (definition, example, etc.)
 */
async function handleGetWordInfo(request, sendResponse) {
  try {
    const { word } = request;

    const response = await fetch(`${API_BASE}/word/${encodeURIComponent(word)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({
      success: true,
      word_info: data,
    });
  } catch (error) {
    console.error("Error in handleGetWordInfo:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get user data including known_words and unknown_words
 */
async function handleGetUserData(request, sendResponse) {
  try {
    const { user_id } = request;

    if (!user_id) {
      throw new Error("user_id is required");
    }

    console.log('[Background] Getting user data for:', user_id);

    const response = await fetch(`${API_BASE}/users/${encodeURIComponent(user_id)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Background] User data retrieved');

    sendResponse({
      success: true,
      user_data: data,
    });
  } catch (error) {
    console.error("Error in handleGetUserData:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Mark a word as known (user already knows it)
 */
async function handleMarkAsKnown(request, sendResponse) {
  try {
    const { user_id, word } = request;

    if (!user_id || !word) {
      throw new Error("user_id and word are required");
    }

    console.log('[Background] Marking word as known:', word, 'for user:', user_id);

    const response = await fetch(`${API_BASE}/users/${encodeURIComponent(user_id)}/known-words`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        word: word.toLowerCase(),
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Background] Word marked as known:', data);

    sendResponse({
      success: true,
      message: `"${word}" marked as known`,
    });
  } catch (error) {
    console.error("Error in handleMarkAsKnown:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}
