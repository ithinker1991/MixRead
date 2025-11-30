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

// Helper function to get date X days ago
function getDateXDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
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

// Update stats when vocabulary changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.vocabulary) {
    const newVocab = changes.vocabulary.newValue || [];
    vocabCountDisplay.textContent = newVocab.length;
    totalCountDisplay.textContent = newVocab.length;
  }
});
