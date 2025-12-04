# MixRead Testing Checklist

## Pre-Testing Setup

- [ ] Backend is running: `python main.py` (should see "Uvicorn running on http://127.0.0.1:8000")
- [ ] Extension is loaded in Chrome: chrome://extensions
- [ ] Extension has reload button clicked (refresh the unpacked extension)
- [ ] Popup shows your user ID correctly
- [ ] DevTools open (F12) with Console tab visible

---

## Test 1: Single Word "Add to Library"

**Steps**:
1. Visit https://github.com
2. Find a word (e.g., "repository", "code", "development")
3. Right-click on the word
4. Select "Add to Library"

**Verify**:
- [ ] No error message in console
- [ ] No red errors in DevTools Console
- [ ] Word appears in Library within 2 seconds
- [ ] Sentences are clean (NO quote marks around them)
- [ ] At least 1 sentence extracted
- [ ] Sentences are actual English text (not gibberish)

**Test Multiple Words**:
- [ ] Test with common word: "test"
- [ ] Test with uncommon word: "serendipity"
- [ ] Test with repeated word (appears multiple times on page)

---

## Test 2: Batch Marking

**Steps**:
1. Visit any article (e.g., Medium, Dev.to, or similar)
2. Click popup → "Batch Mark Words" button
3. Panel opens showing words with checkboxes
4. Select 3-5 words
5. Click "Mark Known"

**Verify**:
- [ ] Panel opens without errors
- [ ] Can see list of words with checkboxes
- [ ] Checkboxes can be checked/unchecked
- [ ] No "Extension context invalidated" error appears
- [ ] Operation completes within 2 seconds
- [ ] Words appear in Library with proper sentences

**Test Error Recovery**:
- [ ] Complete a batch marking operation
- [ ] Open popup and switch to different user
- [ ] Try batch marking immediately → should work with retry logic
- [ ] No "Extension context invalidated" error should appear

---

## Test 3: Library Display

**Steps**:
1. Open Library page: `http://localhost:8002/library-viewer.html`
2. Your user ID should be in the URL (from popup)
3. View your recently added words

**Verify**:
- [ ] Words from tests 1 & 2 appear in library
- [ ] Sentences display WITHOUT surrounding quotes
  - Example: `This is a test.` ✅ NOT `"This is a test."` ❌
- [ ] Multiple sentences appear for words that appeared multiple times
- [ ] Page title (source) is shown for each sentence
- [ ] No HTML entities or strange formatting visible
- [ ] Can scroll through all words

**Test Modal View**:
1. Click "View" on any word
2. Modal should open showing full context

**Verify**:
- [ ] Modal displays sentences cleanly
- [ ] Sentences in modal also have no quote marks
- [ ] Source information visible
- [ ] Can close modal with X button

---

## Test 4: Clean Websites (No Gibberish)

**Steps**:
1. Visit various websites and mark words:
   - GitHub (https://github.com)
   - Wikipedia (https://en.wikipedia.org)
   - News site (https://www.bbc.com)

**Verify**:
- [ ] NO sentences with patterns like "span(1×)"
- [ ] NO sentences with excessive special characters
- [ ] NO patterns like "word(1×)", "word(2×)"
- [ ] NO arrow symbols "→" mixed with text
- [ ] All extracted sentences are readable English

---

## Test 5: Problem Sites (Code-Heavy Content)

**Steps**:
1. Visit https://www.anthropic.com/blog
2. Mark 3-5 words
3. Check Library for these words

**Verify**:
- [ ] NO gibberish patterns in extracted sentences
- [ ] NO "1x", "×", "→" characters
- [ ] Sentences are clean English even on complex pages
- [ ] No excessive special characters in sentences

---

## Test 6: User Switching (Context Invalidation)

**Steps**:
1. Open popup
2. Note current user ID
3. Click user dropdown
4. Select different user (or create new one)
5. Immediately try to add a word to library

**Verify**:
- [ ] Operation succeeds (word is added)
- [ ] No "Extension context invalidated" error
- [ ] Word goes to correct user's library
- [ ] Retry logic handles context switch gracefully

---

## Test 7: Console Logs (Debugging)

**While performing Tests 1-3, check Console for logs**:

Expected logs should show:
- [ ] `[MixRead]` prefixed logs appear
- [ ] Word extraction messages visible
- [ ] API call logs shown
- [ ] Success messages for operations
- [ ] NO red error messages (warnings are OK)

Example good logs:
```
[MixRead] Adding word to vocabulary: development
[MixRead] Found X contexts for word
[MixRead] Successfully added "development" to library
```

---

## Test 8: Error Scenarios (Optional)

**Test Backend Offline**:
1. Stop backend (Ctrl+C)
2. Try to add word
3. Restart backend
4. Try again

**Verify**:
- [ ] First attempt shows error in console (expected)
- [ ] After restart, operations work again
- [ ] No crashes or frozen UI

---

## Quick Pass/Fail Summary

After completing all tests, fill this in:

**Test 1 - Single Word**: ___PASS___ / ___FAIL___
**Test 2 - Batch Marking**: ___PASS___ / ___FAIL___
**Test 3 - Library Display**: ___PASS___ / ___FAIL___
**Test 4 - Clean Websites**: ___PASS___ / ___FAIL___
**Test 5 - Problem Sites**: ___PASS___ / ___FAIL___
**Test 6 - User Switching**: ___PASS___ / ___FAIL___
**Test 7 - Console Logs**: ___PASS___ / ___FAIL___

---

## Common Issues & Quick Fixes

| Issue | Solution |
|-------|----------|
| No [MixRead] logs in console | Reload extension (chrome://extensions), then reload page with F5 |
| Words not appearing in Library | Check backend is running, Network tab for API errors |
| Quote marks still showing | Hard refresh library page (Ctrl+Shift+R) or clear cache |
| "Extension context invalidated" error | Wait 1 second and retry - retry logic should handle it |
| Gibberish sentences appearing | Check backend/cleanup_bad_sentences.py was run |
| User ID not in popup | Refresh extension or reload page |

---

## Notes for Next Session

If any test fails:
1. Check backend logs for errors
2. Check browser console for JavaScript errors
3. Check Network tab in DevTools for API failures
4. Note exact steps to reproduce
5. Review LATEST_FIXES_VERIFICATION.md for detailed debugging

---

## Testing Completion

Date tested: _______________

Tester name: _______________

All tests passed: ___YES___ / ___NO___

Issues found (if any):
```
1.
2.
3.
```

Ready for deployment: ___YES___ / ___NO___

---

*Print or save this checklist for easy reference while testing!*
