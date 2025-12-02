/**
 * MixRead Popup Script
 * Manages difficulty slider, vocabulary display, and statistics
 */

const DIFFICULTY_LEVELS = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
  6: "C2",
};

// Level descriptions - explains what each level means
const LEVEL_DESCRIPTIONS = {
  "A1": {
    range: "A1 only",
    description: "Beginner - highlights only the most basic words for complete beginners"
  },
  "A2": {
    range: "A2-C2",
    description: "Elementary - highlights words from basic to advanced, helping you build vocabulary"
  },
  "B1": {
    range: "B1-C2",
    description: "Intermediate - highlights intermediate and advanced words to improve reading"
  },
  "B2": {
    range: "B2-C2",
    description: "Upper-Intermediate - highlights advanced words for skilled readers"
  },
  "C1": {
    range: "C1-C2",
    description: "Advanced - highlights only difficult words, minimal annotations"
  },
  "C2": {
    range: "C2 only",
    description: "Mastery - highlights only the most challenging words for near-native readers"
  }
};

const difficultySlider = document.getElementById("difficulty-slider");
const currentLevelDisplay = document.getElementById("current-level");
const vocabCountDisplay = document.getElementById("vocab-count");
const todayCountDisplay = document.getElementById("today-count");
const totalCountDisplay = document.getElementById("total-count");
const toggleChinese = document.getElementById("toggle-chinese");

// New stat elements for week and reading time
let weekCountDisplay = document.getElementById("week-count");
let readingTimeDisplay = document.getElementById("reading-time");

const btnViewVocab = document.getElementById("btn-view-vocabulary");
const btnResetVocab = document.getElementById("btn-reset-vocab");
const btnBatchMark = document.getElementById("btn-batch-mark");
const btnViewLibrary = document.getElementById("btn-view-library");
const libraryCountDisplay = document.getElementById("library-count");

// User management elements
const userSelector = document.getElementById("user-selector");
const addNewUserBtn = document.getElementById("add-new-user");
let allUsers = [];
let currentUser = "";

// Helper function to get date X days ago
function getDateXDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

// Load user management first
chrome.storage.local.get(['mixread_users', 'mixread_current_user'], (result) => {
  allUsers = result.mixread_users || [];
  currentUser = result.mixread_current_user || "";

  // If no current user but have users, select the first one
  if (!currentUser && allUsers.length > 0) {
    currentUser = allUsers[0];
    chrome.storage.local.set({ mixread_current_user: currentUser });
  }

  // Load users into selector
  loadUsersIntoSelector();

  // If still no users, create one
  if (allUsers.length === 0) {
    createNewUser();
  } else {
    // Update UI with current user
    updateUserDisplay();
    // Load library count
    loadLibraryCount(currentUser);
    // Initialize domain management
    initializeDomainManagement();
  }

  // Load and display current settings
  chrome.storage.local.get(
    ["difficultyLevel", "vocabulary", "vocabulary_dates", "showChinese", "reading_sessions"],
    (result) => {
    // Load difficulty level
    const difficultyLevel = result.difficultyLevel || "B1";
    const difficultyValue = Object.entries(DIFFICULTY_LEVELS).find(
      ([_, level]) => level === difficultyLevel
    )?.[0] || "3";
    difficultySlider.value = difficultyValue;
    updateDifficultyDisplay(difficultyValue);

    // Load Chinese display setting
    const showChinese = result.showChinese !== undefined ? result.showChinese : true;
    toggleChinese.checked = showChinese;

    // Load vocabulary stats
    const vocabulary = result.vocabulary || [];
    vocabCountDisplay.textContent = vocabulary.length;
    totalCountDisplay.textContent = vocabulary.length;

    // Calculate today's additions
    const dates = result.vocabulary_dates || {};
    const today = new Date().toISOString().split("T")[0];
    let todayCount = 0;
    let weekCount = 0;

    // Count words added today and this week
    for (const word in dates) {
      const wordDate = dates[word];
      if (wordDate === today) {
        todayCount++;
      }
      // Check if word was added in the last 7 days
      const wordTime = new Date(wordDate).getTime();
      const sevenDaysAgo = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);
      if (wordTime >= sevenDaysAgo) {
        weekCount++;
      }
    }
    todayCountDisplay.textContent = todayCount;

    // Display week count if element exists
    if (weekCountDisplay) {
      weekCountDisplay.textContent = weekCount;
    }

    // Calculate reading time
    const sessions = result.reading_sessions || {};
    let todayReading = sessions[today] || 0;
    let weekReading = 0;

    // Sum up reading time for the week
    for (let i = 0; i < 7; i++) {
      const date = getDateXDaysAgo(i);
      weekReading += sessions[date] || 0;
    }

    // Display reading time if element exists
    if (readingTimeDisplay) {
      if (weekReading > 60) {
        readingTimeDisplay.textContent = Math.round(weekReading / 60) + "h " + (weekReading % 60) + "m";
      } else {
        readingTimeDisplay.textContent = weekReading + "m";
      }
    }
  });
});

