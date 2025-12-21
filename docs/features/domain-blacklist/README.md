# Domain Blacklist Feature

## Overview

Domain Blacklist allows users to disable MixRead's word highlighting on specific websites.

## Current Implementation (P1) - ✅ Complete

### User Interface

![1764845191328](image/README/1764845191328.png)

![Domain Blacklist UI](../image/domain-exclusion/1764843484281.png)

### Key Features

1. **Default Blacklist** (13 pre-configured domains)

   - Development: localhost, 127.0.0.1
   - Learning Tools: quizlet.com, anki.deskew.com
   - Social Media: facebook.com, twitter.com, reddit.com, instagram.com, tiktok.com
   - Video Platforms: youtube.com
   - Privacy Sensitive: mail.google.com, github.com, stackoverflow.com

2. **Quick Actions**

   - One-click exclude current domain
   - One-click exclude current path
   - Auto-refresh after adding

3. **Management**

   - View all blacklisted domains
   - Remove domains (no confirmation needed)
   - Add custom domains
   - Restore preset domains

### User Guide

#### How to exclude a website:

1. Open the website you want to exclude
2. Click MixRead icon
3. Go to "Domains" tab
4. Click "Exclude Domain" button
5. Page refreshes - highlighting is disabled

#### How to restore a website:

1. Click MixRead icon
2. Go to "Domains" tab
3. Find domain in Blacklist list
4. Click "✕" button next to it

## Technical Implementation

### Backend

- **Repository**: [repositories.py](file:///Users/yinshucheng/code/creo/MixRead/backend/infrastructure/repositories.py)

  - `DEFAULT_BLACKLIST` constant (13 domains) - lines 27-52
  - `_import_default_blacklist()` for new users - lines 332-370
  - `DomainManagementPolicyRepository` class - lines 373-651

- **Database Table**: `domain_management_policies`

  ```sql
  user_id, domain, policy_type, is_active, description, added_at, updated_at
  ```

- **API Endpoints** ([routes.py](file:///Users/yinshucheng/code/creo/MixRead/backend/api/routes.py) lines 206-315):

  | Method | Endpoint                                                 | Description                |
  | ------ | -------------------------------------------------------- | -------------------------- |
  | GET    | `/users/{userId}/domain-policies/blacklist`              | Get all blacklist domains  |
  | GET    | `/users/{userId}/domain-policies/blacklist/detailed`     | Get policies with metadata |
  | POST   | `/users/{userId}/domain-policies/blacklist`              | Add domain to blacklist    |
  | POST   | `/users/{userId}/domain-policies/blacklist/batch`        | Add multiple domains       |
  | DELETE | `/users/{userId}/domain-policies/blacklist/{domain}`     | Remove domain              |
  | POST   | `/users/{userId}/domain-policies/blacklist/batch-remove` | Remove multiple domains    |
  | POST   | `/users/{userId}/domain-policies/check`                  | Check if domain excluded   |
  | GET    | `/users/{userId}/domain-policies/statistics`             | Get statistics             |

### Frontend

- **UI**: [popup.html](file:///Users/yinshucheng/code/creo/MixRead/frontend/chrome-extension/popup.html) (lines 206-366)

  - Tab navigation (lines 96-100)
  - Quick Actions section (lines 215-288)
  - Domain input and blacklist display (lines 290-365)

- **Logic**: [popup.js](file:///Users/yinshucheng/code/creo/MixRead/frontend/chrome-extension/popup.js)

  - `initializeDomainManagement()` - lines 700-728
  - `setupDomainEventListeners()` - lines 733-760
  - `initializeQuickActions()` - lines 961-1010
  - `handleQuickExcludeDomain()` - lines 1017-1056
  - `handleQuickExcludePath()` - lines 1062-1101
  - `renderBlacklist()` - lines 845-882

- **Store**: [domain-policy-store.js](file:///Users/yinshucheng/code/creo/MixRead/frontend/chrome-extension/content/modules/domain-policy/domain-policy-store.js) (406 lines)

  - Data caching and API synchronization
  - Key methods: `initialize()`, `shouldExcludeDomain()`, `addBlacklistDomain()`, `removeBlacklistDomain()`

- **Filter**: [domain-policy-filter.js](file:///Users/yinshucheng/code/creo/MixRead/frontend/chrome-extension/content/modules/domain-policy/domain-policy-filter.js) (171 lines)

  - Runtime domain checking for content script
  - Key methods: `shouldExcludeCurrentPage()`, `extractDomain()`, `isDomainInList()`

## Testing

### Test Coverage

```bash
# Backend
python -m pytest backend/test_default_blacklist.py
python -m pytest backend/test_p1_integration.py
python -m pytest backend/test_api_domain_management.py

# Frontend
node frontend/test_p1_quick_actions.js
```

### Test Files

- `backend/test_default_blacklist.py` - Default blacklist import tests
- `backend/test_p1_integration.py` - End-to-end integration tests
- `backend/test_api_domain_management.py` - API endpoint tests
- `frontend/test_p1_quick_actions.js` - Quick action UI tests

## Future Enhancements (Not Yet Implemented)

- Context menu for quick exclude
- Multi-level matching (exact/subdomain/path)
- Admin platform for global presets
- Domain analytics reporting (backend prepared at `reportDomainStatus()`)

## Maintenance Notes

- Each user has independent blacklist stored in database
- Default domains are imported only for new users (on first `get_user()` call)
- No confirmation dialog on delete (user preference)
- Port numbers are preserved in domain matching (e.g., localhost:8002)
- Whitelist endpoints exist in backend but not exposed in UI (Phase 2+)
