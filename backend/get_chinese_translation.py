"""
Simple Chinese translation helper using Free Translation APIs
Uses multiple fallback APIs for reliability
"""

import httpx
import asyncio
from typing import Optional

async def get_chinese_translation(word: str) -> Optional[str]:
    """
    Get Chinese translation for an English word
    Uses free APIs with fallback

    Returns: Chinese translation string or None
    """

    # Try MyMemory Translation API (free, no key needed)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(
                "https://api.mymemory.translated.net/get",
                params={
                    "q": word,
                    "langpair": "en|zh-CN"
                }
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("responseStatus") == 200:
                    translation = data.get("responseData", {}).get("translatedText", "")
                    if translation and translation.lower() != word.lower():
                        # Clean up the translation - take first sentence only
                        translation = translation.split('。')[0].split(',')[0].strip()
                        return translation[:30]  # Limit length
    except Exception as e:
        print(f"MyMemory API error for '{word}': {e}")

    # Fallback: Try LibreTranslate (self-hosted, free)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.post(
                "https://libretranslate.de/translate",
                json={
                    "q": word,
                    "source": "en",
                    "target": "zh",
                    "format": "text"
                }
            )

            if response.status_code == 200:
                data = response.json()
                translation = data.get("translatedText", "")
                if translation and translation.lower() != word.lower():
                    return translation[:30]
    except Exception as e:
        print(f"LibreTranslate API error for '{word}': {e}")

    return None


# Cache for translations to avoid repeated API calls
_translation_cache = {}

async def get_chinese_translation_cached(word: str) -> Optional[str]:
    """
    Get Chinese translation with caching
    """
    word_lower = word.lower()

    if word_lower in _translation_cache:
        return _translation_cache[word_lower]

    translation = await get_chinese_translation(word)

    if translation:
        _translation_cache[word_lower] = translation

    return translation


# Test function
async def test_translations():
    """Test translation API with sample words"""
    test_words = ["beautiful", "difficult", "extraordinary", "simple", "understand"]

    print("Testing translation API...\n")

    for word in test_words:
        translation = await get_chinese_translation(word)
        print(f"{word:20} -> {translation}")


if __name__ == "__main__":
    asyncio.run(test_translations())
