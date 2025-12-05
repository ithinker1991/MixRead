/**
 * MixRead Library Manager
 * Manages the word library page interface and interactions
 */

class LibraryManager {
  constructor() {
    this.apiBaseUrl = 'http://localhost:8000';
    this.userId = null;
    this.allWords = [];
    this.filteredWords = [];
    this.stats = {
      total: 0,
      learning: 0,
      known: 0
    };

    this.initializeEventListeners();
    this.loadLibrary();
  }

  initializeEventListeners() {
    // Start Review button
    document.getElementById('start-review-btn')?.addEventListener('click', () => {
      this.startReview();
    });

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      this.loadLibrary();
    });

    // Search input
    document.getElementById('search-input')?.addEventListener('input', (e) => {
      this.filterWords(e.target.value);
    });
  }

  async loadLibrary() {
    console.log('[Library] Loading library...');
    this.showLoading();

    try {
      // Get user ID from URL params
      const params = MixReadNavigation.getPageParams();
      this.userId = params.user_id || 'test_user';

      console.log(`[Library] Loading vocabulary for user: ${this.userId}`);

      // Fetch vocabulary
      const response = await fetch(
        `${this.apiBaseUrl}/users/${this.userId}/vocabulary`
      );

      if (!response.ok) {
        throw new Error(`Failed to load vocabulary: ${response.statusText}`);
      }

      const data = await response.json();
      this.allWords = data.data || data.vocabulary || [];

      console.log(`[Library] Loaded ${this.allWords.length} words`);

      // Calculate statistics
      this.calculateStats();

      // Display words
      this.displayLibrary();
      this.updateStats();
    } catch (error) {
      console.error('[Library] Error loading library:', error);
      this.showError(error.message);
    }
  }

  calculateStats() {
    this.stats.total = this.allWords.length;
    this.stats.learning = this.allWords.filter(
      (w) => w.status === 'learning' || w.status === 'reviewing'
    ).length;
    this.stats.known = this.allWords.filter(
      (w) => w.status === 'mastered' || w.status === 'known'
    ).length;
  }

  updateStats() {
    document.getElementById('total-words').textContent = this.stats.total;
    document.getElementById('learning-words').textContent = this.stats.learning;
    document.getElementById('known-words').textContent = this.stats.known;
  }

  filterWords(searchTerm) {
    const term = searchTerm.toLowerCase();
    this.filteredWords = this.allWords.filter((word) => {
      const wordMatch = (word.word || '').toLowerCase().includes(term);
      const meaningMatch = (word.meaning || '').toLowerCase().includes(term);
      return wordMatch || meaningMatch;
    });

    this.displayLibrary();
  }

  displayLibrary() {
    const libraryList = document.getElementById('library-list');
    if (!libraryList) return;

    const words = this.filteredWords.length > 0 ? this.filteredWords : this.allWords;

    if (words.length === 0) {
      libraryList.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center;">
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-text">No words in your library yet</div>
            <div style="font-size: 12px; color: #ccc;">
              Add words from the extension to start building your vocabulary
            </div>
          </div>
        </div>
      `;
      return;
    }

    libraryList.innerHTML = words
      .map((word) => this.createWordCard(word))
      .join('');

    // Attach event listeners to cards
    words.forEach((word) => {
      const reviewBtn = document.querySelector(
        `[data-word-id="${word.id}"] .review-btn`
      );
      const markKnownBtn = document.querySelector(
        `[data-word-id="${word.id}"] .mark-known-btn`
      );
      const deleteBtn = document.querySelector(
        `[data-word-id="${word.id}"] .delete-btn`
      );

      if (reviewBtn) {
        reviewBtn.addEventListener('click', () => this.reviewWord(word));
      }
      if (markKnownBtn) {
        markKnownBtn.addEventListener('click', () => this.markWordAsKnown(word));
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteWord(word));
      }
    });
  }

  createWordCard(word) {
    const statusLabel = this.getStatusLabel(word.status);
    const statusColor = this.getStatusColor(word.status);

    return `
      <div class="word-card" data-word-id="${word.id}">
        <div class="word-card-word">${word.word}</div>
        <div class="word-card-meaning">${word.meaning || word.definition || 'No meaning'}</div>
        <div class="word-card-status" style="color: ${statusColor}">
          ${statusLabel}
        </div>
        <div class="word-card-actions">
          <button class="btn-secondary review-btn" style="font-size: 12px;">
            📖 Review
          </button>
          <button class="btn-secondary mark-known-btn" style="font-size: 12px;">
            ✓ Known
          </button>
          <button class="btn-secondary delete-btn" style="font-size: 12px; color: #c00;">
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }

  getStatusLabel(status) {
    const labels = {
      learning: 'Learning',
      reviewing: 'Reviewing',
      mastered: 'Mastered',
      known: 'Known'
    };
    return labels[status] || 'Unknown';
  }

  getStatusColor(status) {
    const colors = {
      learning: '#ff9500',
      reviewing: '#667eea',
      mastered: '#34c759',
      known: '#34c759'
    };
    return colors[status] || '#999';
  }

  async markWordAsKnown(word) {
    console.log(`[Library] Marking word as known: ${word.word}`);
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/${this.userId}/vocabulary/${word.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'mastered' })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to mark word as known: ${response.statusText}`);
      }

      word.status = 'mastered';
      this.calculateStats();
      this.updateStats();
      this.displayLibrary();

      console.log(`[Library] Word marked as known: ${word.word}`);
    } catch (error) {
      console.error('[Library] Error marking word as known:', error);
      this.showError(error.message);
    }
  }

  async deleteWord(word) {
    console.log(`[Library] Deleting word: ${word.word}`);
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/users/${this.userId}/vocabulary/${word.id}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete word: ${response.statusText}`);
      }

      this.allWords = this.allWords.filter((w) => w.id !== word.id);
      this.calculateStats();
      this.updateStats();
      this.displayLibrary();

      console.log(`[Library] Word deleted: ${word.word}`);
    } catch (error) {
      console.error('[Library] Error deleting word:', error);
      this.showError(error.message);
    }
  }

  reviewWord(word) {
    console.log(`[Library] Reviewing word: ${word.word}`);
    // Could open a modal or navigate to review
    alert(`Reviewing: ${word.word}\n${word.meaning}`);
  }

  startReview() {
    console.log('[Library] Starting review session');
    const params = MixReadNavigation.getPageParams();
    MixReadNavigation.openPage('review', {
      user_id: this.userId || params.user_id,
      source: 'library'
    });
  }

  showLoading() {
    const libraryList = document.getElementById('library-list');
    if (libraryList) {
      libraryList.innerHTML = `
        <div style="grid-column: 1/-1;">
          <div class="loading">Loading your vocabulary...</div>
        </div>
      `;
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.innerHTML = `<div class="error-message">❌ ${message}</div>`;
    }
    const libraryList = document.getElementById('library-list');
    if (libraryList) {
      libraryList.innerHTML = `
        <div style="grid-column: 1/-1;">
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">Error loading library</div>
            <div style="font-size: 12px; color: #c00;">${message}</div>
          </div>
        </div>
      `;
    }
  }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Library] Initializing LibraryManager');
  new LibraryManager();
});
