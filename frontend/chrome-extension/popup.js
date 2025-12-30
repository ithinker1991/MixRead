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

// DOM Elements
const difficultySlider = document.getElementById("difficulty-slider");
const currentLevelDisplay = document.getElementById("current-level");
const vocabCountDisplay = document.getElementById("vocab-count");
const todayCountDisplay = document.getElementById("today-count");
const totalCountDisplay = document.getElementById("total-count");
const toggleChinese = document.getElementById("toggle-chinese");
const weekCountDisplay = document.getElementById("week-count");
const readingTimeDisplay = document.getElementById("reading-time");
const btnViewVocab = document.getElementById("btn-view-vocabulary");
const btnResetVocab = document.getElementById("btn-reset-vocab");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const btnViewLibrary = document.getElementById("btn-view-library");
const btnStartReview = document.getElementById("btn-start-review");
const libraryCountDisplay = document.getElementById("library-count");

// User management variables
let allUsers = [];
let currentUser = "";

// MRS Descriptions Helper
function getMRSDescription(score) {
  if (score < 20) return { level: "A1", desc: "Beginner" };
  if (score < 30) return { level: "A2", desc: "Elementary" };
  if (score < 50) return { level: "B1", desc: "Intermediate" };
  if (score < 70) return { level: "B2", desc: "Upper-Intermediate" };
  if (score < 90) return { level: "C1", desc: "Advanced" };
  return { level: "C2", desc: "Mastery" };
}

difficultySlider.addEventListener("input", function () {
  const score = parseInt(this.value);
  updateDifficultyDisplay(score);
  saveDifficulty(score);
});

function updateDifficultyDisplay(score) {
  const info = getMRSDescription(score);
  currentLevelDisplay.textContent = `MRS: ${score} (${info.level})`;

  // Color feedback based on score
  const hue = 120 - score * 1.2; // Green to Red
  currentLevelDisplay.style.color = `hsl(${hue}, 70%, 45%)`;

  updateLevelDescription(info);
}

function updateLevelDescription(info) {
  const descriptionElement = document.getElementById("level-description");
  if (!descriptionElement) return;
  descriptionElement.innerHTML = `Highlights <strong>${info.level}</strong> range - ${info.desc}`;
}

function saveDifficulty(score) {
  const info = getMRSDescription(score);
  console.log(
    `[MixRead Popup] Saving difficulty - MRS: ${score}, Level: ${info.level}`
  );

  const updates = {
    difficulty_mrs: score,
    difficulty_level: info.level, // Fallback for legacy
    difficultyLevel: info.level, // Sync with content script key
  };

  // Also save to current user's data if available
  if (currentUser) {
    const userKey = `user_data_${currentUser}`;
    chrome.storage.local.get([userKey], (result) => {
      const userData = result[userKey] || {};
      userData.difficulty_mrs = score;
      userData.difficultyLevel = info.level;

      const userUpdate = {};
      userUpdate[userKey] = userData;
      chrome.storage.local.set(userUpdate);
    });
  }

  chrome.storage.local.set(updates, function () {
    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        console.log(
          `[MixRead Popup] Sending updateDifficulty to tab ${tabs[0].id}`
        );
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "updateDifficulty",
            difficulty_level: info.level,
            difficulty_mrs: score,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[MixRead Popup] Message error:",
                chrome.runtime.lastError.message
              );
            } else {
              console.log(
                "[MixRead Popup] Message sent successfully, response:",
                response
              );
            }
          }
        );
      }
    });
  });
}

// Initialize
chrome.storage.local.get(["difficulty_mrs"], function (result) {
  if (result.difficulty_mrs !== undefined) {
    difficultySlider.value = result.difficulty_mrs;
    updateDifficultyDisplay(result.difficulty_mrs);
  } else {
    // Default B1 approx (40)
    difficultySlider.value = 40;
    updateDifficultyDisplay(40);
  }
});

// Helper function to get date X days ago
function getDateXDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

// REMOVED: Old user loading code - moved to setupUserIdManagement()
// This old code loaded users into dropdown selector which no longer exists
// User management now handled by setupUserIdManagement() with manual input
/*
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
*/

/**
 * Update difficulty display
 */
