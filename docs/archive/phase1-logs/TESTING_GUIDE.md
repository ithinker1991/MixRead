# TabId Caching - Manual Testing Guide

## 🚀 Quick Start Testing

### Step 1: Load Extension in Chrome

```
1. Open Chrome
2. Go to chrome://extensions
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select: /Users/yinshucheng/code/creo/MixRead/frontend
```

### Step 2: Verify Initialization

```
1. Go to any website (e.g., medium.com)
2. Open DevTools: F12 → Console tab
3. Look for these logs:
   ✓ [SidebarPanel] Got tabId: XXXX (e.g., 12345)
   ✓ [Background] Returning tab ID: XXXX
   ✓ [SidebarPanel] Initialization complete
```

If you see `Got tabId: null`, something is wrong with the tab ID retrieval.

---

## 🧪 Test Scenarios

### Test A: Multi-Tab Isolation

**Goal**: Verify different tabs don't share word lists

**Steps**:
```
1. Open Tab 1: https://medium.com
   - Let page load and highlight words
   - Check sidebar: shows word list (e.g., "serendipity", "eloquent")
   - Note the word count

2. Open Tab 2 (new tab): https://github.com
   - Let page load and highlight words
   - Check sidebar: shows DIFFERENT words (GitHub/tech words)
   - Should NOT contain the words from Tab 1

3. Switch back to Tab 1
   - Check sidebar: should restore the ORIGINAL words from Step 1
   - This confirms tab-level caching is working

**Expected Result**:
✓ Each tab has its own separate word list
✓ Switching tabs restores the correct word list
```

**Console Check**:
```
When switching tabs, you should see:
[SidebarPanel] Loading data for tab_12345 (tabId: 12345)
[SidebarPanel] Restored from cache: N words
```

---

### Test B: SPA Navigation (Accumulation)

**Goal**: Verify SPA navigation accumulates words in same tab

**Steps**:
```
1. Open Twitter: https://twitter.com
   - Let page load, note sidebar word count (e.g., 5 words)

2. Click on a tweet (stays on same tab, SPA navigation)
   - Check DevTools console:
     ✓ [SidebarPanel] pushState detected - marking as SPA navigation
     ✓ [SidebarPanel] SPA navigation detected - continuing to accumulate words
   - Check sidebar: word count INCREASES (e.g., now 8 words)
   - This shows words are accumulating, not clearing

3. Click back (browser back button)
   - Check console:
     ✓ [SidebarPanel] Popstate event detected
     ✓ [SidebarPanel] SPA navigation detected - continuing to accumulate words
   - Check sidebar: still shows accumulated words (e.g., 8 words)

**Expected Result**:
✓ SPA navigation detected via pushState/replaceState
✓ Words continue to accumulate across page navigation
✓ Sidebar shows total of all words encountered in session
```

**Console Check**:
```
Should NOT see "clearing words" - only "continuing to accumulate"
```

---

### Test C: F5 Refresh (Clear)

**Goal**: Verify F5 refresh clears words

**Steps**:
```
1. Open any article page: https://example.com/article
   - Let page load and highlight words
   - Check sidebar: shows word list (e.g., 10 words)
   - Note some words visible

2. Press F5 (refresh)
   - Check DevTools console:
     ✓ [SidebarPanel] Non-SPA navigation detected (F5 refresh...) - clearing words
   - Check sidebar: appears EMPTY or shows "No words highlighted yet"

3. Wait for page to fully load
   - New highlights appear
   - Check sidebar: shows ONLY new words (e.g., 5 words)
   - Original words should NOT reappear

**Expected Result**:
✓ F5 triggers word clearing
✓ After refresh, only new words appear
✓ No carryover of pre-refresh words
```

**Console Check**:
```
Should see:
[SidebarPanel] Non-SPA navigation detected (F5 refresh or new URL input) - clearing words
[SidebarPanel] Words cleared, ready for new content
```

---

### Test D: Manual URL Input (Clear)

**Goal**: Verify typing new URL in address bar clears words

