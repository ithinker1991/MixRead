/**
 * MixRead Popup Script
 * Manages difficulty slider, vocabulary display, and statistics
 */

// ===== Extension Context Management =====
// Wrapper to safely handle chrome API calls even after context invalidation
const ChromeAPI = {
  isContextValid() {
    try {
      return chrome && chrome.storage && chrome.runtime;
    } catch (e) {
      return false;
    }
  },

  storage: {
    get(keys, callback) {
      if (!ChromeAPI.isContextValid()) {
        console.warn(
          "[MixRead] Extension context invalid, skipping storage.get"
        );
        if (callback) callback({});
        return;
      }
      try {
        chrome.storage.local.get(keys, (result) => {
          try {
            if (chrome.runtime.lastError) {
              console.warn(
                "[MixRead] Storage error:",
                chrome.runtime.lastError.message
              );
              if (callback) callback({});
            } else {
              if (callback) callback(result);
            }
          } catch (callbackError) {
            console.warn(
              "[MixRead] Storage callback error:",
              callbackError.message
            );
            if (callback) callback({});
          }
        });
      } catch (e) {
        console.warn("[MixRead] Chrome storage error:", e.message);
        if (callback) callback({});
      }
    },

    set(data, callback) {
      if (!ChromeAPI.isContextValid()) {
        console.warn(
          "[MixRead] Extension context invalid, skipping storage.set"
        );
        if (callback) callback();
        return;
      }
      try {
        chrome.storage.local.set(data, () => {
          try {
            if (chrome.runtime.lastError) {
              console.warn(
                "[MixRead] Storage set error:",
                chrome.runtime.lastError.message
              );
            }
            if (callback) callback();
          } catch (callbackError) {
            console.warn(
              "[MixRead] Storage set callback error:",
              callbackError.message
            );
            if (callback) callback();
          }
        });
      } catch (e) {
        console.warn("[MixRead] Chrome storage set error:", e.message);
        if (callback) callback();
      }
    },
  },

  runtime: {
    sendMessage(message, callback) {
      if (!ChromeAPI.isContextValid()) {
        console.warn(
          "[MixRead] Extension context invalid, skipping sendMessage"
        );
        if (callback) callback();
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          try {
            if (chrome.runtime.lastError) {
              console.warn(
                "[MixRead] Message error:",
                chrome.runtime.lastError.message
              );
            }
            if (callback) callback(response);
          } catch (callbackError) {
            console.warn(
              "[MixRead] Message callback error:",
              callbackError.message
            );
            if (callback) callback();
          }
        });
      } catch (e) {
        console.warn("[MixRead] Chrome sendMessage error:", e.message);
        if (callback) callback();
      }
    },
  },
};

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
  A1: {
    range: "A1 only",
    description:
      "Beginner - highlights only the most basic words for complete beginners",
  },
  A2: {
    range: "A2-C2",
    description:
      "Elementary - highlights words from basic to advanced, helping you build vocabulary",
  },
  B1: {
    range: "B1-C2",
    description:
      "Intermediate - highlights intermediate and advanced words to improve reading",
  },
  B2: {
    range: "B2-C2",
    description:
      "Upper-Intermediate - highlights advanced words for skilled readers",
  },
  C1: {
    range: "C1-C2",
    description:
      "Advanced - highlights only difficult words, minimal annotations",
  },
  C2: {
    range: "C2 only",
    description:
      "Mastery - highlights only the most challenging words for near-native readers",
  },
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
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
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
ChromeAPI.storage.get(["mixread_users", "mixread_current_user"], (result) => {
  allUsers = result.mixread_users || [];
  currentUser = result.mixread_current_user || "";

  // If no current user but have users, select the first one
  if (!currentUser && allUsers.length > 0) {
    currentUser = allUsers[0];
    ChromeAPI.storage.set({ mixread_current_user: currentUser });
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
  ChromeAPI.storage.get(
    [
      "difficultyLevel",
      "vocabulary",
      "vocabulary_dates",
      "showChinese",
      "reading_sessions",
    ],
    (result) => {
      // Load difficulty level
      const difficultyLevel = result.difficultyLevel || "B1";
      const difficultyValue =
        Object.entries(DIFFICULTY_LEVELS).find(
          ([_, level]) => level === difficultyLevel
        )?.[0] || "3";
      difficultySlider.value = difficultyValue;
      updateDifficultyDisplay(difficultyValue);

      // Load Chinese display setting
      const showChinese =
        result.showChinese !== undefined ? result.showChinese : true;
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
        const sevenDaysAgo = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
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
          readingTimeDisplay.textContent =
            Math.round(weekReading / 60) + "h " + (weekReading % 60) + "m";
        } else {
          readingTimeDisplay.textContent = weekReading + "m";
        }
      }
    }
  );
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
  ChromeAPI.storage.set({ showChinese });

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
  ChromeAPI.storage.set({ difficultyLevel: level });

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
  ChromeAPI.storage.get(["vocabulary"], (result) => {
    const vocabulary = result.vocabulary || [];

    if (vocabulary.length === 0) {
      alert(
        "No words in your vocabulary yet. Hover over highlighted words and click 'Add to Library' to start learning!"
      );
      return;
    }

    // Create a simple modal to display vocabulary
    const wordList = vocabulary.join(", ");
    alert(`Your Vocabulary (${vocabulary.length} words):\n\n${wordList}`);
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
    ChromeAPI.storage.set({
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
if (btnToggleSidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    console.log("[Popup] Toggle sidebar button clicked");

    // Send message to content script to toggle sidebar visibility
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id;
        console.log("[Popup] Sending toggle sidebar message to tab:", tabId);

        // Send message to toggle sidebar
        chrome.tabs.sendMessage(
          tabId,
          {
            type: "TOGGLE_SIDEBAR",
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[Popup] Error sending toggle sidebar message:",
                chrome.runtime.lastError
              );
            } else {
              console.log("[Popup] Sidebar toggled successfully");
            }
          }
        );
      } else {
        console.error("[Popup] No active tab found");
      }
    });
  });
}