/**
 * Update difficulty display
 */
function updateDifficultyDisplay(value) {
  const level = DIFFICULTY_LEVELS[value];
  currentLevelDisplay.textContent = level;

  // Change color based on difficulty
  const display = currentLevelDisplay.parentElement;
  let bgColor = "#e7f3ff";
  let textColor = "#0056b3";

  if (value <= 2) {
    bgColor = "#d4edda";
    textColor = "#155724";
  } else if (value >= 5) {
    bgColor = "#f8d7da";
    textColor = "#721c24";
  }

  display.style.background = bgColor;
  display.style.color = textColor;

  // Update level description
  updateLevelDescription(level);
}

/**
 * Update level description text
 */
function updateLevelDescription(level) {
  const descriptionElement = document.getElementById("level-description");
  if (!descriptionElement) return;

  const info = LEVEL_DESCRIPTIONS[level];
  if (!info) return;

  descriptionElement.innerHTML = `Highlights <strong>${info.range}</strong> words - ${info.description}`;
}

/**
 * Handle Chinese toggle change
 */
toggleChinese.addEventListener("change", (e) => {
  const showChinese = e.target.checked;

  // Save to storage
  chrome.storage.local.set({ showChinese });

  // Notify content script about the change
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "CHINESE_DISPLAY_CHANGED",
        showChinese,
      });
    }
  });
});

/**
 * Handle difficulty slider change
 */
difficultySlider.addEventListener("input", (e) => {
  const value = e.target.value;
  const level = DIFFICULTY_LEVELS[value];

  updateDifficultyDisplay(value);

  // Save to storage
  chrome.storage.local.set({ difficultyLevel: level });

  // Notify content script about the change
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: "DIFFICULTY_CHANGED",
      difficulty_level: level,
    });
  });
});

/**
 * View vocabulary button
 */
btnViewVocab.addEventListener("click", () => {
  chrome.storage.local.get(["vocabulary"], (result) => {
    const vocabulary = result.vocabulary || [];

    if (vocabulary.length === 0) {
      alert("No words in your vocabulary yet. Hover over highlighted words and click 'Add to Library' to start learning!");
      return;
    }

    // Create a simple modal to display vocabulary
    const wordList = vocabulary.join(", ");
    alert(
      `Your Vocabulary (${vocabulary.length} words):\n\n${wordList}`
    );
  });
});

/**
 * Reset vocabulary button
 */
btnResetVocab.addEventListener("click", () => {
  if (
    confirm(
      "Are you sure? This will delete all your learned words. This action cannot be undone."
    )
  ) {
    chrome.storage.local.set({
      vocabulary: [],
      vocabulary_dates: {},
    });
    vocabCountDisplay.textContent = "0";
    totalCountDisplay.textContent = "0";
    todayCountDisplay.textContent = "0";
  }
});

/**
 * Batch marking panel button
 */
