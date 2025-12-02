/**
 * Batch Marking Panel Module
 *
 * Displays all highlighted words on the current page with frequency grouping
 * Allows users to batch mark words as known/unknown
 */

class BatchMarkingPanel {
  constructor(unknownWordsService, userStore) {
    this.unknownWordsService = unknownWordsService;
    this.userStore = userStore;
    this.panelElement = null;
    this.isOpen = false;
    this.wordFrequency = {};
    this.groups = null;
    this.showChinese = true; // Default to show Chinese
  }

  /**
   * Initialize panel (create HTML structure)
   */
  init() {
    if (this.panelElement) return; // Already initialized

    const panelHTML = `
      <div id="mixread-batch-panel" class="mixread-batch-panel">
        <div class="panel-header">
          <h3>MixRead - 页面单词</h3>
          <button class="panel-close-btn" aria-label="Close panel">✕</button>
        </div>

        <div class="panel-stats">
          📊 <span id="panel-total-words">0</span> 个高亮单词
          <span class="selection-hint">💡 拖动框选或使用快速选择</span>
        </div>

        <div class="panel-settings">
          <label class="toggle-switch">
            <input type="checkbox" id="show-chinese-toggle" checked>
            <span class="toggle-slider"></span>
            <span class="toggle-label">显示中文释义</span>
          </label>
        </div>

        <div class="panel-quick-select">
          <button id="quick-select-high" class="quick-btn" title="快速选择高频词">🔴 高频</button>
          <button id="quick-select-medium" class="quick-btn" title="快速选择中频词">🟡 中频</button>
          <button id="quick-select-low" class="quick-btn" title="快速选择低频词">🟢 低频</button>
        </div>

        <div class="panel-content" id="panel-content-area">
          <div class="loading">加载中...</div>
        </div>

        <div class="selection-canvas"></div>

        <div class="panel-toolbar">
          <button id="select-all-btn" class="toolbar-btn">全选</button>
          <button id="deselect-all-btn" class="toolbar-btn">反选</button>
          <button id="clear-all-btn" class="toolbar-btn">清空</button>
        </div>

        <div class="panel-actions">
          <button id="add-to-library-btn" class="action-btn info">⭐ Add to Library</button>
          <button id="mark-known-btn" class="action-btn primary">✓ Mark as Known</button>
          <button id="mark-unknown-btn" class="action-btn">× Mark as Unknown</button>
        </div>

        <div id="confirm-dialog" class="confirm-dialog hidden">
          <div class="confirm-content">
            <p id="confirm-message"></p>
            <div class="confirm-buttons">
              <button id="confirm-cancel" class="btn-cancel">取消</button>
              <button id="confirm-ok" class="btn-ok">确认</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', panelHTML);
    this.panelElement = document.querySelector('#mixread-batch-panel');

    // Initialize selection state
    this.isSelecting = false;
    this.selectionStart = null;
    this.selectionRect = null;

    this.attachEventListeners();
    this.attachSelectionListeners();
    console.log('[BatchMarkingPanel] Panel initialized');
  }

  /**
   * Attach event listeners to panel elements
   */
  attachEventListeners() {
    // Close button
    this.panelElement.querySelector('.panel-close-btn')
      .addEventListener('click', () => this.close());

    // Quick select buttons
    document.querySelector('#quick-select-high')
      .addEventListener('click', () => this.quickSelectByFrequency('high'));

    document.querySelector('#quick-select-medium')
      .addEventListener('click', () => this.quickSelectByFrequency('medium'));

    document.querySelector('#quick-select-low')
      .addEventListener('click', () => this.quickSelectByFrequency('low'));

    // Toolbar buttons
    document.querySelector('#select-all-btn')
      .addEventListener('click', () => this.selectAll());

    document.querySelector('#deselect-all-btn')
      .addEventListener('click', () => this.deselectAll());

    document.querySelector('#clear-all-btn')
      .addEventListener('click', () => this.clearSelection());

    // Action buttons
    document.querySelector('#add-to-library-btn')
      .addEventListener('click', () => this.handleAddToLibrary());

    document.querySelector('#mark-known-btn')
      .addEventListener('click', () => this.handleMarkKnown());

    document.querySelector('#mark-unknown-btn')
      .addEventListener('click', () => this.handleMarkUnknown());

    // Confirm dialog
    document.querySelector('#confirm-cancel')
      .addEventListener('click', () => this.closeConfirmDialog());

    document.querySelector('#confirm-ok')
      .addEventListener('click', () => this.executeAction());

    // Chinese toggle
    document.querySelector('#show-chinese-toggle')
      .addEventListener('change', (e) => {
        this.showChinese = e.target.checked;
        this.renderContent(); // Re-render with new setting
      });

    // Close on outside click
    this.panelElement.addEventListener('click', (e) => {
      if (e.target.id === 'mixread-batch-panel') {
        this.close();
      }
    });
  }

  /**
   * Attach selection (lasso/rectangle select) listeners
   */
  attachSelectionListeners() {
    const contentArea = document.querySelector('#panel-content-area');
    if (!contentArea) return;

    // Use document-level listeners for better tracking
    document.addEventListener('mousedown', (e) => this.handleSelectionStart(e));
    document.addEventListener('mousemove', (e) => this.handleSelectionMove(e));
    document.addEventListener('mouseup', (e) => this.handleSelectionEnd(e));
  }

  /**
   * Handle rectangle selection start
   */
  handleSelectionStart(e) {
    // Check if we're inside the panel content area
    if (!e.target.closest('#panel-content-area') ||
        e.target.closest('.word-item') ||
        e.target.type === 'checkbox') {
      return;
    }

    this.isSelecting = true;
    this.selectionStart = { x: e.clientX, y: e.clientY };
    console.log('[BatchMarkingPanel] Selection started at', this.selectionStart);
  }

  /**
   * Handle rectangle selection move
   */
  handleSelectionMove(e) {
    if (!this.isSelecting || !this.selectionStart) return;

    const canvas = this.panelElement.querySelector('.selection-canvas');

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

    // Only show if minimum size
    if (width < 5 || height < 5) return;

    // Apply styles
    canvas.style.left = left + 'px';
    canvas.style.top = top + 'px';
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.classList.add('active');

    // Store rectangle
    this.selectionRect = { left, top, width, height };

    console.log('[BatchMarkingPanel] Rectangle:', {
      left, top, width, height,
      start: { x: startX, y: startY },
      end: { x: endX, y: endY }
    });
  }

  /**
   * Handle rectangle selection end
   */
  handleSelectionEnd(e) {
    if (!this.isSelecting || !this.selectionRect) {
      this.isSelecting = false;
      const canvas = this.panelElement.querySelector('.selection-canvas');
      canvas.classList.remove('active');
      return;
    }

    // Select words in rectangle
    this.selectWordsInRect(this.selectionRect);

    this.isSelecting = false;
    const canvas = this.panelElement.querySelector('.selection-canvas');
    canvas.classList.remove('active');

    console.log('[BatchMarkingPanel] Selection ended');
  }

  /**
   * Select words within rectangle
   */
  selectWordsInRect(rect) {
    const checkboxes = this.panelElement.querySelectorAll('.word-checkbox');
    let selectedCount = 0;

    checkboxes.forEach(checkbox => {
      const label = checkbox.closest('.word-item');
      if (!label) return;

      // Get label's position in viewport
      const labelRect = label.getBoundingClientRect();

      // Check if label overlaps with selection rectangle
      if (labelRect.right > rect.left &&
          labelRect.left < rect.left + rect.width &&
          labelRect.bottom > rect.top &&
          labelRect.top < rect.top + rect.height) {
        checkbox.checked = !checkbox.checked;
        selectedCount++;
      }
    });

    console.log(`[BatchMarkingPanel] Selected ${selectedCount} words in rectangle`);
    console.log('[BatchMarkingPanel] Rectangle bounds:', rect);
  }

  /**
   * Quick select by frequency
   */
  quickSelectByFrequency(frequency) {
    if (!this.groups || !this.groups[frequency]) return;

    const wordsInGroup = this.groups[frequency].map(item => item.word);
    const checkboxes = this.panelElement.querySelectorAll('.word-checkbox');

    let selectedCount = 0;
    checkboxes.forEach(checkbox => {
      if (wordsInGroup.includes(checkbox.dataset.word)) {
        checkbox.checked = !checkbox.checked;
        selectedCount++;
      }
    });

    const groupNames = { high: '高频', medium: '中频', low: '低频' };
    console.log(`[BatchMarkingPanel] Quick selected ${selectedCount} ${groupNames[frequency]} words`);
  }

  /**
   * Collect all highlighted words and their frequencies
   */
  collectHighlightedWords() {
    const wordFrequency = {};

    // Get all highlighted elements
    const highlightedElements = document.querySelectorAll('.mixread-highlight');

    highlightedElements.forEach(element => {
      const word = element.dataset.word || element.textContent;
      const wordLower = word.toLowerCase();

      if (!wordFrequency[wordLower]) {
        wordFrequency[wordLower] = {
          count: 0,
          originalWords: new Set(),
          baseWord: wordLower,
          chinese: element.dataset.chinese || '',
          definition: element.dataset.definition || ''
        };
      }

      wordFrequency[wordLower].count++;
      wordFrequency[wordLower].originalWords.add(word);
    });

    // Load word details from storage if available
    chrome.storage.local.get(['wordDetails'], (result) => {
      const wordDetails = result.wordDetails || {};

      // Enhance word frequency data with storage info
      Object.keys(wordFrequency).forEach(word => {
        if (wordDetails[word]) {
          wordFrequency[word].chinese = wordFrequency[word].chinese || wordDetails[word].chinese || '';
          wordFrequency[word].definition = wordFrequency[word].definition || wordDetails[word].definition || '';
        }
      });
    });

    return wordFrequency;
  }

  /**
   * Group words by frequency
   */
  groupByFrequency(wordFrequency) {
    const groups = {
      high: [],    // 5+ times
      medium: [],  // 2-4 times
      low: []      // 1 time
    };

    Object.entries(wordFrequency).forEach(([word, data]) => {
      const wordData = {
        word: word,
        baseWord: Stemmer.stem(word),
        originalWords: Array.from(data.originalWords),
        count: data.count,
        chinese: data.chinese || '',
        definition: data.definition || ''
      };

      if (data.count >= 5) {
        groups.high.push(wordData);
      } else if (data.count >= 2) {
        groups.medium.push(wordData);
      } else {
        groups.low.push(wordData);
      }
    });

    // Sort each group by frequency descending
    groups.high.sort((a, b) => b.count - a.count);
    groups.medium.sort((a, b) => b.count - a.count);
    groups.low.sort((a, b) => b.count - a.count);

    return groups;
  }

  /**
   * Render panel content with grouped words
   */
  renderContent() {
    const panelContent = this.panelElement.querySelector('.panel-content');
    panelContent.innerHTML = '';

    if (!this.groups) {
      panelContent.innerHTML = '<div class="no-words">没有找到高亮单词</div>';
      return;
    }

    const groupConfig = [
      { key: 'high', label: '🔴 高频词 (5+ 次)', color: '#ff4444' },
      { key: 'medium', label: '🟡 中频词 (2-4 次)', color: '#ffaa00' },
      { key: 'low', label: '🟢 低频词 (1 次)', color: '#44aa44' }
    ];

    groupConfig.forEach(({ key, label, color }) => {
      const words = this.groups[key];

      if (words.length === 0) return; // Skip empty groups

      // Create group container
      const groupDiv = document.createElement('div');
      groupDiv.className = 'frequency-group';
      groupDiv.style.borderLeftColor = color;

      // Group header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'group-header';
      headerDiv.textContent = label;
      groupDiv.appendChild(headerDiv);

      // Word list
      const listDiv = document.createElement('div');
      listDiv.className = 'word-list';

      words.forEach(({ word, count, baseWord, originalWords, chinese }) => {
        const label = document.createElement('label');
        label.className = 'word-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'word-checkbox';
        checkbox.dataset.word = word;

        // Create word container
        const wordContainer = document.createElement('div');
        wordContainer.className = 'word-container';

        // Main word (original form if different)
        const wordMain = document.createElement('span');
        wordMain.className = 'word-main';

        if (baseWord && baseWord !== word) {
          wordMain.innerHTML = `${word}<span class="word-base">→ ${baseWord}</span>`;
        } else {
          wordMain.textContent = word;
        }

        // Additional forms
        if (originalWords.length > 1) {
          const formsSpan = document.createElement('span');
          formsSpan.className = 'word-forms';
          formsSpan.textContent = `[${Array.from(originalWords).join(', ')}]`;
          wordContainer.appendChild(formsSpan);
        }

        wordContainer.appendChild(wordMain);

        // Chinese (if toggle is on)
        if (this.showChinese && chinese) {
          const chineseSpan = document.createElement('span');
          chineseSpan.className = 'word-chinese';
          chineseSpan.textContent = chinese;

          wordContainer.appendChild(chineseSpan);
        }

        // Count
        const countSpan = document.createElement('span');
        countSpan.className = 'word-count';
        countSpan.textContent = `(${count}×)`;

        label.appendChild(checkbox);
        label.appendChild(wordContainer);
        label.appendChild(countSpan);
        listDiv.appendChild(label);
      });

      groupDiv.appendChild(listDiv);
      panelContent.appendChild(groupDiv);
    });

    // Update total count
    const totalWords = Object.values(this.groups)
      .flat()
      .length;
    const totalWordsElement = this.panelElement.querySelector('#panel-total-words');
    if (totalWordsElement) {
      totalWordsElement.textContent = totalWords;
    }
  }

  /**
   * Open panel and load data
   */
  open() {
    if (!this.panelElement) {
      this.init();
    }

    // Collect and group words
    this.wordFrequency = this.collectHighlightedWords();
    this.groups = this.groupByFrequency(this.wordFrequency);

    // Render content
    this.renderContent();

    // Show panel
    this.panelElement.classList.add('open');
    this.isOpen = true;

    console.log('[BatchMarkingPanel] Panel opened', {
      totalWords: Object.values(this.groups).flat().length,
      groups: this.groups
    });
  }

  /**
   * Close panel
   */
  close() {
    if (this.panelElement) {
      this.panelElement.classList.remove('open');
    }
    this.isOpen = false;
    console.log('[BatchMarkingPanel] Panel closed');
  }

  /**
   * Toggle panel open/close
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Get selected words
   */
  getSelectedWords() {
    const checkboxes = this.panelElement.querySelectorAll('.word-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.word);
  }

  /**
   * Select all words
   */
  selectAll() {
    const checkboxes = this.panelElement.querySelectorAll('.word-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    console.log('[BatchMarkingPanel] All words selected');
  }

  /**
   * Deselect all words
   */
  deselectAll() {
    const checkboxes = this.panelElement.querySelectorAll('.word-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    console.log('[BatchMarkingPanel] All words deselected');
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.deselectAll();
  }

  /**
   * Handle Add to Library button click
   */
  handleAddToLibrary() {
    const selectedWords = this.getSelectedWords();

    if (selectedWords.length === 0) {
      alert('请先选择要添加到单词本的词');
      return;
    }

    const message = `即将添加 ${selectedWords.length} 个单词到你的单词本，确定吗？`;
    this.showConfirmDialog(message, 'add-to-library');
  }

  /**
   * Show confirmation dialog
   */
  showConfirmDialog(message, action) {
    const dialog = this.panelElement.querySelector('#confirm-dialog');
    document.querySelector('#confirm-message').textContent = message;
    dialog.classList.remove('hidden');
    this.pendingAction = action;
    console.log('[BatchMarkingPanel] Confirm dialog shown:', message);
  }

  /**
   * Close confirmation dialog
   */
  closeConfirmDialog() {
    const dialog = this.panelElement.querySelector('#confirm-dialog');
    dialog.classList.add('hidden');
    this.pendingAction = null;
  }

  /**
   * Execute pending action (Mark as Known or Unknown)
   */
  async executeAction() {
    if (!this.pendingAction) return;

    const selectedWords = this.getSelectedWords();

    if (selectedWords.length === 0) {
      alert('请先选择要标记的单词');
      this.closeConfirmDialog();
      return;
    }

    console.log('[BatchMarkingPanel] Executing action:', {
      action: this.pendingAction,
      words: selectedWords
    });

    try {
      if (this.pendingAction === 'mark-known') {
        await this.batchMarkAsKnown(selectedWords);
      } else if (this.pendingAction === 'mark-unknown') {
        await this.batchMarkAsUnknown(selectedWords);
      } else if (this.pendingAction === 'add-to-library') {
        await this.batchAddToLibrary(selectedWords);
      }

      // Update UI
      this.closeConfirmDialog();
      this.close();

      // Re-highlight page
      if (window.highlightPageWords) {
        window.highlightPageWords();
      }

    } catch (error) {
      console.error('[BatchMarkingPanel] Error executing action:', error);
      alert('操作失败: ' + error.message);
    }
  }

  /**
   * Handle Mark as Known button click
   */
  handleMarkKnown() {
    const selectedWords = this.getSelectedWords();

    if (selectedWords.length === 0) {
      alert('请先选择要标记的单词');
      return;
    }

    const message = `即将标记 ${selectedWords.length} 个单词为"已知"，确定吗？`;
    this.showConfirmDialog(message, 'mark-known');
  }

  /**
   * Handle Mark as Unknown button click
   */
  handleMarkUnknown() {
    const selectedWords = this.getSelectedWords();

    if (selectedWords.length === 0) {
      alert('请先选择要标记的单词');
      return;
    }

    const message = `即将标记 ${selectedWords.length} 个单词为"不认识"，确定吗？`;
    this.showConfirmDialog(message, 'mark-unknown');
  }

  /**
   * Batch mark words as known
   */
  async batchMarkAsKnown(words) {
    console.log('[BatchMarkingPanel] Batch marking as known:', words);

    const promises = words.map(word => {
      const stemmedWord = Stemmer.stem(word);
      return new Promise((resolve) => {
        try {
          const sendMarkAsKnown = () => {
            try {
              chrome.runtime.sendMessage(
                {
                  type: "MARK_AS_KNOWN",
                  user_id: this.userStore.getUserId(),
                  word: stemmedWord,
                },
                (response) => {
                  try {
                    if (chrome.runtime.lastError) {
                      console.warn(`[BatchMarkingPanel] Extension context error for "${word}":`, chrome.runtime.lastError.message);
                      // Retry
                      setTimeout(sendMarkAsKnown, 500);
                    } else if (response?.success) {
                      console.log(`[BatchMarkingPanel] Marked "${word}" as known`);
                    } else {
                      console.warn(`[BatchMarkingPanel] Failed to mark "${word}" as known`, response?.error);
                    }
                    resolve();
                  } catch (e) {
                    console.error(`[BatchMarkingPanel] Error in callback:`, e.message);
                    resolve();
                  }
                }
              );
            } catch (e) {
              console.error(`[BatchMarkingPanel] Failed to send message:`, e.message);
              resolve();
            }
          };

          sendMarkAsKnown();
        } catch (error) {
          console.error(`[BatchMarkingPanel] Error setting up mark as known:`, error.message);
          resolve();
        }
      });
    });

    await Promise.all(promises);
    console.log('[BatchMarkingPanel] Batch mark as known completed');
  }

  /**
   * Batch mark words as unknown
   */
  async batchMarkAsUnknown(words) {
    console.log('[BatchMarkingPanel] Batch marking as unknown:', words);

    const promises = words.map(word => {
      const stemmedWord = Stemmer.stem(word);
      return this.unknownWordsService.markAsUnknown(stemmedWord);
    });

    await Promise.all(promises);
    console.log('[BatchMarkingPanel] Batch mark as unknown completed');
  }

  /**
   * Batch add words to library (user wants to learn)
   */
  async batchAddToLibrary(words) {
    console.log('[BatchMarkingPanel] Batch adding to library:', words);

    const userId = this.userStore.getUserId();
    if (!userId) {
      throw new Error('No user ID available');
    }

    // Get current page context
    const pageUrl = window.location.href;
    const pageTitle = document.title;

    const promises = words.map(word => {
      // Get all occurrences of this word to collect different sentences
      const elements = document.querySelectorAll(`[data-word="${word}"], [data-word="${word.toLowerCase()}"]`);

      const contexts = Array.from(elements).map(element => {
        // Get the paragraph containing this word
        let paragraph = element.closest('p');
        if (!paragraph) {
          // If not in a paragraph, try to find the nearest text block
          paragraph = element.closest('div, article, section, li') || element.parentElement;
        }

        // Get the original text content of the paragraph
        let text = '';
        if (paragraph) {
          text = paragraph.textContent || paragraph.innerText || '';

          // CRITICAL: Clean up frequency markers like (1×), (2×), etc. that some websites embed
          // These appear as "word(1×)" in textContent from certain websites' DOM
          // This is a common pattern in dictionary/reference websites
          text = text.replace(/\(\d+×\)/g, '');  // Remove (1×), (2×), (3×), etc.
          text = text.replace(/→\s*/g, ' ');     // Replace arrows with spaces

          // Clean up whitespace but keep original structure
          text = text.replace(/\s+/g, ' ').trim();
        }

        // Simple and direct sentence extraction
        let sentences = [];

        // Find all occurrences of the word in the text
        const wordLower = word.toLowerCase();
        const textLower = text.toLowerCase();
        const wordPositions = [];

        let pos = textLower.indexOf(wordLower);
        while (pos !== -1) {
          wordPositions.push(pos);
          pos = textLower.indexOf(wordLower, pos + 1);
        }

        // For each occurrence, extract the sentence around it
        wordPositions.forEach(wordPos => {
          // Find start of sentence (first punctuation before the word)
          let start = wordPos;
          while (start > 0 && !text[start - 1].match(/[.!?]/)) {
            start--;
          }
          if (start > 0) start++; // Skip the punctuation

          // Find end of sentence (first punctuation after the word)
          let end = wordPos + word.length;
          while (end < text.length && !text[end].match(/[.!?]/)) {
            end++;
          }
          if (end < text.length) end++; // Include the punctuation

          // Extract the sentence
          let sentence = text.substring(start, end).trim();

          // Clean up extra spaces and capitalize
          sentence = sentence.replace(/\s+/g, ' ');
          if (sentence.length > 0) {
            sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
            sentences.push(sentence);
          }
        });

        // Remove duplicate sentences
        sentences = [...new Set(sentences)];

        // Filter and limit sentences
        let targetSentences = sentences
          .filter(sentence => {
            // Basic checks
            if (sentence.length < 10) return false; // Minimum length
            if (sentence.split(/\s+/).length < 3) return false; // At least 3 words

            // Skip sentences with excessive special characters (likely code or markup)
            const specialCharCount = (sentence.match(/[×()[\]{}→]/g) || []).length;
            if (specialCharCount > 2) return false; // Too many special chars

            // Skip if looks like it's mixing different languages/formats
            if (sentence.includes('1x') || sentence.includes('→') || sentence.match(/\d+×/)) {
              return false;
            }

            // CRITICAL: Skip sentences that contain multiple word-form patterns like "word(1×)"
            // This indicates the paragraph contains stemming/dictionary information
            const wordFormPatterns = (sentence.match(/\([0-9×]+\)/g) || []).length;
            if (wordFormPatterns > 3) {
              return false;
            }

            // Skip sentences with non-ASCII characters mixed in (multilingual content)
            if (/[\u4E00-\u9FFF]/.test(sentence) || /[\u3040-\u309F]/.test(sentence)) {
              return false;
            }

            return true;
          })
          .slice(0, 3); // Limit to 3 sentences per context

        // Simple fallback if no sentences found
        if (targetSentences.length === 0) {
          // Try splitting by punctuation and include the word
          const allSentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
          targetSentences = allSentences.filter(sentence => {
            const sLower = sentence.toLowerCase();
            // Check if contains word
            if (!sLower.includes(word.toLowerCase())) return false;
            // Check if long enough
            if (sentence.trim().length < 5) return false;

            // Apply same 6-layer filtering to fallback sentences
            if (sentence.length < 10) return false;
            if (sentence.split(/\s+/).length < 3) return false;

            const specialCharCount = (sentence.match(/[×()[\]{}→]/g) || []).length;
            if (specialCharCount > 2) return false;

            if (sentence.includes('1x') || sentence.includes('→') || sentence.match(/\d+×/)) return false;

            const wordFormPatterns = (sentence.match(/\([0-9×]+\)/g) || []).length;
            if (wordFormPatterns > 3) return false;

            if (/[\u4E00-\u9FFF]/.test(sentence) || /[\u3040-\u309F]/.test(sentence)) return false;

            return true;
          }).slice(0, 1).map(s => s.trim() + '.');
        }

        // Final fallback
        if (targetSentences.length === 0) {
          targetSentences = [`${word} was found on this page.`];
        }

        return {
          pageUrl: pageUrl,
          pageTitle: pageTitle,
          sentences: targetSentences,
          timestamp: Date.now()
        };
      });

      // Get word details from highlighted elements (take first for main info)
      const element = elements[0];
      const definition = element?.dataset.definition || '';
      const chinese = element?.dataset.chinese || '';
      const cefrLevel = element?.dataset.cefr || '';

      // Collect all unique contexts from all occurrences
      const allContexts = [];
      contexts.forEach(context => {
        // Add context if it's not empty
        if (context.sentences && context.sentences.length > 0) {
          allContexts.push({
            page_url: context.pageUrl,
            page_title: context.pageTitle,
            sentences: context.sentences,
            timestamp: context.timestamp
          });
        }
      });

      try {
        const sendAddToLibrary = () => {
          try {
            return chrome.runtime.sendMessage(
              {
                type: "ADD_TO_LIBRARY",
                user_id: userId,
                word: word, // Send simple word string, not object
                contexts: allContexts // Send contexts array separately
              },
              (response) => {
                try {
                  if (chrome.runtime.lastError) {
                    console.warn(`[BatchMarkingPanel] Extension context error when adding "${word}":`, chrome.runtime.lastError.message);
                    // Retry after delay
                    setTimeout(sendAddToLibrary, 500);
                  } else if (response?.success) {
                    console.log(`[BatchMarkingPanel] Added "${word}" to library with ${contexts.length} contexts`);
                  } else {
                    console.warn(`[BatchMarkingPanel] Failed to add "${word}" to library:`, response?.error);
                  }
                } catch (e) {
                  console.error(`[BatchMarkingPanel] Error in callback:`, e.message);
                }
              }
            );
          } catch (e) {
            console.error(`[BatchMarkingPanel] Failed to send message:`, e.message);
          }
        };

        sendAddToLibrary();
      } catch (error) {
        console.error(`[BatchMarkingPanel] Error setting up add to library:`, error.message);
      }
    });

    await Promise.all(promises);
    console.log('[BatchMarkingPanel] Batch add to library completed');
  }
}