/**
 * Load library word count from backend
 */
async function loadLibraryCount(userId) {
  try {
    const response = await fetch(
      `http://localhost:8000/users/${encodeURIComponent(userId)}/library`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        const libraryCount = data.library ? data.library.length : 0;
        libraryCountDisplay.textContent = libraryCount;
      }
    }
  } catch (error) {
    console.log("[Popup] Could not load library count:", error);
    libraryCountDisplay.textContent = "?";
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
    console.error("[Popup] No current user selected");
  }
}

/**
 * Open library URL with given user ID
 */
function openLibraryUrl(userId) {
  try {
    // Open library viewer with user ID
    const libraryUrl = `http://localhost:8002/library-viewer.html?user=${encodeURIComponent(
      userId
    )}`;

    console.log("[Popup] Opening library page:", libraryUrl);
    chrome.tabs.create({ url: libraryUrl }, (tab) => {
      console.log("[Popup] Opened library tab:", tab.id);
    });
  } catch (error) {
    console.error("[Popup] Error opening library page:", error);

    // Fallback: open basic library page
    chrome.tabs.create({
      url: "http://localhost:8002/library-viewer.html",
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

  allUsers.forEach((userId) => {
    const option = document.createElement("option");
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
  if (userId.startsWith("user_")) {
    return userId.substring(5, 20) + "...";
  }
  return userId;
}

function createNewUser() {
  const newUserId =
    "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

  allUsers.push(newUserId);
  currentUser = newUserId;

  ChromeAPI.storage.set(
    {
      mixread_users: allUsers,
      mixread_current_user: currentUser,
    },
    () => {
      console.log("[Popup] Created new user:", newUserId);
      loadUsersIntoSelector();
      updateUserDisplay();
      loadLibraryCount(currentUser);

      // Reset vocabulary for new user
      resetUserVocabulary();
    }
  );
}

function switchToUser(userId) {
  if (!userId) return;

  // Save current user's vocabulary
  saveCurrentUserVocabulary(() => {
    currentUser = userId;
    ChromeAPI.storage.set({ mixread_current_user: userId }, () => {
      console.log("[Popup] Switched to user:", userId);
      updateUserDisplay();
      loadUserVocabulary();
      loadLibraryCount(userId);
    });
  });
}

function saveCurrentUserVocabulary(callback) {
  ChromeAPI.storage.get(
    ["vocabulary", "vocabulary_dates", "difficultyLevel", "showChinese"],
    (result) => {
      const userKey = `user_data_${currentUser}`;
      const userData = {
        vocabulary: result.vocabulary || [],
        vocabulary_dates: result.vocabulary_dates || {},
        difficultyLevel: result.difficultyLevel || "B1",
        showChinese:
          result.showChinese !== undefined ? result.showChinese : true,
      };

      const update = {};
      update[userKey] = userData;

      ChromeAPI.storage.set(update, callback);
    }
  );
}

function loadUserVocabulary() {
  const userKey = `user_data_${currentUser}`;
  ChromeAPI.storage.get([userKey], (result) => {
    const userData = result[userKey] || {};

    // Apply user's settings
    if (userData.vocabulary) {
      ChromeAPI.storage.set({ vocabulary: userData.vocabulary });
      vocabCountDisplay.textContent = userData.vocabulary.length;
      totalCountDisplay.textContent = userData.vocabulary.length;
    }

    if (userData.vocabulary_dates) {
      ChromeAPI.storage.set({ vocabulary_dates: userData.vocabulary_dates });
    }

    if (userData.difficultyLevel) {
      ChromeAPI.storage.set({ difficultyLevel: userData.difficultyLevel });
      const difficultyValue =
        Object.entries(DIFFICULTY_LEVELS).find(
          ([_, level]) => level === userData.difficultyLevel
        )?.[0] || "3";
      difficultySlider.value = difficultyValue;
      updateDifficultyDisplay(difficultyValue);
    }

    if (userData.showChinese !== undefined) {
      ChromeAPI.storage.set({ showChinese: userData.showChinese });
      toggleChinese.checked = userData.showChinese;
    }
  });
}

function resetUserVocabulary() {
  ChromeAPI.storage.set({
    vocabulary: [],
    vocabulary_dates: {},
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
    tabs.forEach((tab) => {
      if (tab.url && tab.url.startsWith("http")) {
        chrome.tabs.sendMessage(
          tab.id,
          {
            type: "UPDATE_CURRENT_USER",
            userId: currentUser,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              // Tab might not have content script loaded, that's ok
              console.log(
                `[Popup] Could not sync user to tab ${tab.id}:`,
                chrome.runtime.lastError.message
              );
            }
          }
        );
      }
    });
  });
}

// ========== Domain Management UI Logic ==========

let domainPolicyStore;
// Note: presetDialog is created in preset-dialog.js, don't re-declare here

/**
 * Initialize domain management
 */
async function initializeDomainManagement() {
  try {
    // Create store instance
    domainPolicyStore = new DomainPolicyStore();
    logger.log("[DomainPolicy] Store created, currentUser:", currentUser);

    // presetDialog is already created in preset-dialog.js, no need to recreate

    // Initialize from backend
    if (currentUser) {
      logger.log(
        "[DomainPolicy] Starting initialization with userId:",
        currentUser
      );
      const initResult = await domainPolicyStore.initialize(currentUser);
      logger.log("[DomainPolicy] Initialization result:", initResult);
    } else {
      logger.warn("[DomainPolicy] No current user, skipping initialization");
    }

    // Setup event listeners
    setupDomainEventListeners();

    // Render blacklist
    renderBlacklist();
  } catch (error) {
    logger.error("[DomainPolicy] Initialization error:", error);
  }
}

/**
 * Setup domain management event listeners
 */
function setupDomainEventListeners() {
  // Tab switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tabName = e.target.getAttribute("data-tab");
      switchTab(tabName);
    });
  });

  // Add domain button
  document.getElementById("btn-add-domain").addEventListener("click", () => {
    addDomainFromInput();
  });

  // Domain input - Enter key
  document.getElementById("domain-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addDomainFromInput();
    }
  });

  // Preset domains button
  document
    .getElementById("btn-preset-domains")
    .addEventListener("click", () => {
      showPresetDialog();
    });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // Remove active class from all buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Show selected tab
  document.getElementById(tabName).classList.add("active");
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
}

