/**
 * ReviewManager - Orchestrates flashcard review sessions
 *
 * Handles:
 * - Starting review sessions
 * - Displaying flashcards
 * - Submitting answers
 * - Tracking session progress and statistics
 */

class ReviewManager {
  constructor(userId, apiBaseUrl = "http://localhost:8000") {
    this.userId = userId;
    this.apiBaseUrl = apiBaseUrl;

    // Session state
    this.session = null;
    this.sessionId = null;
    this.currentCardIndex = 0;
    this.cardStartTime = null;

    // Session statistics
    this.sessionStats = {
      startTime: Date.now(),
      cardsReviewed: 0,
      correctAnswers: 0,
      streak: 0,
      maxStreak: 0,
      qualityDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalTime: 0,
    };

    this.isRunning = false;
    this.isPaused = false;
    this.timerInterval = null;

    // Bind methods
    this.initializeEventListeners = this.initializeEventListeners.bind(this);
    this.startSession = this.startSession.bind(this);
    this.showAnswer = this.showAnswer.bind(this);
    this.submitAnswer = this.submitAnswer.bind(this);
    this.nextCard = this.nextCard.bind(this);
    this.endSession = this.endSession.bind(this);
  }

  /**
   * Start a new review session
   * @param {string} sessionType - "mixed" | "new" | "review"
   * @returns {Promise<object>} Session data
   */
  async startSession(sessionType = "mixed") {
    try {
      console.log(
        `[Review] Starting ${sessionType} session for user ${this.userId}`
      );

      const response = await fetch(
        `${this.apiBaseUrl}/users/${this.userId}/review/session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_type: sessionType }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to start session");
      }

      // Debug: Log the response structure
      console.log("[Review Debug] Response structure:", {
        hasData: "data" in data,
        hasSessionId: "session_id" in data,
        sessionIdValue: data.session_id,
        dataKeys: Object.keys(data),
      });

      // Store session data
      // Handle both response formats: with and without data wrapper
      this.session = data.data || data;
      this.sessionId = data.session_id || (data.data && data.data.session_id);

      // Debug: Log what we stored
      console.log("[Review Debug] Stored session ID:", this.sessionId);
      console.log(
        "[Review Debug] Session keys:",
        this.session ? Object.keys(this.session) : "No session"
      );
      this.currentCardIndex = 0;
      this.isRunning = true;
      this.isPaused = false;

      console.log(
        `[Review] Session started: ${this.sessionId}, cards: ${this.session.total_cards}`
      );

      // Render the session UI from template
      this.renderSessionUI();

      // Initialize event listeners
      this.initializeEventListeners();

      // Display first card
      await this.displayCard(this.session.first_card);
      this.updateProgress(this.session.progress);
      this.startTimer();

      return this.session;
    } catch (error) {
      console.error("[Review] Failed to start session:", error);
      this.showError(`Failed to start review session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Display a flashcard
   * @param {object} card - Card object with id, content
   */
  async displayCard(card) {
    const frontContent = document.getElementById("card-front-content");
    const frontHints = document.getElementById("card-hints");
    const cardFront = document.getElementById("card-front");
    const cardBack = document.getElementById("card-back");

    if (!frontContent) {
      console.error("[Review] Card front content element not found");
      return;
    }

    // Reset visibility
    if (cardFront) cardFront.style.display = "block";
    if (cardBack) cardBack.style.display = "none";

    // Get the word
    const word = card.content?.word || card.front || "Unknown";

    // Display word and hints
    document.getElementById("word-text").textContent = word;
    document.getElementById("card-type").textContent = "Word → Definition";

    // Display back side (definition, example, etc)
    if (document.getElementById("back-word")) {
      document.getElementById("back-word").textContent = word;
    }

    // Fetch definition and other info
    try {
      const response = await fetch(`${this.apiBaseUrl}/word/${word}`);
      if (response.ok) {
        const wordData = await response.json();

        if (document.getElementById("definition")) {
          if (wordData.definition) {
            document.getElementById("definition").textContent =
              wordData.definition;
          } else {
            document.getElementById("definition").textContent =
              "No definition available";
          }
        }

        if (document.getElementById("example") && wordData.example) {
          document.getElementById(
            "example"
          ).innerHTML = `<strong>Example:</strong> ${wordData.example}`;
        }

        if (document.getElementById("cefr") && wordData.cefr_level) {
          document.getElementById(
            "cefr"
          ).textContent = `CEFR: ${wordData.cefr_level}`;
        }
      }
    } catch (error) {
      console.error("[Review] Failed to fetch word definition:", error);
      if (document.getElementById("definition")) {
        document.getElementById("definition").textContent =
          "Failed to load definition";
      }
    }

    // Record when card was displayed
    this.cardStartTime = Date.now();

    // Update position
    document.getElementById("current-card").textContent =
      this.currentCardIndex + 1;
  }

  /**
   * Show the answer side of the card
   */
  showAnswer() {
    const cardFront = document.getElementById("card-front");
    const cardBack = document.getElementById("card-back");

    if (!cardFront || !cardBack) {
      console.error("[Review] Card elements not found");
      return;
    }

    cardFront.style.display = "none";
    cardBack.style.display = "block";
  }

  /**
   * Submit an answer
   * @param {number} quality - Review quality (0-5)
   *   0: Complete blackout
   *   1: Incorrect but recognized
   *   2: Incorrect but easy to recall
   *   3: Correct with hesitation
   *   4: Correct
   *   5: Perfect recall
   */
  async submitAnswer(quality) {
    if (!this.sessionId) {
      console.error("[Review] No active session");
      return;
    }

    if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
      console.error("[Review] Invalid quality score:", quality);
      return;
    }

    try {
      const responseTime = Date.now() - this.cardStartTime;

      console.log(
        `[Review] Submitting answer: quality=${quality}, time=${responseTime}ms`
      );

      const response = await fetch(
        `${this.apiBaseUrl}/users/${this.userId}/review/answer?session_id=${this.sessionId}&quality=${quality}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to submit answer");
      }

      // Update session statistics
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

      // Update UI
      this.updateSessionStats();

      console.log(
        `[Review] Answer recorded. Correct: ${this.sessionStats.correctAnswers}, Streak: ${this.sessionStats.streak}`
      );

      // Check if session is complete
      if (data.session_complete) {
        this.endSession(data.session_summary);
        return;
      }

      // Move to next card
      await this.nextCard(data.next_card, data.progress);
    } catch (error) {
      console.error("[Review] Failed to submit answer:", error);
      this.showError(`Failed to submit answer: ${error.message}`);
    }
  }

  /**
   * Mark current word as already known (mastered)
   * This removes the word from future review sessions
   */
  async markAsKnown() {
    if (!this.sessionId) {
      console.error("[Review] No active session");
      return;
    }

    try {
      console.log("[Review] Marking current word as known");

      const response = await fetch(
        `${this.apiBaseUrl}/users/${this.userId}/review/mark-known?session_id=${this.sessionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to mark as known");
      }

      console.log("[Review] Word marked as known (mastered)");

      // Check if session is complete
      if (data.session_complete) {
        this.endSession(data.session_summary);
        return;
      }

      // Move to next card
      this.currentCardIndex++;
      await this.nextCard(data.next_card, data.progress);
    } catch (error) {
      console.error("[Review] Failed to mark as known:", error);
      this.showError(`Failed to mark as known: ${error.message}`);
    }
  }

  /**
   * Move to the next card
   * @param {object} nextCard - Next card data
   * @param {object} progress - Session progress data
   */
  async nextCard(nextCard, progress) {
    if (!nextCard) {
      console.log("[Review] No next card, session ending");
      this.endSession();
      return;
    }

    this.currentCardIndex++;
    await this.displayCard(nextCard);
    this.updateProgress(progress);
  }

  /**
   * Update session progress display
   * @param {object} progress - Progress data
   */
  updateProgress(progress) {
    if (!progress) return;

    const progressElement = document.getElementById("progress-fill");
    const currentElement = document.getElementById("current-card");
    const totalElement = document.getElementById("total-cards");
    const accuracyElement = document.getElementById("accuracy");

    if (progressElement) {
      const percentage = progress.percentage || 0;
      progressElement.style.width = `${percentage}%`;
    }

    if (currentElement) currentElement.textContent = progress.current;
    if (totalElement) totalElement.textContent = progress.total;

    if (accuracyElement && progress.accuracy !== undefined) {
      const accuracy = (progress.accuracy * 100).toFixed(0);
      accuracyElement.textContent = `${accuracy}%`;
    }
  }

  /**
   * Update session statistics display
   */
  updateSessionStats() {
    const correctElement = document.getElementById("correct-count");
    const streakElement = document.getElementById("streak-count");
    const timeElement = document.getElementById("time-elapsed");

    if (correctElement) {
      correctElement.textContent = this.sessionStats.correctAnswers;
    }

    if (streakElement) {
      streakElement.textContent = this.sessionStats.streak;
    }

    if (timeElement && this.sessionStats.totalTime !== undefined) {
      const minutes = Math.floor(this.sessionStats.totalTime / 60);
      const seconds = this.sessionStats.totalTime % 60;
      timeElement.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
  }

  /**
   * Start timer for session duration
   */
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.sessionStats.totalTime = Math.floor(
          (Date.now() - this.sessionStats.startTime) / 1000
        );
        this.updateSessionStats();
      }
    }, 1000);
  }

