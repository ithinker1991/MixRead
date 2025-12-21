# Vocabulary Review & Spaced Repetition System

## Overview

The Vocabulary Review system extends MixRead's existing vocabulary management with intelligent flashcard-based learning using Spaced Repetition System (SRS) algorithms. This feature transforms passive vocabulary collection into active learning through structured review sessions.

## Current State Analysis

### Existing Infrastructure

#### **Data Models** (from `backend/domain/models.py`)

- ✅ `VocabularyEntry` (Unified): Tracks both SRS status (LEARNING/REVIEWING/MASTERED) and learning contexts.
- ✅ Metadata: `attempt_count`, `last_reviewed`, `review_interval`, `ease_factor`, `next_review`.
- ✅ Contexts: List of original sentences and URLs where the word was encountered.
- ✅ CEFR levels and frequency rankings.

> [!NOTE] > `LibraryEntry` is now unified into `VocabularyEntry`. The user's "Library" is a view of their `VocabularyEntry` collection where they have preservation of context and SRS state.

#### **API Endpoints** (from `backend/api/routes.py`)

- ✅ Full CRUD operations for vocabulary
- ✅ Known/unknown words management
- ✅ Library with context support

#### **Frontend Components**

- ✅ Library viewer with bulk operations
- ✅ Vocabulary statistics dashboard
- ✅ Real-time word highlighting system

### Implementation Gaps

#### **Missing SRS Components**

- ❌ Spaced repetition scheduling algorithm
- ❌ Review queue management
- ❌ Flashcard UI components
- ❌ Review analytics and performance tracking
- ❌ Automated review reminders

#### **Required Extensions**

- Extend `VocabularyEntry` with SRS fields (`next_review`, `ease_factor`, etc.)
- Add review session endpoints
- Create flashcard review interface
- Implement SRS scheduler service

## System Architecture

### 1. Data Model (Unified)

```python
# Unified VocabularyEntry for SRS and Context
class VocabularyEntry:
    # Basic Word Info
    word: str
    cefr_level: str

    # Learning Meta
    status: VocabularyStatus
    added_at: datetime

    # Context Preservation (from original Library)
    contexts: List[Dict] = []  # [{ "sentence": "...", "url": "...", "added_at": "..." }]

    # SRS Logic
    next_review: datetime = None
    review_interval: int = 0        # Hours until next review
    ease_factor: float = 2.5        # SRS difficulty multiplier
    review_streak: int = 0          # Consecutive correct reviews
    total_reviews: int = 0          # Total number of reviews
    correct_reviews: int = 0        # Correct answers count
    last_review_quality: int = None # SM-2 quality score (0-5)
```

### 2. Spaced Repetition Algorithm

#### Simplified SM-2 Implementation

```python
class SpacedRepetitionScheduler:
    def __init__(self):
        self.initial_interval = 1   # 1 hour for first review
        self.min_ease_factor = 1.3
        self.ease_bonus = 1.3       # Bonus for "Easy" reviews

    def calculate_next_review(self, entry: VocabularyEntry, quality: int):
        """
        Calculate next review date based on SM-2 algorithm

        Args:
            entry: Current vocabulary entry
            quality: Review quality (0-5)
                     0: Complete blackout
                     1: Incorrect but recognized
                     2: Incorrect but easy to recall
                     3: Correct with hesitation
                     4: Correct
                     5: Perfect recall
        """
        entry.total_reviews += 1
        entry.last_review_quality = quality

        # Update ease factor
        if quality >= 3:
            entry.correct_reviews += 1
            entry.review_streak += 1

            # Calculate new interval
            if entry.total_reviews == 1:
                entry.review_interval = 6  # 6 hours
            elif entry.total_reviews == 2:
                entry.review_interval = 24  # 1 day
            else:
                entry.review_interval = int(entry.review_interval * entry.ease_factor)

            # Update ease factor
            ease_modifier = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
            entry.ease_factor = max(self.min_ease_factor, entry.ease_factor + ease_modifier)

            # Bonus for "Easy" reviews
            if quality == 5:
                entry.ease_factor *= self.ease_bonus

        else:
            # Reset for incorrect answers
            entry.review_interval = self.initial_interval
            entry.review_streak = 0
            entry.ease_factor = max(self.min_ease_factor, entry.ease_factor - 0.2)

        # Calculate next review time
        entry.next_review = datetime.now() + timedelta(hours=entry.review_interval)
        entry.last_reviewed = datetime.now()

        # Update status based on progress
        self._update_status(entry)

        return entry.next_review

    def _update_status(self, entry: VocabularyEntry):
        """Update vocabulary status based on review progress"""
        if entry.review_streak >= 5 and entry.review_interval >= 7 * 24:  # 5+ streak, 1+ week interval
            entry.status = VocabularyStatus.MASTERED
        elif entry.total_reviews > 0:
            entry.status = VocabularyStatus.REVIEWING
```

