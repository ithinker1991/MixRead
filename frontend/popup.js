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

const difficultySlider = document.getElementById("difficulty-slider");
const currentLevelDisplay = document.getElementById("current-level");
const vocabCountDisplay = document.getElementById("vocab-count");
const todayCountDisplay = document.getElementById("today-count");
const totalCountDisplay = document.getElementById("total-count");
const toggleChinese = document.getElementById("toggle-chinese");

const btnViewVocab = document.getElementById("btn-view-vocabulary");
const btnResetVocab = document.getElementById("btn-reset-vocab");

// Load and display current settings
chrome.storage.local.get(
  ["difficultyLevel", "vocabulary", "vocabulary_dates", "showChinese"],
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

    for (const word in dates) {
      if (dates[word] === today) {
        todayCount++;
      }
    }
    todayCountDisplay.textContent = todayCount;
  }
);

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

// Update stats when vocabulary changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.vocabulary) {
    const newVocab = changes.vocabulary.newValue || [];
    vocabCountDisplay.textContent = newVocab.length;
    totalCountDisplay.textContent = newVocab.length;
  }
});