  /**
   * End the review session
   * @param {object} summary - Session summary data
   */
  endSession(summary) {
    clearInterval(this.timerInterval);
    this.isRunning = false;

    if (!summary) {
      summary = {
        total_reviewed: this.sessionStats.cardsReviewed,
        correct_count: this.sessionStats.correctAnswers,
        accuracy:
          this.sessionStats.cardsReviewed > 0
            ? this.sessionStats.correctAnswers / this.sessionStats.cardsReviewed
            : 0,
        duration_minutes: Math.floor(this.sessionStats.totalTime / 60),
        max_streak: this.sessionStats.maxStreak,
      };
    }

    console.log("[Review] Session ended:", summary);

    // Display completion screen
    this.showCompletionScreen(summary);

    // Fire custom event
    window.dispatchEvent(
      new CustomEvent("reviewSessionEnded", { detail: summary })
    );
  }

  /**
   * Show completion screen with summary
   * @param {object} summary - Session summary
   */
  showCompletionScreen(summary) {
    const container = document.getElementById("review-container");
    if (!container) return;

    const accuracy = (summary.accuracy * 100).toFixed(1);
    const duration =
      summary.duration_minutes || Math.floor(this.sessionStats.totalTime / 60);

    container.innerHTML = `
            <div class="completion-screen">
                <h2>🎉 Session Complete!</h2>
                <div class="summary-stats">
                    <div class="stat">
                        <span class="label">Cards Reviewed</span>
                        <span class="value">${summary.total_reviewed}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Correct</span>
                        <span class="value">${summary.correct_count}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Accuracy</span>
                        <span class="value">${accuracy}%</span>
                    </div>
                    <div class="stat">
                        <span class="label">Max Streak</span>
                        <span class="value">${summary.max_streak}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Duration</span>
                        <span class="value">${duration} min</span>
                    </div>
                </div>
                <div class="actions">
                    <button id="back-to-library" class="btn btn-primary">Back to Library</button>
                    <button id="start-another" class="btn btn-secondary">Start Another</button>
                </div>
            </div>
        `;

    document
      .getElementById("back-to-library")
      ?.addEventListener("click", () => {
        const libraryUrl = chrome.runtime.getURL("pages/library-viewer.html");
        window.location.href = `${libraryUrl}?user_id=${this.userId}`;
      });

    document.getElementById("start-another")?.addEventListener("click", () => {
      this.reset();
    });
  }

