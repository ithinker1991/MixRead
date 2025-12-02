/**
 * Preset Domains Dialog Component
 *
 * Shows an interactive dialog for first-time users to add preset domains
 * More polished than a simple confirm() dialog
 */

class PresetDialog {
  constructor() {
    this.isOpen = false;
    this.selectedDomains = new Set();
    this.presetDomains = [
      {
        domain: 'localhost',
        category: 'Development',
        description: 'Local development environment'
      },
      {
        domain: 'github.com',
        category: 'Development',
        description: 'Code repository and collaboration'
      },
      {
        domain: 'stackoverflow.com',
        category: 'Development',
        description: 'Programming Q&A and reference'
      },
      {
        domain: 'twitter.com',
        category: 'Social Media',
        description: 'Social networking platform'
      },
      {
        domain: 'reddit.com',
        category: 'Social Media',
        description: 'Discussion and community platform'
      },
      {
        domain: 'facebook.com',
        category: 'Social Media',
        description: 'Social networking platform'
      },
      {
        domain: 'instagram.com',
        category: 'Social Media',
        description: 'Photo and video sharing'
      },
      {
        domain: 'tiktok.com',
        category: 'Social Media',
        description: 'Short-form video platform'
      },
      {
        domain: 'youtube.com',
        category: 'Video',
        description: 'Video sharing platform'
      }
    ];
  }

  /**
   * Create the dialog HTML structure
   */
  createDialogHTML() {
    const categories = this.groupByCategory();
    let categoriesHTML = '';

    for (const [category, domains] of Object.entries(categories)) {
      categoriesHTML += `
        <div class="preset-category" data-category="${category}">
          <h4 class="preset-category-title">${category}</h4>
          <div class="preset-domains-list">
            ${domains.map(item => `
              <label class="preset-domain-item">
                <input
                  type="checkbox"
                  class="preset-domain-checkbox"
                  data-domain="${item.domain}"
                  checked
                >
                <span class="preset-domain-label">
                  <strong>${item.domain}</strong>
                  <br>
                  <small>${item.description}</small>
                </span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    const html = `
      <div id="preset-dialog-overlay" class="preset-dialog-overlay">
        <div class="preset-dialog">
          <div class="preset-dialog-header">
            <h2>🚀 Get Started with Preset Domains</h2>
            <p class="preset-dialog-subtitle">
              Select domains where you want to disable highlighting
            </p>
          </div>

          <div class="preset-dialog-content">
            <div class="preset-domains-container">
              ${categoriesHTML}
            </div>

            <div class="preset-dialog-stats">
              <span id="preset-selected-count">9 domains selected</span>
            </div>
          </div>

          <div class="preset-dialog-footer">
            <button id="preset-dialog-cancel" class="preset-btn preset-btn-cancel">
              Skip
            </button>
            <button id="preset-dialog-confirm" class="preset-btn preset-btn-confirm">
              Add Selected Domains
            </button>
          </div>

          <div class="preset-dialog-help">
            <small>
              💡 You can always add or remove domains later in the <strong>Domains</strong> tab
            </small>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Group domains by category
   */
  groupByCategory() {
    const categories = {};
    this.presetDomains.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });
    return categories;
  }

  /**
   * Open the preset dialog
   * @param {Function} onConfirm - Callback when user confirms
   * @param {Function} onCancel - Callback when user cancels
   */
  open(onConfirm, onCancel) {
    if (this.isOpen) return;

    // Create and inject dialog HTML
    const dialogHTML = this.createDialogHTML();
    document.body.insertAdjacentHTML('beforeend', dialogHTML);

    // Get dialog elements
    const overlay = document.getElementById('preset-dialog-overlay');
    const confirmBtn = document.getElementById('preset-dialog-confirm');
    const cancelBtn = document.getElementById('preset-dialog-cancel');
    const checkboxes = document.querySelectorAll('.preset-domain-checkbox');

    // Initialize selected domains
    this.selectedDomains = new Set();
    checkboxes.forEach(checkbox => {
      if (checkbox.checked) {
        this.selectedDomains.add(checkbox.dataset.domain);
      }
    });

    // Update stats on checkbox change
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedDomains.add(checkbox.dataset.domain);
        } else {
          this.selectedDomains.delete(checkbox.dataset.domain);
        }
        this.updateStats();
      });
    });

    // Handle confirm button
    confirmBtn.addEventListener('click', () => {
      this.close();
      if (onConfirm) {
        onConfirm(Array.from(this.selectedDomains));
      }
    });

    // Handle cancel button
    cancelBtn.addEventListener('click', () => {
      this.close();
      if (onCancel) {
        onCancel();
      }
    });

    // Handle overlay click (close)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
        if (onCancel) {
          onCancel();
        }
      }
    });

    // Handle Escape key
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
        if (onCancel) {
          onCancel();
        }
      }
    };
    document.addEventListener('keydown', this.escapeHandler);

    this.isOpen = true;
    logger.log('[PresetDialog] Opened');
  }

  /**
   * Close the dialog
   */
  close() {
    const overlay = document.getElementById('preset-dialog-overlay');
    if (overlay) {
      overlay.remove();
    }

    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }

    this.isOpen = false;
    logger.log('[PresetDialog] Closed');
  }

  /**
   * Update selected count display
   */
  updateStats() {
    const countDisplay = document.getElementById('preset-selected-count');
    if (countDisplay) {
      const count = this.selectedDomains.size;
      countDisplay.textContent = `${count} domain${count !== 1 ? 's' : ''} selected`;
    }
  }

  /**
   * Check if dialog should be shown (no blacklist yet)
   * @param {DomainPolicyStore} policyStore - Policy store instance
   * @returns {boolean}
   */
  static shouldShow(policyStore) {
    return policyStore && policyStore.shouldShowPresetDialog();
  }
}

// Create global instance
const presetDialog = new PresetDialog();
