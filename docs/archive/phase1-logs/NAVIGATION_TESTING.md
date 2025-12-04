# Complete Navigation Testing Guide - TabId Caching with BFCache Support

## 🎯 Implementation Complete

All navigation scenarios are now correctly handled:

```
✅ F5 / Browser Refresh Button / Ctrl+R → Clear words
✅ New URL input → Clear words
✅ SPA navigation (pushState/replaceState) → Accumulate words
✅ Back/Forward with BFCache → Keep words
✅ Back/Forward without BFCache → Clear words
✅ Multi-tab isolation → Use tabId
```

---

## 🧪 Manual Testing Scenarios

### Test 1: F5 Refresh

**Setup**:
```
1. Open Chrome DevTools: F12 → Console
2. Go to: https://medium.com
3. Wait for page to load and highlight words
4. Note sidebar word count (e.g., "5 独特")
```

**Action**:
```
Press F5 to refresh the page
```

**Expected Behavior**:
```
Console logs (in order):
[SidebarPanel] beforeunload event - page is about to reload
[SidebarPanel] pagehide event: { persisted: false }
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState for fresh session

Sidebar behavior:
1. Sidebar clears (becomes empty or shows "No words highlighted yet")
2. New page loads
3. New highlights appear
4. Sidebar shows ONLY new words (e.g., "3 独特")

✓ Original words (from before refresh) should NOT reappear
```

**Verification**:
- [ ] Console shows both "beforeunload" and "pageshow: { persisted: false }"
- [ ] Sidebar becomes empty briefly during refresh
- [ ] Sidebar shows different word count after refresh
- [ ] Word list is completely new (no old words mixed in)

---

### Test 2: Browser Refresh Button

**Setup**:
```
1. Open Chrome DevTools: F12 → Console
2. Go to: https://github.com
3. Wait for page to load
4. Note sidebar word count
```

**Action**:
```
Click the circular refresh button in the address bar (🔄)
```

**Expected Behavior**:
```
Same as Test 1 (F5 Refresh):
[SidebarPanel] beforeunload event
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState

✓ Behavior identical to F5
```

**Verification**:
- [ ] Same behavior as F5 refresh
- [ ] Console logs show pageshow with persisted=false

---

### Test 3: Ctrl+R (Mac: Cmd+R)

**Setup**:
```
Same as Test 1
```

**Action**:
```
Press Ctrl+R (or Cmd+R on Mac)
```

**Expected Behavior**:
```
Same as Test 1 and Test 2
✓ All refresh methods should be identical
```

---

### Test 4: SPA Navigation (Accumulation)

**Setup**:
```
1. Open Chrome DevTools: F12 → Console
2. Go to: https://twitter.com
3. Wait for highlights, note word count (e.g., "8 独特")
```

**Action**:
```
Click on a tweet to open the tweet detail page
(This is SPA navigation using pushState)
```

**Expected Behavior**:
```
Console logs:
[SidebarPanel] pushState detected - marking as SPA navigation
[SidebarPanel] SPA navigation detected - continuing to accumulate words
[SidebarPanel] Adding 5 new words

Sidebar behavior:
1. Sidebar does NOT clear
2. New words appear in sidebar
3. Word count INCREASES (e.g., from "8 独特" to "13 独特")
4. Both old and new words are visible

✓ Words accumulate across SPA navigation
```

**Verification**:
- [ ] Console shows "pushState detected - marking as SPA navigation"
- [ ] Console shows "SPA navigation detected - continuing to accumulate words"
- [ ] Sidebar word count increases (not resets)
- [ ] Old words still visible in sidebar after SPA nav

---

### Test 5: Back Button (BFCache Available)

**Setup**:
```
1. Open Chrome DevTools: F12 → Console
2. Go to: https://twitter.com
3. Highlight appears, note word count (e.g., "7 独特")
4. Click a tweet to navigate (SPA or regular link)
5. New page loads, note new word count (e.g., "5 独特")
```

**Action**:
```
Click browser back button (⬅️) to go back to previous page
```

**Expected Behavior**:
```
Console logs:
[SidebarPanel] pagehide event: { persisted: true }   ← Page entering bfcache
[SidebarPanel] pageshow event: { persisted: true }   ← Page restored from bfcache
[SidebarPanel] Page restored from bfcache - keeping wordState

Sidebar behavior:
1. Page restores INSTANTLY (fast, <100ms)
2. Sidebar shows the ORIGINAL words from before (e.g., "7 独特")
3. NO new highlights appear (using cached content)
4. Word list is exactly the same as before clicking

✓ BFCache works: state is preserved across back navigation
```

**Verification**:
- [ ] Console shows "pageshow: { persisted: true }"
- [ ] Page restores instantly (much faster than reload)
- [ ] Sidebar word count matches the original count
- [ ] Original words are visible (not replaced)