  /**
   * Reset for another session
   */
  reset() {
    this.session = null;
    this.sessionId = null;
    this.currentCardIndex = 0;
    this.sessionStats = {
      startTime: Date.now(),
      cardsReviewed: 0,
      correctAnswers: 0,
      streak: 0,
      maxStreak: 0,
      qualityDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalTime: 0,
    };

    const container = document.getElementById("review-container");
    if (container) {
      container.innerHTML = `
                <div class="session-selector">
                    <h2>Choose Review Type</h2>
                    <button id="mixed-btn" class="btn btn-primary">Mixed (New + Due)</button>
                    <button id="new-btn" class="btn btn-secondary">New Words Only</button>
                    <button id="review-btn" class="btn btn-secondary">Review Due Words</button>
                </div>
            `;

      document
        .getElementById("mixed-btn")
        ?.addEventListener("click", () => this.startSession("mixed"));
      document
        .getElementById("new-btn")
        ?.addEventListener("click", () => this.startSession("new"));
      document
        .getElementById("review-btn")
        ?.addEventListener("click", () => this.startSession("review"));
    }
  }

  /**
   * Render the session UI from template
   * Clones the template content and replaces the container content
   */
  renderSessionUI() {
    const container = document.getElementById("review-container");
    const template = document.getElementById("review-session-template");

    if (!container) {
      console.error("[Review] review-container not found");
      return;
    }

    if (!template) {
      console.error("[Review] review-session-template not found");
      return;
    }

    // Clone the template content
    const content = template.content.cloneNode(true);

    // Replace container content with the cloned template
    container.innerHTML = "";
    container.appendChild(content);

    console.log("[Review] Session UI rendered from template");
  }