/**
 * Add domain from input field
 */
async function addDomainFromInput() {
  const input = document.getElementById("domain-input");
  const domain = input.value.trim().toLowerCase();

  if (!domain) {
    alert("Please enter a domain name");
    return;
  }

  if (!currentUser) {
    alert("Please select a user first");
    return;
  }

  try {
    const success = await domainPolicyStore.addBlacklistDomain(
      currentUser,
      domain
    );
    if (success) {
      input.value = "";
      renderBlacklist();
      logger.log(`[Popup] Added domain to blacklist: ${domain}`);

      // Notify all tabs about policy change
      notifyTabsOfPolicyChange();
    } else {
      alert("Failed to add domain");
    }
  } catch (error) {
    logger.error("[Popup] Error adding domain", error);
    alert("Error adding domain: " + error.message);
  }
}

/**
 * Remove domain from blacklist
 */
async function removeDomainFromBlacklist(domain) {
  if (!currentUser) return;

  try {
    const success = await domainPolicyStore.removeBlacklistDomain(
      currentUser,
      domain
    );
    if (success) {
      renderBlacklist();
      logger.log(`[Popup] Removed domain from blacklist: ${domain}`);

      // Notify all tabs about policy change
      notifyTabsOfPolicyChange();
    }
  } catch (error) {
    logger.error("[Popup] Error removing domain", error);
  }
}

