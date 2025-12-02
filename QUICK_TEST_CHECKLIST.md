# Quick Test Checklist - Extension Context Invalidation Fixes

**Goal**: Verify that all "Extension context invalidated" errors are fixed

**Time to complete**: ~5 minutes

## Pre-Test Setup

1. Load unpacked extension in Chrome: `chrome://extensions → Load unpacked → select frontend/ folder`
2. Open DevTools on any webpage: `F12`
3. Switch to Console tab

## Test 1: Check for Errors (30 seconds)

```javascript
// Run this in Chrome DevTools console
const checker = new FrontendCodeQualityChecker();
const results = checker.runAllChecks();
```

**Expected output**:
- ✅ Pass rate > 80%
- ✅ No critical errors about "Extension context"
- ✅ All globals defined
- ✅ All DOM elements loaded

**If you see failures**, check TESTING_GUIDE.md for diagnostics

---

## Test 2: Extension Reload Scenario (1 minute)

This is the critical test - it simulates the scenario that was causing errors.

1. Open the extension popup
2. Open DevTools and go to Console tab
3. Reload extension: `chrome://extensions → find MixRead → click refresh icon`
4. Watch console for 5 seconds

**Expected result**:
- ✅ No red error messages
- ✅ No "Extension context invalidated" errors
- ✅ Popup still loads normally
- ✅ User selector dropdown works

**If errors appear**, take a screenshot and check:
- Are they in the ChromeAPI wrapper? (Expected - being handled)
- Or in user code? (Problem - needs fixing)

---

## Test 3: User Selection (1 minute)

1. Open extension popup
2. Locate the "User:" dropdown at the top
3. Click the dropdown

**Expected result**:
- ✅ Dropdown opens smoothly
- ✅ Shows existing users (if any)
- ✅ Can select a user
- ✅ User ID updates at bottom
- ✅ No console errors

**If dropdown doesn't work**:
- Check if users exist (create one with "+ New" button)
- Open DevTools console and run quality checker
- Check TESTING_GUIDE.md for detailed diagnostics

---

## Test 4: Domain Management (1.5 minutes)

1. Open extension popup
2. Click "Domains" tab
3. Try to add a domain:
   - Type "example.com" in input field
   - Click "Add" button

**Expected result**:
- ✅ Domain appears in blacklist immediately
- ✅ Count updates from 0 to 1
- ✅ No console errors
- ✅ Can click "Add Preset Domains" button

**If domain doesn't appear**:
- Check DevTools console for errors
- Verify user is selected
- Try refresh and test again

---

## Test 5: Mark Word as Known (1 minute)

1. Open any English webpage (e.g., https://github.com)
2. Right-click a highlighted word
3. Select "Mark as Known" from context menu

**Expected result**:
- ✅ Word is unhighlighted
- ✅ Console shows "Successfully marked as known"
- ✅ No "Extension context invalidated" error
- ✅ Page updates visibly

**If it fails**:
- Check console for errors
- Verify user is selected
- Look for context invalidation messages

---

## Test 6: Session Recording (1 minute)

Reading session recording is harder to test manually, but here's how:

1. Open a webpage in a tab with extension active
2. Read for 1-2 minutes (just have the tab visible)
3. Close the tab or navigate away

**Expected result**:
- ✅ No errors in console
- ✅ No "Extension context invalidated" messages
- ✅ Backend silently records session (check logs if running backend)

**If errors appear**:
- This is an async operation, so it might fail gracefully
- Check console warnings (not errors)

---

## Final Verification Checklist

Before declaring success, verify all these pass:

- [ ] Quality checker shows pass rate > 80%
- [ ] No red "Extension context invalidated" errors in console
- [ ] User dropdown works and shows users
- [ ] Domains tab switches correctly
- [ ] Can add/remove domains without errors
- [ ] Marking words as known works
- [ ] Popup loads after extension reload
- [ ] No JavaScript syntax errors

---

## If Something Fails

### Step 1: Capture Error Details
1. Take a screenshot of the console error
2. Copy the full error message
3. Note which test failed

### Step 2: Run Diagnostics
```javascript
// In console:
const checker = new FrontendCodeQualityChecker();
const results = checker.runAllChecks();
console.log(JSON.stringify(results, null, 2));
```

### Step 3: Check These Files
- **TESTING_GUIDE.md** - Comprehensive troubleshooting guide
- **CHROME_API_FIXES_VERIFICATION.md** - Technical details
- **code-quality-checker.js** - Automatically checks everything

### Step 4: Common Fixes
| Issue | Solution |
|-------|----------|
| User dropdown broken | Create a new user with "+ New" button |
| Domain management not working | Verify user is selected in dropdown |
| Words not highlighting | Check if user is selected and difficulty level is set |
| Extension won't load | Refresh in chrome://extensions |
| Persistent errors | Try removing and reloading extension |

---

## Expected Console Output

A healthy extension should show logs like:
```
[MixRead] Starting module initialization...
[MixRead] UserStore created
[MixRead] User initialized - ID: xxx, Difficulty: B1
[MixRead] Starting page highlighting...
[MixRead] Found 42 highlighted words
```

**NOT** like:
```
❌ Uncaught Error: Extension context invalidated
❌ Uncaught TypeError: Cannot read property 'get' of undefined
❌ chrome.storage is not available
```

---

## Performance Notes

After fixes, you should notice:
- ✅ Popup opens instantly (no lag)
- ✅ Tab switching happens immediately
- ✅ User selection is responsive
- ✅ Domain operations are instant
- ✅ Word highlighting completes in < 2 seconds

If things are slow, it's likely a different issue.

---

## Success Criteria

✅ **All tests pass** → Extension is working correctly

✅ **Most tests pass** → Minor issues, check specific failures

❌ **Many tests fail** → Major issue, run quality checker and check TESTING_GUIDE.md

---

## What Was Fixed

This test verifies fixes for these errors:
- ~~"Extension context invalidated" when reloading~~
- ~~User dropdown not responding to clicks~~
- ~~Domain management features broken~~
- ~~Marking words as known failing silently~~
- ~~Session recording throwing errors~~

All of these are now protected by the ChromeAPI wrapper at `frontend/content.js:7-80`.

---

## Next Actions

- If all tests pass: ✅ Ready for production use
- If some tests fail: Check TESTING_GUIDE.md for the specific issue
- If you need help: Provide the quality checker output and console screenshot
