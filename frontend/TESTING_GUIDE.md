# Frontend Code Quality & Debugging Guide

## Quick Diagnostics in DevTools

### Method 1: Automatic Quality Check (Recommended)

1. **Open DevTools**: Press `F12` on any MixRead popup or page
2. **Open Console Tab**
3. **Paste and run**:
```javascript
const checker = new FrontendCodeQualityChecker();
const results = checker.runAllChecks();
```

This will automatically check:
- ✅ All critical globals defined
- ✅ All critical functions exist
- ✅ Extension context is valid
- ✅ DOM elements are loaded
- ✅ No JavaScript errors
- ✅ Initialization status

### Method 2: Manual Checks

#### Check 1: Is PresetDialog initialized?
```javascript
console.log('PresetDialog:', window.presetDialog);
console.log('DomainPolicyStore:', window.domainPolicyStore);
```

Expected output: Both should be objects (not undefined)

#### Check 2: Are critical functions available?
```javascript
console.log('markWordAsKnown:', typeof markWordAsKnown);
console.log('switchTab:', typeof switchTab);
console.log('initializeDomainManagement:', typeof initializeDomainManagement);
```

Expected output: All should be `"function"`

#### Check 3: Is extension context valid?
```javascript
console.log('chrome.storage:', chrome.storage);
console.log('chrome.runtime:', chrome.runtime);
console.log('lastError:', chrome.runtime.lastError);
```

Expected output: storage and runtime should be objects, lastError should be null/undefined

#### Check 4: Are DOM elements loaded?
```javascript
console.log('domain-tab:', document.getElementById('domain-tab'));
console.log('btn-add-domain:', document.getElementById('btn-add-domain'));
console.log('userSelector:', document.getElementById('user-selector'));
```

Expected output: All should be DOM elements (not null)

#### Check 5: Check user selector state
```javascript
console.log('All users:', allUsers);
console.log('Current user:', currentUser);
console.log('User selector value:', document.getElementById('user-selector').value);
```

Expected output:
- `allUsers` should be an array with at least one user
- `currentUser` should match the selector value
- Both should not be empty

### Method 3: Test Tab Switching

```javascript
// Test switching to domain tab
switchTab('domain-tab');
console.log('Switched to domain tab');

// Verify it's active
console.log('Is domain-tab active?',
  document.getElementById('domain-tab').classList.contains('active'));
```

### Method 4: Test Preset Dialog

```javascript
// Check if dialog is defined
if (!presetDialog) {
  console.error('❌ presetDialog not initialized!');
} else {
  // Try to open it
  presetDialog.open(
    (selected) => console.log('Selected:', selected),
    () => console.log('Cancelled')
  );
}
```

### Method 5: Monitor for Extension Context Errors

```javascript
// Hook console.error to see extension context errors
const originalError = console.error;
console.error = function(...args) {
  if (args[0] && args[0].includes('context')) {
    console.log('⚠️ Extension context error detected:', args);
  }
  originalError.apply(console, args);
};
```

## Common Issues & Solutions

### Issue 1: "Extension context invalidated" Error

**Symptom**: Red error in console when extension reloads

**Fix**: Already applied in code-quality:
- `safeRecordReadingSession()` wrapper
- Context checks in `markWordAsKnown()`

**Test if fixed**:
```javascript
// Reload extension and run this
const checker = new FrontendCodeQualityChecker();
checker.checkExtensionContext();
```

### Issue 2: PresetDialog is Undefined

**Symptom**: Can't click "Add Preset Domains" button

**Fix**: Already applied in popup.js:
- Added `let presetDialog;` declaration
- Added initialization in `initializeDomainManagement()`

**Test if fixed**:
```javascript
console.log('PresetDialog initialized?', window.presetDialog !== undefined);
console.log('PresetDialog type:', typeof window.presetDialog);
```

### Issue 3: User Selector Not Working

**Symptom**: Can't select existing users

