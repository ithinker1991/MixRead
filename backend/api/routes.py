"""
API Routes - FastAPI endpoints

Presentation layer that exposes the application services via HTTP
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from infrastructure.database import get_db
from infrastructure.repositories import UserRepository, DomainManagementPolicyRepository
from application.services import UserApplicationService, HighlightApplicationService, DomainManagementService

router = APIRouter(prefix="/users", tags=["users"])


class MarkWordRequest(BaseModel):
    """Request model for marking words"""
    word: str


class HighlightWordsRequest(BaseModel):
    """Request model for getting highlighted words"""
    user_id: str
    words: list[str]
    difficulty_level: str = "B1"


class AddToLibraryRequest(BaseModel):
    """Request model for adding words to library with context"""
    words: list[str]
    contexts: list[dict] = []


class AddDomainRequest(BaseModel):
    """Request model for adding domain to policy"""
    domain: str
    description: Optional[str] = None


class AddDomainsRequest(BaseModel):
    """Request model for batch adding domains"""
    domains: List[str]


class RemoveDomainsRequest(BaseModel):
    """Request model for batch removing domains"""
    domains: List[str]


class CheckDomainRequest(BaseModel):
    """Request model for checking if domain should be excluded"""
    domain: str


# Dependency injection helpers
def get_user_service(db: Session = Depends(get_db)):
    """Get user application service"""
    repo = UserRepository(db)
    return UserApplicationService(repo)


def get_domain_service(db: Session = Depends(get_db)):
    """Get domain management service"""
    repo = DomainManagementPolicyRepository(db)
    return DomainManagementService(repo)


# User Management Routes

@router.get("/{user_id}")
async def get_user(user_id: str, db: Session = Depends(get_db)):
    """Get user's complete data"""
    service = UserApplicationService(UserRepository(db))
    result = service.get_user_data(user_id)
    return result


@router.get("/{user_id}/known-words")
async def get_known_words(user_id: str, db: Session = Depends(get_db)):
    """Get user's known words list"""
    service = UserApplicationService(UserRepository(db))
    result = service.get_known_words(user_id)
    return result


@router.post("/{user_id}/known-words")
async def mark_word_as_known(
    user_id: str,
    request: MarkWordRequest,
    service: UserApplicationService = Depends(get_user_service)
):
    """Mark a word as known"""
    result = service.mark_word_as_known(user_id, request.word)
    return result


@router.delete("/{user_id}/known-words/{word}")
async def unmark_word_as_known(
    user_id: str,
    word: str,
    service: UserApplicationService = Depends(get_user_service)
):
    """Remove a word from known words"""
    result = service.unmark_word_as_known(user_id, word)
    return result


@router.get("/{user_id}/unknown-words")
async def get_unknown_words(user_id: str, db: Session = Depends(get_db)):
    """Get user's unknown words list"""
    service = UserApplicationService(UserRepository(db))
    result = service.get_unknown_words(user_id)
    return result


@router.post("/{user_id}/unknown-words")
async def mark_word_as_unknown(
    user_id: str,
    request: MarkWordRequest,
    service: UserApplicationService = Depends(get_user_service)
):
    """Mark a word as unknown/not knowing"""
    result = service.mark_word_as_unknown(user_id, request.word)
    return result


@router.delete("/{user_id}/unknown-words/{word}")
async def unmark_word_as_unknown(
    user_id: str,
    word: str,
    service: UserApplicationService = Depends(get_user_service)
):
    """Remove a word from unknown words"""
    result = service.unmark_word_as_unknown(user_id, word)
    return result


@router.get("/{user_id}/vocabulary")
async def get_vocabulary(user_id: str, db: Session = Depends(get_db)):
    """Get user's vocabulary list"""
    service = UserApplicationService(UserRepository(db))
    user_data = service.get_user_data(user_id)
    return {
        "success": True,
        "vocabulary": user_data["vocabulary"]
    }


