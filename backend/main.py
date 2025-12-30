"""
MixRead Backend - MVP Phase 1 with DDD Architecture

Layered architecture:
- Domain: Core business logic (models, services)
- Application: Use case orchestration
- Infrastructure: Database, ORM, repositories
- Presentation: API routes
"""

import sys
from typing import Optional

import httpx
from api.auth import router as auth_router
from api.review import router as review_router
from api.routes import router as user_router
from application.services import HighlightApplicationService, UserApplicationService
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Import DDD layers
from infrastructure.database import get_db, init_db
from infrastructure.repositories import UserRepository
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Initialize FastAPI app
app = FastAPI(
    title="MixRead Backend",
    version="0.2.0",
    description="English reading enhancement with word difficulty control"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Access-Control-Allow-Private-Network"],
)

# Add Private Network Access support LAST (executes FIRST in middleware stack)
# This ensures it can intercept and modify preflight responses from CORSMiddleware
@app.middleware("http")
async def add_private_network_headers(request, call_next):
    # For PNA preflight, we need to check the request header
    is_pna_preflight = request.headers.get("Access-Control-Request-Private-Network") == "true"
    
    response = await call_next(request)
    
    # Always add the header if it's a PNA preflight or if we just want to be safe
    # Chrome requires this header for any request from a public site to a private/local one
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    
    if is_pna_preflight:
        sys.stderr.write(f"[CORS PNA] Handled PNA preflight for {request.url.path}\n")
        sys.stderr.flush()
        
    return response

# ... (imports)
from infrastructure.dictionary import dictionary_service

# Global data caches
# cefr_data and chinese_dict are now managed by dictionary_service
definition_cache = {}

# ... (models)
# Pydantic models for API
class WordBatch(BaseModel):
    user_id: str
    words: list[str]
    difficulty_level: str = "B1"
    difficulty_mrs: Optional[int] = None # Optional granular difficulty (0-100)


class WordInfo(BaseModel):
    word: str
    cefr_level: Optional[str] = None
    frequency_rank: Optional[int] = None
    definition: Optional[str] = None
    example: Optional[str] = None
    chinese: Optional[str] = None

# Data loading functions removed (handled by DictionaryService)

async def get_word_definition_external(word: str) -> dict:
    """
    Fetch word definition from Free Dictionary API (Fallback for words not in local dictionary)
    """
    word_lower = word.lower()

    if word_lower in definition_cache:
        return definition_cache[word_lower]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/en/{word_lower}"
            )
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    entry = data[0]
                    definition = ""
                    if "meanings" in entry and len(entry["meanings"]) > 0:
                        meanings = entry["meanings"][0]
                        if "definitions" in meanings and len(meanings["definitions"]) > 0:
                            definition = meanings["definitions"][0].get("definition", "")
                            if len(definition) > 150:
                                definition = definition[:150] + "..."

                    example = ""
                    if "meanings" in entry and len(entry["meanings"]) > 0:
                        meanings = entry["meanings"][0]
                        if "definitions" in meanings and len(meanings["definitions"]) > 0:
                            example = meanings["definitions"][0].get("example", "")

                    result = {"definition": definition, "example": example}
                    definition_cache[word_lower] = result
                    return result
    except Exception as e:
        print(f"Error fetching definition for {word}: {e}")

    result = {"definition": "", "example": ""}
    definition_cache[word_lower] = result
    return result


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    print("\n🚀 MixRead Backend Starting...")
    # dictionary_service is auto-initialized on import
    init_db()
    print("✓ Database initialized\n")


# Health check
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "0.3.0",
        "dictionary": {
            "tier1_core_words": len(dictionary_service.cefr_data),
            "tier2_full_db": "Active (SQLite)"
        }
    }

# ... (options_handler)

# Word information endpoints
@app.get("/word/{word}")
async def get_word(word: str):
    """Get word information using Hybrid Dictionary Service"""
    # 1. Lookup in Hybrid Dictionary
    info = dictionary_service.lookup(word)
    
    if info["found"]:
        return {
            "word": info["word"],
            "found": True,
            "cefr_level": info.get("level"),
            "mrs": info.get("mrs"),
            "pos": info.get("pos"),
            "definition": info.get("definition"),
            "translation": info.get("translation"), # Chinese
            "phonetic": info.get("phonetic", "")
        }

    # 2. Fallback to external API if really not found (Tier 3)
    definition_data = await get_word_definition_external(word)
    return {
        "word": word,
        "found": False,
        "definition": definition_data.get("definition"),
        "example": definition_data.get("example"),
        "chinese": None
    }


# Highlight endpoint (core feature)
@app.post("/highlight-words")
async def highlight_words(request: WordBatch, db: Session = Depends(get_db)):
    """
    Get highlighted words based on user's difficulty level and word lists
    """
    try:
        service = HighlightApplicationService(
            UserRepository(db),
            dictionary_service
        )
        result = service.get_highlighted_words(
            request.user_id,
            request.words,
            request.difficulty_level,
            request.difficulty_mrs
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch-word-info")
async def batch_word_info(request: WordBatch):
    """
    Get detailed information for multiple words including definitions
    """
    results = []

    for word in request.words:
        info = dictionary_service.lookup(word)
        if info["found"]:
            results.append({
                "word": word,
                "cefr_level": info.get("level"),
                "pos": info.get("pos"),
                "phonetic": info.get("phonetic"),
                "mrs": info.get("mrs"),
                "tag": info.get("tag"),
                "definition": info.get("definition"),
                "translation": info.get("translation")
            })
        else:
            # Fallback for definitions
            definition_data = await get_word_definition_external(word)
            results.append({
                "word": word,
                "cefr_level": None,
                "pos": None,
                "definition": definition_data.get("definition"),
                "example": definition_data.get("example")
            })

    return {"words": results}

# ... (routes)


# Include user routes (known_words, unknown_words, vocabulary)
app.include_router(user_router)

# Include review routes (SRS-based flashcard review system)
app.include_router(review_router)

# Include auth routes
app.include_router(auth_router)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "MixRead Backend",
        "version": "0.2.0",
        "endpoints": {
            "health": "/health",
            "word_info": "/word/{word}",
            "highlight": "POST /highlight-words",
            "users": "GET /users/{user_id}",
            "known_words": "GET /users/{user_id}/known-words",
            "unknown_words": "GET /users/{user_id}/unknown-words",
            "vocabulary": "GET /users/{user_id}/vocabulary"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
