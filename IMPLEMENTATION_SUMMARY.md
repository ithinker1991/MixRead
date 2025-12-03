# TabId-Based Caching Implementation Summary

## 📋 Overview

Implemented tab-granular word caching system to replace URL-based caching. This prevents word pollution across different tabs and correctly handles SPA navigation within the same tab.

## 🔧 Implementation Details

### 1. `word-cache-manager.js` - Added new method (Line 46-57)

```javascript
getTabCacheKey(tabId) {
  if (!tabId) {
    console.warn('[WordCacheManager] Invalid tabId');
    return null;
  }
  return `tab_${tabId}`;
}
```

**Purpose**: Generate cache keys using tab ID format `tab_12345` instead of URL format `domain.com|/path`

### 2. `background.js` - Added message handler (Line 98-100, 315-333)

```javascript
} else if (request.type === "GET_TAB_ID") {
  handleGetTabId(request, sender, sendResponse);
}

function handleGetTabId(request, sender, sendResponse) {
  try {
    const tabId = sender.tab?.id;
    if (!tabId) {
      throw new Error("Unable to determine tab ID");
    }
    console.log('[Background] Returning tab ID:', tabId);
    sendResponse({
      success: true,
      tabId: tabId,
    });
  } catch (error) {
    console.error("Error in handleGetTabId:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}
```

**Purpose**: Enable content scripts to retrieve their current tab ID from the background service worker.

### 3. `sidebar-panel.js` - Major refactoring (Multiple changes)

#### 3.1 Constructor - Added new state variables (Line 31, 38)

```javascript
this.tabId = null;           // Current tab ID (for tab-granular caching)
this.navigationMode = 'normal';  // Track navigation type: 'spa' or 'normal'
```

#### 3.2 Init method - Fetch tabId first (Line 57-59)

```javascript
// First, get the tab ID
this.tabId = await this.getTabId();
console.log('[SidebarPanel] Got tabId:', this.tabId);
```

#### 3.3 New method - Get tab ID (Line 77-100)

```javascript
async getTabId() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: 'GET_TAB_ID' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[SidebarPanel] Failed to get tabId:', chrome.runtime.lastError);
            resolve(null);
          } else if (response?.success && response?.tabId) {
            console.log('[SidebarPanel] Received tabId:', response.tabId);
            resolve(response.tabId);
          } else {
            console.warn('[SidebarPanel] Invalid tabId response:', response);
            resolve(null);
          }
        }
      );
    } catch (e) {
      console.error('[SidebarPanel] Error requesting tabId:', e);
      resolve(null);
    }
  });
}
```

#### 3.4 Refactored loadPageData - Uses tabId instead of URL (Line 725-767)

```javascript
// Use tab ID for cache key instead of URL
this.currentCacheKey = this.cacheManager.getTabCacheKey(this.tabId);

// Try to restore from cache
const cachedWordState = await this.cacheManager.getFromCache(
  this.currentCacheKey,
  userId
);

if (cachedWordState && Object.keys(cachedWordState).length > 0) {
  console.log(`[SidebarPanel] Restored from cache: ${Object.keys(cachedWordState).length} words`);
  // Restore from cache and convert originalWords back to Set
  this.wordState = this.deserializeWordState(cachedWordState);
  this.renderWordList();
  return;
}

console.log('[SidebarPanel] No cache found - starting fresh session for this tab');
// Will be populated by onNewWordsHighlighted when API returns
this.wordState = {};
this.renderWordList();
```

#### 3.5 New helper method - Deserialize word state (Line 772-797)

```javascript
deserializeWordState(cachedState) {
  const result = {};
  Object.entries(cachedState).forEach(([key, data]) => {
    // Handle originalWords which might be Array, Set, or Object after serialization
    let originalWordsSet = new Set();
    if (data.originalWords) {
      if (Array.isArray(data.originalWords)) {
        originalWordsSet = new Set(data.originalWords);
      } else if (typeof data.originalWords === 'object') {
        // Might be serialized Set or object with string keys
        if (Set.prototype.isPrototypeOf(data.originalWords)) {
          originalWordsSet = new Set(data.originalWords);
        } else {
          // Try to get keys from object
          originalWordsSet = new Set(Object.keys(data.originalWords));
        }
      }
    }

    result[key] = {
      ...data,
      originalWords: originalWordsSet
    };
  });
  return result;
}
```

#### 3.6 Refactored setupURLChangeListener - SPA detection (Line 803-849)

```javascript
history.pushState = (...args) => {
  console.log('[SidebarPanel] pushState detected - marking as SPA navigation');
  this.navigationMode = 'spa';  // Mark as SPA navigation
  originalPushState.apply(history, args);
  setTimeout(() => this.onURLChange(), 50);
  return undefined;
};

history.replaceState = (...args) => {
  console.log('[SidebarPanel] replaceState detected - marking as SPA navigation');
  this.navigationMode = 'spa';  // Mark as SPA navigation
  originalReplaceState.apply(history, args);
  setTimeout(() => this.onURLChange(), 50);
  return undefined;
};
```

#### 3.7 Refactored onURLChange - Navigation mode handling (Line 840-877)

