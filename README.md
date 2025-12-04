# MixRead

An intelligent English reading enhancement tool that helps you improve reading ability through word difficulty awareness and definitions.

## 🗺️ Documentation Map (文档导航)

For AI assistants and developers, please refer to the following documentation structure:

### 1. 🧠 System Context (系统基石)

- **[Setup & Deployment](docs/system/setup.md)**: How to start backend/frontend and deploy.
- **[Architecture](docs/system/architecture.md)**: System design, data flow, and key decisions.
- **[Coding Patterns](docs/system/coding-patterns.md)**: Error handling, logging, and code style guidelines.

### 2. 🧩 Features (功能档案)

- **[Domain Exclusion](docs/features/domain-exclusion.md)**: Logic for disabling extension on specific sites.
- **[Vocabulary Expansion](docs/features/vocabulary-expansion.md)**: Word data structure and expansion plans.
- **[Translation](docs/features/translation.md)**: Chinese translation implementation.

### 3. 📅 Planning (任务规划)

- **[PROJECT_STATUS.md](docs/planning/PROJECT_STATUS.md)**: **Single Source of Truth** for current progress, backlog, and history.

---

## Quick Start

### Backend

```bash
cd backend
source venv/bin/activate
python main.py
# Server: http://localhost:8000
```

### Frontend (Chrome Extension)

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Load unpacked: `frontend/` directory

---

## Project Structure

```
MixRead/
├── docs/                # Documentation (System, Features, Planning)
├── backend/             # FastAPI backend
│   ├── main.py          # API Entry point
│   └── data/            # Word databases
├── frontend/            # Chrome Extension (Manifest V3)
│   ├── content.js       # Core logic
│   └── popup.html       # UI
└── README.md            # This file
```