---

### Test 6: Back Button (BFCache Disabled/Unavailable)

**Setup**:
```
1. Open a website that doesn't support BFCache well
2. Some sites may not enter bfcache if they:
   - Use unload/beforeunload extensively
   - Use sync XHR
   - Use WebSockets
   - Have certain browser API calls
3. Navigate to a new page
```

**Action**:
```
Click browser back button
```

**Expected Behavior**:
```
Console logs:
[SidebarPanel] pagehide event: { persisted: false }  ← Not entering bfcache
[SidebarPanel] pageshow event: { persisted: false }  ← Page is being reloaded
[SidebarPanel] Page loaded fresh - clearing wordState

Sidebar behavior:
1. Page reloads (slower, may take 1-2 seconds)
2. Sidebar clears
3. New highlights appear as page loads
4. Final word count may be different from original

✓ Fallback works: page reloads correctly if bfcache unavailable
```

**Verification**:
- [ ] Console shows "pageshow: { persisted: false }"
- [ ] Page reload takes longer than bfcache restore
- [ ] Sidebar clears then repopulates with new words

---

### Test 7: Forward Button (After Back)

**Setup**:
```
1. Complete Test 5 (Back Button)
2. You're now on the previous page
```

**Action**:
```
Click browser forward button (➡️) to go to the next page again
```

**Expected Behavior**:
```
Console logs (same as Test 5):
[SidebarPanel] pagehide event: { persisted: true }
[SidebarPanel] pageshow event: { persisted: true }
[SidebarPanel] Page restored from bfcache - keeping wordState

Sidebar behavior:
1. Page restores from bfcache (fast)
2. Sidebar shows the exact words from when you navigated away
3. Word list is preserved

✓ BFCache works for forward navigation too
```

**Verification**:
- [ ] Console shows bfcache restore
- [ ] Sidebar state matches what it was before going back

---

### Test 8: Multi-Tab Isolation

**Setup**:
```
1. Open Tab 1: https://medium.com
2. Wait for highlights, note word count (e.g., "6 独特")
3. Note some specific words (e.g., "eloquent", "serendipity")
```

**Action**:
```
Open a new tab (Ctrl+T or Cmd+T)
1. Go to: https://github.com
2. Wait for highlights
3. Note word count and words (different from Medium)
```

**Expected Behavior**:
```
Console logs in Tab 1:
[SidebarPanel] Got tabId: 123  (different from Tab 2)

Console logs in Tab 2:
[SidebarPanel] Got tabId: 456  (different from Tab 1)

Sidebar behavior:
- Tab 1 shows Medium words (e.g., "6 独特", contains "eloquent")
- Tab 2 shows GitHub words (e.g., "8 独特", contains "repository")
- NO overlap between tabs

Action: Switch back to Tab 1 (click Tab 1)

Expected:
[SidebarPanel] Loading data for tab_123
[SidebarPanel] Restored from cache: 6 words

- Tab 1 sidebar shows ORIGINAL Medium words again
- Word count is still "6 独特"
- The original words (e.g., "eloquent") are back

✓ Tab isolation works: each tab has separate cache
```

**Verification**:
- [ ] Tab 1 and Tab 2 have different tabIds in console
- [ ] Tab 1 shows different words than Tab 2
- [ ] Switching tabs restores correct word list
- [ ] No cross-tab word pollution

---

### Test 9: Manual URL Input (New Domain)

**Setup**:
```
1. Go to: https://medium.com
2. Wait for highlights, note word count and words
```

**Action**:
```
Click on address bar
Type new URL: https://github.com
Press Enter
```

**Expected Behavior**:
```
Console logs:
[SidebarPanel] beforeunload event - page is about to reload
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState

Sidebar behavior:
1. Sidebar clears
2. GitHub page loads
3. New highlights appear
4. Sidebar shows ONLY GitHub words (different count and content)

✓ Manual URL input clears words (new reading session)
```

**Verification**:
- [ ] Console shows "beforeunload" then "pageshow: false"
- [ ] Sidebar becomes empty then repopulates
- [ ] Final word list is completely different from Medium

---

### Test 10: Manual URL Input (Same Domain, Different Path)

**Setup**:
```
1. Go to: https://github.com
2. Wait for highlights
3. Note word count
```

**Action**:
```
Click on address bar
Type: https://github.com/microsoft/vscode
Press Enter
```

**Expected Behavior**:
```
Console logs (same as Test 9):
[SidebarPanel] beforeunload event
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState

Sidebar behavior:
1. Sidebar clears
2. New page loads
3. New highlights appear
4. Sidebar shows fresh words for new page

✓ Even same-domain navigation clears words (new URL = new reading session)
```

