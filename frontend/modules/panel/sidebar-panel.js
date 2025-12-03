/**
 * Sidebar Panel Module
 *
 * Persistent sidebar for displaying and managing highlighted words
 * Features:
 * - Real-time word list updates
 * - URL-based caching
 * - Word deduplication via stemming
 * - User visibility preferences
 * - Feed flow support (add/remove tracking)
 */

class SidebarPanel {
  constructor(wordCacheManager) {
    this.cacheManager = wordCacheManager;

    // DOM references
    this.sidebarElement = null;
    this.contentArea = null;
    this.statsElement = null;

    // State
    this.isOpen = false;         // Internal state (always listening)
    this.isVisible = false;      // UI visibility (user preference)
    this.isInitialized = false;  // Track initialization completion
    this.wordState = {};         // {normalizedWord → {count, originalWords, ...}}
    this.currentUrl = null;
    this.currentCacheKey = null;
    this.jumpIndex = {};         // Track jump position per word

    // Event listeners
    this.messageListener = null;
    this.urlChangeListeners = [];

    // Width preference (user adjustable)
    this.sidebarWidth = '350px';

    console.log('[SidebarPanel] Initializing...');
    this.init();
  }

  /**
   * Initialize sidebar
   */
  async init() {
    try {
      await this.createSidebarHTML();
      this.attachEventListeners();
      await this.loadPageData();
      await this.loadVisibilityPreference();
      this.isOpen = true;
      this.isInitialized = true;  // Mark initialization as complete
      console.log('[SidebarPanel] Initialization complete');
    } catch (e) {
      console.error('[SidebarPanel] Init error:', e);
      this.isInitialized = true;  // Mark as initialized even on error to prevent retry loops
    }
  }

