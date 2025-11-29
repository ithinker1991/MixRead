# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MixRead** is an intelligent English reading enhancement tool (Chrome extension) designed to help users improve their English reading ability without relying on full-text translation.

**Mission**: Help users naturally improve English reading ability through "mixed input + difficulty control" rather than full translation dependence.

### Core Value Propositions
1. **Uninterrupted Reading**: Instant explanations only for unfamiliar words/phrases (not full translation)
2. **Automatic Difficult Word Detection**: AI-powered system automatically identifies and annotates words users may not know
3. **Adjustable Difficulty (Mixed Mode)**: Progressive transition from mixed content to full English reading

## Product Development Stages

The project follows a strict phased approach focused on MVP first, then iteration.

### Phase 1: MVP (0 → First Real User)
**Goal**: Validate that users want enhanced English reading

**Must Build**:
- Intelligent difficult word annotation in English articles
- Hover-based explanations (English definitions + examples, no Chinese translation)
- Difficulty slider (A0–C2) to control annotation density
- Basic word library (simple storage, no review system yet)
- Simple vocabulary statistics (count, daily additions)

**Must NOT Build** (save for later):
- User accounts/auth system
- Payment system
- Review/flashcard system
- Chinese-English mixed mode
- AI sentence parsing
- Mobile support

**Success Metrics**: 3 days of continuous usage by initial users

### Phase 2: Learning Loop (10–1000 Users)
- Reading history navigation
- Word library → flashcard generation
- Daily reviews
- Reading analytics/ability curves
- Basic Chinese mixed mode (5% word replacement)

### Phase 3: Scaled Product (1000–10k Users)
- Advanced sentence analysis
- Content recommendations
- Mobile support (React Native or pure extension)
- Monetization (subscription)

### Phase 4: Platform Maturity
- Multi-skill support (speaking, listening, writing)
- Complete language learning ecosystem

## Architecture Overview

### Client (Chrome Extension)
- Content script injection for text extraction
- DOM parsing to identify text nodes
- Text batch submission to backend
- Dynamic annotation rendering with difficulty filtering
- Hover UI tooltips for word explanations
- Difficulty slider (controls annotation threshold)
- Word library management (add to vocabulary)
- Local caching for performance

### Backend (TBD - likely Python Flask/FastAPI)
- Text processing pipeline
- Difficult word identification (based on: frequency lists, word length, CEFR levels A1–C2)
- English definitions (simple, no translations)
- Example sentence generation
- Word metadata storage
- User vocabulary persistence

### Data Model (Phase 1)
- Difficult words list (word, CEFR level, frequency, definition, examples)
- User vocabulary (words added to library)
- Statistics (total words, daily adds, reading time)

## Development Workflow

### Build & Run
```bash
# Backend setup (when ready)
# pip install -r requirements.txt
# python app.py

# Extension development
# Load unpacked extension in chrome://extensions
```

### Testing
```bash
# Add commands when testing framework is set up
# pytest tests/
# pytest tests/test_word_detection.py -v
```

### Project Structure (when code is added)
Follow DDD (Domain-Driven Design) approach with clear separation:
- **Domain Layer**: Word difficulty detection, CEFR classification, vocabulary management
- **Application Layer**: API endpoints, extension message handlers
- **Infrastructure Layer**: Storage, external service integrations (if any)
- **Presentation Layer**: Extension UI, popup, content script

Avoid over-abstraction. Build incrementally with each phase having happy path tests before advancing.

### Code Organization
- Clean separation between content script (UI) and backend logic
- Reusable word detection algorithms
- Extensible difficulty level system

## Key Implementation Decisions

### Word Difficulty Detection Strategy
Combines multiple signals:
- **Frequency**: Common word lists (top 1000, 2000, 5000 words)
- **Word Length**: Longer words often more difficult
- **CEFR Classification**: A1 (easiest) to C2 (hardest) levels
- **User History**: Adapt to words user has already learned

### Why No Translation?
Full Chinese translation creates dependency. MVP uses English definitions only to encourage learning from context.

### Hover UX (MVP Phase)
- English definition (simplified)
- Example sentence from dictionary/LLM
- Optional pronunciation button
- Minimal, non-intrusive design

### Difficulty Slider (Core Innovation)
- Low setting: More words annotated, easier to understand
- High setting: Fewer annotations, challenges learner
- Allows progressive transition from mixed to pure English reading

## API Design Guidelines

### RESTful Architecture Principles

All backend APIs follow **RESTful design patterns** with the following rules:

#### 1. Resource-Based URL Structure
- **Resource** (user, vocabulary, words) is always in the URL path
- **user_id** goes in the URL path: `/users/{user_id}/vocabulary`
- HTTP methods (GET, POST, PUT, DELETE) represent actions
- No action verbs in URLs (❌ `/api/get-vocabulary`, ✅ `GET /users/{user_id}/vocabulary`)

#### 2. Current API Design (No Authentication)
All user-specific endpoints include `user_id` in the path:

```
GET /users/{user_id}
  Retrieve all user data

GET /users/{user_id}/vocabulary
  List all words in user's vocabulary

POST /users/{user_id}/vocabulary
  Add word to vocabulary (body: {"word": "serendipity"})

PUT /users/{user_id}/vocabulary/{word}
  Update word metadata (body: {"status": "learning"})

DELETE /users/{user_id}/vocabulary/{word}
  Remove word from vocabulary

GET /users/{user_id}/known-words
  List all words marked as "known"

POST /users/{user_id}/known-words
  Mark word as known (body: {"word": "beautiful"})

DELETE /users/{user_id}/known-words/{word}
  Unmark word as known

POST /highlight-words
  Get highlighted words list
  (body: {"user_id": "...", "words": [...], "difficulty_level": "B1"})
```

#### 3. Future Authentication Upgrade (Phase 2+)
When adding authentication (JWT/OAuth):
- **Same URL paths** - no changes needed
- **user_id comes from JWT token**, not the request body
- **Backend verifies** path user_id matches token user_id
- **Frontend code changes minimally** - just add Authorization header

Backend middleware pattern:
```python
@middleware
def authenticate(request):
    # Extract user_id from token
    user_id = decode_jwt_token(request.headers['Authorization'])
    request.state.user_id = user_id
    # Route handler uses request.state.user_id
```

#### 4. Benefits of This Approach
- ✅ **Clear resource identification** in URLs
- ✅ **Easier debugging** - logs and tools show user_id directly
- ✅ **Consistent with industry standards** (GitHub, Stripe, AWS)
- ✅ **Minimal migration path** to authenticated system
- ✅ **Better for error tracking** - failures are tied to specific users

#### 5. Response Format
All endpoints return consistent JSON format:
```json
{
  "success": true/false,
  "data": { /* response data */ },
  "error": "error message if applicable",
  "timestamp": "2025-11-29T10:30:00Z"
}
```

## Core Development Principles

### 简单、适用、演进 (Simplicity, Applicability, Evolution)

These three principles guide all development decisions:

1. **简单 (Simplicity)**: Build the minimal viable solution that solves the core problem. Avoid over-engineering, premature optimization, and "nice-to-have" features. Each line of code should serve the MVP goal.

2. **适用 (Applicability)**: Code must work for real users in real scenarios. Focus on happy path implementation first. Test assumptions with actual users before adding complexity.

3. **演进 (Evolution)**: Design for incremental improvement across phases. Don't try to build the perfect system in Phase 1. Build what's needed now; improve in subsequent phases as you learn from users.

**Critical**: DO NOT over-optimize. A simple solution that works beats perfect architecture that delays user validation.

## Important Development Notes

1. **MVP Scope is Sacred**: Don't add secondary phase features (mixed Chinese mode, flashcards, etc.) in Phase 1. Speed to user validation is critical.

2. **DDD Principle**: Build domain models for word difficulty and vocabulary management explicitly, but don't over-engineer. Each phase should be completable with focused effort.

3. **Happy Path First**: Each phase needs working end-to-end flows before expanding features. For MVP: user opens English article → words annotated → hover shows definition → word saved to library.

4. **No User Accounts Yet**: MVP uses browser local storage only. Don't build auth systems before validating product-market fit.

5. **Content Script Isolation**: Extension content scripts have limited DOM access and security constraints—plan interactions carefully with backend.

6. **Performance**: Text processing must be fast (not noticeable lag when reading). Consider batching and async operations.

7. **No Over-Optimization**: Simple, working code > perfect but delayed code. Optimize only when real user data shows bottlenecks.

## Chrome Extension Development Guidelines

**Critical Rule**: NEVER rely on self-testing with only unit tests. Backend unit tests passing ≠ frontend extension works in Chrome.

### 1. Browser Environment Compatibility Checklist
Before writing any frontend code, verify:
- ❌ NO `process.env` - doesn't exist in browsers
- ❌ NO `require()` / `module.exports` - use ES6 modules or globals only
- ❌ NO Node.js built-ins (fs, path, crypto, etc.)
- ✅ Use `localStorage`, `sessionStorage` for client storage
- ✅ Use `chrome.storage` API for extension persistent storage
- ✅ Use `fetch()` for HTTP requests
- ✅ Use `console.log/warn/error` for debugging