if (btnBatchMark) {
  btnBatchMark.addEventListener("click", () => {
    console.log('[Popup] Batch mark button clicked');
    console.log('[Popup] Current user:', currentUser);

    // Send message to content script to open batch marking panel
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log('[Popup] Current tabs:', tabs);

      if (tabs[0]?.id) {
        const tabId = tabs[0].id;
        console.log('[Popup] Sending message to tab:', tabId);

        // First, send current user ID to content script
        chrome.tabs.sendMessage(tabId, {
          type: "UPDATE_CURRENT_USER",
          userId: currentUser
        }, (response) => {
          console.log('[Popup] User update response:', response);

          // Then send OPEN_BATCH_PANEL message
          chrome.tabs.sendMessage(tabId, {
            type: "OPEN_BATCH_PANEL",
          }, (response) => {
            console.log('[Popup] Batch panel response:', response);
            if (chrome.runtime.lastError) {
              console.error('[Popup] Error sending batch panel message:', chrome.runtime.lastError);

              // Try to inject content script as fallback
              console.log('[Popup] Attempting to inject content script...');
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
              }, () => {
                if (chrome.runtime.lastError) {
                  console.error('[Popup] Failed to inject content script:', chrome.runtime.lastError);
                  alert('Please refresh the page and try again.');
                } else {
                  // Wait a bit and try again
                  setTimeout(() => {
                    // Send user ID first
                    chrome.tabs.sendMessage(tabId, {
                      type: "UPDATE_CURRENT_USER",
                      userId: currentUser
                    }, () => {
                      // Then send OPEN_BATCH_PANEL
                      setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, {
                          type: "OPEN_BATCH_PANEL",
                        });
                      }, 500);
                    });
                  }, 1000);
                }
              });
            }
          });
        });
      } else {
        console.error('[Popup] No active tab found');
      }
    });
  });
}

/**
 * Load library word count from backend
 */
async function loadLibraryCount(userId) {
  try {
    const response = await fetch(`http://localhost:8000/users/${encodeURIComponent(userId)}/library`);

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        const libraryCount = data.library ? data.library.length : 0;
        libraryCountDisplay.textContent = libraryCount;
      }
    }
  } catch (error) {
    console.log('[Popup] Could not load library count:', error);
    libraryCountDisplay.textContent = '?';
  }
}

/**
 * Open library viewer page
 */
function openLibraryPage() {
  // Use current user
  if (currentUser) {
    openLibraryUrl(currentUser);
  } else {
    console.error('[Popup] No current user selected');
  }
}

/**
 * Open library URL with given user ID
 */
function openLibraryUrl(userId) {
  try {
    // Open library viewer with user ID
    const libraryUrl = `http://localhost:8002/library-viewer.html?user=${encodeURIComponent(userId)}`;

    console.log('[Popup] Opening library page:', libraryUrl);
    chrome.tabs.create({ url: libraryUrl }, (tab) => {
      console.log('[Popup] Opened library tab:', tab.id);
    });

  } catch (error) {
    console.error('[Popup] Error opening library page:', error);

    // Fallback: open basic library page
    chrome.tabs.create({
      url: 'http://localhost:8002/library-viewer.html'
    });
  }
}

/**
 * View Library button click handler
 */
if (btnViewLibrary) {
  btnViewLibrary.addEventListener("click", openLibraryPage);
}

// Update stats when vocabulary changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.vocabulary) {
    const newVocab = changes.vocabulary.newValue || [];
    vocabCountDisplay.textContent = newVocab.length;
    totalCountDisplay.textContent = newVocab.length;
  }
});

/**
 * User Management Functions
 */

function loadUsersIntoSelector() {
  userSelector.innerHTML = '<option value="">-- Select User --</option>';

  allUsers.forEach(userId => {
    const option = document.createElement('option');
    option.value = userId;
    option.textContent = getUserDisplayName(userId);
    if (userId === currentUser) {
      option.selected = true;
    }
    userSelector.appendChild(option);
  });
}

function getUserDisplayName(userId) {
  // Extract readable part from user ID
  if (userId.startsWith('user_')) {
    return userId.substring(5, 20) + '...';
  }
  return userId;
}