**Steps**:
```
1. Open Tab: https://medium.com
   - Let page load and highlight words
   - Check sidebar: shows words (e.g., 8 words)
   - Note the word list

2. Click address bar and type: https://github.com
   - Press Enter
   - Check DevTools console:
     ✓ [SidebarPanel] Non-SPA navigation detected... - clearing words
   - Check sidebar: appears EMPTY during navigation

3. Wait for github.com to load
   - New highlights appear (GitHub-related words)
   - Check sidebar: shows DIFFERENT words (tech vocabulary)
   - Old Medium words should NOT be visible

**Expected Result**:
✓ Manual URL input triggers word clearing
✓ New website shows only its own words
✓ No pollution from previous site
```

**Console Check**:
```
Sequence should be:
[SidebarPanel] Non-SPA navigation detected
[SidebarPanel] Words cleared, ready for new content
[SidebarPanel] Loading data for tab_12345 (tabId: 12345)
```

---

## 🔍 Debugging Tips

### If tabId is null

```javascript
// Check in DevTools Console:
console.log('Chrome API available:', typeof chrome !== 'undefined');
console.log('Runtime API available:', typeof chrome.runtime !== 'undefined');

// The tab ID request might be failing
// Look for: "[SidebarPanel] Failed to get tabId:"
```

### If words don't clear on F5

```javascript
// Check navigation mode detection
// Search console for: "pushState detected" or "Non-SPA navigation detected"

// If you see "SPA navigation detected" for F5, something is wrong with detection logic
```

### If words don't accumulate on SPA nav

```javascript
// Verify the site uses pushState/replaceState
// Open site's console and check if page navigation uses history API
// Some sites use full page reload instead of SPA

// Check console for: "pushState detected" or "replaceState detected"
```

### If sidebar is empty on first load

```javascript
// Check:
1. Did highlights appear on the page?
   - Look for yellow background on difficult words
   - If no highlights, the API might not be working

2. Check console for API errors:
   - [Background] API Response received
   - If "Cache MISS", that's expected for first visit

3. Check if userStore has a valid userId
   - The sidebar won't show if userId is missing
```

---

## 📊 Expected Console Output

### Good (Successful Init)
```
[SidebarPanel] Initializing...
[SidebarPanel] Got tabId: 12345
[SidebarPanel] Initializing Batch Marking Panel...
[SidebarPanel] DOM created
[SidebarPanel] Scroll handlers attached
[SidebarPanel] Rectangle selection listeners attached
[SidebarPanel] Message listener registered
[SidebarPanel] URL change listener installed with SPA detection
[SidebarPanel] Loading data for tab_12345 (tabId: 12345)
[SidebarPanel] No cache found - starting fresh session for this tab
[SidebarPanel] Initialization complete
```

### Multi-Tab Switch
```
// User opens new tab
[SidebarPanel] Got tabId: 54321  (← Different tabId!)
[SidebarPanel] Loading data for tab_54321 (tabId: 54321)
[SidebarPanel] Restored from cache: 5 words  (← Different tab's words!)

// User switches back to original tab
[SidebarPanel] Got tabId: 12345  (← Back to original tabId)
[SidebarPanel] Loading data for tab_12345 (tabId: 12345)
[SidebarPanel] Restored from cache: 8 words  (← Original tab's words restored!)
```

### SPA Navigation
```
[SidebarPanel] pushState detected - marking as SPA navigation
[SidebarPanel] SPA navigation detected - continuing to accumulate words
[SidebarPanel] Adding 3 new words
[SidebarPanel] Rendered 11 words (accumulated!)
```

### F5 Refresh
```
[SidebarPanel] Non-SPA navigation detected (F5 refresh or new URL input) - clearing words
[SidebarPanel] Words cleared, ready for new content
[SidebarPanel] Adding 5 new words (fresh set!)
```

---

## ✅ Final Checklist

- [ ] Extension loads without errors
- [ ] TabId is retrieved successfully (not null)
- [ ] Multi-tab isolation works (Test A passes)
- [ ] SPA navigation accumulates words (Test B passes)
- [ ] F5 refresh clears words (Test C passes)
- [ ] Manual URL clears words (Test D passes)
- [ ] Console logs make sense
- [ ] No cross-tab word pollution observed
- [ ] Sidebar updates correctly for all scenarios

---

**If all checks pass**: Implementation is working correctly! ✓

**If any check fails**:
1. Check the console for specific error messages
2. Verify the file changes using the IMPLEMENTATION_SUMMARY.md
3. Check browser DevTools Network tab for API errors
4. Verify userStore is initialized with a valid userId
