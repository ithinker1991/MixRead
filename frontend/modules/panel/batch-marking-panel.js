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
    document.querySelector('#mark-known-btn')
      .addEventListener('click', () => this.handleMarkKnown());

    document.querySelector('#mark-unknown-btn')
      .addEventListener('click', () => this.handleMarkUnknown());

    // Confirm dialog
    document.querySelector('#confirm-cancel')
      .addEventListener('click', () => this.closeConfirmDialog());

    document.querySelector('#confirm-ok')
      .addEventListener('click', () => this.executeAction());

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

    contentArea.addEventListener('mousedown', (e) => this.handleSelectionStart(e));
    contentArea.addEventListener('mousemove', (e) => this.handleSelectionMove(e));
    contentArea.addEventListener('mouseup', (e) => this.handleSelectionEnd(e));
    contentArea.addEventListener('mouseleave', (e) => this.handleSelectionEnd(e));
  }

  /**
   * Handle rectangle selection start
   */
  handleSelectionStart(e) {
    // Don't select if clicking on checkbox or word
    if (e.target.closest('.word-item') || e.target.type === 'checkbox') {
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
    const contentArea = document.querySelector('#panel-content-area');
    const rect = contentArea.getBoundingClientRect();

    const startX = this.selectionStart.x - rect.left;
    const startY = this.selectionStart.y - rect.top;
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    // Draw selection rectangle - relative to content area
    canvas.style.left = x + 'px';
    canvas.style.top = y + 'px';
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.classList.add('active');

    this.selectionRect = { x, y, width, height };
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

      const labelRect = label.getBoundingClientRect();
      const contentArea = document.querySelector('#panel-content-area');
      const contentRect = contentArea.getBoundingClientRect();

      // Get label position relative to content area
      const labelX = labelRect.left - contentRect.left;
      const labelY = labelRect.top - contentRect.top;
      const labelWidth = labelRect.width;
      const labelHeight = labelRect.height;

      // Check if label overlaps with selection rectangle
      // The rect coordinates are already relative to content area
      if (labelX + labelWidth > rect.x &&
          labelX < rect.x + rect.width &&
          labelY + labelHeight > rect.y &&
          labelY < rect.y + rect.height) {
        checkbox.checked = !checkbox.checked;
        selectedCount++;
      }
    });

    console.log(`[BatchMarkingPanel] Selected ${selectedCount} words in rectangle`);
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

      wordFrequency[wordLower] = (wordFrequency[wordLower] || 0) + 1;
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

    Object.entries(wordFrequency).forEach(([word, count]) => {
      if (count >= 5) {
        groups.high.push({ word, count });
      } else if (count >= 2) {
        groups.medium.push({ word, count });
      } else {
        groups.low.push({ word, count });
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

      words.forEach(({ word, count }) => {
        const label = document.createElement('label');
        label.className = 'word-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'word-checkbox';
        checkbox.dataset.word = word;

        const wordSpan = document.createElement('span');
        wordSpan.className = 'word-text';
        wordSpan.textContent = word;

        const countSpan = document.createElement('span');
        countSpan.className = 'word-count';
        countSpan.textContent = `(${count}×)`;

        label.appendChild(checkbox);
        label.appendChild(wordSpan);
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
    document.querySelector('#panel-total-words').textContent = totalWords;
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
        chrome.runtime.sendMessage(
          {
            type: "MARK_AS_KNOWN",
            user_id: this.userStore.getUserId(),
            word: stemmedWord,
          },
          (response) => {
            if (response?.success) {
              console.log(`[BatchMarkingPanel] Marked "${word}" as known`);
            } else {
              console.warn(`[BatchMarkingPanel] Failed to mark "${word}" as known`, response?.error);
            }
            resolve();
          }
        );
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
}