function createNewUser() {
  const newUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  allUsers.push(newUserId);
  currentUser = newUserId;

  chrome.storage.local.set({
    mixread_users: allUsers,
    mixread_current_user: currentUser
  }, () => {
    console.log('[Popup] Created new user:', newUserId);
    loadUsersIntoSelector();
    updateUserDisplay();
    loadLibraryCount(currentUser);

    // Reset vocabulary for new user
    resetUserVocabulary();
  });
}

function switchToUser(userId) {
  if (!userId) return;

  // Save current user's vocabulary
  saveCurrentUserVocabulary(() => {
    currentUser = userId;
    chrome.storage.local.set({ mixread_current_user: userId }, () => {
      console.log('[Popup] Switched to user:', userId);
      updateUserDisplay();
      loadUserVocabulary();
      loadLibraryCount(userId);
    });
  });
}

function saveCurrentUserVocabulary(callback) {
  chrome.storage.local.get(['vocabulary', 'vocabulary_dates', 'difficultyLevel', 'showChinese'], (result) => {
    const userKey = `user_data_${currentUser}`;
    const userData = {
      vocabulary: result.vocabulary || [],
      vocabulary_dates: result.vocabulary_dates || {},
      difficultyLevel: result.difficultyLevel || 'B1',
      showChinese: result.showChinese !== undefined ? result.showChinese : true
    };

    const update = {};
    update[userKey] = userData;

    chrome.storage.local.set(update, callback);
  });
}

function loadUserVocabulary() {
  const userKey = `user_data_${currentUser}`;
  chrome.storage.local.get([userKey], (result) => {
    const userData = result[userKey] || {};

    // Apply user's settings
    if (userData.vocabulary) {
      chrome.storage.local.set({ vocabulary: userData.vocabulary });
      vocabCountDisplay.textContent = userData.vocabulary.length;
      totalCountDisplay.textContent = userData.vocabulary.length;
    }

    if (userData.vocabulary_dates) {
      chrome.storage.local.set({ vocabulary_dates: userData.vocabulary_dates });
    }

    if (userData.difficultyLevel) {
      chrome.storage.local.set({ difficultyLevel: userData.difficultyLevel });
      const difficultyValue = Object.entries(DIFFICULTY_LEVELS).find(
        ([_, level]) => level === userData.difficultyLevel
      )?.[0] || "3";
      difficultySlider.value = difficultyValue;
      updateDifficultyDisplay(difficultyValue);
    }

    if (userData.showChinese !== undefined) {
      chrome.storage.local.set({ showChinese: userData.showChinese });
      toggleChinese.checked = userData.showChinese;
    }
  });
}

function resetUserVocabulary() {
  chrome.storage.local.set({
    vocabulary: [],
    vocabulary_dates: {}
  });
  vocabCountDisplay.textContent = "0";
  totalCountDisplay.textContent = "0";
  todayCountDisplay.textContent = "0";
  if (weekCountDisplay) weekCountDisplay.textContent = "0";
}

function updateUserDisplay() {
  const userIdDisplay = document.getElementById("user-id-display");
  if (userIdDisplay) {
    userIdDisplay.textContent = currentUser || "No user selected";
  }

  // Update selector
  userSelector.value = currentUser;
}

// Event listeners for user management
userSelector.addEventListener("change", (e) => {
  const selectedUserId = e.target.value;
  if (selectedUserId) {
    switchToUser(selectedUserId);
    // After switching, sync to all content scripts
    setTimeout(() => {
      syncCurrentUserToContentScripts();
    }, 1000);
  }
});

addNewUserBtn.addEventListener("click", () => {
  createNewUser();
});

// Function to sync current user with content scripts
function syncCurrentUserToContentScripts() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && tab.url.startsWith('http')) {
        chrome.tabs.sendMessage(tab.id, {
          type: "UPDATE_CURRENT_USER",
          userId: currentUser
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Tab might not have content script loaded, that's ok
            console.log(`[Popup] Could not sync user to tab ${tab.id}:`, chrome.runtime.lastError.message);
          }
        });
      }
    });
  });
}

// ========== Domain Management UI Logic ==========

let domainPolicyStore;
let presetDialog;

/**
 * Initialize domain management
 */