### 3. Review Queue Management

```python
class ReviewQueueService:
    def __init__(self, vocabulary_repo: VocabularyRepository):
        self.vocabulary_repo = vocabulary_repo
        self.daily_new_limit = 5  # Max new words per day

    def get_due_reviews(self, user_id: str, limit: int = 20) -> List[VocabularyEntry]:
        """Get words due for review"""
        return self.vocabulary_repo.get_due_for_review(user_id, datetime.now(), limit)

    def get_new_words(self, user_id: str, limit: int = None) -> List[VocabularyEntry]:
        """Get new words for learning"""
        if limit is None:
            limit = self.daily_new_limit

        # Check daily new word limit
        today_new = self.vocabulary_repo.count_new_today(user_id)
        remaining = max(0, self.daily_new_limit - today_new)

        if remaining > 0:
            return self.vocabulary_repo.get_unlearned_words(user_id, min(limit, remaining))
        return []

    def build_review_session(self, user_id: str, session_type: str = "mixed") -> ReviewSession:
        """
        Build a review session

        Args:
            user_id: User identifier
            session_type: "review", "new", or "mixed"
        """
        session = ReviewSession(
            user_id=user_id,
            session_type=session_type,
            created_at=datetime.now()
        )

        if session_type in ["review", "mixed"]:
            session.due_words = self.get_due_reviews(user_id)

        if session_type in ["new", "mixed"]:
            session.new_words = self.get_new_words(user_id)

        # Shuffle for variety
        random.shuffle(session.due_words)
        random.shuffle(session.new_words)

        session.total_cards = len(session.due_words) + len(session.new_words)

        return session
```

### 4. API Design

```python
# New endpoints in routes.py

@app.post("/users/{user_id}/review/session")
async def create_review_session(user_id: str, session_type: str = "mixed"):
    """Create a new review session"""
    service = ReviewQueueService(vocabulary_repo)
    session = service.build_review_session(user_id, session_type)
    return {"success": True, "data": session.to_dict()}

@app.post("/users/{user_id}/review/answer")
async def submit_review_answer(
    user_id: str,
    card_id: str,
    quality: int,
    response_time: int
):
    """Submit answer for a review card"""
    entry = vocabulary_repo.get_by_id(user_id, card_id)
    if not entry:
        return {"success": False, "error": "Card not found"}

    scheduler = SpacedRepetitionScheduler()
    next_review = scheduler.calculate_next_review(entry, quality)

    vocabulary_repo.update(entry)

    # Record analytics
    review_analytics.record_answer(
        user_id=user_id,
        word=entry.word,
        quality=quality,
        response_time=response_time,
        interval=entry.review_interval
    )

    return {
        "success": True,
        "data": {
            "next_review": next_review.isoformat(),
            "new_interval": entry.review_interval,
            "ease_factor": entry.ease_factor,
            "status": entry.status.value
        }
    }

@app.get("/users/{user_id}/review/stats")
async def get_review_stats(user_id: str, period: str = "week"):
    """Get review statistics for a period"""
    stats = review_analytics.get_stats(user_id, period)
    return {"success": True, "data": stats}

@app.get("/users/{user_id}/review/schedule")
async def get_review_schedule(user_id: str, days: int = 7):
    """Get upcoming review schedule"""
    schedule = review_analytics.get_upcoming_schedule(user_id, days)
    return {"success": True, "data": schedule}
```

### 5. Frontend Implementation

#### 5.1 Review Session UI

