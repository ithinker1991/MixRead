# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MixRead** is an intelligent English reading enhancement tool (Chrome extension) designed to help users improve their English reading ability without relying on full-text translation.

**Mission**: Help users naturally improve English reading ability through "mixed input + difficulty control" rather than full translation dependence.

### Core Value Propositions
1. **Uninterrupted Reading**: Instant explanations only for unfamiliar words/phrases (not full translation)
2. **Automatic Difficult Word Detection**: AI-powered system automatically identifies and annotates words users may not know
3. **Adjustable Difficulty (Mixed Mode)**: Progressive transition from mixed content to full English reading

## Product Development Stages

The project follows a strict phased approach focused on MVP first, then iteration.

### Phase 1: MVP (0 → First Real User)
**Goal**: Validate that users want enhanced English reading

**Must Build**:
- Intelligent difficult word annotation in English articles
- Hover-based explanations (English definitions + examples, no Chinese translation)
- Difficulty slider (A0–C2) to control annotation density
- Basic word library (simple storage, no review system yet)
- Simple vocabulary statistics (count, daily additions)

**Must NOT Build** (save for later):
- User accounts/auth system
- Payment system
- Review/flashcard system
- Chinese-English mixed mode
- AI sentence parsing
- Mobile support

**Success Metrics**: 3 days of continuous usage by initial users

### Phase 2: Learning Loop (10–1000 Users)
- Reading history navigation
- Word library → flashcard generation
- Daily reviews
- Reading analytics/ability curves
- Basic Chinese mixed mode (5% word replacement)

### Phase 3: Scaled Product (1000–10k Users)
- Advanced sentence analysis
- Content recommendations
- Mobile support (React Native or pure extension)
- Monetization (subscription)

### Phase 4: Platform Maturity
- Multi-skill support (speaking, listening, writing)
- Complete language learning ecosystem

## Architecture Overview

### Client (Chrome Extension)
- Content script injection for text extraction
- DOM parsing to identify text nodes
- Text batch submission to backend
- Dynamic annotation rendering with difficulty filtering
- Hover UI tooltips for word explanations
- Difficulty slider (controls annotation threshold)
- Word library management (add to vocabulary)
- Local caching for performance

### Backend (TBD - likely Python Flask/FastAPI)
- Text processing pipeline
- Difficult word identification (based on: frequency lists, word length, CEFR levels A1–C2)
- English definitions (simple, no translations)
- Example sentence generation
- Word metadata storage
- User vocabulary persistence

### Data Model (Phase 1)
- Difficult words list (word, CEFR level, frequency, definition, examples)
- User vocabulary (words added to library)
- Statistics (total words, daily adds, reading time)

## Development Workflow

### Build & Run
```bash
# Backend setup (when ready)
# pip install -r requirements.txt
# python app.py

# Extension development
# Load unpacked extension in chrome://extensions
```

### Testing
```bash
# Add commands when testing framework is set up
# pytest tests/
# pytest tests/test_word_detection.py -v
```

### Project Structure (when code is added)
Follow DDD (Domain-Driven Design) approach with clear separation:
- **Domain Layer**: Word difficulty detection, CEFR classification, vocabulary management
- **Application Layer**: API endpoints, extension message handlers
- **Infrastructure Layer**: Storage, external service integrations (if any)
- **Presentation Layer**: Extension UI, popup, content script

Avoid over-abstraction. Build incrementally with each phase having happy path tests before advancing.

### Code Organization
- Clean separation between content script (UI) and backend logic
- Reusable word detection algorithms
- Extensible difficulty level system

## Key Implementation Decisions

### Word Difficulty Detection Strategy
Combines multiple signals:
- **Frequency**: Common word lists (top 1000, 2000, 5000 words)
- **Word Length**: Longer words often more difficult
- **CEFR Classification**: A1 (easiest) to C2 (hardest) levels
- **User History**: Adapt to words user has already learned

### Why No Translation?
Full Chinese translation creates dependency. MVP uses English definitions only to encourage learning from context.

### Hover UX (MVP Phase)
- English definition (simplified)
- Example sentence from dictionary/LLM
- Optional pronunciation button
- Minimal, non-intrusive design

### Difficulty Slider (Core Innovation)
- Low setting: More words annotated, easier to understand
- High setting: Fewer annotations, challenges learner
- Allows progressive transition from mixed to pure English reading

## Core Development Principles

### 简单、适用、演进 (Simplicity, Applicability, Evolution)

These three principles guide all development decisions:

1. **简单 (Simplicity)**: Build the minimal viable solution that solves the core problem. Avoid over-engineering, premature optimization, and "nice-to-have" features. Each line of code should serve the MVP goal.

2. **适用 (Applicability)**: Code must work for real users in real scenarios. Focus on happy path implementation first. Test assumptions with actual users before adding complexity.

3. **演进 (Evolution)**: Design for incremental improvement across phases. Don't try to build the perfect system in Phase 1. Build what's needed now; improve in subsequent phases as you learn from users.

**Critical**: DO NOT over-optimize. A simple solution that works beats perfect architecture that delays user validation.

## Important Development Notes

1. **MVP Scope is Sacred**: Don't add secondary phase features (mixed Chinese mode, flashcards, etc.) in Phase 1. Speed to user validation is critical.

2. **DDD Principle**: Build domain models for word difficulty and vocabulary management explicitly, but don't over-engineer. Each phase should be completable with focused effort.

3. **Happy Path First**: Each phase needs working end-to-end flows before expanding features. For MVP: user opens English article → words annotated → hover shows definition → word saved to library.

4. **No User Accounts Yet**: MVP uses browser local storage only. Don't build auth systems before validating product-market fit.

5. **Content Script Isolation**: Extension content scripts have limited DOM access and security constraints—plan interactions carefully with backend.

6. **Performance**: Text processing must be fast (not noticeable lag when reading). Consider batching and async operations.

7. **No Over-Optimization**: Simple, working code > perfect but delayed code. Optimize only when real user data shows bottlenecks.

## References

- Full product roadmap: `DevelopPlan.md`
- Target CEFR levels: A1, A2, B1, B2, C1, C2 (from European Framework)
- Common word lists: Consider using established frequency lists (e.g., British National Corpus, Corpus of Contemporary American English)

## Next Steps When Starting Development

1. Create backend structure (Flask/FastAPI with text processing pipeline)
2. Implement core word difficulty detection algorithm
3. Build Chrome extension scaffold with content script
4. Connect extension to backend for word annotation
5. Implement hover tooltip UI
6. Add difficulty slider
7. Implement word library storage
8. Build simple statistics dashboard
9. Test with 3–5 beta users and iterate