**Code Review Rule**: Every file in `frontend/` must be checked for these incompatibilities BEFORE submission.

### 2. Global Variable Declaration Rule
- **ONE place only** for variable declarations
- ✅ Declare in `content.js` top-level: `let userStore;`
- ❌ DO NOT redeclare in module files like `user-store.js`
- ❌ DO NOT instantiate module variables (e.g., `const userStore = new UserStore()`) at module level

**Pattern**:
```javascript
// ✅ CORRECT: content.js
let userStore;
async function initializeModules() {
  userStore = new UserStore(); // Instantiate here
}

// ❌ WRONG: user-store.js
let userStore = new UserStore(); // Duplicate declaration!
```

### 3. Module Load Order Dependency
Document dependencies clearly in `manifest.json`:
```json
"js": [
  "scripts/logger.js",           // No dependencies
  "scripts/api-client.js",       // Depends on logger
  "modules/user/user-store.js",  // Depends on logger, storage
  "content.js"                   // Depends on all above
]
```

**Validation Rule**: Before submitting, verify each module can reference all its dependencies without errors.

### 4. CORS and Private Network Access
When accessing `localhost:8000` from extension:

**Backend Config Required**:
```python
# Add Private Network Access headers
@app.middleware("http")
async def add_private_network_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# Add CORS middleware
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
```

**Frontend Awareness**: Extension content scripts running on HTTPS pages may get CORS errors. Test on both:
- Local HTTP pages (http://localhost:8001/test.html)
- Public HTTPS pages (https://github.com)

### 5. Testing Checklist - MANDATORY BEFORE SUBMISSION

Do NOT just run unit tests. Do this:

```
[ ] Unit tests pass (backend)
[ ] Backend health check works (curl http://localhost:8000/health)
[ ] Extension loads in Chrome without errors
[ ] Open DevTools on actual test page
[ ] Check Console for [MixRead] logs - should see initialization sequence
[ ] Verify page has highlighted words (yellow background)
[ ] Test right-click context menu on a word
[ ] Check Network tab - verify API requests to localhost:8000 succeed
[ ] Test multiple pages (local HTTP + public HTTPS)
```

**Red Flags** (stop and debug):
- ❌ Empty Console (no [MixRead] logs)
- ❌ Red errors in Console
- ❌ No highlighted words after 3 seconds
- ❌ 404 or CORS errors in Network tab
- ❌ Functions not defined (reference errors)

### 6. Real Environment Testing
**ALWAYS test in actual Chrome before claiming "done"**:

```bash
# Start backend
cd backend && python main.py

# In ANOTHER terminal, start local HTTP server for test page
cd frontend && python -m http.server 8001 --bind localhost

# In Chrome:
# 1. chrome://extensions → Load unpacked → select frontend/
# 2. Open http://localhost:8001/test.html
# 3. F12 → Console
# 4. Verify all [MixRead] initialization logs appear
```

### 7. Code Review for Frontend
Every frontend change must check:

1. **Syntax errors**:
   - Balanced braces `{}`
   - All function definitions complete
   - No typos in class names or method calls

2. **Variable scope**:
   - Check for duplicate `let`/`const` declarations
   - Verify global variables declared in content.js, not modules
   - Ensure all `this.` references are in methods, not top-level

3. **Dependency completeness**:
   - If file uses `logger`, verify logger.js loaded before it
   - If file uses `apiClient`, verify scripts/api-client.js loaded before it
   - Check manifest.json load order

4. **Browser compatibility**:
   - Search file for `process.`, `require(`, `Buffer`, `fs.`, `path.`
   - Verify all external references exist in Chrome

5. **Event handling**:
   - Check all event listeners have corresponding cleanup
   - Verify no memory leaks from anonymous functions
   - Test event handlers with Console logging

## References

- Full product roadmap: `DevelopPlan.md`
- Target CEFR levels: A1, A2, B1, B2, C1, C2 (from European Framework)
- Common word lists: Consider using established frequency lists (e.g., British National Corpus, Corpus of Contemporary American English)

## Next Steps When Starting Development

1. Create backend structure (Flask/FastAPI with text processing pipeline)
2. Implement core word difficulty detection algorithm
3. Build Chrome extension scaffold with content script
4. Connect extension to backend for word annotation
5. Implement hover tooltip UI
6. Add difficulty slider
7. Implement word library storage
8. Build simple statistics dashboard
9. Test with 3–5 beta users and iterate
