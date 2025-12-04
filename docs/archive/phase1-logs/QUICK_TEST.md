# Quick Navigation Testing - 5 Minutes

## ⚡ Fast Track Testing

If you only have 5 minutes, do this quick sequence:

### Preparation (1 minute)

```
1. Load extension in Chrome
   - Go to chrome://extensions
   - Load unpacked → select frontend folder
   - Look for no errors

2. Open DevTools
   - F12 → Console tab
   - Keep DevTools visible for entire test
```

### Test Sequence (4 minutes)

#### Step 1: Initial Load (1 minute)
```
1. Go to: https://medium.com
2. Wait for page to fully load
3. Note sidebar word count (e.g., "5 词汇")
4. Look for these console logs:
   ✓ [SidebarPanel] Got tabId: XXXX
   ✓ [SidebarPanel] pageshow event: { persisted: false }
   ✓ [SidebarPanel] Initialization complete

RESULT: Initial load works
```

#### Step 2: F5 Refresh (1 minute)
```
1. Press F5 to refresh
2. Note console logs:
   ✓ [SidebarPanel] beforeunload event
   ✓ [SidebarPanel] pageshow event: { persisted: false }
   ✓ [SidebarPanel] Page loaded fresh - clearing wordState

3. Sidebar should:
   ✓ Become empty briefly
   ✓ Show different word count (new content)

RESULT: Refresh clears words correctly
```

#### Step 3: SPA Navigation (1 minute)
```
1. Click a link on Medium (any article link)
2. This uses SPA navigation (pushState)
3. Check console:
   ✓ [SidebarPanel] pushState detected
   ✓ [SidebarPanel] SPA navigation detected - continuing to accumulate

4. Sidebar should:
   ✓ NOT clear
   ✓ Show MORE words (accumulated)

RESULT: SPA navigation accumulates words correctly
```

#### Step 4: Back Button (1 minute)
```
1. Click browser back button (⬅️)
2. Check console:
   ✓ [SidebarPanel] pageshow event: { persisted: true or false }

3. If persisted=true (BFCache):
   ✓ Page restores instantly
   ✓ Sidebar shows accumulated words from Step 3
   ✓ Should be faster than F5 refresh

4. If persisted=false (No BFCache):
   ✓ Page reloads (slower)
   ✓ Sidebar clears then repopulates
   ✓ Still works, just slower

RESULT: Back button works correctly
```

---

## ✅ Quick Pass/Fail Checklist

```
[ ] Step 1: Initial load shows tabId in console
[ ] Step 2: F5 refresh shows "pageshow: false" and clears sidebar
[ ] Step 3: SPA nav shows "pushState detected" and accumulates words
[ ] Step 4: Back button works (either bfcache=true or false)

If ALL 4 checked → PASS ✓
If ANY unchecked → FAIL ✗
```

---

## 🔍 Quick Debug

### If Step 1 fails (no tabId)
```
Problem: [SidebarPanel] Got tabId: null

Solution:
1. Check if chrome.runtime.sendMessage works
2. Verify background.js has handleGetTabId function
3. Check Network tab → no CORS errors
```

### If Step 2 fails (F5 doesn't clear)
```
Problem: Sidebar still shows old words after F5

Solution:
1. Check console for "pageshow event"
2. Verify persisted=false is shown
3. Check if wordState={} is called
```

### If Step 3 fails (SPA doesn't accumulate)
```
Problem: Sidebar clears on SPA navigation

Solution:
1. Check console for "pushState detected"
2. Verify navigationMode is set to 'spa'
3. Check if onURLChange skips clearing
```

### If Step 4 fails (Back doesn't work)
```
Problem: Back button doesn't restore or always clears

Solution:
1. Check if pageshow event fires
2. Check persisted flag value
3. Try a simpler site (medium.com) that supports bfcache
```

---

## 📊 Expected Console Output

```
Successful sequence should show:

[SidebarPanel] Got tabId: 123
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Initialization complete
[SidebarPanel] Adding 5 new words

[SidebarPanel] beforeunload event
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState
[SidebarPanel] Adding 4 new words

[SidebarPanel] pushState detected
[SidebarPanel] SPA navigation detected - continuing to accumulate
[SidebarPanel] Adding 3 new words

[SidebarPanel] pageshow event: { persisted: true }
[SidebarPanel] Page restored from bfcache - keeping wordState
```

---

## ⏱️ Time Budget

- Preparation: 1 minute
- Step 1 (Initial load): 1 minute
- Step 2 (F5 refresh): 1 minute
- Step 3 (SPA nav): 1 minute
- Step 4 (Back button): 1 minute
- **Total**: 5 minutes

---

## ✨ Success Criteria

**PASS if**:
- ✓ All 4 steps complete without errors
- ✓ Console shows expected log messages
- ✓ Sidebar behaves correctly in each scenario
- ✓ No JavaScript errors in DevTools

**FAIL if**:
- ✗ TabId is null
- ✗ F5 doesn't clear sidebar
- ✗ SPA nav clears sidebar
- ✗ Back button doesn't work