```html
<!-- review-session.html -->
<div class="review-container">
  <!-- Progress Bar -->
  <div class="review-header">
    <div class="progress-section">
      <span class="progress-count">
        <span id="current-card">1</span> / <span id="total-cards">20</span>
      </span>
      <div class="progress-bar">
        <div class="progress-fill" id="progress-fill"></div>
      </div>
    </div>
    <div class="review-controls">
      <button id="pause-btn" class="btn-secondary">Pause</button>
      <button id="quit-btn" class="btn-danger">Quit</button>
    </div>
  </div>

  <!-- Flashcard Container -->
  <div class="flashcard-container">
    <div class="flashcard" id="flashcard">
      <!-- Card Front -->
      <div class="card-side card-front" id="card-front">
        <div class="card-type-indicator">Word → Definition</div>
        <div class="card-content">
          <h1 class="word-text" id="word-text">serendipity</h1>
          <div class="word-hints" id="word-hints" style="display: none">
            <span class="hint">CEFR: C1</span>
            <span class="hint">Pronunciation: /ˌserənˈdɪpɪti/</span>
          </div>
        </div>
        <button class="show-answer-btn" id="show-answer">
          Show Answer <kbd>Space</kbd>
        </button>
      </div>

      <!-- Card Back -->
      <div class="card-side card-back" id="card-back" style="display: none">
        <div class="card-content">
          <h2 class="word-text" id="back-word">serendipity</h2>
          <div class="definition" id="definition">
            The occurrence of events by chance in a happy way
          </div>
          <div class="example" id="example">
            <strong>Example:</strong> A fortunate stroke of serendipity brought
            the two friends together.
          </div>
        </div>

        <!-- Review Buttons -->
        <div class="review-buttons">
          <h3>How well did you know this?</h3>
          <div class="button-group">
            <button class="review-btn again" data-quality="0">
              <span class="btn-label">Again</span>
              <span class="btn-hint">(< 1 day)</span>
            </button>
            <button class="review-btn hard" data-quality="1">
              <span class="btn-label">Hard</span>
              <span class="btn-hint">(3 days)</span>
            </button>
            <button class="review-btn good" data-quality="3">
              <span class="btn-label">Good</span>
              <span class="btn-hint">(1 week)</span>
            </button>
            <button class="review-btn easy" data-quality="5">
              <span class="btn-label">Easy</span>
              <span class="btn-hint">(2 weeks)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Session Stats -->
  <div class="session-stats" id="session-stats">
    <div class="stat">
      <span class="stat-label">Correct</span>
      <span class="stat-value" id="correct-count">0</span>
    </div>
    <div class="stat">
      <span class="stat-label">Streak</span>
      <span class="stat-value" id="streak-count">0</span>
    </div>
    <div class="stat">
      <span class="stat-label">Time</span>
      <span class="stat-value" id="time-elapsed">0:00</span>
    </div>
  </div>
</div>
```

#### 5.2 Review Manager JavaScript