/**
 * Render blacklist items
 */
function renderBlacklist() {
  const domains = domainPolicyStore.getBlacklistDomains();
  const container = document.getElementById("blacklist-items");
  const emptyMsg = document.getElementById("empty-blacklist-msg");
  const count = document.getElementById("blacklist-count");

  count.textContent = domains.length;

  // Clear container
  container.innerHTML = "";

  if (domains.length === 0) {
    emptyMsg.style.display = "block";
  } else {
    emptyMsg.style.display = "none";
    domains.forEach((domain) => {
      const li = document.createElement("li");
      li.style.cssText =
        "display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 12px;";

      const domainSpan = document.createElement("span");
      domainSpan.textContent = domain;
      domainSpan.style.cssText = "flex: 1;";

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "✕";
      removeBtn.style.cssText =
        "background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 11px;";
      removeBtn.addEventListener("click", () => {
        removeDomainFromBlacklist(domain);
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
      logger.log("[Popup] Preset dialog cancelled");
    }
  );
}

/**
 * Add preset domains in batch
 */
async function addPresetDomains(domains) {
  if (!currentUser) {
    alert("Please select a user first");
    return;
  }

  try {
    const success = await domainPolicyStore.addBlacklistDomainsBatch(
      currentUser,
      domains
    );
    if (success) {
      renderBlacklist();
      logger.log(`[Popup] Added ${domains.length} preset domains`);
      alert(`Added ${domains.length} domains to blacklist`);
    } else {
      alert("Failed to add preset domains");
    }
  } catch (error) {
    logger.error("[Popup] Error adding preset domains", error);
  }
}

/**
 * Notify all tabs that domain policy has changed
 */
function notifyTabsOfPolicyChange() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url && tab.url.startsWith("http")) {
        chrome.tabs.sendMessage(
          tab.id,
          {
            type: "DOMAIN_POLICY_CHANGED",
            userId: currentUser,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              // Tab might not have content script loaded, that's ok
              console.log(
                `[Popup] Could not notify tab ${tab.id}:`,
                chrome.runtime.lastError.message
              );
            }
          }
        );
      }
    });
  });
}

// ===== Quick Actions for Domain Blacklist (P1.2) =====

/**
 * Initialize quick actions for current page domain
 */
function initializeQuickActions() {
  console.log("[Popup] Initializing quick actions...");

  // Get current tab information
  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    async (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.warn("[Popup] No active tab found");
        return;
      }

      const tab = tabs[0];
      if (!tab.url) {
        console.warn("[Popup] Tab has no URL");
        updateQuickActionStatus(
          "Cannot get current page URL",
          "error"
        );
        return;
      }

      try {
        // Extract domain and path
        const url = new URL(tab.url);
        const domain = url.host; // Includes port number
        const path = url.pathname;

        console.log(
          "[Popup] Current page - domain:",
          domain,
          "path:",
          path
        );

        // Display domain
        document.getElementById("current-page-domain").textContent = domain;

        // Bind button events
        document.getElementById("btn-quick-exclude-domain").onclick =
          async () => {
            await handleQuickExcludeDomain(domain, tab);
          };

        document.getElementById("btn-quick-exclude-path").onclick =
          async () => {
            await handleQuickExcludePath(domain, path, tab);
          };

        console.log("[Popup] Quick actions initialized for domain:", domain);
      } catch (error) {
        console.error("[Popup] Error initializing quick actions:", error);
        updateQuickActionStatus("Invalid page URL", "error");
      }
    }
  );
}

/**
 * Handle quick exclude domain button click
 */
