/**
 * Context Menu - Right-click menu for word operations
 *
 * Displays context menu when user right-clicks on a word
 * Allows users to mark words as unknown or search
 */

class ContextMenu {
  constructor(unknownWordsService) {
    this.unknownWordsService = unknownWordsService;
    this.menuElement = null;
    this.currentWord = null;
  }

  /**
   * Show context menu at mouse position
   *
   * @param {MouseEvent} event - Right-click event
   * @param {string} word - Word to operate on
   */
  show(event, word) {
    event.preventDefault();
    event.stopPropagation();

    this.currentWord = word;

    // Remove old menu if exists
    this.hide();

    // Create menu element
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'mixread-context-menu';
    this.menuElement.style.left = event.pageX + 'px';
    this.menuElement.style.top = event.pageY + 'px';

    // Check if word is already unknown or known
    const isUnknown = this.unknownWordsService.isUnknown(word);

    // Create menu items
    const html = `
      <div class="mixread-context-menu-item" data-action="${isUnknown ? 'unmark-unknown' : 'mark-unknown'}">
        ${isUnknown ? '✓ Remove from Unknown' : 'Mark as Unknown'}
      </div>
      <div class="mixread-context-menu-item" data-action="mark-known">
        Mark as Known
      </div>
      <div class="mixread-context-menu-item" data-action="search-definition">
        Search Definition
      </div>
    `;

    this.menuElement.innerHTML = html;

    // Add event listeners
    this.menuElement.querySelectorAll('[data-action]').forEach(item => {
      item.addEventListener('click', (e) => this.handleClick(e));
    });

    // Hide menu when clicking elsewhere
    document.addEventListener('click', () => this.hide());

    // Add to page
    document.body.appendChild(this.menuElement);
  }

  /**
   * Hide context menu
   */
  hide() {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
  }

  /**
   * Handle menu item click
   *
   * @param {MouseEvent} event - Click event
   */
  async handleClick(event) {
    const action = event.target.dataset.action;
    const word = this.currentWord;

    console.log(`[ContextMenu] Handling click - action: ${action}, word: ${word}`);

    this.hide();

    if (!word) {
      console.warn('[ContextMenu] No word provided');
      return;
    }

    try {
      switch (action) {
        case 'mark-unknown':
          console.log(`[ContextMenu] Calling markAsUnknown("${word}")`);
          const result1 = await this.unknownWordsService.markAsUnknown(word);
          console.log(`[ContextMenu] markAsUnknown returned:`, result1);
          logger.log(`Marked "${word}" as unknown via context menu`);
          break;

        case 'unmark-unknown':
          console.log(`[ContextMenu] Calling unmarkAsUnknown("${word}")`);
          const result2 = await this.unknownWordsService.unmarkAsUnknown(word);
          console.log(`[ContextMenu] unmarkAsUnknown returned:`, result2);
          logger.log(`Removed "${word}" from unknown via context menu`);
          break;

        case 'mark-known':
          console.log(`[ContextMenu] Calling markAsKnown("${word}")`);
          const result3 = await this.unknownWordsService.markAsKnown(word);
          console.log(`[ContextMenu] markAsKnown returned:`, result3);
          logger.log(`Marked "${word}" as known via context menu`);
          break;

        case 'search-definition':
          // Could open popup or tooltip
          console.log(`[ContextMenu] Searching definition for "${word}"`);
          logger.log(`Searching definition for "${word}"`);
          break;

        default:
          console.warn(`[ContextMenu] Unknown action: ${action}`);
          logger.warn(`Unknown context menu action: ${action}`);
      }
    } catch (error) {
      console.error(`[ContextMenu] Error handling action ${action}:`, error);
      logger.error(`Error handling context menu action: ${action}`, error);
    }
  }
}
