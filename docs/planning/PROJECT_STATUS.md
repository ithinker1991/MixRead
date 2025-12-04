# Project Status & Roadmap

**Last Updated**: 2025-12-04

---

## 🚀 Current Focus (正在进行)

> **Priority**: Vocabulary Expansion & User System

- [ ] **Vocabulary Expansion (Phase 2)**

  - [ ] Import BNC/COCA 10k word lists.
  - [ ] Implement "Hybrid Mode" (Local Core + API Cache).
  - [ ] Expand Chinese dictionary coverage.

- [ ] **User System (Phase 3)**
  - [ ] Cloud Sync implementation.
  - [ ] User Dashboard.

---

## ✅ Changelog / History (已完成)

### Phase 1: MVP (Nov 2025)

- ✅ **Core Highlighting**: CEFR-based word highlighting.
- ✅ **Dictionary**: Hover tooltip with definitions and examples.
- ✅ **Library**: "Add to Library" functionality.
- ✅ **Chinese Support**: Inline Chinese translations.
- ✅ **Domain Exclusion**:
  - Implemented `DomainManagementPolicy` backend architecture.
  - Implemented Frontend `DomainPolicyStore` and `Popup` UI.
  - Supported Blacklist mode and Preset Dialog.

### Phase 2: Vocabulary (Dec 2025)

- ✅ **Data Structure**: Updated static dictionary to support frequency rank and exam tags.
- ✅ **Coverage**: Increased Chinese translation coverage to 89.9%.

---

## 📋 Backlog (待办规划)

### Features

- [ ] **Exam Mode**: Filter words by CET-4/6, IELTS, TOEFL.
- [ ] **Flashcards**: Spaced repetition system (SRS) for review.
- [ ] **Mobile App**: React Native companion app.

### Technical Debt

- [ ] **Migration Tool**: Setup Alembic for database migrations.
- [ ] **Frontend Build**: Migrate to Vite + TypeScript.
- [ ] **Testing**: Increase unit test coverage for backend services.

* [ ] **Frontend Build**: Migrate to Vite + TypeScript.
* [ ] **Testing**: Increase unit test coverage for backend services.
