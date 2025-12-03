# BFCache & Navigation Lifecycle - Implementation Notes

## 📋 What Changed

### From

```javascript
// OLD: Only handled SPA and popstate
window.addEventListener('popstate', () => {
  this.onURLChange();  // Always cleared words, even for bfcache restore
});

window.addEventListener('beforeunload', () => {
  // Just logged, didn't actually clear anything
});
```

### To

```javascript
// NEW: Properly handles all navigation scenarios
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // BFCache restore: keep existing wordState
    this.renderWordList();
  } else {
    // Fresh load: clear wordState
    this.wordState = {};
    this.jumpIndex = {};
    this.renderWordList();
  }
});

window.addEventListener('beforeunload', () => {
  // Mark page as unloading for refresh detection
  sessionStorage.setItem('mixread_page_unloading', 'true');
});
```

---

## 🎯 Why BFCache Matters

### Performance Impact

**With BFCache (Back/Forward with cache)**:
```
User clicks back button
    ↓
Browser restores page from memory (bfcache)
    ↓
pageshow fires with persisted=true
    ↓
Sidebar state is kept (no re-rendering needed)
    ↓
Result: ~50-100ms instant restoration ⚡
```

**Without BFCache (Full reload)**:
```
User clicks back button
    ↓
Browser has to reload entire page
    ↓
Resources re-downloaded
    ↓
Scripts re-execute
    ↓
pageshow fires with persisted=false
    ↓
Sidebar clears and repopulates
    ↓
Result: ~1-2 seconds (much slower) 🐌
```

---

## 🔄 Event Flow Diagram

### Scenario 1: F5 Refresh

```
beforeunload event
  └─ sessionStorage.setItem('mixread_page_unloading', 'true')

pagehide event (persisted=false)
  └─ Page is being unloaded

Page reloads...

pageshow event (persisted=false)
  └─ [SidebarPanel] Page loaded fresh - clearing wordState
  └─ this.wordState = {}
  └─ this.renderWordList()

Highlights reappear
  └─ onNewWordsHighlighted() populates wordState
```

### Scenario 2: SPA Navigation

```
history.pushState() is called
  └─ [SidebarPanel] pushState detected - marking as SPA navigation
  └─ this.navigationMode = 'spa'

setTimeout(() => this.onURLChange(), 50)
  └─ [SidebarPanel] SPA navigation detected - continuing to accumulate words
  └─ navigationMode === 'spa' → return (don't clear)

Highlights update
  └─ onNewWordsHighlighted() merges new words into existing wordState
```

### Scenario 3: Back Button (BFCache)

```
Browser detects back button
  └─ Page is in bfcache

pagehide event (persisted=true)
  └─ [SidebarPanel] Page entering bfcache - state will be preserved

Page transitions to new page...

User clicks back again

pageshow event (persisted=true)
  └─ [SidebarPanel] Page restored from bfcache - keeping wordState
  └─ this.renderWordList()  (re-render with same wordState)
  └─ NO clearing, NO re-fetching
```

### Scenario 4: Back Button (No BFCache)

```
Browser detects back button
  └─ Page is NOT in bfcache

pagehide event (persisted=false)
  └─ [SidebarPanel] Page being unloaded

Page reloads...

pageshow event (persisted=false)
  └─ [SidebarPanel] Page loaded fresh - clearing wordState
  └─ this.wordState = {}
```

---

## 🔑 Key Concepts

### 1. BFCache (Back-Forward Cache)

**What it is**:
- Browser feature that caches entire page state in memory
- When user navigates back/forward, browser restores from cache instead of reloading
- Requires page to be "bfcache-eligible"

**pageshow event's persisted flag**:
- `event.persisted === true`: Page is being restored from bfcache
- `event.persisted === false`: Page is being loaded fresh (first visit or bfcache unavailable)

**Our usage**:
```javascript
if (event.persisted) {
  // Page state already in memory, just restore UI
  this.renderWordList();  // Keep existing wordState
} else {
  // Page is loading fresh, start clean
  this.wordState = {};
  this.renderWordList();
}
```

### 2. Navigation Modes

**SPA Navigation** (single-page app):
- Uses `history.pushState()` or `history.replaceState()`
- URL changes but page doesn't reload
- Our sidebar should **accumulate** words across SPA navigation

**Regular Navigation**:
- User clicks link, types new URL, or presses refresh
- Page reloads completely
- Our sidebar should **clear** words and start fresh

**Detection**:
```javascript
// Intercept pushState/replaceState
history.pushState = (...args) => {
  this.navigationMode = 'spa';  // Mark for SPA handling
  originalPushState.apply(history, args);
};
```

### 3. Refresh Types

All these trigger the same sequence:
- F5 key
- Ctrl+R (Windows/Linux) or Cmd+R (Mac)
- Browser refresh button (🔄)
- Ctrl+Shift+R (hard refresh, clears browser cache)

**Our detection**:
```javascript
// beforeunload marks the page as unloading
window.addEventListener('beforeunload', () => {
  sessionStorage.setItem('mixread_page_unloading', 'true');
});

// pageshow confirms fresh load
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) {  // persisted=false means fresh load
    this.wordState = {};
  }
});
```

### 4. Multi-Tab Isolation