async function handleQuickExcludeDomain(domain, tab) {
  console.log("[Popup] Quick exclude domain:", domain);

  if (!domainPolicyStore) {
    updateQuickActionStatus("Store not ready", "error");
    return;
  }

  if (!currentUser) {
    updateQuickActionStatus("User not logged in", "error");
    return;
  }

  try {
    updateQuickActionStatus("Adding domain to blacklist...", "loading");

    const success = await domainPolicyStore.addBlacklistDomain(
      currentUser,
      domain,
      "Added from quick actions"
    );

    if (success) {
      updateQuickActionStatus(
        `✅ Added "${domain}" to blacklist`,
        "success"
      );

      // Reload tab after 1.5 seconds
      setTimeout(() => {
        chrome.tabs.reload(tab.id);
        window.close();
      }, 1500);
    } else {
      updateQuickActionStatus("Failed to add domain", "error");
    }
  } catch (error) {
    console.error("[Popup] Error excluding domain:", error);
    updateQuickActionStatus(`Error: ${error.message}`, "error");
  }
}

/**
 * Handle quick exclude path button click
 */
async function handleQuickExcludePath(domain, path, tab) {
  console.log("[Popup] Quick exclude path:", domain + path);

  if (!domainPolicyStore) {
    updateQuickActionStatus("Store not ready", "error");
    return;
  }

  if (!currentUser) {
    updateQuickActionStatus("User not logged in", "error");
    return;
  }

  try {
    const domainWithPath = domain + path;

    updateQuickActionStatus("Adding path to blacklist...", "loading");

    const success = await domainPolicyStore.addBlacklistDomain(
      currentUser,
      domainWithPath,
      "Added path from quick actions"
    );

    if (success) {
      updateQuickActionStatus(
        `✅ Added "${domainWithPath}" to blacklist`,
        "success"
      );

      // Reload tab after 1.5 seconds
      setTimeout(() => {
        chrome.tabs.reload(tab.id);
        window.close();
      }, 1500);
    } else {
      updateQuickActionStatus("Failed to add path", "error");
    }
  } catch (error) {
    console.error("[Popup] Error excluding path:", error);
    updateQuickActionStatus(`Error: ${error.message}`, "error");
  }
}

/**
 * Display status message in quick actions area
 */
function updateQuickActionStatus(message, type = "info") {
  const statusEl = document.getElementById("quick-action-status");
  statusEl.textContent = message;
  statusEl.style.display = "block";

  // Set styles based on type
  const colorMap = {
    success: { bg: "#d4edda", color: "#155724", border: "#c3e6cb" },
    error: { bg: "#f8d7da", color: "#721c24", border: "#f5c6cb" },
    loading: { bg: "#d1ecf1", color: "#0c5460", border: "#bee5eb" },
    info: { bg: "#d7e8ef", color: "#0c5460", border: "#b8daff" },
  };

  const style = colorMap[type] || colorMap["info"];
  statusEl.style.background = style.bg;
  statusEl.style.color = style.color;
  statusEl.style.borderColor = style.border;

  console.log(`[Popup] Quick action status: ${type} - ${message}`);
}

// Initialize quick actions when popup loads
// Wait a bit for domainPolicyStore to be ready
setTimeout(() => {
  initializeQuickActions();
}, 500);

/**
 * Quick Entry Points
 * Navigation to review and library pages
 */

// Start Review button
const btnStartReview = document.getElementById('btn-start-review');
if (btnStartReview) {
  btnStartReview.addEventListener('click', () => {
    console.log('[Popup] Starting review session');

    // Get current user from storage (testUserId first for testing)
    ChromeAPI.storage.get(['testUserId', 'userId', 'currentUser'], (result) => {
      const userId = result.testUserId || result.currentUser || result.userId || 'test_user';
      console.log('[Popup] Starting review for user:', userId);

      // Use MixReadNavigation to open review page
      if (typeof MixReadNavigation !== 'undefined') {
        MixReadNavigation.openPage('review', { user_id: userId });
      } else {
        // Fallback if navigation not loaded
        chrome.tabs.create({
          url: `http://localhost:8001/pages/review/?user_id=${encodeURIComponent(userId)}`
        });
      }
    });
  });
}

