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

    def calculate_dynamic_mrs(self, rank: Optional[int], tags: str = "", word: str = "", translation: str = "") -> Optional[int]:
        """
        Calculate a rough MRS score (0-100+) based on word frequency ranking, tags, and translation content.
        """
        word_lower = word.lower()
        translation = translation or ""

        # 1. Pinyin Detection (Highest priority for Chinese users)
        if "（汉语拼音）" in translation:
            return 5 # Very easy (A1)

        # 2. Handle common Easy words/contractions without rank
        if "'" in word_lower:
            # Common contractions are usually very easy (A1/A2 range)
            return 15

        # 3. Handle hyphenated words (compound words)
        if "-" in word_lower and (rank is None or rank <= 0) and not tags:
            parts = [p for p in word_lower.split("-") if p]
            if parts:
                part_scores = []
                for p in parts:
                    # Recursive check for parts using lookup logic
                    p_lemma = self.variant_map.get(p, p)
                    p_info = self.cefr_data.get(p_lemma)
                    if p_info and p_info.get("mrs") is not None:
                        part_scores.append(p_info["mrs"])
                    else:
                        # Fallback for common parts
                        if len(p) <= 3: part_scores.append(20) # A1-like
                        else: part_scores.append(80) # Default for unknown parts
                
                # Take the max difficulty of parts but cap at a reasonable level
                return min(max(part_scores), 100)

        # 4. Use translation features for estimation if rank is missing or 0
        if rank is None or rank <= 0:
            # Abbreviations (abbr.)
            if translation.strip().startswith("abbr."):
                is_all_consonants = all(c not in "aeiou" for c in word_lower if c.isalpha())
                if is_all_consonants or len(word_lower) <= 3:
                    return 40 # Common abbr (B1)
                return 60 # Rarer abbr (B2)
                
            # Domain tags in translation
            domain_tags = ["[计]", "[医]", "[经]", "[法]", "[机]"]
            if any(tag in translation for tag in domain_tags):
                return 60 # Technical term (B2)

            # Traditional exam tags
            if tags:
                tag_list = tags.split(' ') if isinstance(tags, str) else []
                if 'zk' in tag_list: return 30  # A2
                if 'gk' in tag_list or 'cet4' in tag_list: return 50  # B1
                if 'cet6' in tag_list: return 70  # B2
                if 'ky' in tag_list or 'toefl' in tag_list or 'ielts' in tag_list: return 90  # C1
                if 'gre' in tag_list: return 110 # C2
            
            # Default for words in dictionary but no ranking/traits
            return 100 

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
            return 100 # Safe default for problematic entries

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
            tags = db_result.get("tag", "")
            ranking = db_result.get("ranking")
            translation = db_result.get("translation", "")
            mrs = self.calculate_dynamic_mrs(ranking, tags, word_lower, translation)
            
            return {
                "word": word,
                "found": True,
                "source": "full",
                "level": self._derive_cefr_from_mrs(mrs), 
                "mrs": mrs,
                "pos": None,
                "definition": db_result.get("definition"),
                "translation": translation,
                "phonetic": db_result.get("phonetic"),
                "rank": ranking,
                "tag": tags
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
        
        # Fallback for MRS if missing even in core library
        if mrs is None:
            tags = " ".join(entry.get("tags", [])) if isinstance(entry.get("tags"), list) else entry.get("tags", "")
            rank = entry.get("rank")
            translation = entry.get("chn", "")
            mrs = self.calculate_dynamic_mrs(rank, tags, word, translation)
            if not level:
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
            "rank": entry.get("rank"),
            "tag": " ".join(entry.get("tags", [])) if isinstance(entry.get("tags"), list) else entry.get("tags", "")
        }

    def _derive_cefr_from_mrs(self, mrs: Optional[int]) -> Optional[str]:
        """Helper to derive CEFR level label from MRS score"""
        if mrs is None:
            return None
        if mrs < 20:
            return "A1"
        if mrs < 40:
            return "A2"
        if mrs < 60:
            return "B1"
        if mrs < 80:
            return "B2"
        if mrs < 100:
            return "C1"
        return "C2"

# Global instance
dictionary_service = DictionaryService()
