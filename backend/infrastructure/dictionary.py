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
                    
                    # Handle "lemma/rank" format in lemma.en.txt
                    lemma_part = parts[0].strip()
                    lemma = lemma_part.split("/")[0] if "/" in lemma_part else lemma_part
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

    def calculate_dynamic_mrs(self, rank: Optional[int]) -> Optional[int]:
        """
        Calculate a rough MRS score (0-100+) based on word frequency ranking.
        Based on the mapping:
        - Top 1k: 0-20
        - 1k-3k: 20-40
        - 3k-6k: 40-60
        - 6k-10k: 60-80
        - 10k-15k: 80-100
        - 15k+: 100+
        """
        if rank is None or rank <= 0:
            return None
            
        import math
        try:
            if rank <= 1000:
                # 0 - 20 scale
                return int((math.log10(rank) / 3.0) * 20)
            elif rank <= 15000:
                # 20 - 100 scale
                # log10(1000) = 3, log10(15000) = 4.17
                # Linear mapping from log scale
                normalized = (math.log10(rank) - 3.0) / (4.176 - 3.0)
                return int(20 + normalized * 80)
            else:
                # 100+ scale
                # 15k is ~100, 100k is ~150
                normalized = (math.log10(rank) - 4.176) / (5.0 - 4.176)
                return int(100 + normalized * 50)
        except Exception:
            return 100 # Safe default for生僻词

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
                "level": self._derive_cefr_from_mrs(self.calculate_dynamic_mrs(db_result.get("ranking"))), 
                "mrs": self.calculate_dynamic_mrs(db_result.get("ranking")),
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
        level = entry.get("level") or entry.get("cefr")
        mrs = entry.get("mrs")
        
        # If level is Unknown or missing, try to derive it from MRS
        if (not level or level == "Unknown") and mrs is not None:
             level = self._derive_cefr_from_mrs(mrs)
             
        return {
            "word": word, # Return original requested word
            "found": True,
            "source": "core",
            "level": level, 
            "mrs": mrs,
            "pos": entry.get("pos"),
            "definition": entry.get("def"),
            "translation": entry.get("chn"),
            "phonetic": entry.get("ph"),
            "rank": entry.get("rank")
        }

    def _derive_cefr_from_mrs(self, mrs: Optional[int]) -> Optional[str]:
        """Helper to derive CEFR level label from MRS score"""
        if mrs is None: return None
        if mrs < 20: return "A1"
        if mrs < 40: return "A2"
        if mrs < 60: return "B1"
        if mrs < 80: return "B2"
        if mrs < 100: return "C1"
        return "C2"

# Global instance
dictionary_service = DictionaryService()
