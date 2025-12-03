# E2E Test Plan - MixRead "Unknown Words" Feature

## Test Overview
Complete end-to-end testing of the unknown words feature, covering both frontend and backend integration.

## Test Scenarios

### Scenario 1: User Initialization
**Test**: New user can initialize and generate user_id
**Steps**:
1. Clean browser storage (simulate new user)
2. Load extension on a test page
3. Verify user_id is generated and stored
4. Verify difficulty level defaults to B1

**Expected Results**:
- User store initializes successfully
- User_id is generated in format: `mixread-user-{timestamp}-{random}`
- Difficulty level defaults to B1
- User data is persisted in browser storage

---

### Scenario 2: Unknown Words Sync on Startup
**Test**: Frontend syncs unknown words from backend on startup
**Steps**:
1. User has marked 5 words as unknown on another device (simulated via backend API)
2. Load extension on new device with same user_id
3. Extension should fetch unknown words from backend
4. Verify words are loaded into local store

**Expected Results**:
- GET /users/{user_id}/unknown-words returns list of words
- Unknown words are loaded into UnknownWordsStore
- Local cache is synced with backend data

---

### Scenario 3: Right-Click Context Menu
**Test**: User can right-click a highlighted word and mark it as unknown
**Steps**:
1. Load a page with highlighted English words
2. Right-click on a highlighted word
3. Context menu appears with "Mark as Unknown" option
4. Click "Mark as Unknown"
5. Word is added to unknown_words

**Expected Results**:
- Context menu appears on right-click
- Menu shows appropriate action ("Mark as Unknown" or "Remove from Unknown")
- Unknown words are tracked locally
- Word is synced to backend API (POST /users/{user_id}/unknown-words)
- Page re-highlights to reflect changes

---

### Scenario 4: 3-Priority Highlighting Logic
**Test**: Words are highlighted based on 3-priority system
**Steps**:
1. User has difficulty level set to B1
2. Word "ephemeris" is marked as unknown (Priority 1)
3. Word "common" is marked as known (Priority 2)
4. Word "run" is common enough for B1 difficulty (Priority 3)
5. Load page with all three words
6. Verify highlighting decisions

**Expected Results**:
- "ephemeris" (unknown): HIGHLIGHTED (Priority 1 override)
- "common" (known): NOT HIGHLIGHTED (Priority 2 override)
- "run" (B1 level): NOT HIGHLIGHTED (difficulty rule)
- Backend applies 3-priority logic based on HighlightService.should_highlight()

---

### Scenario 5: Multi-Device Sync
**Test**: Unknown words sync across devices for same user
**Steps**:
1. Device A: Mark word "ubiquitous" as unknown
2. Verify POST to /users/{user_id}/unknown-words succeeds
3. Device B: Load extension with same user_id
4. Verify GET /users/{user_id}/unknown-words includes "ubiquitous"
5. Verify page highlights "ubiquitous" correctly

**Expected Results**:
- Unknown words persist in backend database
- Multiple devices can access and sync the same user data
- Unknown words state is consistent across devices

---

### Scenario 6: Remove Word from Unknown
**Test**: User can remove a word from unknown list via context menu
**Steps**:
1. Word "ephemeris" is marked as unknown
2. Right-click on word again
3. Context menu shows "Remove from Unknown"
4. Click to remove
5. Verify word is no longer in unknown_words

**Expected Results**:
- Context menu updates based on current word state
- DELETE /users/{user_id}/unknown-words/{word} succeeds
- Word is removed from local store and backend
- Page re-highlights without the word

---

### Scenario 7: Difficulty Level Change
**Test**: Changing difficulty level re-highlights page correctly
**Steps**:
1. User has unknown/known words marked
2. Change difficulty level from B1 to C1
3. Verify page re-highlights
4. Verify 3-priority logic still applies

**Expected Results**:
- Page automatically re-highlights on difficulty change
- Highlighting respects unknown_words and known_words overrides
- Backend applies new difficulty level to highlighting logic

---

### Scenario 8: Chinese Display Toggle
**Test**: Users can toggle Chinese translation display
**Steps**:
1. Load page with highlighted words
2. Hover on word to show tooltip
3. Toggle Chinese display checkbox
4. Verify Chinese text shows/hides

**Expected Results**:
- Chinese translations display correctly in inline annotations
- Chinese toggle in tooltip works without re-highlighting page
- Chinese display preference is persisted

---

### Scenario 9: Session Time Tracking
**Test**: Reading session time is tracked
**Steps**:
1. User reads content for 5 minutes
2. User leaves page
3. Verify session time is recorded in storage

**Expected Results**:
- Reading time is tracked and persisted
- Session data aggregates by date
- Time tracking doesn't interfere with highlighting

---

### Scenario 10: Error Handling
**Test**: System gracefully handles errors
**Sub-tests**:
- Backend API is down: Unknown words fail gracefully, highlighting still works
- Network timeout on unknown words sync: Local cache continues working
- Invalid user_id: System generates new user_id
- Storage quota exceeded: System clears old data gracefully

**Expected Results**:
- Application doesn't crash on errors
- User can continue reading even if backend is unavailable
- Errors are logged appropriately

---

## Test Execution Checklist

### Frontend Tests
- [ ] Test 1: User Initialization
- [ ] Test 2: Unknown Words Sync on Startup
- [ ] Test 3: Right-Click Context Menu
- [ ] Test 4: 3-Priority Highlighting Logic
- [ ] Test 5: Multi-Device Sync
- [ ] Test 6: Remove Word from Unknown
- [ ] Test 7: Difficulty Level Change
- [ ] Test 8: Chinese Display Toggle
- [ ] Test 9: Session Time Tracking
- [ ] Test 10: Error Handling

### Backend Tests
- [ ] POST /highlight-words returns correct highlighted_words based on 3-priority logic
- [ ] GET /users/{user_id}/unknown-words returns user's unknown words
- [ ] POST /users/{user_id}/unknown-words adds word to database
- [ ] DELETE /users/{user_id}/unknown-words/{word} removes word
- [ ] Multi-user isolation (user A's words don't affect user B)

### Integration Tests
- [ ] Frontend correctly passes user_id to backend
- [ ] Backend applies 3-priority logic with unknown_words
- [ ] Unknown words changes trigger page re-highlight
- [ ] Multi-device sync works with same user_id

---

## Success Criteria
1. All 10 test scenarios pass
2. No console errors in extension
3. Backend responds correctly to all API calls
4. Unknown words persist across page reloads
5. Multi-device sync works with same user_id
6. Performance: Page highlighting completes within 1 second
7. UI is responsive: Context menu appears immediately on right-click
8. Error handling: System continues working even if backend is unavailable

---

## Testing Environment Setup
```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py  # Runs on http://localhost:8000

# Frontend
1. Open chrome://extensions
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select frontend directory
5. Open test website (e.g., https://medium.com)
6. Open DevTools Console to see logs
```

---

## Automation Scripts (Future)
- Selenium/Puppeteer scripts to automate browser interactions
- Python test suite for backend API testing
- Integration test harness to coordinate frontend/backend testing