**Causes** (test each):
```javascript
// 1. Check if users exist
console.log('Users:', allUsers);

// 2. Check if selector is rendered
const selector = document.getElementById('user-selector');
console.log('Selector exists?', selector !== null);
console.log('Selector options:', selector.length);

// 3. Check if change event is bound
console.log('Selector listeners:', getEventListeners(selector));

// 4. Check current user
console.log('Current user:', currentUser);
```

**Solution**:
- If no users: Click "+ New" to create one
- If selector broken: Check popup.js lines 559-568
- If currentUser empty: Check initialization in popup.js lines 74-97

### Issue 4: Domain Tab Doesn't Switch

**Symptom**: Clicking "Domains" tab has no effect

**Test**:
```javascript
// Manually test switch
document.getElementById('domain-tab').classList.toggle('active');
document.querySelector('[data-tab="domain-tab"]').classList.toggle('active');

// Check if it switched
console.log('Domain tab is active:',
  document.getElementById('domain-tab').classList.contains('active'));
```

## Testing Checklist

Before reporting bugs, run these checks:

- [ ] Run `new FrontendCodeQualityChecker().runAllChecks()`
- [ ] Verify pass rate is > 80%
- [ ] Check console for red errors (not counting extension context errors)
- [ ] Test tab switching: `switchTab('domain-tab')`
- [ ] Test user selection with existing user
- [ ] Test adding a domain
- [ ] Test preset dialog: `presetDialog.open(...)`

## Reporting Bugs

When reporting bugs, include:

1. **Screenshot** of the error
2. **Console output** from quality checker
3. **Steps to reproduce**
4. **Expected vs actual behavior**

Example:
```
Bug: Domains tab doesn't respond to clicks
Location: popup.html, Domains tab
Steps:
1. Open extension popup
2. Click "Domains" tab
3. Tab doesn't switch

Quality Check Output:
[Paste output from FrontendCodeQualityChecker.runAllChecks()]

Expected: Tab should switch and show domain management UI
Actual: Nothing happens, tab stays on Settings
```

## Performance Diagnostics

### Check for slow operations

```javascript
console.time('Domain initialization');
domainPolicyStore.initialize(currentUser);
console.timeEnd('Domain initialization');

// Should be < 500ms
```

### Check for memory leaks

```javascript
// Get current memory usage
if (performance.memory) {
  console.log('Memory used:',
    (performance.memory.usedJSHeapSize / 1048576).toFixed(2), 'MB');
}
```

### Monitor for excessive redraws

```javascript
// Check if tab switching causes reflows
const before = document.querySelectorAll('[class]').length;
switchTab('domain-tab');
const after = document.querySelectorAll('[class]').length;
console.log('DOM changed:', after - before, 'elements');
```

## Advanced: Hook Into Functions

### Monitor markWordAsKnown calls

```javascript
const original = window.markWordAsKnown;
window.markWordAsKnown = function(word) {
  console.log('📝 markWordAsKnown called with:', word);
  return original.call(this, word);
};
```

### Monitor tab switches

```javascript
const originalSwitch = window.switchTab;
window.switchTab = function(tabName) {
  console.log('📑 Switching to tab:', tabName);
  return originalSwitch.call(this, tabName);
};
```

### Monitor storage operations

```javascript
const originalGet = chrome.storage.local.get;
chrome.storage.local.get = function(...args) {
  console.log('💾 Storage.get called with:', args[0]);
  return originalGet.apply(this, args);
};
```

## When to Escalate

Report to development if:
- Quality checker shows > 3 errors
- Red console errors persisting after reload
- Extension features completely broken
- Performance > 1 second for simple operations

## Quick Fixes

### If Domains tab broken:
1. Reload extension: chrome://extensions → refresh
2. Close and reopen popup
3. Check console for errors

### If can't select users:
1. Create new user (click "+ New")
2. Reload popup
3. Try selecting user again

### If extension keeps erroring:
1. Right-click extension icon → "Manage extension"
2. Remove extension
3. Reload from chrome://extensions
