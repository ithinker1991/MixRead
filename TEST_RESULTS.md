# Navigation Testing Results - TabId Caching with BFCache

**Test Date**: _______________
**Tester**: _______________
**Browser**: _______________
**OS**: _______________

---

## ✅ Test 1: F5 Refresh

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Original word count before refresh: _______________
- Sidebar cleared after F5: [ ] YES [ ] NO
- New word count after page loaded: _______________
- Console logs observed:
  - [ ] "beforeunload event"
  - [ ] "pageshow event: { persisted: false }"
  - [ ] "Page loaded fresh - clearing wordState"

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 2: Browser Refresh Button

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Same behavior as F5: [ ] YES [ ] NO
- Console shows "pageshow: { persisted: false }": [ ] YES [ ] NO
- Sidebar cleared: [ ] YES [ ] NO

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 3: Ctrl+R / Cmd+R

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Same behavior as F5: [ ] YES [ ] NO
- Word list cleared: [ ] YES [ ] NO

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 4: SPA Navigation (Accumulation)

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Word count before SPA nav: _______________
- Word count after SPA nav: _______________
- Sidebar cleared during SPA nav: [ ] YES [ ] NO (should be NO)
- Console shows "pushState detected": [ ] YES [ ] NO
- Console shows "SPA navigation detected - continuing to accumulate": [ ] YES [ ] NO
- Old words still visible: [ ] YES [ ] NO

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 5: Back Button (BFCache Available)

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Setup word count (before navigation): _______________
- Navigation to new page: [ ] Completed
- Word count on new page: _______________
- Back button behavior: [ ] FAST (< 100ms) [ ] SLOW (> 1s)
- Sidebar state after back: [ ] ORIGINAL [ ] CLEARED [ ] NEW
- Console shows "pageshow: { persisted: true }": [ ] YES [ ] NO

**Expected**: Sidebar should show original word count _______________
**Actual**: Sidebar shows _______________

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 6: Back Button (BFCache Disabled)

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Note**: This test may not work if your test sites support BFCache well

**Details**:
- Console shows "pageshow: { persisted: false }": [ ] YES [ ] NO
- Page reload speed: [ ] SLOW (expected)
- Sidebar cleared: [ ] YES [ ] NO
- New words appeared: [ ] YES [ ] NO

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 7: Forward Button

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Forward button works: [ ] YES [ ] NO
- Page restored from cache: [ ] YES [ ] NO (check console)
- Sidebar state correct: [ ] YES [ ] NO

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 8: Multi-Tab Isolation

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Tab 1 tabId: _______________
- Tab 2 tabId: _______________
- Tab IDs different: [ ] YES [ ] NO

Tab 1 (Medium):
- Word count: _______________
- Sample words: _______________

Tab 2 (GitHub):
- Word count: _______________
- Sample words: _______________

After switching back to Tab 1:
- Word count matches original: [ ] YES [ ] NO
- Same words visible: [ ] YES [ ] NO
- No pollution from Tab 2: [ ] YES [ ] NO

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 9: Manual URL Input (New Domain)

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Original site: _______________
- New site: _______________
- Sidebar cleared: [ ] YES [ ] NO
- New words appeared: [ ] YES [ ] NO
- Old words mixed in: [ ] YES (BAD) [ ] NO (good)

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## ✅ Test 10: Manual URL Input (Same Domain)

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Details**:
- Original URL: _______________
- New URL: _______________
- Sidebar cleared: [ ] YES [ ] NO
- New words appeared: [ ] YES [ ] NO

**Issues** (if any):
```
[Describe any unexpected behavior]
```

---

## 📊 Summary

### Overall Result

**Total Tests**: 10
**Passed**: ___ / 10
**Failed**: ___ / 10
**Partial**: ___ / 10

### Critical Tests (Must Pass)

- [ ] Test 1: F5 Refresh → Clear words
- [ ] Test 4: SPA Navigation → Accumulate words
- [ ] Test 5: Back Button → Keep/Clear based on BFCache
- [ ] Test 8: Multi-Tab Isolation → Different tabIds

### Summary

```
Key Observations:
[Write overall observations about how the implementation performs]

Main Issues Found:
[List any issues discovered during testing]

Recommendations:
[Any recommendations for improvements]
```

---

## 🔧 Console Output Log

Paste relevant console logs here for reference:

```
[Paste console logs here]
```

---

## 🐛 Bugs Found

| Issue | Severity | Description | Reproduction Steps | Status |
|-------|----------|-------------|-------------------|--------|
| | | | | |
| | | | | |
| | | | | |

---

## ✅ Sign-off

- **Tested by**: _______________
- **Date**: _______________
- **All critical tests passed**: [ ] YES [ ] NO
- **Ready for production**: [ ] YES [ ] NO

**Notes**:
```
[Any final notes about the testing]
```