  /**
   * Create sidebar DOM structure
   */
  async createSidebarHTML() {
    // Check if already exists
    if (document.getElementById('mixread-sidebar')) {
      this.sidebarElement = document.getElementById('mixread-sidebar');
      this.contentArea = this.sidebarElement.querySelector('.sidebar-content');
      this.statsElement = this.sidebarElement.querySelector('.sidebar-stats');
      return;
    }

    const sidebarHTML = `
      <div id="mixread-sidebar" class="mixread-sidebar" style="width: ${this.sidebarWidth}">
        <div class="sidebar-header">
          <h3>MixRead</h3>
          <div class="sidebar-header-buttons">
            <button class="sidebar-width-btn" title="调整宽度">⚙</button>
            <button class="sidebar-toggle-btn" title="关闭侧边栏">✕</button>
          </div>
        </div>

        <div class="sidebar-stats">
          📊 <span class="stat-count">0</span> 词汇 | <span class="stat-unique">0</span> 独特
        </div>

        <div class="sidebar-content"></div>

        <div class="sidebar-footer">
          <button class="sidebar-refresh-btn">🔄 刷新</button>
          <button class="sidebar-toggle-expand-btn">▼</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', sidebarHTML);
    this.sidebarElement = document.getElementById('mixread-sidebar');
    this.contentArea = this.sidebarElement.querySelector('.sidebar-content');
    this.statsElement = this.sidebarElement.querySelector('.sidebar-stats');

    console.log('[SidebarPanel] DOM created');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    this.sidebarElement.querySelector('.sidebar-toggle-btn')
      ?.addEventListener('click', () => this.toggleVisibility());

    // Refresh button
    this.sidebarElement.querySelector('.sidebar-refresh-btn')
      ?.addEventListener('click', () => this.refresh());

    // Start listening for new highlighted words
    this.startListeningForNewWords();

    // Monitor URL changes
    this.setupURLChangeListener();

    // Save cache on page unload
    this.setupUnloadHandler();
  }

  /**
   * Setup page unload handler to save cache before leaving
   */
  setupUnloadHandler() {
    window.addEventListener('beforeunload', async () => {
      if (this.currentCacheKey && Object.keys(this.wordState).length > 0) {
        try {
          const userId = userStore?.getUserId();
          if (userId) {
            // Synchronously save to avoid delays (non-blocking)
            this.cacheManager.setToCache(
              this.currentCacheKey,
              this.wordState,
              userId
            ).catch(e => console.warn('[SidebarPanel] Unload cache save error:', e));
          }
        } catch (e) {
          console.warn('[SidebarPanel] Unload handler error:', e);
        }
      }
    });

    console.log('[SidebarPanel] Unload handler registered');
  }

  /**
   * Load or restore page data from cache
   */
  async loadPageData() {
    try {
      const userId = userStore?.getUserId();
      if (!userId) {
        console.warn('[SidebarPanel] No userId, cannot load data');
        return;
      }

      this.currentUrl = window.location.href;
      this.currentCacheKey = this.cacheManager.getCacheKey(this.currentUrl);

      if (!this.currentCacheKey) {
        console.warn('[SidebarPanel] Invalid URL, cannot create cache key');
        return;
      }

      console.log(`[SidebarPanel] Loading data for ${this.currentCacheKey}`);

      // Try to restore from cache
      const cachedWordState = await this.cacheManager.getFromCache(
        this.currentCacheKey,
        userId
      );

      if (cachedWordState && Object.keys(cachedWordState).length > 0) {
        console.log(`[SidebarPanel] Restored from cache: ${Object.keys(cachedWordState).length} words`);
        // Restore from cache and convert originalWords back to Set
        this.wordState = {};
        Object.entries(cachedWordState).forEach(([key, data]) => {
          // Handle originalWords which might be Array, Set, or Object after serialization
          let originalWordsSet = new Set();
          if (data.originalWords) {
            if (Array.isArray(data.originalWords)) {
              originalWordsSet = new Set(data.originalWords);
            } else if (typeof data.originalWords === 'object') {
              // Might be serialized Set or object with string keys
              if (Set.prototype.isPrototypeOf(data.originalWords)) {
                originalWordsSet = new Set(data.originalWords);
              } else {
                // Try to get keys from object
                originalWordsSet = new Set(Object.keys(data.originalWords));
              }
            }
          }

          this.wordState[key] = {
            ...data,
            originalWords: originalWordsSet
          };
        });
        this.renderWordList();
        return;
      }

      console.log('[SidebarPanel] Cache miss, waiting for API response...');
      // Will be populated by onNewWordsHighlighted when API returns
    } catch (e) {
      console.error('[SidebarPanel] Load data error:', e);
    }
  }

  /**
   * Handle URL changes (for SPA)
   */
  setupURLChangeListener() {
    // Guard against multiple calls
    if (window.__mixreadUrlListenerSetup) {
      console.log('[SidebarPanel] URL change listener already installed (skipping duplicate)');
      return;
    }

    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', () => {
      this.onURLChange();
    });

    // Intercept pushState/replaceState for better SPA support
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.onURLChange(), 50);
      return undefined;
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.onURLChange(), 50);
      return undefined;
    };

    // Mark as initialized to prevent duplicate setup
    window.__mixreadUrlListenerSetup = true;

    console.log('[SidebarPanel] URL change listener installed');
  }

  /**
   * Called when URL changes
   */
  async onURLChange() {
    const newUrl = window.location.href;
    const newCacheKey = this.cacheManager.getCacheKey(newUrl);

    if (!newCacheKey || newCacheKey === this.currentCacheKey) {
      return;  // Same page
    }

    console.log(`[SidebarPanel] URL changed: ${this.currentCacheKey} → ${newCacheKey}`);

    try {
      const userId = userStore?.getUserId();
      if (!userId) return;

      // Save current cache
      if (this.currentCacheKey && Object.keys(this.wordState).length > 0) {
        await this.cacheManager.setToCache(
          this.currentCacheKey,
          this.wordState,
          userId
        );
      }

      // Load new page
      this.wordState = {};
      this.jumpIndex = {};
      await this.loadPageData();
    } catch (e) {
      console.error('[SidebarPanel] URL change error:', e);
    }
  }

  /**
   * Start listening for new highlighted words from content.js
   */
  startListeningForNewWords() {
    if (this.messageListener) {
      return;  // Already listening
    }

    this.messageListener = (request, sender, sendResponse) => {
      if (request.type === 'NEW_WORDS_HIGHLIGHTED' && this.isOpen) {
        console.log(`[SidebarPanel] Received NEW_WORDS_HIGHLIGHTED: ${Object.keys(request.newWords || {}).length} words`);
        this.onNewWordsHighlighted(request.newWords);
      }
    };

    try {
      chrome.runtime.onMessage.addListener(this.messageListener);
      console.log('[SidebarPanel] Message listener registered');
    } catch (e) {
      console.warn('[SidebarPanel] Failed to add message listener:', e);
    }
  }

  /**
   * Stop listening for new words
   */
  stopListeningForNewWords() {
    if (this.messageListener) {
      try {
        chrome.runtime.onMessage.removeListener(this.messageListener);
        this.messageListener = null;
        console.log('[SidebarPanel] Message listener removed');
      } catch (e) {
        console.warn('[SidebarPanel] Failed to remove message listener:', e);
      }
    }
  }

  /**
   * Handle new highlighted words (incremental update)
   */
  async onNewWordsHighlighted(newWordsData) {
    if (!newWordsData || Object.keys(newWordsData).length === 0) {
      return;
    }

    // Wait for initialization to complete if not yet ready
    if (!this.isInitialized) {
      console.log('[SidebarPanel] Waiting for sidebar initialization before processing words');
      let attempts = 0;
      while (!this.isInitialized && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (!this.isInitialized) {
        console.warn('[SidebarPanel] Sidebar initialization timeout, proceeding anyway');
      }
    }

    console.log(`[SidebarPanel] Adding ${Object.keys(newWordsData).length} new words`);

    // Process each word and merge into wordState
    Object.entries(newWordsData).forEach(([word, data]) => {
      const normalizedWord = this.normalizeWord(word);

      if (!this.wordState[normalizedWord]) {
        // New word
        this.wordState[normalizedWord] = {
          count: data.count || 0,
          originalWords: new Set(data.originalWords || [word]),
          chinese: data.chinese || '',
          definition: data.definition || '',
          baseWord: normalizedWord,
          isKnown: false,
          isLibrary: false
        };
      } else {
        // Existing word - merge
        this.wordState[normalizedWord].count += (data.count || 0);

        // Ensure originalWords is always a Set
        if (!Set.prototype.isPrototypeOf(this.wordState[normalizedWord].originalWords)) {
          this.wordState[normalizedWord].originalWords = new Set(
            this.wordState[normalizedWord].originalWords || []
          );
        }

        if (data.originalWords) {
          // Handle both Set and Array input
          if (Set.prototype.isPrototypeOf(data.originalWords)) {
            data.originalWords.forEach(w => {
              this.wordState[normalizedWord].originalWords.add(w);
            });
          } else if (Array.isArray(data.originalWords)) {
            data.originalWords.forEach(w => {
              this.wordState[normalizedWord].originalWords.add(w);
            });
          }
        }
      }
    });

    this.renderWordList();

    // Async cache update (non-blocking)
    try {
      const userId = userStore?.getUserId();
      if (userId && this.currentCacheKey) {
        await this.cacheManager.setToCache(
          this.currentCacheKey,
          this.wordState,
          userId
        );
      }
    } catch (e) {
      console.warn('[SidebarPanel] Cache update error:', e);
    }
  }

  /**
   * Handle words removed (Feed flow)
   */
  async onWordsRemoved(wordStems) {
    if (!wordStems || wordStems.length === 0) {
      return;
    }

    // Wait for initialization to complete if not yet ready
    if (!this.isInitialized) {
      console.log('[SidebarPanel] Waiting for sidebar initialization before processing removal');
      let attempts = 0;
      while (!this.isInitialized && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (!this.isInitialized) {
        console.warn('[SidebarPanel] Sidebar initialization timeout, proceeding with removal anyway');
      }
    }

    console.log(`[SidebarPanel] Removing ${wordStems.length} words from cache`);

    let changed = false;
    wordStems.forEach(stem => {
      const normalizedWord = this.normalizeWord(stem);

      if (this.wordState[normalizedWord]) {
        this.wordState[normalizedWord].count--;

        if (this.wordState[normalizedWord].count <= 0) {
          delete this.wordState[normalizedWord];
          changed = true;
        }
      }
    });

    if (changed) {
      this.renderWordList();

      // Async cache update
      try {
        const userId = userStore?.getUserId();
        if (userId && this.currentCacheKey) {
          await this.cacheManager.setToCache(
            this.currentCacheKey,
            this.wordState,
            userId
          );
        }
      } catch (e) {
        console.warn('[SidebarPanel] Cache update error:', e);
      }
    }
  }

  /**
   * Normalize word (stemming + deduplication)
   */
  normalizeWord(word) {
    if (!word) return '';

    // Convert to lowercase
    let normalized = word.toLowerCase();

    // Use Porter Stemmer if available (should be loaded by content.js)
    if (typeof Stemmer !== 'undefined' && Stemmer.stem) {
      try {
        normalized = Stemmer.stem(normalized);
      } catch (e) {
        console.warn('[SidebarPanel] Stemming error for word:', word, e);
      }
    }

    return normalized;
  }

  /**
   * Render word list
   */
  renderWordList() {
    if (!this.contentArea) return;

    // Clear existing
    this.contentArea.innerHTML = '';

    // Get sorted word list (by count, descending)
    const words = Object.entries(this.wordState)
      .sort((a, b) => b[1].count - a[1].count);

    // Update stats
    if (this.statsElement) {
      const totalCount = words.reduce((sum, [, data]) => sum + data.count, 0);
      const uniqueCount = words.length;

      this.statsElement.innerHTML = `
        📊 <span class="stat-count">${totalCount}</span> 词汇 |
        <span class="stat-unique">${uniqueCount}</span> 独特
      `;
    }

    // Render each word
    words.forEach(([word, data]) => {
      const wordItem = this.createWordItem(word, data);
      this.contentArea.appendChild(wordItem);
    });

    console.log(`[SidebarPanel] Rendered ${words.length} words`);
  }

  /**
   * Create word item element
   */
  createWordItem(normalizedWord, data) {
    const div = document.createElement('div');
    div.className = 'word-item';
    if (data.isKnown) div.classList.add('is-known');
    if (data.isLibrary) div.classList.add('is-library');
    div.dataset.word = normalizedWord;

    // Display text: show variants count if multiple forms
    // Handle both Set and Array formats for originalWords
    const variantsCount = Set.prototype.isPrototypeOf(data.originalWords)
      ? data.originalWords.size
      : (Array.isArray(data.originalWords) ? data.originalWords.length : 0);
    const hasVariants = variantsCount > 1;
    const displayWord = hasVariants
      ? `${normalizedWord}* (${variantsCount})`
      : normalizedWord;

    div.innerHTML = `
      <div class="word-main">
        <input type="checkbox" class="word-checkbox" data-word="${normalizedWord}">
        <span class="word-text">${displayWord}</span>
        <span class="word-count">[${data.count}]</span>
      </div>
      <div class="word-labels">
        ${data.isKnown ? '<span class="label known" title="已标记为已知">✓ Known</span>' : ''}
        ${data.isLibrary ? '<span class="label library" title="已添加到学习库">⭐ Library</span>' : ''}
      </div>
      <button class="jump-btn" data-word="${normalizedWord}" title="快速跳转">🔍</button>
    `;

    // Jump button event (Phase 2)
    const jumpBtn = div.querySelector('.jump-btn');
    jumpBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.jumpToWord(normalizedWord);
    });

    return div;
  }

  /**
   * Quick jump to word position (Phase 2 implementation)
   */
  jumpToWord(word) {
    // TODO: Phase 2 - implement jumping to positions
    console.log('[SidebarPanel] Jump to word:', word);
    // Will implement:
    // - Get all positions of this word
    // - Track current index
    // - Scroll to element
    // - Update highlight
    // - Show "X/Y" indicator
  }

  /**
   * Refresh word list (manual)
   */
  async refresh() {
    console.log('[SidebarPanel] Manual refresh');

    // Re-scan current page
    this.wordState = {};
    await this.loadPageData();

    // Trigger a re-highlight (will send NEW_WORDS_HIGHLIGHTED event)
    if (typeof highlightPageWords === 'function') {
      highlightPageWords();
    }
  }

  /**
   * Toggle sidebar visibility
   */
  async toggleVisibility() {
    this.isVisible = !this.isVisible;
    this.sidebarElement.style.display = this.isVisible ? 'block' : 'none';

    // Save preference
    try {
      await StorageManager.setItem('sidebar_visible', this.isVisible);
      console.log('[SidebarPanel] Visibility toggled:', this.isVisible);
    } catch (e) {
      console.warn('[SidebarPanel] Failed to save visibility preference:', e);
    }
  }

  /**
   * Load visibility preference from storage
   */
  async loadVisibilityPreference() {
    try {
      const saved = await StorageManager.getItem('sidebar_visible');
      // Default to false (closed)
      this.isVisible = saved === true ? true : false;
      this.sidebarElement.style.display = this.isVisible ? 'block' : 'none';
      console.log('[SidebarPanel] Loaded visibility preference:', this.isVisible);
    } catch (e) {
      console.warn('[SidebarPanel] Failed to load visibility preference:', e);
      this.isVisible = false;
    }
  }

  /**
   * Set sidebar width (CSS variable)
   */
  setSidebarWidth(width) {
    this.sidebarWidth = width;
    if (this.sidebarElement) {
      this.sidebarElement.style.width = width;
    }
    // Save preference
    StorageManager.setItem('sidebar_width', width).catch(e =>
      console.warn('[SidebarPanel] Failed to save width:', e)
    );
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      isOpen: this.isOpen,
      isVisible: this.isVisible,
      currentUrl: this.currentUrl,
      currentCacheKey: this.currentCacheKey,
      wordStateSize: Object.keys(this.wordState).length,
      wordState: this.wordState,
      cacheStats: this.cacheManager?.getStats()
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SidebarPanel;
}