// Update Library button to use new navigation (use existing btnViewLibrary from line 177)
if (btnViewLibrary) {
  btnViewLibrary.addEventListener('click', () => {
    console.log('[Popup] Opening library page');

    // Get current user from storage (testUserId first for testing)
    ChromeAPI.storage.get(['testUserId', 'userId', 'currentUser'], (result) => {
      const userId = result.testUserId || result.currentUser || result.userId || 'test_user';
      console.log('[Popup] Opening library for user:', userId);

      // Use MixReadNavigation to open library page
      if (typeof MixReadNavigation !== 'undefined') {
        MixReadNavigation.openPage('library', { user_id: userId });
      } else {
        // Fallback if navigation not loaded
        chrome.tabs.create({
          url: `http://localhost:8001/pages/library/?user_id=${encodeURIComponent(userId)}`
        });
      }
    });
  });
}

/**
 * User ID Management for Testing
 * Allow users to manually set user_id for testing without full auth system
 */

function setupUserIdManagement() {
  console.log('[Popup] Setting up user ID management');

  const userIdInput = document.getElementById('user-id-input');
  const setUserBtn = document.getElementById('set-user-btn');
  const userIdDisplay = document.getElementById('user-id-display');
  const recentUsersContainer = document.getElementById('recent-users');

  if (!userIdInput || !setUserBtn) {
    console.warn('[Popup] User ID elements not found');
    return;
  }

  console.log('[Popup] User ID elements found, initializing handlers');

  // Initialize user ID input
  function initializeUserIdInput() {
    console.log('[Popup] Loading user ID from storage');

    ChromeAPI.storage.get(['testUserId', 'recentUserIds'], (result) => {
      try {
        const currentUserId = result.testUserId || 'test_user';
        const recentUserIds = result.recentUserIds || [];

        // Set current user display
        userIdDisplay.textContent = currentUserId;
        userIdInput.value = currentUserId;

        console.log('[Popup] Current user ID:', currentUserId);

        // Display recent users as buttons
        if (recentUserIds.length > 0) {
          recentUsersContainer.innerHTML = recentUserIds
            .slice(0, 5)
            .map(
              (userId) =>
                `<button class="recent-user-btn" data-user-id="${userId}" style="
              font-size: 9px;
              padding: 2px 6px;
              background: #e8f5e9;
              color: #2e7d32;
              border: 1px solid #2e7d32;
              border-radius: 3px;
              cursor: pointer;
            ">${userId}</button>`
            )
            .join('');

          // Add click handlers to recent user buttons
          recentUsersContainer.querySelectorAll('.recent-user-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
              const userId = btn.getAttribute('data-user-id');
              console.log('[Popup] Clicked recent user:', userId);
              setUserIdAndNavigate(userId);
            });
          });
        }
      } catch (e) {
        console.error('[Popup] Error initializing user ID:', e);
      }
    });
  }

  // Set user ID function
  function setUserIdAndNavigate(userId) {
    if (!userId || userId.trim().length === 0) {
      alert('Please enter a valid user ID');
      return;
    }

    userId = userId.trim();
    console.log('[Popup] Setting user ID to:', userId);

    ChromeAPI.storage.get(['recentUserIds'], (result) => {
      try {
        let recentUserIds = result.recentUserIds || [];

        if (!recentUserIds.includes(userId)) {
          recentUserIds.unshift(userId);
          recentUserIds = recentUserIds.slice(0, 10);
        }

        ChromeAPI.storage.set(
          {
            testUserId: userId,
            recentUserIds: recentUserIds
          },
          () => {
            userIdDisplay.textContent = userId;
            userIdInput.value = userId;
            initializeUserIdInput();
            console.log('[Popup] User ID successfully set:', userId);
            alert(`✅ User ID set to: ${userId}\n\nYou can now use the quick entry buttons.`);
          }
        );
      } catch (e) {
        console.error('[Popup] Error setting user ID:', e);
      }
    });
  }

  // Attach event listeners
  console.log('[Popup] Attaching event listeners');

  setUserBtn.addEventListener('click', () => {
    console.log('[Popup] Set button clicked');
    setUserIdAndNavigate(userIdInput.value);
  });

  userIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      console.log('[Popup] Enter pressed in input');
      setUserIdAndNavigate(userIdInput.value);
    }
  });

  // Initialize on load
  console.log('[Popup] Initial load of user ID');
  initializeUserIdInput();
}

// Run setup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupUserIdManagement);
  console.log('[Popup] Waiting for DOMContentLoaded');
} else {
  console.log('[Popup] DOM already loaded');
  setTimeout(setupUserIdManagement, 100);
}