```javascript
// review-manager.js
class ReviewManager {
  constructor() {
    this.session = null;
    this.currentCardIndex = 0;
    this.cardStartTime = null;
    this.sessionStats = {
      startTime: Date.now(),
      cardsReviewed: 0,
      correctAnswers: 0,
      streak: 0,
      maxStreak: 0,
      qualityDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
    this.timer = null;
    this.initializeEventListeners();
  }

  async startReviewSession(sessionType = "mixed") {
    try {
      const response = await api.post(`/users/${userId}/review/session`, {
        session_type: sessionType,
      });
      this.session = response.data;

      if (this.session.total_cards === 0) {
        this.showNoCardsMessage();
        return;
      }

      this.currentCardIndex = 0;
      this.showCard(this.session.cards[0]);
      this.startTimer();
      this.updateProgressBar();
    } catch (error) {
      console.error("Failed to start review session:", error);
      showError("Unable to start review session");
    }
  }

  showCard(card) {
    this.cardStartTime = Date.now();

    // Reset card state
    document.getElementById("card-back").style.display = "none";
    document.getElementById("card-front").style.display = "block";

    // Display card content
    if (card.card_type === "WORD_TO_MEANING") {
      document.getElementById("word-text").textContent = card.word;
      document.getElementById("back-word").textContent = card.word;
      document.getElementById("definition").textContent = card.definition;
      document.getElementById("example").textContent = card.example;
    }

    // Update position
    document.getElementById("current-card").textContent =
      this.currentCardIndex + 1;
  }

  async submitAnswer(quality) {
    const responseTime = Date.now() - this.cardStartTime;
    const currentCard = this.session.cards[this.currentCardIndex];

    try {
      await api.post(`/users/${userId}/review/answer`, {
        card_id: currentCard.id,
        quality: quality,
        response_time: responseTime,
      });

      // Update stats
      this.sessionStats.cardsReviewed++;
      this.sessionStats.qualityDistribution[quality]++;

      if (quality >= 3) {
        this.sessionStats.correctAnswers++;
        this.sessionStats.streak++;
        this.sessionStats.maxStreak = Math.max(
          this.sessionStats.maxStreak,
          this.sessionStats.streak
        );
      } else {
        this.sessionStats.streak = 0;
      }

      this.updateSessionStats();

      // Move to next card
      this.nextCard();
    } catch (error) {
      console.error("Failed to submit answer:", error);
      showError("Failed to save your answer");
    }
  }

  nextCard() {
    this.currentCardIndex++;

    if (this.currentCardIndex >= this.session.cards.length) {
      this.endSession();
    } else {
      this.showCard(this.session.cards[this.currentCardIndex]);
      this.updateProgressBar();
    }
  }

  updateProgressBar() {
    const progress =
      ((this.currentCardIndex + 1) / this.session.cards.length) * 100;
    document.getElementById("progress-fill").style.width = `${progress}%`;
  }

  updateSessionStats() {
    document.getElementById("correct-count").textContent =
      this.sessionStats.correctAnswers;
    document.getElementById("streak-count").textContent =
      this.sessionStats.streak;
  }

  startTimer() {
    this.timer = setInterval(() => {
      const elapsed = Date.now() - this.sessionStats.startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      document.getElementById(
        "time-elapsed"
      ).textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }, 1000);
  }

  async endSession() {
    clearInterval(this.timer);

    // Show completion screen with stats
    this.showCompletionScreen();

    // Record session completion
    try {
      await api.post(`/users/${userId}/review/session-complete`, {
        stats: this.sessionStats,
        duration: Date.now() - this.sessionStats.startTime,
      });
    } catch (error) {
      console.error("Failed to complete session:", error);
    }
  }

  initializeEventListeners() {
    // Show answer button
    document.getElementById("show-answer").addEventListener("click", () => {
      this.showAnswer();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (
        e.code === "Space" &&
        document.getElementById("card-front").style.display !== "none"
      ) {
        e.preventDefault();
        this.showAnswer();
      } else if (e.code === "Digit1") {
        this.submitAnswer(0); // Again
      } else if (e.code === "Digit2") {
        this.submitAnswer(1); // Hard
      } else if (e.code === "Digit3") {
        this.submitAnswer(3); // Good
      } else if (e.code === "Digit4") {
        this.submitAnswer(5); // Easy
      }
    });

    // Review buttons
    document.querySelectorAll(".review-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const quality = parseInt(btn.dataset.quality);
        this.submitAnswer(quality);
      });
    });
  }

  showAnswer() {
    document.getElementById("card-front").style.display = "none";
    document.getElementById("card-back").style.display = "block";
    document.getElementById("word-hints").style.display = "block";
  }
}
```

### 6. Review Analytics & Progress Tracking

