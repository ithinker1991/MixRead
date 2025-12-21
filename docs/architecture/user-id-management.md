# Account Management Architecture

## Project Context

MixRead is currently in **development phase**. The ability to manually set `user_id` exists solely for **testing purposes** - to quickly switch between different users during development and QA.

In **production**, a proper authentication system will be implemented:

- Login/logout flow
- OAuth or email-based auth
- User session management
- Single source of truth for user identity

## Current State Analysis

### Storage Keys in Use

| Key                    | Purpose                    | Location                        |
| ---------------------- | -------------------------- | ------------------------------- |
| `testUserId`           | Dev testing - manual input | popup.js                        |
| `mixread_user_id`      | Auto-generated user ID     | storage.js, user-store.js       |
| `mixread_current_user` | Legacy multi-user selector | popup.js (mostly commented out) |
| `userId`               | URL params & navigation    | navigation.js                   |
| `currentUser`          | Runtime global variable    | popup.js                        |

### Core Problem

**Content Script and Popup are not synchronized:**

1. Content script initializes → reads user ID from storage
2. User opens popup → sets different `testUserId`
3. Content script still uses the OLD user ID
4. Features like domain blacklist load data for wrong user

## Solution Analysis

### Solution 1: Unified Storage Key (Quick Fix)

**Approach**: All components read/write from ONE key: `mixread_user_id`

**Changes Required**:

1. Popup writes to `mixread_user_id` instead of `testUserId`
2. Remove redundant keys
3. Add message to force content script reload when user changes

**Pros**:

- Simple, minimal code changes
- Fixes immediate problem

**Cons**:

- Still no proper session management
- "Recent users" feature would need rework

**Effort**: ~2 hours

---

### Solution 2: Dev Mode Flag + Unified Key

**Approach**: Add explicit "development mode" that enables manual user switching

**Changes Required**:

1. Add `DEV_MODE` flag (could be based on `manifest.json` version or env)
2. In dev mode: show user input, allow manual switching
3. In production: hide user input, rely on auth (future)
4. Use `mixread_user_id` as the single runtime key
5. When user switches in popup, send message to ALL content scripts to reload

**Pros**:

- Clean separation of dev vs production behavior
- Prepares codebase for future auth integration
- Single key simplifies debugging

**Cons**:

- Slightly more code
- Need to decide dev mode detection mechanism

**Effort**: ~4 hours

---

### Solution 3: Session-Based Architecture (Best for Future)

**Approach**: Implement a lightweight session layer that will integrate with future auth

**Changes Required**:

1. Create `SessionManager` class in shared code
2. `SessionManager.getCurrentUserId()` - single source of truth
3. `SessionManager.setUserId(id)` - updates all components
4. Use Chrome extension messaging to sync across popup/content scripts
5. In dev: allow manual setting via popup
6. In production: `setUserId` called after login

**Architecture**:

```
┌─────────────────────────────────────────────────────┐
│                  SessionManager                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ getCurrentUserId()                           │    │
│  │ setUserId(id) → broadcasts to all scripts   │    │
│  │ onUserChanged(callback)                      │    │
│  └─────────────────────────────────────────────┘    │
│                        │                             │
│         ┌──────────────┼──────────────┐             │
│         ▼              ▼              ▼             │
│     Popup.js    Content.js    Background.js         │
│         │              │              │             │
│         └──────────────┴──────────────┘             │
│              All use SessionManager                  │
└─────────────────────────────────────────────────────┘
```

**Pros**:

- Clean architecture
- Easy to integrate auth later
- All components always in sync
- Supports future features (multi-device, sync)

**Cons**:

- More upfront work
- May be over-engineering for current needs

**Effort**: ~8 hours

## Recommendation

### For Immediate Fix (Domain Blacklist Issue)

Use **Solution 1** - it's the fastest way to fix the current bug:

1. Change popup to write `mixread_user_id` when user sets ID
2. Send `UPDATE_USER_ID` message to content scripts
3. Content scripts update their `UserStore` and reload policies

**Time**: 1-2 hours

### For Long-term Architecture

Implement **Solution 3** (Session-Based) when you're ready to add authentication:

1. `SessionManager` becomes the foundation
2. Auth flow calls `SessionManager.setUserId()`
3. All existing code already uses the right pattern

## Immediate Action Plan

```
Phase 1: Quick Fix (Now)
├── Update popup.js to write mixread_user_id
├── Add UPDATE_USER_ID message handler in content.js
├── Test domain blacklist works after user change
└── Estimated: 1-2 hours

Phase 2: Cleanup (Optional, Later)
├── Remove unused storage keys (testUserId, mixread_current_user)
├── Consolidate user ID logic
└── Estimated: 2 hours

Phase 3: Auth Integration (Future)
├── Implement SessionManager
├── Add login/logout UI
├── Integrate with backend auth
└── Scope TBD
```

## Questions

1. Should I proceed with the **Quick Fix (Solution 1)** to resolve the domain blacklist issue now?
2. Is the "recent users" feature in popup important, or can it be removed/simplified?
