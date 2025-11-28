"""
MixRead Backend - MVP Phase 1
Simple FastAPI server for word difficulty detection and definition lookup
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from typing import Optional
import httpx
import asyncio

app = FastAPI(title="MixRead Backend", version="0.1.0")

# Add CORS middleware to allow requests from Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global CEFR data cache
cefr_data = {}
chinese_dict = {}  # Chinese translation dictionary

class WordInfo(BaseModel):
    word: str
    cefr_level: Optional[str] = None
    frequency_rank: Optional[int] = None
    definition: Optional[str] = None
    example: Optional[str] = None
    chinese: Optional[str] = None  # Chinese translation

class WordBatch(BaseModel):
    words: list[str]
    difficulty_level: str = "B1"  # A1, A2, B1, B2, C1, C2

def load_cefr_data():
    """Load CEFR word database from JSON file"""
    global cefr_data
    cefr_path = os.path.join(os.path.dirname(__file__), "data", "cefr_words.json")
    if os.path.exists(cefr_path):
        with open(cefr_path, 'r', encoding='utf-8') as f:
            cefr_data = json.load(f)
        print(f"Loaded {len(cefr_data)} words from CEFR database")
    else:
        print(f"Warning: CEFR database not found at {cefr_path}")

def load_chinese_dict():
    """Load Chinese translation dictionary"""
    global chinese_dict
    dict_path = os.path.join(os.path.dirname(__file__), "chinese_dict.json")
    if os.path.exists(dict_path):
        with open(dict_path, 'r', encoding='utf-8') as f:
            chinese_dict = json.load(f)
        print(f"Loaded {len(chinese_dict)} Chinese translations")
    else:
        print(f"Warning: Chinese dictionary not found at {dict_path}")

def get_cefr_level_rank(level: str) -> int:
    """Convert CEFR level string to numeric rank for comparison"""
    levels = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
    return levels.get(level, 0)

def should_highlight_word(word: str, user_level: str) -> bool:
    """
    Determine if a word should be highlighted based on:
    CEFR level >= user level
    """
    if word.lower() not in cefr_data:
        return False

    word_info = cefr_data[word.lower()]
    cefr_level = word_info.get("cefr_level", "A1")

    # Check difficulty level
    word_level_rank = get_cefr_level_rank(cefr_level)
    user_level_rank = get_cefr_level_rank(user_level)

    # Only highlight if word difficulty >= user level
    return word_level_rank >= user_level_rank

async def get_word_definition(word: str) -> dict:
    """
    Fetch word definition from Free Dictionary API
    Returns: {"definition": "...", "example": "..."}
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"https://api.dictionaryapi.dev/api/v2/entries/en/{word.lower()}")
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    entry = data[0]
                    # Extract definition
                    definition = ""
                    if "meanings" in entry and len(entry["meanings"]) > 0:
                        meanings = entry["meanings"][0]
                        if "definitions" in meanings and len(meanings["definitions"]) > 0:
                            definition = meanings["definitions"][0].get("definition", "")

                    # Extract example
                    example = ""
                    if "meanings" in entry and len(entry["meanings"]) > 0:
                        meanings = entry["meanings"][0]
                        if "definitions" in meanings and len(meanings["definitions"]) > 0:
                            example = meanings["definitions"][0].get("example", "")

                    return {
                        "definition": definition,
                        "example": example
                    }
    except Exception as e:
        print(f"Error fetching definition for {word}: {e}")

    return {"definition": "", "example": ""}

@app.on_event("startup")
async def startup_event():
    """Load CEFR data and Chinese dictionary on startup"""
    load_cefr_data()
    load_chinese_dict()

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "words_loaded": len(cefr_data)}

@app.get("/word/{word}")
async def get_word(word: str):
    """Get word information including CEFR level, definition, and Chinese translation"""
    # Get Chinese translation
    chinese = chinese_dict.get(word.lower())

    if word.lower() not in cefr_data:
        # Try to fetch from external API anyway
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

@app.post("/highlight-words")
async def highlight_words(batch: WordBatch):
    """
    Check which words in a batch should be highlighted based on user's difficulty level.
    Returns list of words that meet the highlighting criteria.

    IMPORTANT: Only highlights words that have Chinese translations!
    This ensures every highlighted word shows Chinese.
    """
    highlighted = []
    word_details = []

    for word in batch.words:
        # Check if word meets difficulty level AND has Chinese translation
        if should_highlight_word(word, batch.difficulty_level):
            chinese = chinese_dict.get(word.lower())

            # Only highlight if Chinese translation exists
            if chinese:
                highlighted.append(word)
                if word.lower() in cefr_data:
                    word_info = cefr_data[word.lower()]
                    word_details.append({
                        "word": word,
                        "cefr_level": word_info.get("cefr_level"),
                        "pos": word_info.get("pos"),
                        "chinese": chinese
                    })

    return {
        "difficulty_level": batch.difficulty_level,
        "total_words": len(batch.words),
        "highlighted_count": len(highlighted),
        "highlighted_words": highlighted,
        "word_details": word_details
    }

@app.post("/batch-word-info")
async def batch_word_info(batch: WordBatch):
    """
    Get detailed information for multiple words including definitions.
    Used for getting definitions when user hovers over highlighted words.
    """
    results = []

    # Fetch definitions concurrently
    tasks = [get_word_definition(word) for word in batch.words]
    definitions = await asyncio.gather(*tasks)

    for word, definition_data in zip(batch.words, definitions):
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