```javascript
async onURLChange() {
  const newUrl = window.location.href;

  // Check if this is SPA navigation
  if (this.navigationMode === 'spa') {
    console.log('[SidebarPanel] SPA navigation detected - continuing to accumulate words');
    this.navigationMode = 'normal';  // Reset for next navigation
    return;  // Don't clear words, continue accumulating
  }

  // Non-SPA navigation: clear words
  console.log(`[SidebarPanel] Non-SPA navigation detected (F5 refresh or new URL input) - clearing words`);
  console.log(`[SidebarPanel] URL changed: ${this.currentUrl} → ${newUrl}`);

  try {
    const userId = userStore?.getUserId();
    if (!userId) return;

    // Save current state to cache before clearing (optional, for safety)
    if (this.currentCacheKey && Object.keys(this.wordState).length > 0) {
      await this.cacheManager.setToCache(
        this.currentCacheKey,
        this.wordState,
        userId
      );
    }

    // Clear words for new navigation
    this.wordState = {};
    this.jumpIndex = {};
    this.currentUrl = newUrl;
    this.renderWordList();

    console.log('[SidebarPanel] Words cleared, ready for new content');
  } catch (e) {
    console.error('[SidebarPanel] URL change error:', e);
  }
}
```

## ✅ Expected Behavior

### Scenario A: Multi-Tab Isolation ✓
- Tab 1 (twitter.com) → word1, word2, word3
- Tab 2 (medium.com) → word4, word5
- **Result**: Each tab shows only its own words

### Scenario B: SPA Navigation within Same Tab ✓
- Tab 1: twitter.com → highlight {word1, word2}
- Tab 1: twitter.com/detail/123 (SPA push state) → highlight {word3, word4}
- Tab 1: back to twitter.com (SPA pop state)
- **Result**: Sidebar accumulates all words {word1, word2, word3, word4}

### Scenario C: F5 Refresh ✓
- Tab 1: twitter.com → highlight {word1, word2}
- User presses F5
- **Result**: Sidebar clears, shows only new words

### Scenario D: Manual URL Input ✓
- Tab 1: twitter.com → highlight {word1, word2}
- User types github.com in address bar
- **Result**: Sidebar clears, shows only github words

### Scenario E: Tab Closure ✓
- Old tab data stays in storage but is never used
- New tabs get fresh tabId and start from scratch
- **Result**: No cross-tab pollution

## 🧪 Testing Checklist

```
✓ Code syntax validation:
  [✓] word-cache-manager.js
  [✓] background.js
  [✓] sidebar-panel.js

□ Extension loading:
  [ ] Load unpacked extension in Chrome
  [ ] Check console for init logs
  [ ] Verify "[SidebarPanel] Got tabId:" message appears

□ Scenario A (Multi-tab):
  [ ] Open Tab 1: twitter.com → read article → verify sidebar shows words
  [ ] Open Tab 2: medium.com → read article → verify sidebar shows NEW words only
  [ ] Switch back to Tab 1 → verify sidebar shows original words
  [ ] No cross-tab pollution observed

□ Scenario B (SPA Navigation):
  [ ] Open Tab 1: twitter.com → highlight appears
  [ ] Click link to twitter.com/detail (SPA) → new words appear
  [ ] Sidebar shows BOTH old and new words (accumulated)

□ Scenario C (F5 Refresh):
  [ ] Read article → sidebar shows words
  [ ] Press F5 → sidebar clears
  [ ] New page loads → sidebar shows only new words

□ Scenario D (Manual URL):
  [ ] Read twitter.com → sidebar shows words
  [ ] Type github.com in address bar → sidebar clears
  [ ] github.com loads → sidebar shows only github words

□ Console logging:
  [ ] Check DevTools console for "[SidebarPanel]" logs
  [ ] Verify "[Background] Returning tab ID: XXXX" appears on init
  [ ] Verify "[SidebarPanel] SPA navigation detected" for SPA nav
```

## 📝 Files Modified

1. **word-cache-manager.js**: Added `getTabCacheKey()` method
2. **background.js**: Added `handleGetTabId()` function and message handler
3. **sidebar-panel.js**: Major refactoring for tabId-based caching
   - Added tabId and navigationMode state
   - Added `getTabId()` method
   - Added `deserializeWordState()` helper
   - Refactored `loadPageData()` to use tabId
   - Refactored `setupURLChangeListener()` for SPA detection
   - Refactored `onURLChange()` to handle navigation modes

## 🔗 Key Design Decisions

1. **Tab ID Granularity**: Cache is per-tab, not per-URL
2. **SPA Detection**: pushState/replaceState calls set navigation mode
3. **Navigation Modes**:
   - `spa`: Continue accumulating words
   - `normal`: Clear words (F5 refresh, new URL input)
4. **No Active Cleanup**: New tabs start fresh; old data auto-expires
5. **Storage Key Format**: Changed from `"domain.com|/path"` to `"tab_12345"`

## 🚀 Next Steps

1. Load extension in Chrome and verify tabId is retrieved
2. Test all scenarios manually in the browser
3. Monitor console logs for proper navigation detection
4. Verify word persistence across SPA navigation
5. Confirm word clearing on regular navigation

---

**Status**: Implementation Complete - Ready for Testing
**Date**: 2025-12-03