// Deprecated functions removed in favor of MRS logic above

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
  if (!userId) {
    console.log("[Popup] No user ID provided for library count");
    libraryCountDisplay.textContent = "0";
    return;
  }
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
  const finalUserId = userId || currentUser;
  if (!finalUserId) {
    console.error("[Popup] No user ID for library URL");
    return;
  }

  try {
    // Use MixReadNavigation to open library page if available
    if (typeof MixReadNavigation !== "undefined") {
      MixReadNavigation.openPage("library", { user_id: finalUserId });
      return;
    }

    // Open library viewer with user ID
    const libraryUrl =
      chrome.runtime.getURL("pages/library.html") +
      `?user=${encodeURIComponent(finalUserId)}`;

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
    [
      "vocabulary",
      "vocabulary_dates",
      "difficultyLevel",
      "difficulty_mrs",
      "showChinese",
    ],
    (result) => {
      const userKey = `user_data_${currentUser}`;
      const userData = {
        vocabulary: result.vocabulary || [],
        vocabulary_dates: result.vocabulary_dates || {},
        difficultyLevel: result.difficultyLevel || "B1",
        difficulty_mrs: result.difficulty_mrs || 40,
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

    // Apply user's settings, falling back to top-level storage if needed
    if (userData.vocabulary) {
      ChromeAPI.storage.set({ vocabulary: userData.vocabulary });
      vocabCountDisplay.textContent = userData.vocabulary.length;
      totalCountDisplay.textContent = userData.vocabulary.length;
    }

    if (userData.vocabulary_dates) {
      ChromeAPI.storage.set({ vocabulary_dates: userData.vocabulary_dates });
    }

    // Load difficulty level - try user data first, then fall back to direct storage read
    let level = userData.difficultyLevel;
    let mrsScore = userData.difficulty_mrs;

    if (level || mrsScore) {
      updateDifficultyUI(level, mrsScore);
    } else {
      // Fallback: try reading directly from storage (top-level key)
      ChromeAPI.storage.get(["difficultyLevel", "difficulty_mrs"], (res) => {
        const directLevel = res.difficultyLevel || "B1";
        const directMRS = res.difficulty_mrs || 40;
        updateDifficultyUI(directLevel, directMRS);
      });
    }

    if (userData.showChinese !== undefined) {
      ChromeAPI.storage.set({ showChinese: userData.showChinese });
      toggleChinese.checked = userData.showChinese;
    }
  });
}

function updateDifficultyUI(level, mrsScore = null) {
  // If we have an MRS score, use it directly as it's more granular
  if (mrsScore === null || mrsScore === undefined) {
    // Convert CEFR level to MRS score (approximate)
    const levelToMRS = {
      A1: 10,
      A2: 25,
      B1: 40,
      B2: 60,
      C1: 80,
      C2: 95,
    };
    mrsScore = levelToMRS[level] || 40; // Default to B1 (40)
  } else {
    // If we have MRS but no level, derive level from MRS
    if (!level) {
      const info = getMRSDescription(mrsScore);
      level = info.level;
    }
  }

  ChromeAPI.storage.set({
    difficulty_mrs: mrsScore,
    difficulty_level: level,
    difficultyLevel: level,
  });
  difficultySlider.value = mrsScore;
  updateDifficultyDisplay(mrsScore);
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
  // REMOVED: userSelector.value = currentUser;
  // Old dropdown selector removed - user selection now handled by setupUserIdManagement()
}