@router.post("/{user_id}/vocabulary")
async def add_to_vocabulary(
    user_id: str,
    request: MarkWordRequest,
    service: UserApplicationService = Depends(get_user_service)
):
    """Add a word to vocabulary"""
    result = service.add_to_vocabulary(user_id, request.word)
    return result


@router.delete("/{user_id}/vocabulary/{word}")
async def remove_from_vocabulary(
    user_id: str,
    word: str,
    service: UserApplicationService = Depends(get_user_service)
):
    """Remove a word from vocabulary"""
    result = service.remove_from_vocabulary(user_id, word)
    return result


# Library Routes (for words user wants to learn)

@router.get("/{user_id}/library")
async def get_library(user_id: str, db: Session = Depends(get_db)):
    """Get user's library words (words to learn) with context"""
    service = UserApplicationService(UserRepository(db))
    result = service.get_library(user_id)
    return result


@router.post("/{user_id}/library")
async def add_to_library(
    user_id: str,
    request: AddToLibraryRequest,
    service: UserApplicationService = Depends(get_user_service)
):
    """Add words to library with learning context"""
    result = service.add_to_library(user_id, request.words, request.contexts)
    return result


@router.delete("/{user_id}/library/{word}")
async def remove_from_library(
    user_id: str,
    word: str,
    service: UserApplicationService = Depends(get_user_service)
):
    """Remove a word from library"""
    result = service.remove_from_library(user_id, word)
    return result


# ========== Domain Management Routes ==========

# Blacklist endpoints
@router.get("/{user_id}/domain-policies/blacklist")
async def get_blacklist_domains(
    user_id: str,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Get all blacklist domains for user"""
    return service.get_blacklist_domains(user_id)


@router.get("/{user_id}/domain-policies/blacklist/detailed")
async def get_blacklist_policies(
    user_id: str,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Get all blacklist policies with detailed information"""
    return service.get_blacklist_policies(user_id)


@router.post("/{user_id}/domain-policies/blacklist")
async def add_blacklist_domain(
    user_id: str,
    request: AddDomainRequest,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Add domain to blacklist"""
    return service.add_blacklist_domain(user_id, request.domain, request.description)


@router.post("/{user_id}/domain-policies/blacklist/batch")
async def add_blacklist_domains_batch(
    user_id: str,
    request: AddDomainsRequest,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Add multiple domains to blacklist"""
    return service.add_blacklist_domains_batch(user_id, request.domains)


@router.delete("/{user_id}/domain-policies/blacklist/{domain}")
async def remove_blacklist_domain(
    user_id: str,
    domain: str,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Remove domain from blacklist"""
    return service.remove_blacklist_domain(user_id, domain)


@router.post("/{user_id}/domain-policies/blacklist/batch-remove")
async def remove_blacklist_domains_batch(
    user_id: str,
    request: RemoveDomainsRequest,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Remove multiple domains from blacklist"""
    return service.remove_blacklist_domains_batch(user_id, request.domains)


# Whitelist endpoints (for future use, Phase 2+)
@router.get("/{user_id}/domain-policies/whitelist")
async def get_whitelist_domains(
    user_id: str,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Get all whitelist domains for user"""
    return service.get_whitelist_domains(user_id)


@router.post("/{user_id}/domain-policies/whitelist")
async def add_whitelist_domain(
    user_id: str,
    request: AddDomainRequest,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Add domain to whitelist"""
    return service.add_whitelist_domain(user_id, request.domain, request.description)


@router.delete("/{user_id}/domain-policies/whitelist/{domain}")
async def remove_whitelist_domain(
    user_id: str,
    domain: str,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Remove domain from whitelist"""
    return service.remove_whitelist_domain(user_id, domain)


# Utility endpoints
@router.post("/{user_id}/domain-policies/check")
async def check_domain_excluded(
    user_id: str,
    request: CheckDomainRequest,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Check if a domain should be excluded"""
    return service.should_exclude_domain(user_id, request.domain)


@router.get("/{user_id}/domain-policies/statistics")
async def get_domain_statistics(
    user_id: str,
    service: DomainManagementService = Depends(get_domain_service)
):
    """Get domain management statistics"""
    return service.get_statistics(user_id)