```python
class ReviewAnalytics:
    def get_stats(self, user_id: str, period: str) -> Dict:
        """Get comprehensive review statistics"""
        end_date = datetime.now()
        start_date = {
            "day": end_date - timedelta(days=1),
            "week": end_date - timedelta(weeks=1),
            "month": end_date - timedelta(days=30),
            "year": end_date - timedelta(days=365)
        }.get(period, end_date - timedelta(weeks=1))

        # Gather metrics
        reviews = self.review_repo.get_reviews_in_period(user_id, start_date, end_date)

        stats = {
            "period": period,
            "total_reviews": len(reviews),
            "unique_words": len(set(r.word for r in reviews)),
            "accuracy_rate": self._calculate_accuracy(reviews),
            "average_response_time": self._calculate_avg_response_time(reviews),
            "streak_info": self._get_streak_info(user_id),
            "difficulty_distribution": self._get_difficulty_distribution(reviews),
            "learning_progress": self._get_learning_progress(user_id, start_date, end_date)
        }

        return stats

    def get_upcoming_schedule(self, user_id: str, days: int) -> List[Dict]:
        """Get review schedule for next N days"""
        schedule = []
        today = datetime.now().date()

        for i in range(days):
            date = today + timedelta(days=i)
            due_count = self.vocabulary_repo.count_due_on_date(user_id, date)

            schedule.append({
                "date": date.isoformat(),
                "due_count": due_count,
                "urgency": self._calculate_urgency(due_count, i)
            })

        return schedule
```

## Implementation Plan

### Phase 1: Basic Flashcards (1-2 weeks)

**Goals**:

- Implement basic card flip functionality
- Manual review sessions (no SRS yet)
- Integration with existing vocabulary

**Tasks**:

1. ✅ Extend VocabularyEntry model with SRS fields
2. ⬜ Create review session endpoints
3. ⬜ Build basic flashcard UI
4. ⬜ Implement card flip animation
5. ⬜ Add keyboard shortcuts
6. ⬜ Basic review statistics

**Acceptance Criteria**:

- Users can start a review session from Library page
- Cards flip to show definition
- Answers are recorded
- Session progress is tracked

### Phase 2: Spaced Repetition (2-3 weeks)

**Goals**:

- Implement SM-2 algorithm
- Automatic scheduling
- Review queue management

**Tasks**:

1. ⬜ Implement SpacedRepetitionScheduler
2. ⬜ Create ReviewQueueService
3. ⬜ Add due date calculation
4. ⬜ Build upcoming review calendar
5. ⬜ Implement review reminders
6. ⬜ Add review session analytics

**Acceptance Criteria**:

- Cards appear for review at appropriate intervals
- Incorrect answers reset intervals
- Easy answers increase intervals more
- Users can see upcoming review schedule

### Phase 3: Advanced Features (Ongoing)

**Goals**:

- Multiple card types
- Advanced analytics
- Personalized learning paths

**Tasks**:

1. ⬜ Implement different card types (fill-in-the-blank, multiple choice)
2. ⬜ Add memory curve visualization
3. ⬜ Implement adaptive difficulty
4. ⬜ Create weekly review reports
5. ⬜ Add achievement system
6. ⬜ Implement study streaks and badges

## Integration Points

### With Existing Features

1. **Library Integration**

   - Add "Start Review" button in Library page
   - Show review status indicators next to words
   - Filter words by review status (due, new, mastered)

2. **Extension Popup Integration**

   - Display due review count
   - Quick access to start review session
   - Daily review reminder notifications

3. **Word Context Integration**

   - Use original context from Library entries
   - Show example sentences from where words were collected
   - Link back to source articles for context refresh

4. **Statistics Dashboard Integration**
   - Add review metrics to existing stats
   - Track learning velocity (words mastered per week)
   - Show retention rate trends

### Data Migration Strategy

> [!IMPORTANT] > **Critical Step**: You MUST run the migration script before enabling the review feature in production. Existing vocabulary entries lack the necessary SRS fields (`next_review`, `ease_factor`, etc.), which will cause the review system to crash or behave unpredictably.

```python
# Migration script for existing vocabulary
async def migrate_existing_vocabulary():
    """Migrate existing vocabulary entries to support SRS"""
    entries = await vocabulary_repo.get_all_entries()

    for entry in entries:
        if entry.next_review is None:
            # Set initial review based on age and status
            if entry.status == VocabularyStatus.MASTERED:
                entry.next_review = datetime.now() + timedelta(days=30)
                entry.review_interval = 30 * 24
            elif entry.status == VocabularyStatus.REVIEWING:
                entry.next_review = datetime.now() + timedelta(days=3)
                entry.review_interval = 3 * 24
            else:  # LEARNING
                entry.next_review = datetime.now() + timedelta(hours=6)
                entry.review_interval = 6

            entry.ease_factor = 2.5
            entry.total_reviews = 0
            entry.correct_reviews = 0
            entry.review_streak = 0

            await vocabulary_repo.update(entry)
```