  /**
   * Initialize keyboard shortcuts and button handlers
   */
  initializeEventListeners() {
    // Show answer button
    document
      .getElementById("show-answer-btn")
      ?.addEventListener("click", () => {
        this.showAnswer();
      });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (!this.isRunning || this.isPaused) return;

      // Space: show answer
      if (e.code === "Space") {
        e.preventDefault();
        const cardFront = document.getElementById("card-front");
        if (cardFront?.style.display !== "none") {
          this.showAnswer();
        }
      }

      // 0-5: quality scores
      if (e.code === "Digit1") {
        e.preventDefault();
        this.submitAnswer(0);
      } else if (e.code === "Digit2") {
        e.preventDefault();
        this.submitAnswer(1);
      } else if (e.code === "Digit3") {
        e.preventDefault();
        this.submitAnswer(3);
      } else if (e.code === "Digit4") {
        e.preventDefault();
        this.submitAnswer(5);
      }
    });

    // Quality buttons
    document.querySelectorAll(".review-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // Skip if it's the "Already Known" button (handled separately)
        if (btn.id === "btn-already-known") return;

        const quality = parseInt(
          e.target.dataset.quality ||
            e.target.closest(".review-btn").dataset.quality
        );
        if (!isNaN(quality)) {
          this.submitAnswer(quality);
        }
      });
    });

    // Already Known button
    document
      .getElementById("btn-already-known")
      ?.addEventListener("click", () => {
        this.markAsKnown();
      });

    // Pause button
    document.getElementById("pause-btn")?.addEventListener("click", () => {
      this.togglePause();
    });

    // Quit button
    document.getElementById("quit-btn")?.addEventListener("click", () => {
      if (confirm("Are you sure you want to quit this session?")) {
        this.endSession();
        window.history.back();
      }
    });
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    const pauseBtn = document.getElementById("pause-btn");
    if (pauseBtn) {
      pauseBtn.textContent = this.isPaused ? "Resume" : "Pause";
      pauseBtn.classList.toggle("paused", this.isPaused);
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorEl = document.createElement("div");
    errorEl.className = "error-message";
    errorEl.textContent = message;
    errorEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 16px;
            border-radius: 4px;
            z-index: 10000;
            max-width: 400px;
        `;

    document.body.appendChild(errorEl);

    setTimeout(() => {
      errorEl.remove();
    }, 5000);
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ReviewManager;
}