Each tab has its own:
- **TabId**: Retrieved via `GET_TAB_ID` message to background.js
- **Cache Key**: Stored as `tab_12345` format
- **WordState**: Completely separate from other tabs

```javascript
// Each tab gets unique tabId from sender.tab.id
const tabId = sender.tab.id;

// Cache is per-tab
const cacheKey = `tab_${tabId}`;
await this.cacheManager.getFromCache(cacheKey, userId);
```

---

## 🔗 How They Work Together

```
User Session Flow:
═════════════════════════════════════════════════════════════════

Tab 1: twitter.com
  1. pageshow (persisted=false) → Clear wordState ✓
  2. Highlights appear → Populate wordState
  3. Click link (SPA) → pushState → Accumulate words ✓
  4. Press back → pageshow (persisted=true) → Keep words ✓
  5. Press F5 → beforeunload + pageshow (persisted=false) → Clear ✓

Tab 2: github.com (parallel)
  1. pageshow (persisted=false) → Clear wordState ✓
  2. Highlights appear → Populate wordState
  3. DIFFERENT from Tab 1 (separate cache) ✓

Back to Tab 1:
  1. pageshow (persisted=true) → Keep Tab 1's words ✓
  2. Tab 1's original words restored, Tab 2's words hidden ✓
```

---

## 🚨 Edge Cases Handled

### Case 1: Rapid Navigation

```
User quickly clicks multiple links (SPA):
  pushState → pushState → pushState

Each triggers:
  this.navigationMode = 'spa'
  onURLChange() → check navigationMode → accumulate

Result: All words accumulate correctly ✓
```

### Case 2: SPA then Regular Nav

```
SPA navigation → then refresh

pushState sets navigationMode = 'spa'
  → onURLChange() accumulates

beforeunload triggers
  → sessionStorage marks as unloading

pageshow (persisted=false) triggers
  → Clears wordState ✓
  → navigationMode reset doesn't matter
```

### Case 3: Rapid Back/Forward

```
Back → Forward → Back → Forward

Each triggers pageshow with correct persisted flag

bfcache toggles between:
  persisted=true (restore state)
  persisted=false (clear state)

DOM is always in sync ✓
```

### Case 4: New Tab vs Tab Reopen

```
Close Tab 1 (had tabId=123)
  → Old cache data remains in storage

Open new tab, go to same URL
  → New tabId=456 (different from 123)
  → New cache key: tab_456
  → No access to old cache

Result: Fresh start for new tab ✓
```

---

## 📊 Event Timeline Example

### Complete User Journey

```
TIME    EVENT                          ACTION                  SIDEBAR STATE
────    ─────────────────────────────  ─────────────────────  ──────────────
0:00    User opens Tab 1 (twitter)
        pageshow (persisted=false)     Clear wordState        Empty
        Highlights appear              Populate words         Shows 5 words

0:05    User clicks tweet (SPA)
        pushState triggered            Mark as SPA
        New highlights appear          Accumulate words       Shows 8 words

0:10    User clicks back button
        pageshow (persisted=true)      Keep wordState         Shows 8 words
        Page restored from bfcache     Render sidebar         (instant)

0:15    User opens Tab 2 (github)
        pageshow (persisted=false)     Clear wordState        Empty
        Highlights appear              Populate words         Shows 6 words

0:20    User switches to Tab 1
        pageshow (persisted=true)      Keep wordState         Shows 8 words
        (from bfcache)                 Restore sidebar        (instant)

0:25    User presses F5 on Tab 1
        beforeunload                   Mark unloading
        pagehide (persisted=false)     Page unloading
        pageshow (persisted=false)     Clear wordState        Empty
        New highlights appear          Populate words         Shows 4 words
```

---

## ✅ Testing Verification Checklist

- [ ] `pageshow` event fires on each page load
- [ ] `event.persisted` is `true` for bfcache restores
- [ ] `event.persisted` is `false` for fresh loads
- [ ] `beforeunload` marks page unloading
- [ ] SPA navigation accumulates (not clears)
- [ ] Regular navigation clears words
- [ ] Back button restores state (when bfcache available)
- [ ] Multi-tab has different tabIds
- [ ] Multi-tab cache is separate
- [ ] Console logs are accurate
- [ ] Sidebar renders correctly in all scenarios

---

## 🔗 Related Files

- **sidebar-panel.js**: Main implementation
  - Line 813-829: pageshow listener
  - Line 831-838: pagehide listener
  - Line 845-858: SPA detection (pushState/replaceState)
  - Line 863-866: beforeunload listener
  - Line 55-66: init() checks refresh flag

- **word-cache-manager.js**: Cache storage
  - Line 51-57: getTabCacheKey() for tabId caching

- **background.js**: Tab ID provider
  - Line 98-100: GET_TAB_ID handler
  - Line 315-333: handleGetTabId() function

---

## 📚 Additional Resources

**Browser APIs Used**:
- `pageshow` event: MDN - https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event
- `pagehide` event: MDN - https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event
- `beforeunload` event: MDN - https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
- `sessionStorage`: MDN - https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage

**BFCache**:
- Chrome DevTools BFCache Debugging: https://developer.chrome.com/blog/bfcache/
- Mozilla BFCache: https://firefox-source-docs.mozilla.org/dom/bfcache.html