## Performance Considerations

### Batch Operations

- Process reviews in batches to reduce database calls
- Cache upcoming review schedules
- Preload next card while reviewing current one

### Optimization Strategies

- Use Redis for fast review queue operations
- Implement lazy loading for review statistics
- Compress session data for faster transmission

## User Experience Guidelines

### Onboarding

1. Explain SRS concept simply
2. Set realistic expectations ("5-10 minutes daily")
3. Provide tutorial for first review session

### Session Design

- Default to mixed sessions (review + new)
- Allow session customization
- Provide breaks for longer sessions
- Show progress and motivation

### Flexibility

- Allow resuming paused sessions
- Support skipping difficult cards
- Provide emergency cram mode before exams
- Export vocabulary for external review

## Success Metrics

### Engagement

- Daily active reviewers
- Average session duration
- Retention rate after 7 days
- Weekly review consistency

### Learning Effectiveness

- Long-term retention rate (30+ days)
- Words mastered per week
- Review accuracy improvement
- Reduction in unknown words during reading

### User Satisfaction

- Net Promoter Score (NPS)
- Feature adoption rate
- Support requests related to review system
- User testimonials about vocabulary growth

## Future Enhancements

### Advanced SRS Features

1. **Adaptive SRS**: Adjust algorithm based on individual performance
2. **Contextual Reviews**: Prioritize words encountered recently
3. **Group Reviews**: Review related words together (themes, topics)
4. **Forced Choice**: Multiple choice format for variety

### Gamification

1. **Streaks**: Consecutive review days
2. **Leaderboards**: Compare progress with peers
3. **Challenges**: Weekly/monthly vocabulary goals
4. **Achievements**: Unlock badges for milestones

### AI Enhancements

1. **Personalized Examples**: Generate examples based on user interests
2. **Difficulty Prediction**: Predict which words will be difficult
3. **Optimal Timing**: AI-optimized review timing
4. **Learning Path**: Suggest what to learn next based on goals

## Technical Dependencies

### Backend

- FastAPI for REST APIs
- SQLAlchemy for database operations
- Redis for caching and queues
- Celery for background tasks (reminders, analytics)

### Frontend

- Vanilla JavaScript with ES6 modules
- CSS animations for card transitions
- Chrome storage API for offline mode
- Service worker for background sync

### Database

- PostgreSQL for primary storage
- Indexes on (user_id, next_review) for efficient queries
- Partitioning for large user bases
- Analytics schema for review patterns

## Security Considerations

### Data Privacy

- Review history considered sensitive
- Option to delete review history
- Export personal data on request
- Secure API endpoints with authentication

### Rate Limiting

- Limit review API calls per user
- Prevent session hijacking
- Validate review quality submissions
- Protect against review data manipulation

## Testing Strategy

### Unit Tests

- SRS algorithm correctness
- Review queue logic
- API endpoint responses
- Data model validations

### Integration Tests

- End-to-end review flow
- Database transaction handling
- Frontend-backend communication
- Offline synchronization

### Performance Tests

- Large vocabulary handling
- Concurrent review sessions
- Database query optimization
- UI responsiveness

### User Acceptance Tests

- Session completion rates
- Feature discoverability
- Intuitiveness of controls
- Overall satisfaction

## Rollout Plan

### Alpha Testing (Internal)

- Feature-complete implementation
- Small user group (5-10 people)
- Daily usage monitoring
- Bug fixing and iteration

### Beta Testing (Power Users)

- Expanded user group (50-100 users)
- Feature feedback collection
- Performance optimization
- Documentation improvement

### Full Launch

- Feature announcement
- User education (tutorials, videos)
- Gradual rollout to all users
- Continuous monitoring and improvements

## Conclusion

The Vocabulary Review system transforms MixRead from a passive reading aid into an active learning platform. By implementing spaced repetition, users can efficiently remember and master vocabulary encountered during reading, accelerating their English learning journey.

The phased implementation approach ensures rapid delivery of value while building a solid foundation for advanced features. The system integrates seamlessly with existing MixRead features, enhancing the overall user experience without disrupting established workflows.
