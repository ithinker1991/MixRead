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
    this.frequencyStatsElement = null;

    // State
    this.isOpen = false; // Internal state (always listening)
    this.isVisible = false; // UI visibility (user preference)
    this.isInitialized = false; // Track initialization completion
    this.wordState = {}; // {normalizedWord → {count, originalWords, ...}}
    this.currentUrl = null;
    this.currentCacheKey = null;
    this.jumpIndex = {}; // Track jump position per word
    this.tabId = null; // Current tab ID (for tab-granular caching)

    // Event listeners
    this.messageListener = null;
    this.urlChangeListeners = [];

    // Navigation tracking
    this.navigationMode = "normal"; // Track navigation type: 'spa' or 'normal'

    // Rectangle selection state
    this.isSelecting = false;
    this.selectionStart = null;
    this.selectionRect = null;

    // Width preference (user adjustable)
    this.sidebarWidth = "350px";

    console.log("[SidebarPanel] Initializing...");
    this.init();
  }

  /**
   * Initialize sidebar
   */
  async init() {
    try {
      // First, get the tab ID
      this.tabId = await this.getTabId();
      console.log("[SidebarPanel] Got tabId:", this.tabId);

      // Check if this is a page refresh
      const wasPageUnloading = sessionStorage.getItem("mixread_page_unloading");
      if (wasPageUnloading) {
        sessionStorage.removeItem("mixread_page_unloading");
        console.log(
          "[SidebarPanel] Detected page refresh/reload - will clear wordState on pageshow"
        );
      }

      await this.createSidebarHTML();
      this.attachEventListeners();
      await this.loadPageData();
      await this.loadVisibilityPreference();
      this.isOpen = true;
      this.isInitialized = true; // Mark initialization as complete
      console.log("[SidebarPanel] Initialization complete");
    } catch (e) {
      console.error("[SidebarPanel] Init error:", e);
      this.isInitialized = true; // Mark as initialized even on error to prevent retry loops
    }
  }

  /**
   * Get current tab ID from background service worker
   */
  async getTabId() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[SidebarPanel] Failed to get tabId:",
              chrome.runtime.lastError
            );
            resolve(null);
          } else if (response?.success && response?.tabId) {
            console.log("[SidebarPanel] Received tabId:", response.tabId);
            resolve(response.tabId);
          } else {
            console.warn("[SidebarPanel] Invalid tabId response:", response);
            resolve(null);
          }
        });
      } catch (e) {
        console.error("[SidebarPanel] Error requesting tabId:", e);
        resolve(null);
      }
    });
  }

  /**
   * Create sidebar DOM structure
   */
  async createSidebarHTML() {
    // Check if already exists
    if (document.getElementById("mixread-sidebar")) {
      this.sidebarElement = document.getElementById("mixread-sidebar");
      this.contentArea = this.sidebarElement.querySelector(".sidebar-content");
      this.statsElement = this.sidebarElement.querySelector(".sidebar-stats");
      this.frequencyStatsElement = this.sidebarElement.querySelector(
        ".sidebar-frequency-stats"
      );
      console.log("[SidebarPanel] Reusing existing sidebar DOM");
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

        <div class="sidebar-frequency-stats">
          🔥 <span class="stat-high-freq">0</span> 高频 | ❄️ <span class="stat-low-freq">0</span> 低频
        </div>

        <div class="sidebar-toolbar">
          <button class="toolbar-btn" id="select-all-btn" title="全选">全选</button>
          <button class="toolbar-btn" id="deselect-all-btn" title="反选">反选</button>
          <button class="toolbar-btn" id="clear-selection-btn" title="清空">清空</button>
        </div>

        <div class="sidebar-content"></div>

        <!-- Rectangle selection canvas for drag-to-select -->
        <div class="sidebar-selection-canvas"></div>

        <div class="sidebar-actions">
          <button class="action-btn mark-known-btn" id="mark-known-btn" disabled title="将选中的词标记为已知">✓ Mark as Known</button>
          <button class="action-btn add-library-btn" id="add-library-btn" disabled title="将选中的词添加到学习库">⭐ Add to Library</button>
          <button class="action-btn mark-unknown-btn" id="mark-unknown-btn" disabled title="将选中的词标记为未知">× Mark as Unknown</button>
        </div>

        <div class="sidebar-footer">
          <button class="sidebar-refresh-btn">🔄 刷新</button>
          <button class="sidebar-toggle-expand-btn">▼</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", sidebarHTML);
    this.sidebarElement = document.getElementById("mixread-sidebar");
    this.contentArea = this.sidebarElement.querySelector(".sidebar-content");
    this.statsElement = this.sidebarElement.querySelector(".sidebar-stats");
    this.frequencyStatsElement = this.sidebarElement.querySelector(
      ".sidebar-frequency-stats"
    );

    console.log("[SidebarPanel] DOM created");
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    this.sidebarElement
      .querySelector(".sidebar-toggle-btn")
      ?.addEventListener("click", () => this.toggleVisibility());

    // Refresh button
    this.sidebarElement
      .querySelector(".sidebar-refresh-btn")
      ?.addEventListener("click", () => this.refresh());

    // Toolbar buttons
    this.sidebarElement
      .querySelector("#select-all-btn")
      ?.addEventListener("click", () => this.selectAllCheckboxes());

    this.sidebarElement
      .querySelector("#deselect-all-btn")
      ?.addEventListener("click", () => this.deselectAllCheckboxes());

    this.sidebarElement
      .querySelector("#clear-selection-btn")
      ?.addEventListener("click", () => this.deselectAllCheckboxes());

    // Action buttons
    this.sidebarElement
      .querySelector("#mark-known-btn")
      ?.addEventListener("click", () => this.markSelectedAsKnown());

    this.sidebarElement
      .querySelector("#add-library-btn")
      ?.addEventListener("click", () => this.addSelectedToLibrary());

    this.sidebarElement
      .querySelector("#mark-unknown-btn")
      ?.addEventListener("click", () => this.markSelectedAsUnknown());

    // Rectangle selection listeners
    this.attachSelectionListeners();

    // Prevent page scroll when hovering sidebar
    this.attachScrollHandlers();

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
    window.addEventListener("beforeunload", async () => {
      if (this.currentCacheKey && Object.keys(this.wordState).length > 0) {
        try {
          const userId = userStore?.getUserId();
          if (userId) {
            // Synchronously save to avoid delays (non-blocking)
            this.cacheManager
              .setToCache(this.currentCacheKey, this.wordState, userId)
              .catch((e) =>
                console.warn("[SidebarPanel] Unload cache save error:", e)
              );
          }
        } catch (e) {
          console.warn("[SidebarPanel] Unload handler error:", e);
        }
      }
    });

    console.log("[SidebarPanel] Unload handler registered");
  }

  /**
   * Attach scroll handlers to prevent page scroll when hovering sidebar
   */
  attachScrollHandlers() {
    if (!this.sidebarElement) return;

    const contentArea = this.sidebarElement.querySelector(".sidebar-content");
    if (!contentArea) return;

    // Handle wheel events on sidebar content to prevent page scroll
    contentArea.addEventListener(
      "wheel",
      (e) => {
        const element = e.target.closest(".sidebar-content");
        if (!element) return;

        // Check if content can scroll in the direction of wheel movement
        const canScrollDown =
          element.scrollHeight > element.scrollTop + element.clientHeight;
        const canScrollUp = element.scrollTop > 0;
        const isScrollingDown = e.deltaY > 0;
        const isScrollingUp = e.deltaY < 0;

        // Only prevent default scroll if:
        // 1. We're scrolling down and content can scroll down
        // 2. We're scrolling up and content can scroll up
        const shouldPreventDefault =
          (isScrollingDown && canScrollDown) || (isScrollingUp && canScrollUp);

        if (shouldPreventDefault) {
          // Allow sidebar to scroll naturally
          return;
        }

        // If we're at the top/bottom and trying to scroll further,
        // prevent default to avoid page scroll
        if (!canScrollDown && isScrollingDown) {
          e.preventDefault();
        } else if (!canScrollUp && isScrollingUp) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Prevent page scroll when hovering over other sidebar areas
    this.sidebarElement.addEventListener(
      "wheel",
      (e) => {
        if (e.target.closest(".sidebar-content")) {
          // Already handled above
          return;
        }
        // For non-content areas, always prevent default
        e.preventDefault();
      },
      { passive: false }
    );

    console.log("[SidebarPanel] Scroll handlers attached");
  }

  /**
   * Attach rectangle selection (drag-to-select) listeners
   */
  attachSelectionListeners() {
    // Ensure we have content area before attaching listeners
    if (!this.contentArea) {
      console.warn(
        "[SidebarPanel] contentArea not ready for selection listeners"
      );
      return;
    }

    // Use document-level listeners for better tracking
    document.addEventListener("mousedown", (e) => this.handleSelectionStart(e));
    document.addEventListener("mousemove", (e) => this.handleSelectionMove(e));
    document.addEventListener("mouseup", (e) => this.handleSelectionEnd(e));

    console.log("[SidebarPanel] Rectangle selection listeners attached");
  }

  /**
   * Handle rectangle selection start
   */
  handleSelectionStart(e) {
    // Check if we're inside the sidebar content area (but not on a checkbox or word item)
    const contentArea = this.contentArea;
    if (!contentArea || !contentArea.contains(e.target)) {
      return;
    }

    // Don't start selection if clicking on checkboxes or buttons
    if (
      e.target.closest(".word-checkbox") ||
      e.target.closest("button") ||
      e.target
        .closest(".word-item")
        ?.querySelector(".word-checkbox")
        .contains(e.target)
    ) {
      return;
    }

    this.isSelecting = true;
    this.selectionStart = { x: e.clientX, y: e.clientY };
    console.log("[SidebarPanel] Selection started at", this.selectionStart);
  }

  /**
   * Handle rectangle selection move
   */
  handleSelectionMove(e) {
    if (!this.isSelecting || !this.selectionStart) return;

    const canvas = this.sidebarElement?.querySelector(
      ".sidebar-selection-canvas"
    );
    if (!canvas) return;

    // Calculate rectangle
    const startX = this.selectionStart.x;
    const startY = this.selectionStart.y;
    const endX = e.clientX;
    const endY = e.clientY;

    // Position and size
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Only show if minimum size (5px)
    if (width < 5 || height < 5) {
      canvas.classList.remove("active");
      return;
    }

    // Apply styles
    canvas.style.left = left + "px";
    canvas.style.top = top + "px";
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.classList.add("active");

    // Store rectangle
    this.selectionRect = { left, top, width, height };
  }

  /**
   * Handle rectangle selection end
   */
  handleSelectionEnd(e) {
    if (!this.isSelecting || !this.selectionRect) {
      this.isSelecting = false;
      const canvas = this.sidebarElement?.querySelector(
        ".sidebar-selection-canvas"
      );
      if (canvas) canvas.classList.remove("active");
      return;
    }

    // Select words in rectangle
    this.selectWordsInRect(this.selectionRect);

    this.isSelecting = false;
    const canvas = this.sidebarElement?.querySelector(
      ".sidebar-selection-canvas"
    );
    if (canvas) canvas.classList.remove("active");

    console.log("[SidebarPanel] Selection ended");
  }

  /**
   * Select words within rectangle
   */
  selectWordsInRect(rect) {
    const checkboxes = this.contentArea?.querySelectorAll(".word-checkbox");
    let selectedCount = 0;

    if (!checkboxes) return;

    checkboxes.forEach((checkbox) => {
      const wordItem = checkbox.closest(".word-item");
      if (!wordItem) return;

      // Get word item's position in viewport
      const itemRect = wordItem.getBoundingClientRect();

      // Check if word item overlaps with selection rectangle
      if (
        itemRect.right > rect.left &&
        itemRect.left < rect.left + rect.width &&
        itemRect.bottom > rect.top &&
        itemRect.top < rect.top + rect.height
      ) {
        checkbox.checked = !checkbox.checked;
        selectedCount++;
      }
    });

    // Update action buttons state after selection
    this.updateActionButtonsState();

    console.log(
      `[SidebarPanel] Selected/deselected ${selectedCount} words in rectangle`
    );
  }

  /**
   * Select all checkboxes in sidebar
   */
  selectAllCheckboxes() {
    const checkboxes = this.contentArea?.querySelectorAll(".word-checkbox");
    if (checkboxes) {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
      });
      this.updateActionButtonsState();
      console.log("[SidebarPanel] All checkboxes selected");
    }
  }

  /**
   * Deselect all checkboxes in sidebar
   */
  deselectAllCheckboxes() {
    const checkboxes = this.contentArea?.querySelectorAll(".word-checkbox");
    if (checkboxes) {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      this.updateActionButtonsState();
      console.log("[SidebarPanel] All checkboxes deselected");
    }
  }

  /**
   * Get list of selected word stems
   */
  getSelectedWords() {
    const checkboxes = this.contentArea?.querySelectorAll(
      ".word-checkbox:checked"
    );
    const selectedWords = [];
    if (checkboxes) {
      checkboxes.forEach((checkbox) => {
        const word = checkbox.dataset.word;
        if (word) {
          selectedWords.push(word);
        }
      });
    }
    return selectedWords;
  }

  /**
   * Update action buttons enabled/disabled state based on selection
   */
  updateActionButtonsState() {
    const selectedWords = this.getSelectedWords();
    const hasSelection = selectedWords.length > 0;

    const markKnownBtn = this.sidebarElement?.querySelector("#mark-known-btn");
    const addLibraryBtn =
      this.sidebarElement?.querySelector("#add-library-btn");
    const markUnknownBtn =
      this.sidebarElement?.querySelector("#mark-unknown-btn");

    if (markKnownBtn) markKnownBtn.disabled = !hasSelection;
    if (addLibraryBtn) addLibraryBtn.disabled = !hasSelection;
    if (markUnknownBtn) markUnknownBtn.disabled = !hasSelection;
  }

  /**
   * Mark selected words as known
   */
  async markSelectedAsKnown() {
    const selectedWords = this.getSelectedWords();
    if (selectedWords.length === 0) {
      console.warn("[SidebarPanel] No words selected");
      return;
    }

    try {
      console.log("[SidebarPanel] Marking as known:", selectedWords);

      // Update local state
      selectedWords.forEach((word) => {
        if (this.wordState[word]) {
          this.wordState[word].isKnown = true;
        }
      });

      // Call API to mark words as known
      if (
        typeof unknownWordsService !== "undefined" &&
        unknownWordsService.markWordsAsKnown
      ) {
        const userId = userStore?.getUserId();
        if (userId) {
          await unknownWordsService.markWordsAsKnown(userId, selectedWords);
        }
      }

      // Update UI
      this.renderWordList();
      this.deselectAllCheckboxes();
      console.log(
        "[SidebarPanel] Successfully marked as known:",
        selectedWords
      );
    } catch (e) {
      console.error("[SidebarPanel] Error marking as known:", e);
    }
  }

  /**
   * Add selected words to library
   */
  async addSelectedToLibrary() {
    const selectedWords = this.getSelectedWords();
    if (selectedWords.length === 0) {
      console.warn("[SidebarPanel] No words selected");
      return;
    }

    try {
      console.log("[SidebarPanel] Adding to library:", selectedWords);

      // Update local state
      selectedWords.forEach((word) => {
        if (this.wordState[word]) {
          this.wordState[word].isLibrary = true;
        }
      });

      // Get current page context
      const pageUrl = window.location.href;
      const pageTitle = document.title;

      // Send each word to library via background.js
      const userId = userStore?.getUserId();
      if (!userId) {
        console.warn("[SidebarPanel] No user ID available");
        return;
      }

      // Process words serially to avoid race conditions
      for (const word of selectedWords) {
        await this.sendWordToLibrary(word, userId, pageUrl, pageTitle);
      }

      // Update UI
      this.renderWordList();
      this.deselectAllCheckboxes();
      console.log(
        "[SidebarPanel] Successfully added to library:",
        selectedWords
      );
    } catch (e) {
      console.error("[SidebarPanel] Error adding to library:", e);
    }
  }

  /**
   * Send a word to library via background.js
   * @param {string} word - Word to add to library
   * @param {string} userId - User ID
   * @param {string} pageUrl - Current page URL
   * @param {string} pageTitle - Current page title
   */
  sendWordToLibrary(word, userId, pageUrl, pageTitle) {
    return new Promise((resolve, reject) => {
      try {
        const sendAddToLibrary = () => {
          try {
            // Use word directly
            const wordLower = word.toLowerCase();

            const sentenceSet = new Set();

            // Find all highlighted elements with this word
            const allElements = document.querySelectorAll(
              `.mixread-highlight[data-word="${wordLower}"]`
            );

            console.log(
              `[SidebarPanel] Found ${allElements.length} highlighted elements for "${word}"`
            );

            // Extract cached sentence contexts from data attributes
            allElements.forEach((element) => {
              const cachedContext = element.dataset.sentenceContext;
              if (cachedContext) {
                sentenceSet.add(cachedContext);
              }
            });

            const sentences = Array.from(sentenceSet);
            console.log(
              `[SidebarPanel] Extracted ${sentences.length} unique sentence contexts for "${word}"`
            );

            if (sentences.length > 0) {
              console.log(
                `[SidebarPanel] Sample sentences:`,
                sentences.slice(0, 2)
              );
            }

            // Create contexts array with extracted sentences or fallback
            const contexts = [
              {
                page_url: pageUrl,
                page_title: pageTitle,
                sentences:
                  sentences.length > 0
                    ? sentences
                    : [`Encountered "${word}" while reading.`],
                timestamp: Date.now(),
              },
            ];

            chrome.runtime.sendMessage(
              {
                type: "ADD_TO_LIBRARY",
                user_id: userId,
                word: word,
                contexts: contexts,
              },
              (response) => {
                try {
                  if (chrome.runtime.lastError) {
                    console.warn(
                      `[SidebarPanel] Extension context error when adding "${word}":`,
                      chrome.runtime.lastError.message
                    );
                    setTimeout(sendAddToLibrary, 500);
                  } else if (response?.success) {
                    const msg =
                      sentences.length > 0
                        ? `Added "${word}" with ${sentences.length} sentence(s)`
                        : `Added "${word}" with fallback context`;
                    console.log(`[SidebarPanel] ${msg}`);
                    console.log(
                      `[SidebarPanel DEBUG] Contexts sent for "${word}":`,
                      contexts
                    );
                    resolve(response);
                  } else {
                    console.warn(
                      `[SidebarPanel] Failed to add "${word}" to library:`,
                      response?.error
                    );
                    reject(new Error(response?.error || "Unknown error"));
                  }
                } catch (e) {
                  console.error(`[SidebarPanel] Error in callback:`, e.message);
                  reject(e);
                }
              }
            );
          } catch (e) {
            console.error(`[SidebarPanel] Failed to send message:`, e.message);
            reject(e);
          }
        };

        sendAddToLibrary();
      } catch (error) {
        console.error(
          `[SidebarPanel] Error setting up add to library:`,
          error.message
        );
        reject(error);
      }
    });
  }

  /**
   * Mark selected words as unknown
   */
  async markSelectedAsUnknown() {
    const selectedWords = this.getSelectedWords();
    if (selectedWords.length === 0) {
      console.warn("[SidebarPanel] No words selected");
      return;
    }

    try {
      console.log("[SidebarPanel] Marking as unknown:", selectedWords);

      // Update local state
      selectedWords.forEach((word) => {
        if (this.wordState[word]) {
          this.wordState[word].isKnown = false;
        }
      });

      // Call API to mark words as unknown
      if (
        typeof unknownWordsService !== "undefined" &&
        unknownWordsService.markWordsAsUnknown
      ) {
        const userId = userStore?.getUserId();
        if (userId) {
          await unknownWordsService.markWordsAsUnknown(userId, selectedWords);
        }
      }

      // Update UI
      this.renderWordList();
      this.deselectAllCheckboxes();
      console.log(
        "[SidebarPanel] Successfully marked as unknown:",
        selectedWords
      );
    } catch (e) {
      console.error("[SidebarPanel] Error marking as unknown:", e);
    }
  }

  /**
   * Load or restore page data from cache
   * Now uses tab-granular caching instead of URL-based
   *
   * IMPORTANT: Don't restore from cache on init() - let pageshow event handle it
   * pageshow fires AFTER init() and determines if we should clear or keep words
   */
  async loadPageData() {
    try {
      const userId = userStore?.getUserId();
      if (!userId || !this.tabId) {
        console.warn(
          "[SidebarPanel] Missing userId or tabId, cannot load data"
        );
        return;
      }

      this.currentUrl = window.location.href;
      // Use tab ID for cache key instead of URL
      this.currentCacheKey = this.cacheManager.getTabCacheKey(this.tabId);

      if (!this.currentCacheKey) {
        console.warn("[SidebarPanel] Invalid tabId, cannot create cache key");
        return;
      }

      console.log(
        `[SidebarPanel] Initialized cache key: ${this.currentCacheKey} (tabId: ${this.tabId})`
      );

      // DON'T restore from cache here - pageshow event will handle it
      // If this is a fresh load (F5 refresh), pageshow will clear words
      // If this is a BFCache restore, pageshow will keep words
      // Initial wordState is empty
      this.wordState = {};
      this.renderWordList();

      console.log("[SidebarPanel] Ready to receive words from highlight API");
    } catch (e) {
      console.error("[SidebarPanel] Load data error:", e);
      this.wordState = {};
      this.renderWordList();
    }
  }

  /**
   * Deserialize cached word state, converting originalWords back to Set
   */
  deserializeWordState(cachedState) {
    const result = {};
    Object.entries(cachedState).forEach(([key, data]) => {
      // Handle originalWords which might be Array, Set, or Object after serialization
      let originalWordsSet = new Set();
      if (data.originalWords) {
        if (Array.isArray(data.originalWords)) {
          originalWordsSet = new Set(data.originalWords);
        } else if (typeof data.originalWords === "object") {
          // Might be serialized Set or object with string keys
          if (Set.prototype.isPrototypeOf(data.originalWords)) {
            originalWordsSet = new Set(data.originalWords);
          } else {
            // Try to get keys from object
            originalWordsSet = new Set(Object.keys(data.originalWords));
          }
        }
      }

      result[key] = {
        ...data,
        originalWords: originalWordsSet,
      };
    });
    return result;
  }

  /**
   * Handle URL changes (for SPA)
   * Detects SPA navigation vs regular navigation
   * Uses pageshow/pagehide for accurate lifecycle tracking
   */
  setupURLChangeListener() {
    // Guard against multiple calls
    if (window.__mixreadUrlListenerSetup) {
      console.log(
        "[SidebarPanel] URL change listener already installed (skipping duplicate)"
      );
      return;
    }

    // === Page Lifecycle Listeners ===
    // pageshow: Fires when page is shown (including bfcache restoration)
    window.addEventListener("pageshow", (event) => {
      console.log("[SidebarPanel] pageshow event:", {
        persisted: event.persisted,
      });

      if (event.persisted) {
        // Page restored from bfcache - keep existing wordState
        console.log(
          "[SidebarPanel] Page restored from bfcache - keeping wordState"
        );
        this.renderWordList(); // Re-render in case DOM was recreated
        return;
      }

      // Page loaded fresh (not from bfcache)
      // This includes: F5 refresh, new URL, back/forward without bfcache, etc.
      console.log(
        "[SidebarPanel] Page loaded fresh - clearing wordState for fresh session"
      );
      this.wordState = {};
      this.jumpIndex = {};
      this.renderWordList();
    });

    // pagehide: Fires when page is hidden (including entering bfcache)
    window.addEventListener("pagehide", (event) => {
      if (event.persisted) {
        console.log(
          "[SidebarPanel] Page entering bfcache - state will be preserved"
        );
      } else {
        console.log("[SidebarPanel] Page being unloaded");
      }
    });

    // === SPA Navigation Detection ===
    // Intercept pushState/replaceState for SPA navigation detection
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      console.log(
        "[SidebarPanel] pushState detected - marking as SPA navigation"
      );
      this.navigationMode = "spa"; // Mark as SPA navigation
      originalPushState.apply(history, args);
      setTimeout(() => this.onURLChange(), 50);
      return undefined;
    };

    history.replaceState = (...args) => {
      console.log(
        "[SidebarPanel] replaceState detected - marking as SPA navigation"
      );
      this.navigationMode = "spa"; // Mark as SPA navigation
      originalReplaceState.apply(history, args);
      setTimeout(() => this.onURLChange(), 50);
      return undefined;
    };

    // === Refresh Detection ===
    // Mark when page is about to unload (F5, refresh button, new URL input, etc.)
    window.addEventListener("beforeunload", () => {
      console.log(
        "[SidebarPanel] beforeunload event - page is about to reload"
      );
      sessionStorage.setItem("mixread_page_unloading", "true");
    });

    // Mark as initialized to prevent duplicate setup
    window.__mixreadUrlListenerSetup = true;

    console.log(
      "[SidebarPanel] URL change listener installed with pageshow/pagehide and SPA detection"
    );
  }

  /**
   * Called when URL changes via SPA navigation (pushState/replaceState)
   * Note: Page reloads are now handled by pageshow event
   */
  async onURLChange() {
    // Check if this is SPA navigation
    if (this.navigationMode === "spa") {
      console.log(
        "[SidebarPanel] SPA navigation detected - continuing to accumulate words"
      );
      this.navigationMode = "normal"; // Reset for next navigation
      return; // Don't clear words, continue accumulating
    }

    // This shouldn't happen anymore since regular navigation is handled by pageshow
    console.log("[SidebarPanel] onURLChange called but not SPA navigation");
  }

  /**
   * Start listening for new highlighted words from content.js
   */
  startListeningForNewWords() {
    if (this.messageListener) {
      return; // Already listening
    }

    this.messageListener = (request, sender, sendResponse) => {
      if (request.type === "NEW_WORDS_HIGHLIGHTED" && this.isOpen) {
        console.log(
          `[SidebarPanel] Received NEW_WORDS_HIGHLIGHTED: ${
            Object.keys(request.newWords || {}).length
          } words`
        );
        this.onNewWordsHighlighted(request.newWords);
      }
    };

    try {
      chrome.runtime.onMessage.addListener(this.messageListener);
      console.log("[SidebarPanel] Message listener registered");
    } catch (e) {
      console.warn("[SidebarPanel] Failed to add message listener:", e);
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
        console.log("[SidebarPanel] Message listener removed");
      } catch (e) {
        console.warn("[SidebarPanel] Failed to remove message listener:", e);
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
      console.log(
        "[SidebarPanel] Waiting for sidebar initialization before processing words"
      );
      let attempts = 0;
      while (!this.isInitialized && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
      if (!this.isInitialized) {
        console.warn(
          "[SidebarPanel] Sidebar initialization timeout, proceeding anyway"
        );
      }
    }

    console.log(
      `[SidebarPanel] Adding ${Object.keys(newWordsData).length} new words`
    );

    // Process each word and merge into wordState
    Object.entries(newWordsData).forEach(([word, data]) => {
      const normalizedWord = this.normalizeWord(word);

      if (!this.wordState[normalizedWord]) {
        // New word
        this.wordState[normalizedWord] = {
          count: data.count || 0,
          originalWords: new Set(data.originalWords || [word]),
          chinese: data.chinese || "",
          definition: data.definition || "",
          cefrLevel: data.cefrLevel || "",
          baseWord: normalizedWord,
          isKnown: false,
          isLibrary: false,
        };
      } else {
        // Existing word - merge
        this.wordState[normalizedWord].count += data.count || 0;

        // Ensure originalWords is always a Set
        if (
          !Set.prototype.isPrototypeOf(
            this.wordState[normalizedWord].originalWords
          )
        ) {
          this.wordState[normalizedWord].originalWords = new Set(
            this.wordState[normalizedWord].originalWords || []
          );
        }

        if (data.originalWords) {
          // Handle both Set and Array input
          if (Set.prototype.isPrototypeOf(data.originalWords)) {
            data.originalWords.forEach((w) => {
              this.wordState[normalizedWord].originalWords.add(w);
            });
          } else if (Array.isArray(data.originalWords)) {
            data.originalWords.forEach((w) => {
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
      console.warn("[SidebarPanel] Cache update error:", e);
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
      console.log(
        "[SidebarPanel] Waiting for sidebar initialization before processing removal"
      );
      let attempts = 0;
      while (!this.isInitialized && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
      if (!this.isInitialized) {
        console.warn(
          "[SidebarPanel] Sidebar initialization timeout, proceeding with removal anyway"
        );
      }
    }

    console.log(`[SidebarPanel] Removing ${wordStems.length} words from cache`);

    let changed = false;
    wordStems.forEach((stem) => {
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
        console.warn("[SidebarPanel] Cache update error:", e);
      }
    }
  }

  /**
   * Normalize word (stemming + deduplication)
   */
  normalizeWord(word) {
    if (!word) return "";
    return word.toLowerCase().trim();
  }

  /**
   * Render word list
   */
  renderWordList() {
    console.log(
      "[SidebarPanel] renderWordList called, contentArea:",
      !!this.contentArea,
      "wordState keys:",
      Object.keys(this.wordState).length
    );

    if (!this.contentArea) {
      console.error("[SidebarPanel] contentArea is null or undefined!");
      return;
    }

    // Clear existing
    this.contentArea.innerHTML = "";

    // Get sorted word list (by count, descending)
    const words = Object.entries(this.wordState).sort(
      (a, b) => b[1].count - a[1].count
    );

    console.log("[SidebarPanel] Words to render:", words.length);

    // Calculate statistics
    const totalCount = words.reduce((sum, [, data]) => sum + data.count, 0);
    const uniqueCount = words.length;
    const highFreqCount = words.filter(([, data]) => data.count >= 3).length;
    const mediumFreqCount = words.filter(([, data]) => data.count === 2).length;
    const lowFreqCount = words.filter(([, data]) => data.count === 1).length;

    // Update stats
    if (this.statsElement) {
      this.statsElement.innerHTML = `
        📊 <span class="stat-count">${totalCount}</span> 词汇 |
        <span class="stat-unique">${uniqueCount}</span> 独特
      `;
    }

    // Update frequency stats
    if (this.frequencyStatsElement) {
      this.frequencyStatsElement.innerHTML = `
        🔥 <span class="stat-high-freq">${highFreqCount}</span> 高频 | 📊 <span class="stat-medium-freq">${mediumFreqCount}</span> 中频 | ❄️ <span class="stat-low-freq">${lowFreqCount}</span> 低频
      `;
    }

    // Separate words by frequency
    const highFreq = words.filter(([, data]) => data.count >= 3);
    const mediumFreq = words.filter(([, data]) => data.count === 2);
    const lowFreq = words.filter(([, data]) => data.count === 1);

    // Render high frequency section
    if (highFreq.length > 0) {
      this.renderFrequencyGroup("🔥 High Frequency", highFreq);
    }

    // Render medium frequency section
    if (mediumFreq.length > 0) {
      this.renderFrequencyGroup("📊 Medium Frequency", mediumFreq);
    }

    // Render low frequency section
    if (lowFreq.length > 0) {
      this.renderFrequencyGroup("❄️ Low Frequency", lowFreq);
    }

    // If no words, show empty state
    if (words.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "sidebar-empty";
      emptyDiv.innerHTML = "<p>No words highlighted yet</p>";
      this.contentArea.appendChild(emptyDiv);
    }

    console.log(
      `[SidebarPanel] Rendered ${words.length} words (${highFreqCount} high, ${mediumFreqCount} medium, ${lowFreqCount} low freq)`
    );
  }

  /**
   * Render a frequency group with header
   */
  renderFrequencyGroup(title, words) {
    // Create group container
    const groupDiv = document.createElement("div");
    groupDiv.className = "frequency-group";

    // Create group header
    const headerDiv = document.createElement("div");
    headerDiv.className = "frequency-group-header";
    headerDiv.textContent = title;
    groupDiv.appendChild(headerDiv);

    // Create group content
    const contentDiv = document.createElement("div");
    contentDiv.className = "frequency-group-content";
    words.forEach(([word, data]) => {
      const wordItem = this.createWordItem(word, data);
      contentDiv.appendChild(wordItem);
    });
    groupDiv.appendChild(contentDiv);

    this.contentArea.appendChild(groupDiv);
  }

  /**
   * Create word item element
   */
  createWordItem(normalizedWord, data) {
    const div = document.createElement("div");
    div.className = "word-item";
    if (data.isKnown) div.classList.add("is-known");
    if (data.isLibrary) div.classList.add("is-library");
    div.dataset.word = normalizedWord;

    // Display text: show variants count if multiple forms
    // Handle both Set and Array formats for originalWords
    const variantsCount = Set.prototype.isPrototypeOf(data.originalWords)
      ? data.originalWords.size
      : Array.isArray(data.originalWords)
      ? data.originalWords.length
      : 0;
    const hasVariants = variantsCount > 1;
    const displayWord = hasVariants
      ? `${normalizedWord}* (${variantsCount})`
      : normalizedWord;

    // Extract example sentences for this word
    const sentences = this.extractWordSentences(normalizedWord);
    const sentencesHTML =
      sentences.length > 0
        ? `<div class="word-sentences">
           ${sentences
             .slice(0, 2)
             .map(
               (sentence) => `<div class="sentence-example">"${sentence}"</div>`
             )
             .join("")}
         </div>`
        : "";

    div.innerHTML = `
      <div class="word-main">
        <input type="checkbox" class="word-checkbox" data-word="${normalizedWord}">
        <span class="word-text">${displayWord}</span>
        <span class="word-count">[${data.count}]</span>
      </div>
      <div class="word-labels">
        ${
          data.cefrLevel
            ? `<span class="label cefr" title="CEFR Level">${data.cefrLevel}</span>`
            : ""
        }
        ${
          data.isKnown
            ? '<span class="label known" title="已标记为已知">✓ Known</span>'
            : ""
        }
        ${
          data.isLibrary
            ? '<span class="label library" title="已添加到学习库">⭐ Library</span>'
            : ""
        }
      </div>
      ${sentencesHTML}
      <button class="jump-btn" data-word="${normalizedWord}" title="快速跳转">🔍</button>
    `;

    // Jump button event (Phase 2)
    const jumpBtn = div.querySelector(".jump-btn");
    jumpBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.jumpToWord(normalizedWord);
    });

    // Checkbox change event - update action buttons state
    const checkbox = div.querySelector(".word-checkbox");
    checkbox?.addEventListener("change", () => {
      this.updateActionButtonsState();
    });

    return div;
  }

  /**
   * Extract example sentences for a word from highlighted elements
   * @param {string} word - The normalized word
   * @returns {string[]} Array of unique sentences
   */
  extractWordSentences(word) {
    try {
      // Use word directly
      const wordLower = word.toLowerCase();

      const sentenceSet = new Set();

      // Find all highlighted elements with this word
      const allElements = document.querySelectorAll(
        `.mixread-highlight[data-word="${wordLower}"]`
      );

      // Extract cached sentence contexts from data attributes
      allElements.forEach((element) => {
        const cachedContext = element.dataset.sentenceContext;
        if (cachedContext) {
          sentenceSet.add(cachedContext);
        }
      });

      return Array.from(sentenceSet);
    } catch (error) {
      console.error(
        `[SidebarPanel] Error extracting sentences for "${word}":`,
        error
      );
      return [];
    }
  }

  /**
   * Quick jump to word position (Phase 2 implementation)
   */
  jumpToWord(word) {
    // TODO: Phase 2 - implement jumping to positions
    console.log("[SidebarPanel] Jump to word:", word);
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
    console.log("[SidebarPanel] Manual refresh - re-highlighting page");

    // Just trigger a re-highlight without clearing word state
    // This will discover any new words on dynamically loaded content
    if (typeof highlightPageWords === "function") {
      highlightPageWords();
      console.log("[SidebarPanel] Page re-highlighted");
    } else {
      console.warn("[SidebarPanel] highlightPageWords function not found");
    }
  }

  /**
   * Toggle sidebar visibility
   */
  async toggleVisibility() {
    this.isVisible = !this.isVisible;
    this.sidebarElement.style.display = this.isVisible ? "block" : "none";

    // Save preference
    try {
      await StorageManager.setItem("sidebar_visible", this.isVisible);
      console.log("[SidebarPanel] Visibility toggled:", this.isVisible);
    } catch (e) {
      console.warn("[SidebarPanel] Failed to save visibility preference:", e);
    }
  }

  /**
   * Load visibility preference from storage
   */
  async loadVisibilityPreference() {
    try {
      const saved = await StorageManager.getItem("sidebar_visible");
      // Only hide if explicitly set to false
      // Default to true (open) for all other cases (null, undefined, etc.)
      this.isVisible = saved !== false ? true : false;
      this.sidebarElement.style.display = this.isVisible ? "flex" : "none";
      console.log(
        "[SidebarPanel] Loaded visibility preference:",
        this.isVisible,
        "(saved:",
        saved,
        ")"
      );
    } catch (e) {
      console.warn("[SidebarPanel] Failed to load visibility preference:", e);
      this.isVisible = true; // Default to open on error
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
    StorageManager.setItem("sidebar_width", width).catch((e) =>
      console.warn("[SidebarPanel] Failed to save width:", e)
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
      cacheStats: this.cacheManager?.getStats(),
    };
  }
}

// Export for use in both module and global scope
if (typeof module !== "undefined" && module.exports) {
  module.exports = SidebarPanel;
} else if (typeof window !== "undefined") {
  window.SidebarPanel = SidebarPanel;
}
