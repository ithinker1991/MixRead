"""
MixRead Backend - MVP Phase 1 with DDD Architecture

Layered architecture:
- Domain: Core business logic (models, services)
- Application: Use case orchestration
- Infrastructure: Database, ORM, repositories
- Presentation: API routes
"""

import json
import os
import asyncio
import sys
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Import DDD layers
from infrastructure.database import get_db, init_db
from infrastructure.repositories import UserRepository
from application.services import UserApplicationService, HighlightApplicationService
from api.routes import router as user_router
from api.review import router as review_router

# Initialize FastAPI app
app = FastAPI(
    title="MixRead Backend",
    version="0.2.0",
    description="English reading enhancement with word difficulty control"
)

# Add Private Network Access support FIRST (executes LAST in middleware stack)
# This ensures headers are added to all responses
@app.middleware("http")
async def add_private_network_headers(request, call_next):
    response = await call_next(request)
    # Always allow private network access for all requests
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    sys.stderr.write(f"[CORS DEBUG] Added Private-Network header to {request.method} {request.url.path}\n")
    sys.stderr.flush()
    # For OPTIONS requests, also set these
    if request.method == "OPTIONS":
        response.headers["Access-Control-Request-Private-Network"] = "true"
    return response

# Add CORS middleware AFTER private network middleware
# (will execute BEFORE in the stack)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Access-Control-Allow-Private-Network"],
)

# Global data caches
cefr_data = {}
chinese_dict = {}
definition_cache = {}

# Pydantic models for API
class WordBatch(BaseModel):
    user_id: str
    words: list[str]
    difficulty_level: str = "B1"


class WordInfo(BaseModel):
    word: str
    cefr_level: Optional[str] = None
    frequency_rank: Optional[int] = None
    definition: Optional[str] = None
    example: Optional[str] = None
    chinese: Optional[str] = None


# Data loading functions
def load_cefr_data():
    """Load CEFR word database from JSON file"""
    global cefr_data
    cefr_path = os.path.join(os.path.dirname(__file__), "data", "cefr_words.json")
    if os.path.exists(cefr_path):
        with open(cefr_path, 'r', encoding='utf-8') as f:
            cefr_data = json.load(f)
        print(f"✓ Loaded {len(cefr_data)} words from CEFR database")
    else:
        print(f"⚠ Warning: CEFR database not found at {cefr_path}")


def load_chinese_dict():
    """Load Chinese translation dictionary"""
    global chinese_dict
    dict_path = os.path.join(os.path.dirname(__file__), "chinese_dict.json")
    if os.path.exists(dict_path):
        with open(dict_path, 'r', encoding='utf-8') as f:
            chinese_dict = json.load(f)
        print(f"✓ Loaded {len(chinese_dict)} Chinese translations")
    else:
        print(f"⚠ Warning: Chinese dictionary not found at {dict_path}")


async def get_word_definition(word: str) -> dict:
    """
    Fetch word definition from Free Dictionary API with caching
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
    load_cefr_data()
    load_chinese_dict()
    init_db()
    print("✓ Database initialized\n")


# Health check
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "0.2.0",
        "words_loaded": len(cefr_data),
        "chinese_translations": len(chinese_dict)
    }

# Handle OPTIONS requests for CORS preflight (including Private Network Access)
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle OPTIONS requests for CORS preflight"""
    return {"detail": "ok"}


# Word information endpoints
@app.get("/word/{word}")
async def get_word(word: str):
    """Get word information including CEFR level, definition, and Chinese translation"""
    chinese = chinese_dict.get(word.lower())

    if word.lower() not in cefr_data:
        definition_data = await get_word_definition(word)
        return {
            "word": word,
            "found": False,
            "definition": definition_data.get("definition"),
            "example": definition_data.get("example"),
            "chinese": chinese
        }

    word_info = cefr_data[word.lower()]
    definition_data = await get_word_definition(word)

    return {
        "word": word,
        "found": True,
        "cefr_level": word_info.get("cefr_level"),
        "pos": word_info.get("pos"),
        "definition": definition_data.get("definition"),
        "example": definition_data.get("example"),
        "chinese": chinese
    }


# Highlight endpoint (core feature)
@app.post("/highlight-words")
async def highlight_words(request: WordBatch, db: Session = Depends(get_db)):
    """
    Get highlighted words based on user's difficulty level and word lists

    Priority for highlighting:
    1. unknown_words - user explicitly marked as not knowing
    2. known_words - user explicitly marked as knowing
    3. difficulty_level - default CEFR level-based rule
    """
    try:
        service = HighlightApplicationService(
            UserRepository(db),
            cefr_data,
            chinese_dict
        )
        result = service.get_highlighted_words(
            request.user_id,
            request.words,
            request.difficulty_level
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

    tasks = [get_word_definition(word) for word in request.words]
    definitions = await asyncio.gather(*tasks)

    for word, definition_data in zip(request.words, definitions):
        if word.lower() in cefr_data:
            word_info = cefr_data[word.lower()]
            results.append({
                "word": word,
                "cefr_level": word_info.get("cefr_level"),
                "pos": word_info.get("pos"),
                "definition": definition_data.get("definition"),
                "example": definition_data.get("example")
            })
        else:
            results.append({
                "word": word,
                "cefr_level": None,
                "pos": None,
                "definition": definition_data.get("definition"),
                "example": definition_data.get("example")
            })

    return {"words": results}


# Include user routes (known_words, unknown_words, vocabulary)
app.include_router(user_router)

# Include review routes (SRS-based flashcard review system)
app.include_router(review_router)

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