// Event listeners for user management - REMOVED OLD DROPDOWN
// User selection is now handled by setupUserIdManagement() in the new manual input system
// Removed: userSelector.addEventListener(...)
// Removed: addNewUserBtn.addEventListener(...)

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
        updateQuickActionStatus("Cannot get current page URL", "error");
        return;
      }

      try {
        // Extract domain and path
        const url = new URL(tab.url);
        const domain = url.host; // Includes port number
        const path = url.pathname;

        console.log("[Popup] Current page - domain:", domain, "path:", path);

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
      updateQuickActionStatus(`✅ Added "${domain}" to blacklist`, "success");

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
if (btnStartReview) {
  btnStartReview.addEventListener("click", () => {
    console.log("[Popup] Starting review session");

    // Favor current selected user from memory first
    const userId = currentUser || "test_user";
    console.log("[Popup] Starting review for user:", userId);

    // Use MixReadNavigation to open review page
    if (typeof MixReadNavigation !== "undefined") {
      MixReadNavigation.openPage("review", { user_id: userId });
    } else {
      // Fallback if navigation not loaded
      const reviewUrl =
        chrome.runtime.getURL("pages/review.html") +
        `?user_id=${encodeURIComponent(userId)}`;
      chrome.tabs.create({ url: reviewUrl });
    }
  });
}

// Update Library button to use new navigation
if (btnViewLibrary) {
  btnViewLibrary.addEventListener("click", () => {
    console.log("[Popup] Opening library page");

    // Use openLibraryUrl helper which handles the logic
    openLibraryUrl(currentUser);
  });
}

/**
 * User ID Management for Testing
 * Allow users to manually set user_id for testing without full auth system
 */

function setupUserIdManagement() {
  console.log("[Popup] Setting up user ID management");

  const userIdInput = document.getElementById("user-id-input");
  const setUserBtn = document.getElementById("set-user-btn");
  const userIdDisplay = document.getElementById("user-id-display");
  const recentUsersContainer = document.getElementById("recent-users");

  if (!userIdInput || !setUserBtn) {
    console.warn("[Popup] User ID elements not found");
    return;
  }

  console.log("[Popup] User ID elements found, initializing handlers");

  // Initialize user ID input
  function initializeUserIdInput() {
    console.log("[Popup] Loading user ID from storage");

    ChromeAPI.storage.get(
      ["testUserId", "mixread_user_id", "recentUserIds"],
      (result) => {
        try {
          const currentUserId =
            result.testUserId || result.mixread_user_id || "test_user";
          const recentUserIds = result.recentUserIds || [];

          // Set global current user
          currentUser = currentUserId;

          // Set current user display
          userIdDisplay.textContent = currentUserId;
          userIdInput.value = currentUserId;

          console.log("[Popup] Current user ID:", currentUserId);

          // Load user vocabulary and settings
          loadUserVocabulary();

          // Initialize domain management (tab switching, blacklist, etc.)
          initializeDomainManagement();

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
              .join("");

            // Add click handlers to recent user buttons
            recentUsersContainer
              .querySelectorAll(".recent-user-btn")
              .forEach((btn) => {
                btn.addEventListener("click", () => {
                  const userId = btn.getAttribute("data-user-id");
                  console.log("[Popup] Clicked recent user:", userId);
                  setUserIdAndNavigate(userId);
                });
              });
          }
        } catch (e) {
          console.error("[Popup] Error initializing user ID:", e);
        }
      }
    );
  }

  // Set user ID function
  function setUserIdAndNavigate(userId) {
    if (!userId || userId.trim().length === 0) {
      alert("Please enter a valid user ID");
      return;
    }

    userId = userId.trim();
    console.log("[Popup] Setting user ID to:", userId);

    ChromeAPI.storage.get(["recentUserIds"], (result) => {
      try {
        let recentUserIds = result.recentUserIds || [];

        if (!recentUserIds.includes(userId)) {
          recentUserIds.unshift(userId);
          recentUserIds = recentUserIds.slice(0, 10);
        }

        // Write to BOTH testUserId (popup) AND mixread_user_id (content script)
        // This ensures all components use the same user ID
        ChromeAPI.storage.set(
          {
            testUserId: userId,
            mixread_user_id: userId, // <-- Key for content script sync
            recentUserIds: recentUserIds,
          },
          () => {
            userIdDisplay.textContent = userId;
            userIdInput.value = userId;

            // Update global current user and reload data
            currentUser = userId;
            loadUserVocabulary();

            // Notify ALL content scripts to update their user ID
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach((tab) => {
                if (tab.url && tab.url.startsWith("http")) {
                  chrome.tabs.sendMessage(
                    tab.id,
                    {
                      type: "UPDATE_USER_ID",
                      userId: userId,
                    },
                    (response) => {
                      if (chrome.runtime.lastError) {
                        // Tab might not have content script, that's ok
                      } else {
                        console.log(`[Popup] Synced user ID to tab ${tab.id}`);
                      }
                    }
                  );
                }
              });
            });

            initializeUserIdInput();
            console.log("[Popup] User ID successfully set:", userId);
            alert(
              `✅ User ID set to: ${userId}\n\nYou can now use the quick entry buttons.`
            );
          }
        );
      } catch (e) {
        console.error("[Popup] Error setting user ID:", e);
      }
    });
  }

  // Attach event listeners
  console.log("[Popup] Attaching event listeners to setUserBtn:", setUserBtn);

  if (!setUserBtn) {
    console.error("[Popup] ERROR: setUserBtn is null!");
    return;
  }

  setUserBtn.addEventListener("click", (event) => {
    console.log("[Popup] ===== Set button clicked =====");
    console.log("[Popup] Event:", event);
    console.log("[Popup] userIdInput.value:", userIdInput.value);
    try {
      setUserIdAndNavigate(userIdInput.value);
    } catch (err) {
      console.error("[Popup] Error in setUserIdAndNavigate:", err);
    }
  });

  console.log("[Popup] Set button click listener attached");

  userIdInput.addEventListener("keypress", (e) => {
    console.log("[Popup] Key pressed in input:", e.key);
    if (e.key === "Enter") {
      console.log("[Popup] Enter pressed in input, value:", userIdInput.value);
      try {
        setUserIdAndNavigate(userIdInput.value);
      } catch (err) {
        console.error("[Popup] Error in keypress handler:", err);
      }
    }
  });

  console.log("[Popup] Keypress listener attached");

  // Initialize on load
  console.log("[Popup] Initial load of user ID");
  initializeUserIdInput();
}

