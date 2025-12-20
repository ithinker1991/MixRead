"""
Dictionary Service Infrastructure

Handles hybrid vocabulary lookup:
1. Tier 1: In-Memory Top 30k Core Library (cefr_words.json)
2. Tier 2: On-Disk Full 770k Dictionary (sqlite3)
"""

import json
import os
from typing import Any, Dict, Optional

from sqlalchemy import text

from infrastructure.database import engine


class DictionaryService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DictionaryService, cls).__new__(cls)
            cls._instance.cefr_data = {}
            cls._instance.variant_map = {} # variant -> lemma mapping
            cls._instance.load_core_library()
            cls._instance.load_lemma_index()
        return cls._instance

    def load_core_library(self):
        """Load Tier 1 Core Vocabulary into memory"""
        cefr_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cefr_words.json")
        if os.path.exists(cefr_path):
            try:
                with open(cefr_path, 'r', encoding='utf-8') as f:
                    self.cefr_data = json.load(f)
                print(f"✓ Loaded {len(self.cefr_data)} words from Core Library (Tier 1)")
            except Exception as e:
                print(f"❌ Failed to load Core Library: {e}")
        else:
            print(f"⚠ Warning: Core Library not found at {cefr_path}")

    def load_lemma_index(self):
        """
        Load lemma.en.txt to build variant -> lemma mapping.
        Format: lemma -> variant1, variant2, ...
        """
        try:
            file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "lemma.en.txt")
            if not os.path.exists(file_path):
                print("⚠ lemma.en.txt not found, skipping static lemmatization")
                return

            count = 0
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    # Skip comments or empty lines
                    if line.startswith(';') or not line.strip():
                        continue
                        
                    parts = line.strip().split(" -> ")
                    if len(parts) != 2:
                        continue
                    
                    lemma = parts[0].strip()
                    variants_str = parts[1]
                    variants = [v.strip() for v in variants_str.split(",")]
                    
                    for variant in variants:
                        if variant and variant not in self.variant_map:
                             # Map variant back to its lemma
                             self.variant_map[variant] = lemma
                    count += 1
            print(f"✓ Loaded {len(self.variant_map)} variants from lemma.en.txt")
        except Exception as e:
            print(f"⚠ Failed to load lemma.en.txt: {e}")

    def lookup(self, word: str) -> Dict[str, Any]:
        """
        Lookup word info from hybrid sources.
        Returns dict with keys: found, word, definitions, translation, etc.
        """
        word_lower = word.lower()
        
        # 1. Tier 1: Check Core Library (Memory)
        original_entry = self.cefr_data.get(word_lower)
        
        # 2. Find Lemma (Base Form)
        # Priority 1: ECDICT lemma.en.txt (Static Mapping)
        lemma_word = self.variant_map.get(word_lower)
        
        # Priority 2: lemminflect (Dynamic Analysis) - ONLY if static failed
        if not lemma_word:
            try:
                from lemminflect import getLemma
                # Check Verb, Noun, Adjective for base forms
                for pos in ["VERB", "NOUN", "ADJ"]:
                    lemmas = getLemma(word_lower, upos=pos)
                    if lemmas:
                        lemma_candidate = lemmas[0]
                        # Verify this candidate actually exists in our dictionary
                        if lemma_candidate in self.cefr_data:
                            lemma_word = lemma_candidate
                            break
            except ImportError:
                pass 
            except Exception:
                pass
        
        # 3. Lookup Lemma Data
        lemma_entry = None
        if lemma_word and lemma_word in self.cefr_data:
            lemma_entry = self.cefr_data[lemma_word]
            
        # 4. Decision: Choose Best Entry (Original vs Lemma)
        final_entry = None
        
        if original_entry and lemma_entry:
            # Both exist. Compare difficulty (MRS).
            # Default None to high score (100) to prefer the one with a valid score
            mrs_orig = original_entry.get("mrs")
            mrs_lemma = lemma_entry.get("mrs")
            
            score_orig = 100 if mrs_orig is None else mrs_orig
            score_lemma = 100 if mrs_lemma is None else mrs_lemma
            
            # Prefer the "easier" interpretation (Lower MRS)
            # This handles "taking" (80) vs "take" (0) -> Use "take"
            if score_lemma < score_orig:
                final_entry = lemma_entry
            else:
                final_entry = original_entry
                
        elif original_entry:
            final_entry = original_entry
        elif lemma_entry:
            final_entry = lemma_entry
            
        if final_entry:
            return self._format_entry(word, final_entry)

        # 2. Tier 2: Check Full Dictionary (Database)
        db_result = self._lookup_tier2(word_lower)
        if db_result:
            return {
                "word": word,
                "found": True,
                "source": "full",
                "level": None, # Full dict doesn't have curated levels
                "mrs": None,   # Or calculate dynamic MRS based on ranking if available
                "pos": None,
                "definition": db_result.get("definition"),
                "translation": db_result.get("translation"),
                "phonetic": db_result.get("phonetic"),
                "rank": db_result.get("ranking")
            }

        return {"word": word, "found": False}

    def _lookup_tier2(self, word: str) -> Optional[Dict[str, Any]]:
        """Query SQLite database for full dictionary entry"""
        try:
            # Use direct connection for performance on read-only lookup
            with engine.connect() as conn:
                # Query the 'dictionary' table created by download script
                result = conn.execute(
                    text("SELECT word, ranking, translation, definition, phonetic, tag FROM dictionary WHERE word = :word"),
                    {"word": word}
                ).first()
                
                if result:
                    return {
                        "word": result[0],
                        "ranking": result[1],
                        "translation": result[2],
                        "definition": result[3],
                        "phonetic": result[4],
                        "tag": result[5]
                    }
        except Exception as e:
            # Table might not exist yet if script failed or wasn't run
            print(f"⚠ Tier 2 Lookup Error: {e}")
            
        return None

    def _format_entry(self, word: str, entry: Dict) -> Dict:
        """Format CEFR entry into standard response"""
        return {
            "word": word, # Return original requested word
            "found": True,
            "source": "core",
            "level": entry.get("level") or entry.get("cefr"), 
            "mrs": entry.get("mrs"),
            "pos": entry.get("pos"),
            "definition": entry.get("def"),
            "translation": entry.get("chn"),
            "phonetic": entry.get("ph"),
            "rank": entry.get("rank")
        }

# Global instance
dictionary_service = DictionaryService()
