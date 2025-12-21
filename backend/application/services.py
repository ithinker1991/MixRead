"""
Application Services - Use Case Orchestration

Coordinates domain logic, infrastructure, and data access
Implements specific business use cases
"""

from typing import Dict, List, Optional

from domain.models import User, VocabularyEntry, Word
from domain.services import DifficultyService, HighlightService
from infrastructure.models import DomainPolicyType
from infrastructure.repositories import DomainManagementPolicyRepository, UserRepository


class UserApplicationService:
    """
    User application service - coordinates user-related use cases
    """

    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    def mark_word_as_known(self, user_id: str, word: str):
        """
        Use case: User marks a word as known
        Returns the updated user
        """
        user = self.user_repository.get_user(user_id)
        user.add_known_word(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word marked as known"}

    def mark_word_as_unknown(self, user_id: str, word: str):
        """
        Use case: User marks a word as unknown/not knowing
        Returns the updated user
        """
        user = self.user_repository.get_user(user_id)
        user.add_unknown_word(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word marked as unknown"}

    def unmark_word_as_known(self, user_id: str, word: str):
        """
        Use case: User removes a word from known list
        """
        user = self.user_repository.get_user(user_id)
        user.remove_known_word(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word removed from known list"}

    def unmark_word_as_unknown(self, user_id: str, word: str):
        """
        Use case: User removes a word from unknown list
        """
        user = self.user_repository.get_user(user_id)
        user.remove_unknown_word(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word removed from unknown list"}

    def add_to_vocabulary(self, user_id: str, word: str):
        """
        Use case: User adds a word to vocabulary for learning
        """
        user = self.user_repository.get_user(user_id)
        user.add_to_vocabulary(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word added to vocabulary"}

    def remove_from_vocabulary(self, user_id: str, word: str):
        """
        Use case: User removes a word from vocabulary
        """
        user = self.user_repository.get_user(user_id)
        user.remove_from_vocabulary(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word removed from vocabulary"}

    def get_user_data(self, user_id: str):
        """
        Use case: Get user's complete data
        Returns known_words, unknown_words, and vocabulary
        """
        user = self.user_repository.get_user(user_id)
        return {
            "success": True,
            "user_id": user.user_id,
            "known_words": list(user.known_words),
            "unknown_words": list(user.unknown_words),
            "vocabulary": list(user.vocabulary.keys())
        }

    def get_known_words(self, user_id: str):
        """Get user's known words list"""
        words = self.user_repository.get_known_words(user_id)
        return {
            "success": True,
            "known_words": list(words)
        }

    def get_unknown_words(self, user_id: str):
        """Get user's unknown words list"""
        words = self.user_repository.get_unknown_words(user_id)
        return {
            "success": True,
            "unknown_words": list(words)
        }

    def get_library(self, user_id: str):
        """
        Use case: Get user's library words with learning context
        """
        user = self.user_repository.get_user(user_id)
        return {
            "success": True,
            "library": user.get_library_with_context()
        }

    def add_to_library(self, user_id: str, words: List[str], contexts: List[Dict] = None):
        """
        Use case: Add words to library with learning context
        (Unified: contexts are stored in VocabularyEntry)
        """
        user = self.user_repository.get_user(user_id)
        user.add_to_library(words, contexts)
        self.user_repository.save_user(user)
        
        return {
            "success": True,
            "message": f"{len(words)} word(s) added to library",
            "added_count": len(words)
        }

    def remove_from_library(self, user_id: str, word: str):
        """
        Use case: Remove a word from library
        """
        user = self.user_repository.get_user(user_id)
        user.remove_from_library(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word removed from library"}


class HighlightApplicationService:
    """
    Highlight application service - coordinates word highlighting logic
    """

    def __init__(self, user_repository: UserRepository, dictionary_service):
        self.user_repository = user_repository
        self.dictionary_service = dictionary_service

    def get_highlighted_words(
        self,
        user_id: str,
        words: List[str],
        difficulty_level: str,
        difficulty_mrs: Optional[int] = None
    ) -> Dict:
        """
        Use case: Get words that should be highlighted based on:
        1. user_id's known_words and unknown_words (Priority 1)
        2. difficulty_level (Priority 2) - OR difficulty_mrs if provided
        """
        # Validate user_id
        if not user_id:
            return {
                "success": False,
                "error": "user_id is required"
            }

        # Validate difficulty level if MRS not provided
        if difficulty_mrs is None and not DifficultyService.is_valid_level(difficulty_level):
            return {
                "success": False,
                "error": f"Invalid difficulty level: {difficulty_level}"
            }

        # Load user data
        user = self.user_repository.get_user(user_id)

        highlighted = []
        word_details = []

        for word_text in words:
            word_lower = word_text.lower()
            
            # Lookup word info using Hybrid Dictionary Service
            word_info = self.dictionary_service.lookup(word_text)
            
            # Priority 1: Check if user explicitly marked as unknown
            if word_lower in user.unknown_words:
                highlighted.append(word_text)
                word_details.append({
                    "word": word_text,
                    "cefr_level": word_info.get("level", "Unknown"),
                    "mrs": word_info.get("mrs", 0),
                    "phonetic": word_info.get("phonetic", ""),
                    "pos": word_info.get("pos", "unknown"),
                    "chinese": word_info.get("translation", ""),
                    "reason": "user_marked_unknown"
                })
                continue

            # Priority 2: Check if user explicitly marked as known
            if word_lower in user.known_words:
                continue

            # Priority 3: Apply Difficulty Logic
            if not word_info["found"]:
                continue
                
            # Use dynamic MRS from dictionary service if curated one is missing
            mrs_score = word_info.get("mrs")
            if mrs_score is None:
                # If truly unknown, default to 100, but dictionary_service.lookup
                # should now provide dynamic MRS for Tier 2 words.
                mrs_score = 100
            
            cefr_level = word_info.get("level") or "C2"
            
            # Create domain Word object
            word_obj = Word(word_text, cefr_level)
            # Inject MRS into word object (monkey patch for now, or update model later)
            word_obj.mrs = mrs_score

            # Check if should highlight
            should_highlight = False
            if difficulty_mrs is not None:
                # Use granular MRS logic
                should_highlight = HighlightService.should_highlight_mrs(
                    word_obj,
                    difficulty_mrs,
                    user.known_words,
                    user.unknown_words
                )
            else:
                # Use legacy CEFR logic
                should_highlight = HighlightService.should_highlight(
                    word_obj,
                    difficulty_level,
                    user.known_words,
                    user.unknown_words
                )

            if should_highlight:
                highlighted.append(word_text)
                word_details.append({
                    "word": word_text,
                    "cefr_level": cefr_level,
                    "mrs": mrs_score,
                    "phonetic": word_info.get("phonetic", ""),
                    "pos": word_info.get("pos"),
                    "chinese": word_info.get("translation", ""),
                    "reason": "difficulty_based"
                })

        return {
            "success": True,
            "difficulty_level": difficulty_level,
            "difficulty_mrs": difficulty_mrs,
            "total_words": len(words),
            "highlighted_count": len(highlighted),
            "highlighted_words": highlighted,
            "word_details": word_details
        }


class DomainManagementService:
    """
    Domain Management Service - handles domain policy use cases
    Manages blacklist/whitelist domain policies for users
    """

    def __init__(self, domain_repo: DomainManagementPolicyRepository):
        self.domain_repo = domain_repo

    # ========== 黑名单操作 ==========

    def add_blacklist_domain(
        self,
        user_id: str,
        domain: str,
        description: Optional[str] = None
    ) -> Dict:
        """
        Use case: User adds a domain to blacklist
        """
        try:
            policy = self.domain_repo.add_domain(
                user_id=user_id,
                domain=domain,
                policy_type=DomainPolicyType.BLACKLIST,
                description=description
            )
            return {
                "success": True,
                "message": f"Domain {domain} added to blacklist",
                "domain": domain,
                "policy_type": "blacklist"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to add domain: {str(e)}",
                "error": str(e)
            }

    def remove_blacklist_domain(self, user_id: str, domain: str) -> Dict:
        """
        Use case: User removes a domain from blacklist
        """
        try:
            removed = self.domain_repo.remove_domain(
                user_id=user_id,
                domain=domain,
                policy_type=DomainPolicyType.BLACKLIST
            )
            if removed:
                return {
                    "success": True,
                    "message": f"Domain {domain} removed from blacklist",
                    "domain": domain
                }
            else:
                return {
                    "success": False,
                    "message": f"Domain {domain} not found in blacklist"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to remove domain: {str(e)}",
                "error": str(e)
            }

    def get_blacklist_domains(self, user_id: str) -> Dict:
        """
        Use case: Get all blacklist domains for user
        """
        try:
            domains = self.domain_repo.get_by_user_and_type(
                user_id=user_id,
                policy_type=DomainPolicyType.BLACKLIST
            )
            return {
                "success": True,
                "blacklist_domains": domains,
                "count": len(domains)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to get blacklist: {str(e)}",
                "error": str(e)
            }

    def get_blacklist_policies(self, user_id: str) -> Dict:
        """
        Use case: Get all blacklist policies with full details
        """
        try:
            policies = self.domain_repo.get_policies_by_user_and_type(
                user_id=user_id,
                policy_type=DomainPolicyType.BLACKLIST
            )
            policies_data = [
                {
                    "id": p.id,
                    "domain": p.domain,
                    "description": p.description,
                    "added_at": p.added_at.isoformat() if p.added_at else None,
                    "is_active": p.is_active
                }
                for p in policies
            ]
            return {
                "success": True,
                "policies": policies_data,
                "count": len(policies_data)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to get blacklist policies: {str(e)}",
                "error": str(e)
            }

    # ========== 白名单操作 ==========

    def add_whitelist_domain(
        self,
        user_id: str,
        domain: str,
        description: Optional[str] = None
    ) -> Dict:
        """
        Use case: User adds a domain to whitelist
        """
        try:
            policy = self.domain_repo.add_domain(
                user_id=user_id,
                domain=domain,
                policy_type=DomainPolicyType.WHITELIST,
                description=description
            )
            return {
                "success": True,
                "message": f"Domain {domain} added to whitelist",
                "domain": domain,
                "policy_type": "whitelist"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to add domain: {str(e)}",
                "error": str(e)
            }

    def remove_whitelist_domain(self, user_id: str, domain: str) -> Dict:
        """
        Use case: User removes a domain from whitelist
        """
        try:
            removed = self.domain_repo.remove_domain(
                user_id=user_id,
                domain=domain,
                policy_type=DomainPolicyType.WHITELIST
            )
            if removed:
                return {
                    "success": True,
                    "message": f"Domain {domain} removed from whitelist",
                    "domain": domain
                }
            else:
                return {
                    "success": False,
                    "message": f"Domain {domain} not found in whitelist"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to remove domain: {str(e)}",
                "error": str(e)
            }

    def get_whitelist_domains(self, user_id: str) -> Dict:
        """
        Use case: Get all whitelist domains for user
        """
        try:
            domains = self.domain_repo.get_by_user_and_type(
                user_id=user_id,
                policy_type=DomainPolicyType.WHITELIST
            )
            return {
                "success": True,
                "whitelist_domains": domains,
                "count": len(domains)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to get whitelist: {str(e)}",
                "error": str(e)
            }

    # ========== 通用检查 ==========

    def should_exclude_domain(self, user_id: str, domain: str) -> Dict:
        """
        Use case: Check if a domain should be excluded
        Current logic: only blacklist support
        Returns True if domain is in blacklist
        """
        try:
            in_blacklist = self.domain_repo.domain_exists(
                user_id=user_id,
                domain=domain,
                policy_type=DomainPolicyType.BLACKLIST
            )
            return {
                "success": True,
                "should_exclude": in_blacklist,
                "reason": "domain_in_blacklist" if in_blacklist else "not_in_blacklist"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to check domain: {str(e)}",
                "error": str(e),
                "should_exclude": False  # Default to NOT excluding on error
            }

    # ========== 统计 ==========

    def get_statistics(self, user_id: str) -> Dict:
        """
        Use case: Get domain management statistics
        """
        try:
            blacklist_count = self.domain_repo.count_by_type(
                user_id=user_id,
                policy_type=DomainPolicyType.BLACKLIST
            )
            whitelist_count = self.domain_repo.count_by_type(
                user_id=user_id,
                policy_type=DomainPolicyType.WHITELIST
            )
            return {
                "success": True,
                "blacklist_count": blacklist_count,
                "whitelist_count": whitelist_count,
                "total_policies": blacklist_count + whitelist_count
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to get statistics: {str(e)}",
                "error": str(e)
            }

    # ========== 批量操作 ==========

    def add_blacklist_domains_batch(
        self,
        user_id: str,
        domains: List[str]
    ) -> Dict:
        """
        Use case: Add multiple domains to blacklist
        """
        try:
            policies = self.domain_repo.add_domains_batch(
                user_id=user_id,
                domains=domains,
                policy_type=DomainPolicyType.BLACKLIST
            )
            return {
                "success": True,
                "message": f"Added {len(policies)} domains to blacklist",
                "domains_added": domains,
                "count": len(policies)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to add domains: {str(e)}",
                "error": str(e)
            }

    def remove_blacklist_domains_batch(
        self,
        user_id: str,
        domains: List[str]
    ) -> Dict:
        """
        Use case: Remove multiple domains from blacklist
        """
        try:
            count = self.domain_repo.remove_domains_batch(
                user_id=user_id,
                domains=domains,
                policy_type=DomainPolicyType.BLACKLIST
            )
            return {
                "success": True,
                "message": f"Removed {count} domains from blacklist",
                "count": count
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to remove domains: {str(e)}",
                "error": str(e)
            }