// Run setup when DOM is ready
console.log(
  "[Popup] popup.js loaded, document.readyState:",
  document.readyState
);
console.log(
  "[Popup] user-id-input element:",
  document.getElementById("user-id-input")
);
console.log(
  "[Popup] set-user-btn element:",
  document.getElementById("set-user-btn")
);

if (document.readyState === "loading") {
  console.log("[Popup] Waiting for DOMContentLoaded");
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[Popup] DOMContentLoaded fired");
    setupUserIdManagement();
  });
} else {
  console.log("[Popup] DOM already loaded, running setupUserIdManagement");
  setTimeout(() => {
    console.log("[Popup] Timeout callback: calling setupUserIdManagement");
    setupUserIdManagement();
  }, 100);
}

// ========== Auth UI Logic ==========
async function setupAuthUI() {
  console.log("[Popup] Setting up Auth UI");
  const loginView = document.getElementById("login-view");
  const loggedInView = document.getElementById("logged-in-view");
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const devUserSection = document.getElementById("dev-user-section");

  if (!btnLogin) return;

  btnLogin.addEventListener("click", async () => {
    try {
      btnLogin.textContent = "Logging in...";
      btnLogin.disabled = true;
      const session = await authService.login();
      handleAuthUser(session);
    } catch (e) {
      console.error("Login failed", e);
      alert("Login failed: " + e.message);
      btnLogin.textContent = "Google Login";
      btnLogin.disabled = false;
    }
  });

  btnLogout.addEventListener("click", async () => {
    if (confirm("Are you sure you want to logout?")) {
      await authService.logout();
      handleLogout();
    }
  });

  // Check initial state
  const user = await authService.getUser();
  if (user) {
    console.log("[Popup] Found authenticated user:", user);
    handleAuthUser(user);
  } else {
    console.log("[Popup] No authenticated user");
  }
}

function handleAuthUser(userSession) {
  // Update UI
  document.getElementById("login-view").style.display = "none";
  document.getElementById("logged-in-view").style.display = "flex";
  document.getElementById("dev-user-section").style.display = "none"; // Hide dev input

  // Set user info
  if (userSession.avatar)
    document.getElementById("user-avatar").src = userSession.avatar;
  if (userSession.name)
    document.getElementById("user-name").textContent =
      userSession.name || userSession.email;

  // Set global user
  const userId = userSession.user_id;
  currentUser = userId;

  // Direct Update storage (Bypassing testUserId logic to enforce auth user)
  ChromeAPI.storage.set(
    {
      mixread_current_user: userId,
      mixread_user_id: userId,
      // We don't touch testUserId so it remains as fallback
    },
    () => {
      console.log("[Popup] Auth user set:", userId);
      updateUserDisplay();
      loadUserVocabulary();
      loadLibraryCount(userId);
      initializeDomainManagement();

      // Notify tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.url && tab.url.startsWith("http")) {
            chrome.tabs.sendMessage(tab.id, {
              type: "UPDATE_USER_ID",
              userId: userId,
            });
          }
        });
      });

      // Also update the display to show the auth user ID
      const userIdDisplay = document.getElementById("user-id-display");
      if (userIdDisplay) userIdDisplay.textContent = userId;
    }
  );
}

function handleLogout() {
  document.getElementById("login-view").style.display = "block";
  document.getElementById("logged-in-view").style.display = "none";
  document.getElementById("dev-user-section").style.display = "block";
  document.getElementById("btn-login").textContent = "Google Login";
  document.getElementById("btn-login").disabled = false;

  // Re-run setup to restore test user or clear
  console.log("[Popup] Logged out, restoring dev user management");
  setupUserIdManagement();
}

// Call setupAuthUI
setupAuthUI();

// Additional logging
window.addEventListener("load", () => {
  console.log("[Popup] window load event fired");
});

console.log("[Popup] Script initialization complete");

/**
 * Developer Tools
 */
const btnReloadExtension = document.getElementById("btn-reload-extension");
if (btnReloadExtension) {
  btnReloadExtension.addEventListener("click", () => {
    // Reload the extension
    chrome.runtime.reload();
  });
}
