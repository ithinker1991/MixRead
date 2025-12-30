# MixRead Tech Stack

## Backend

- **Framework**: FastAPI (Python 3.x)
- **Database**: SQLite with SQLAlchemy ORM
- **Architecture**: Domain-Driven Design (DDD) with layered architecture
  - Domain: Core business logic and entities
  - Application: Use case orchestration
  - Infrastructure: Database, repositories
  - Presentation: API routes
- **Key Dependencies**:
  - `fastapi==0.104.1`
  - `uvicorn==0.24.0`
  - `sqlalchemy==2.0.23`
  - `pydantic==2.5.0`
  - `httpx==0.25.2` (external API calls)

## Frontend

- **Type**: Chrome Extension (Manifest V3)
- **Language**: Vanilla JavaScript (no build step)
- **Architecture**: Modular structure with feature-specific modules
- **Styling**: Plain CSS

## Data Sources

- CEFR-J word dataset (~7,000 core words) stored locally
- ECDICT for extended dictionary lookups
- Free Dictionary API as external fallback

## Deployment

- Docker support via `docker-compose.yml`
- Backend runs on port 8000

## Common Commands

### Backend

```bash
# Start development server
cd backend
source venv/bin/activate
python main.py
# Server runs at http://localhost:8000

# Run tests
cd backend
pytest

# Run specific test file
pytest test_api.py -v
```

### Frontend (Chrome Extension)

```bash
# Load extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable Developer Mode
# 3. Load unpacked: select frontend/ directory
```

### Docker

```bash
# Start backend with Docker
docker-compose up -d

# View logs
docker-compose logs -f backend
```