async function initializeDomainManagement() {
  // Create store instance
  domainPolicyStore = new DomainPolicyStore();

  // Create preset dialog instance
  presetDialog = new PresetDialog();

  // Initialize from backend
  if (currentUser) {
    await domainPolicyStore.initialize(currentUser);
  }

  // Setup event listeners
  setupDomainEventListeners();

  // Render blacklist
  renderBlacklist();
}

/**
 * Setup domain management event listeners
 */
function setupDomainEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Add domain button
  document.getElementById('btn-add-domain').addEventListener('click', () => {
    addDomainFromInput();
  });

  // Domain input - Enter key
  document.getElementById('domain-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomainFromInput();
    }
  });

  // Preset domains button
  document.getElementById('btn-preset-domains').addEventListener('click', () => {
    showPresetDialog();
  });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Remove active class from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(tabName).classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

/**
 * Add domain from input field
 */
async function addDomainFromInput() {
  const input = document.getElementById('domain-input');
  const domain = input.value.trim().toLowerCase();

  if (!domain) {
    alert('Please enter a domain name');
    return;
  }

  if (!currentUser) {
    alert('Please select a user first');
    return;
  }

  try {
    const success = await domainPolicyStore.addBlacklistDomain(currentUser, domain);
    if (success) {
      input.value = '';
      renderBlacklist();
      logger.log(`[Popup] Added domain to blacklist: ${domain}`);
    } else {
      alert('Failed to add domain');
    }
  } catch (error) {
    logger.error('[Popup] Error adding domain', error);
    alert('Error adding domain: ' + error.message);
  }
}

/**
 * Remove domain from blacklist
 */
async function removeDomainFromBlacklist(domain) {
  if (!currentUser) return;

  try {
    const success = await domainPolicyStore.removeBlacklistDomain(currentUser, domain);
    if (success) {
      renderBlacklist();
      logger.log(`[Popup] Removed domain from blacklist: ${domain}`);
    }
  } catch (error) {
    logger.error('[Popup] Error removing domain', error);
  }
}

/**
 * Render blacklist items
 */
function renderBlacklist() {
  const domains = domainPolicyStore.getBlacklistDomains();
  const container = document.getElementById('blacklist-items');
  const emptyMsg = document.getElementById('empty-blacklist-msg');
  const count = document.getElementById('blacklist-count');

  count.textContent = domains.length;

  // Clear container
  container.innerHTML = '';

  if (domains.length === 0) {
    emptyMsg.style.display = 'block';
  } else {
    emptyMsg.style.display = 'none';
    domains.forEach(domain => {
      const li = document.createElement('li');
      li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 12px;';

      const domainSpan = document.createElement('span');
      domainSpan.textContent = domain;
      domainSpan.style.cssText = 'flex: 1;';

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.style.cssText = 'background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 11px;';
      removeBtn.addEventListener('click', () => {
        if (confirm(`Remove ${domain} from blacklist?`)) {
          removeDomainFromBlacklist(domain);
        }
      });

      li.appendChild(domainSpan);
      li.appendChild(removeBtn);
      container.appendChild(li);
    });
  }
}

/**
 * Show preset domains dialog
 */
function showPresetDialog() {
  presetDialog.open(
    (selectedDomains) => {
      // User confirmed
      if (selectedDomains.length > 0) {
        addPresetDomains(selectedDomains);
      }
    },
    () => {
      // User cancelled
      logger.log('[Popup] Preset dialog cancelled');
    }
  );
}

/**
 * Add preset domains in batch
 */
async function addPresetDomains(domains) {
  if (!currentUser) {
    alert('Please select a user first');
    return;
  }

  try {
    const success = await domainPolicyStore.addBlacklistDomainsBatch(currentUser, domains);
    if (success) {
      renderBlacklist();
      logger.log(`[Popup] Added ${domains.length} preset domains`);
      alert(`Added ${domains.length} domains to blacklist`);
    } else {
      alert('Failed to add preset domains');
    }
  } catch (error) {
    logger.error('[Popup] Error adding preset domains', error);
  }
}