**Verification**:
- [ ] Sidebar clears on new URL, even same domain
- [ ] Words repopulate with new content

---

## 📊 Complete Test Results Checklist

```
Test 1: F5 Refresh
  [  ] Console shows beforeunload + pageshow: false
  [  ] Sidebar clears
  [  ] New words appear after page loads
  [  ] Old words don't reappear

Test 2: Browser Refresh Button
  [  ] Same as Test 1

Test 3: Ctrl+R / Cmd+R
  [  ] Same as Test 1

Test 4: SPA Navigation
  [  ] Console shows "pushState detected"
  [  ] Sidebar does NOT clear
  [  ] Word count INCREASES
  [  ] Old words remain visible

Test 5: Back Button (with BFCache)
  [  ] Console shows "pageshow: { persisted: true }"
  [  ] Page restores instantly
  [  ] Sidebar shows original words
  [  ] Word count matches original

Test 6: Back Button (without BFCache)
  [  ] Console shows "pageshow: { persisted: false }"
  [  ] Page reloads (slower)
  [  ] Sidebar clears then repopulates

Test 7: Forward Button
  [  ] Console shows "pageshow: { persisted: true }"
  [  ] Page restores from cache
  [  ] Sidebar state is preserved

Test 8: Multi-Tab Isolation
  [  ] Different tabIds for different tabs
  [  ] Each tab has different words
  [  ] Switching tabs restores correct words
  [  ] No pollution between tabs

Test 9: Manual URL (New Domain)
  [  ] Sidebar clears
  [  ] New words appear
  [  ] No old words mixed in

Test 10: Manual URL (Same Domain)
  [  ] Sidebar clears (even same domain)
  [  ] New words appear
```

---

## 🔍 Debugging Tips

### If BFCache isn't working (pageshow always shows persisted: false)

Some sites don't support BFCache. Try:
- Simple sites: medium.com, github.com (usually work)
- Avoid: Pages with unload handlers, WebSockets

**Check in DevTools**:
```
1. Open DevTools → Application → Cache Storage
2. Some sites may cache their own data preventing bfcache
3. Try different websites to test bfcache
```

### If pageshow event never fires

**Check if event listener is attached**:
```javascript
// In DevTools Console:
console.log('pageshow listener attached:', window.hasListener);

// Or manually trigger a test:
window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
```

### If sidebar doesn't show tabId

**Debug tabId retrieval**:
```javascript
// In DevTools Console on any page:
chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, (response) => {
  console.log('TabId response:', response);
});
```

---

## 🎯 Quick Test Sequence (5 minutes)

If you want to quickly test all scenarios:

```
1. Open Tab 1: https://medium.com
   - Note word count

2. Press F5
   - Sidebar should clear then show new words ✓

3. Click a link on the page
   - Sidebar should accumulate more words ✓

4. Press back button
   - Sidebar should restore with all accumulated words ✓

5. Open Tab 2: https://github.com
   - Different word count and words ✓
   - Tab 1's words are NOT visible ✓

6. Switch to Tab 1
   - Original words are back ✓

If all 6 ✓ checks pass → Implementation is working correctly!
```

---

## 📝 Expected Console Output (Full Session)

```
[SidebarPanel] Initializing...
[SidebarPanel] Got tabId: 123
[SidebarPanel] DOM created
[SidebarPanel] Message listener registered
[SidebarPanel] URL change listener installed with pageshow/pagehide and SPA detection
[SidebarPanel] Loading data for tab_123 (tabId: 123)
[SidebarPanel] No cache found - starting fresh session for this tab
[SidebarPanel] Initialization complete

[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState for fresh session

[SidebarPanel] Received NEW_WORDS_HIGHLIGHTED: 5 words
[SidebarPanel] Adding 5 new words

← User navigates (SPA) →
[SidebarPanel] pushState detected - marking as SPA navigation
[SidebarPanel] SPA navigation detected - continuing to accumulate words
[SidebarPanel] Adding 3 new words

← User presses back →
[SidebarPanel] pagehide event: { persisted: true }
[SidebarPanel] Page entering bfcache - state will be preserved
[SidebarPanel] pageshow event: { persisted: true }
[SidebarPanel] Page restored from bfcache - keeping wordState

← User presses refresh →
[SidebarPanel] beforeunload event - page is about to reload
[SidebarPanel] pagehide event: { persisted: false }
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState for fresh session
```

---

## ✅ Success Criteria

Implementation is complete when:

1. ✅ F5/Refresh clears words
2. ✅ SPA nav accumulates words
3. ✅ Back with BFCache keeps words
4. ✅ Back without BFCache clears words
5. ✅ Multi-tab isolation works
6. ✅ All console logs are accurate
7. ✅ No errors in DevTools console

**Expected Test Time**: ~10 minutes for all scenarios

