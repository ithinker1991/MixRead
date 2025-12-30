# MixRead Project Structure

```
MixRead/
├── backend/                    # FastAPI backend (Python)
│   ├── main.py                 # Application entry point
│   ├── api/                    # API routes (presentation layer)
│   │   ├── routes.py           # User management endpoints
│   │   ├── review.py           # SRS review endpoints
│   │   └── auth.py             # Authentication endpoints
│   ├── application/            # Application services (use cases)
│   │   ├── services.py         # User, Highlight services
│   │   └── srs_adapter.py      # SRS integration
│   ├── domain/                 # Domain models and business logic
│   │   ├── models.py           # User, Word, VocabularyEntry entities
│   │   └── services.py         # Domain services
│   ├── infrastructure/         # Database and external services
│   │   ├── database.py         # SQLite/SQLAlchemy setup
│   │   ├── models.py           # ORM models
│   │   ├── repositories.py     # Data access layer
│   │   └── dictionary.py       # Dictionary service
│   ├── srs_core/               # Spaced repetition system
│   │   ├── models.py           # SRS data models
│   │   └── scheduler.py        # SM2 algorithm implementation
│   ├── data/                   # Static data files
│   │   ├── cefr_words.json     # Core CEFR vocabulary
│   │   └── ecdict.csv          # Extended dictionary
│   └── tests/                  # Backend tests
│
├── frontend/                   # Chrome Extension
│   ├── manifest.json           # Extension manifest (V3)
│   ├── background.js           # Service worker
│   ├── popup.html/js/css       # Extension popup UI
│   ├── content.css             # Content script styles
│   ├── scripts/                # Shared utilities
│   │   ├── api-client.js       # Backend API client
│   │   ├── logger.js           # Logging utility
│   │   ├── storage.js          # Chrome storage wrapper
│   │   └── stemmer.js          # Word stemming
│   ├── modules/                # Feature modules
│   │   ├── user/               # User state management
│   │   ├── highlight/          # Word highlighting logic
│   │   ├── panel/              # Sidebar and batch marking UI
│   │   ├── domain-policy/      # Domain blacklist/whitelist
│   │   ├── unknown-words/      # Unknown words tracking
│   │   └── review/             # Review session management
│   ├── pages/                  # Standalone pages
│   │   └── review-session.html # Flashcard review page
│   └── chrome-extension/       # Alternative extension structure
│
├── docs/                       # Documentation
│   ├── system/                 # Architecture, setup, patterns
│   ├── features/               # Feature-specific docs
│   └── planning/               # Project status and planning
│
└── scripts/                    # Build and deployment scripts
```

## Key Patterns

- **Backend**: DDD layers - keep domain logic pure, use repositories for data access
- **Frontend**: Modular vanilla JS - each feature in its own module folder
- **API**: RESTful endpoints under `/users/{user_id}/` namespace
- **Error Handling**: 3-layer try-catch pattern for Chrome extension context safety
