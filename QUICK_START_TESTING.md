# MixRead - Quick Start Testing Guide

## ✅ Fixes Deployed

This session fixed all major issues:
1. **Extension context invalidation** - Retry logic implemented
2. **"Add to Library" button** - Now works with backend API
3. **Sentence extraction** - Simplified to simple punctuation-based method
4. **Library display** - Removed quote marks from sentences
5. **Database** - Cleaned 16 bad sentence entries

## 🚀 Quick Start (5 minutes)

### 1. Start Backend
```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python main.py
# Should see: "Uvicorn running on http://127.0.0.1:8000"
```

### 2. Reload Extension
```
1. Go to chrome://extensions
2. Find "MixRead" extension
3. Click Reload button (circular arrow icon)
4. Or use keyboard: Cmd+R on the extension tile
```

### 3. Test on Website
```
1. Visit: https://github.com
2. Find a word like "development" or "create"
3. Right-click on word → "Add to Library"
4. Wait 2 seconds
5. Open: http://localhost:8002/library-viewer.html
6. Your user ID appears in extension popup
```

### 4. Verify in Browser Console
```
1. Press F12 on webpage
2. Go to Console tab
3. Look for [MixRead] logs showing:
   - Word extraction successful
   - API call to backend
   - No errors
```

## 🎯 Key Test Cases (2 minutes each)

### Test 1: Single Word Add
- **What to do**: Right-click any word → "Add to Library"
- **Expected**: Word appears in Library with 1-3 clean sentences
- **Check**: No quotes around sentences, no gibberish
- **Pass if**: ✅ Word shows up, sentences are readable

### Test 2: Batch Marking
- **What to do**:
  1. Open popup
  2. Click "Batch Mark Words" button
  3. Select 3-5 words
  4. Click "Mark Known"
- **Expected**: Words added without errors
- **Pass if**: ✅ No "Extension context invalidated" error

### Test 3: User Switching
- **What to do**:
  1. Open popup
  2. Switch user (click user dropdown, select different user)
  3. Immediately try to add a word
- **Expected**: Works without errors (retry logic handles it)
- **Pass if**: ✅ Operation succeeds after profile switch

### Test 4: Problem Sites
- **What to do**:
  1. Visit https://www.anthropic.com/blog
  2. Mark 3-5 words
  3. Check Library
- **Expected**: No gibberish like "span(1×)", "4×", "→"
- **Pass if**: ✅ All sentences are clean English text

## 📊 Success Checklist

Mark these off as you test:

```
[ ] Backend starts without errors
[ ] Extension reloads successfully
[ ] Can see [MixRead] logs in console
[ ] Single word "Add to Library" works
    [ ] Word appears in library
    [ ] Sentences are clean (no quotes)
    [ ] At least 1 sentence extracted
[ ] Batch marking works
    [ ] No context invalidation errors
    [ ] Words appear in library
[ ] User switching works
    [ ] Can switch users in popup
    [ ] Can add words immediately after
[ ] Clean websites (no gibberish)
    [ ] GitHub works
    [ ] Anthropic blog works
    [ ] Regular articles work
```

## 🔍 If Something Goes Wrong

### Problem: "No [MixRead] logs in console"
```
Solution:
1. Check extension reloaded (Step 2 above)
2. Check manifest.json is correct
3. Reload page with F5
4. Open DevTools AFTER page loads
```

### Problem: "Extension context invalidated error"
```
Solution:
1. Check backend is running
2. Wait a few seconds (retry logic waits 500ms)
3. Try operation again
4. If still fails: reload extension (chrome://extensions)
```

### Problem: "Words not appearing in Library"
```
Solution:
1. Check backend is running: http://localhost:8000
2. Open DevTools Network tab, try "Add to Library"
3. Look for request to /users/XXX/library
4. Check response status (should be 200)
5. If 404: backend might not be running
```

### Problem: "Gibberish sentences like span(1×)"
```
Solution:
1. Check content.js lines 734-749 (filters)
2. Database cleanup was run (should be clean)
3. Try on different website
4. Check browser console for any JavaScript errors
```

## 📱 Quick Database Check

If you want to verify data was saved correctly:

```bash
cd /Users/yinshucheng/code/creo/MixRead/backend

# Check user's library entries
python -c "
from infrastructure.database import SessionLocal
from infrastructure.models import LibraryEntryModel

db = SessionLocal()
# Replace YOUR_USER_ID with actual ID from extension popup
entries = db.query(LibraryEntryModel).filter_by(user_id='YOUR_USER_ID').all()
print(f'Found {len(entries)} words in library')
for e in entries:
    print(f'  - {e.word}: {len(e.get_contexts())} context(s)')
db.close()
"
```

## 🎓 What Was Fixed

| Issue | Before | After |
|-------|--------|-------|
| **"Add to Library" button** | Only saved locally | Calls backend API ✅ |
| **Sentence display** | `"This is a test."` (with quotes) | `This is a test.` (clean) ✅ |
| **Sentence extraction** | Complex, produced gibberish | Simple punctuation method ✅ |
| **Context errors** | Would crash on user switch | Retries automatically ✅ |
| **Library quality** | Mixed bad/good sentences | All sentences cleaned ✅ |

## 📚 More Information

- Full details: `LATEST_FIXES_VERIFICATION.md`
- Session summary: `SESSION_COMPLETION_SUMMARY.md`
- Fixes overview: `FIXES_SUMMARY.md`

## 💡 Tips

1. **Use incognito window** for fresh testing (no cached data)
2. **Test multiple websites** to verify robustness
3. **Keep DevTools open** while testing to see logs
4. **Use simple words first** (like "test", "example") for easy verification
5. **Check Library page** immediately after each operation

---

**Ready to test?** Start with Step 1 above and follow through! 🚀
