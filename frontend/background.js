/**
 * MixRead Background Service Worker
 * Handles API requests and communication between content script and backend
 */

const API_BASE = "http://localhost:8000";

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_HIGHLIGHTED_WORDS") {
    handleGetHighlightedWords(request, sendResponse);
  } else if (request.type === "GET_WORD_INFO") {
    handleGetWordInfo(request, sendResponse);
  } else if (request.type === "GET_USER_DATA") {
    handleGetUserData(request, sendResponse);
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
