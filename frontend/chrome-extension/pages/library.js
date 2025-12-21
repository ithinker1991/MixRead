// MixRead Library Page Script

let currentLibrary = [];
let currentUser = "";
let selectedWords = new Set();
let isSelectMode = false;
let currentFilter = "all";
let searchTerm = "";
let sortOrder = { field: "date", direction: "desc" };

// Auto-load user from URL
function getUserFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get("user");
  if (userId) {
    document.getElementById("currentUser").textContent = userId;
    return userId;
  }
  return null;
}

// Safe URL parsing helper
function safeGetHostname(urlStr) {
  try {
    if (!urlStr) return "Unknown Source";
    const url = new URL(urlStr);
    return url.hostname;
  } catch (e) {
    console.warn("Invalid URL encountered:", urlStr);
    return "Unknown Source";
  }
}

// Load library data
async function loadLibrary() {
  const urlParams = new URLSearchParams(window.location.search);
  let userId = urlParams.get("user") || urlParams.get("user_id");

  if (!userId && typeof chrome !== "undefined" && chrome.storage) {
    // Try to get from storage if not in URL
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(
        ["testUserId", "mixread_user_id", "userId"],
        resolve
      );
    });
    userId = result.testUserId || result.mixread_user_id || result.userId;
  }

  if (!userId) {
    showError(
      "No user ID found. Please set your ID in the extension popup first."
    );
    return;
  }

  currentUser = userId;
  document.getElementById("currentUser").textContent = userId;

  showLoading();

  try {
    const response = await fetch(
      `http://localhost:8000/users/${encodeURIComponent(userId)}/library`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      currentLibrary = data.library || [];
      renderLibrary();
    } else {
      showError(data.error || "Failed to load library");
    }
  } catch (error) {
    showError(`Error loading library: ${error.message}`);
  }
}

// Delete word from library
async function deleteWord(word) {
  try {
    const response = await fetch(
      `http://localhost:8000/users/${encodeURIComponent(
        currentUser
      )}/library/${encodeURIComponent(word)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      showToast(`"${word}" removed from library`);
      currentLibrary = currentLibrary.filter((w) => w.word !== word);
      renderLibrary();
    } else {
      showError(data.error || "Failed to delete word");
    }
  } catch (error) {
    showError(`Error deleting word: ${error.message}`);
  }
}

// Batch delete selected words
async function deleteSelectedWords() {
  if (selectedWords.size === 0) {
    showToast("No words selected");
    return;
  }

  if (!confirm(`Delete ${selectedWords.size} selected word(s)?`)) {
    return;
  }

  let deleted = 0;
  let failed = [];

  for (const word of selectedWords) {
    try {
      const response = await fetch(
        `http://localhost:8000/users/${encodeURIComponent(
          currentUser
        )}/library/${encodeURIComponent(word)}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        deleted++;
      } else {
        failed.push(word);
      }
    } catch (error) {
      failed.push(word);
    }
  }

  if (deleted > 0) {
    showToast(`${deleted} word(s) deleted successfully`);
    if (failed.length > 0) {
      showError(`Failed to delete: ${failed.join(", ")}`);
    }
    currentLibrary = currentLibrary.filter((w) => !selectedWords.has(w.word));
    selectedWords.clear();
    isSelectMode = false;
    updateSelectMode();
    renderLibrary();
  }
}

// Render library as table
function renderLibrary() {
  if (currentLibrary.length === 0) {
    document.getElementById("content").innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No words in library</h3>
                <p>Start adding words to your library from the MixRead extension!</p>
            </div>
        `;
    document.getElementById("wordsTable").style.display = "none";
    document.getElementById("statsSection").style.display = "none";
    return;
  }

  // Show table
  document.getElementById("wordsTable").style.display = "table";
  document.getElementById("content").innerHTML = "";

  // Filter and sort words
  let filteredWords = currentLibrary.filter((word) => {
    // Search filter
    if (
      searchTerm &&
      !word.word.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    // Status filter
    if (currentFilter === "recent") {
      const addedDate = new Date(word.added_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return addedDate > weekAgo;
    }

    if (currentFilter === "learning") {
      return word.status === "learning";
    }

    return true;
  });

  // Sort words
  filteredWords.sort((a, b) => {
    let aVal = a[sortOrder.field];
    let bVal = b[sortOrder.field];

    if (sortOrder.field === "date") {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else if (sortOrder.field === "word") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortOrder.direction === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Update stats
  updateStats();

  // Render table rows
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = filteredWords.map((word) => renderTableRow(word)).join("");

  // Add event listeners
  addEventListeners();
}

// Render table row
function renderTableRow(word) {
  const addedDate = new Date(word.added_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isSelected = selectedWords.has(word.word);
  const contextCount = word.contexts?.length || 0;

  // Extract sentences for preview
  let sentencesPreview = "";
  let sourceInfo = "";

  if (word.contexts && word.contexts.length > 0) {
    // Get all unique sentences from all contexts (up to 3 for preview)
    const allSentences = [];
    word.contexts.forEach((context) => {
      if (context.sentences && context.sentences.length > 0) {
        context.sentences.forEach((sentence) => {
          if (sentence.length > 10 && !allSentences.includes(sentence)) {
            allSentences.push(sentence);
          }
        });
      }
    });

    // Show up to 2 sentences in preview
    const previewSentences = allSentences.slice(0, 2);
    sentencesPreview = previewSentences
      .map((sentence) => {
        const displayText =
          sentence.length > 80 ? sentence.substring(0, 80) + "..." : sentence;
        return `<div class="sentence-item">${displayText}</div>`;
      })
      .join("");

    if (allSentences.length > 2) {
      sentencesPreview += `<div class="more-sentences">+${
        allSentences.length - 2
      } more sentences</div>`;
    }

    // Show source info from first context
    const context = word.contexts[0];
    const domain = safeGetHostname(context.page_url);
    sourceInfo = `
            <a href="${
              context.page_url || "#"
            }" target="_blank" class="source-link">
                <i class="fas fa-link"></i>
                <div class="source-title">${
                  context.page_title || "Untitled"
                }</div>
                <div class="source-domain">${domain}</div>
            </a>
        `;

    if (contextCount > 1) {
      sourceInfo += `<div class="more-sources">+${
        contextCount - 1
      } more sources</div>`;
    }
  }

  return `
        <tr class="${isSelected ? "selected" : ""}" data-word="${word.word}">
            <td>
                <input type="checkbox" class="word-checkbox" data-word="${
                  word.word
                }" ${isSelected ? "checked" : ""}>
            </td>
            <td class="word-cell">${word.word}</td>
            <td class="date-cell">${addedDate}</td>
            <td><span class="status-badge">${
              word.status || "learning"
            }</span></td>
            <td class="sentences-cell">
                ${
                  sentencesPreview ||
                  '<span style="color: #adb5bd;">No sentences</span>'
                }
            </td>
            <td class="source-cell">
                ${
                  sourceInfo || '<span style="color: #adb5bd;">No source</span>'
                }
            </td>
            <td class="actions-cell">
                <button class="action-btn view-btn" data-action="view" data-word="${
                  word.word
                }">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn delete-btn" data-action="delete" data-word="${
                  word.word
                }">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
}

// View all contexts for a word
function viewContexts(word) {
  const wordData = currentLibrary.find((w) => w.word === word);
  if (!wordData || !wordData.contexts) return;

  const modal = document.getElementById("contextModal");
  const modalWord = document.getElementById("modalWord");
  const modalBody = document.getElementById("modalBody");

  modalWord.textContent = word + " - All Contexts";

  // Collect all sentences and group by source
  let allSentencesHtml = "";
  let allSourcesHtml = "";

  // First, show all unique sentences
  const allSentences = new Set();
  const sentenceSources = new Map(); // sentence -> array of sources

  wordData.contexts.forEach((context, index) => {
    const domain = safeGetHostname(context.page_url);
    const sourceInfo = {
      title: context.page_title || "Untitled Page",
      url: context.page_url || "#",
      domain: domain,
      index: index,
    };

    if (context.sentences && context.sentences.length > 0) {
      context.sentences.forEach((sentence) => {
        if (sentence.length > 10) {
          allSentences.add(sentence);

          if (!sentenceSources.has(sentence)) {
            sentenceSources.set(sentence, []);
          }
          sentenceSources.get(sentence).push(sourceInfo);
        }
      });
    }
  });

  // Sentences section
  allSentencesHtml = `
        <div class="modal-section">
            <h4><i class="fas fa-quote-left"></i> Sentences (${
              allSentences.size
            })</h4>
            <div class="sentences-list">
                ${Array.from(allSentences)
                  .map(
                    (sentence, i) => `
                    <div class="sentence-card">
                        <div class="sentence-text">${sentence}</div>
                        <div class="sentence-sources">
                            Found in: ${sentenceSources
                              .get(sentence)
                              .map(
                                (src) =>
                                  `<a href="${
                                    src.url
                                  }" target="_blank" class="source-ref">
                                    <i class="fas fa-link"></i>${src.index + 1}
                                </a>`
                              )
                              .join(" ")}
                        </div>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
    `;

  // Sources section
  allSourcesHtml = `
        <div class="modal-section">
            <h4><i class="fas fa-globe"></i> Sources (${
              wordData.contexts.length
            })</h4>
            <div class="sources-list">
                ${wordData.contexts
                  .map((context, index) => {
                    const domain = safeGetHostname(context.page_url);
                    return `
                        <div class="source-card">
                            <span class="source-number">${index + 1}</span>
                            <a href="${
                              context.page_url || "#"
                            }" target="_blank" class="source-item">
                                <div class="source-item-title">${
                                  context.page_title || "Untitled Page"
                                }</div>
                                <div class="source-item-domain">${domain}</div>
                            </a>
                        </div>
                    `;
                  })
                  .join("")}
            </div>
        </div>
    `;

  modalBody.innerHTML = allSentencesHtml + allSourcesHtml;

  modal.style.display = "block";
}

// Close modal
function closeModal() {
  document.getElementById("contextModal").style.display = "none";
}

// Update stats
function updateStats() {
  const totalWords = currentLibrary.length;
  const totalContexts = currentLibrary.reduce(
    (sum, word) => sum + (word.contexts?.length || 0),
    0
  );
  const learningWords = currentLibrary.filter(
    (w) => w.status === "learning"
  ).length;

  document.getElementById("totalWords").textContent = totalWords;
  document.getElementById("totalContexts").textContent = totalContexts;
  document.getElementById("learningWords").textContent = learningWords;
  document.getElementById("statsSection").style.display = "grid";
}

// Toggle word selection
function toggleWordSelection(word) {
  if (selectedWords.has(word)) {
    selectedWords.delete(word);
  } else {
    selectedWords.add(word);
  }
  updateSelectMode();
}

// Update select mode UI
function updateSelectMode() {
  const selectBtn = document.getElementById("selectBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  const selectAll = document.getElementById("selectAll");
  const checkboxes = document.querySelectorAll(".word-checkbox");

  if (isSelectMode) {
    selectBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
    checkboxes.forEach((cb) => (cb.style.display = "block"));
    selectAll.style.display = "block";
  } else {
    selectBtn.innerHTML = '<i class="fas fa-check-square"></i> Select';
    checkboxes.forEach((cb) => (cb.style.display = "none"));
    selectAll.style.display = "none";
  }

  deleteBtn.disabled = selectedWords.size === 0;
  selectAll.checked = selectedWords.size > 0;

  // Update row classes
  document.querySelectorAll("tbody tr").forEach((row) => {
    const word = row.dataset.word;
    if (selectedWords.has(word)) {
      row.classList.add("selected");
    } else {
      row.classList.remove("selected");
    }
  });
}

// Delete word from table
function deleteWordFromTable(word) {
  if (confirm(`Delete "${word}" from your library?`)) {
    deleteWord(word);
  }
}

// Show loading state
function showLoading() {
  document.getElementById("content").innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>Loading your library...</p>
        </div>
    `;
  document.getElementById("wordsTable").style.display = "none";
  document.getElementById("statsSection").style.display = "none";
}

// Show error message
function showError(message) {
  document.getElementById("content").innerHTML = `
        <div class="error">
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Error:</strong> ${message}
            </div>
        </div>
    `;
  document.getElementById("wordsTable").style.display = "none";
  document.getElementById("statsSection").style.display = "none";
}

// Show toast notification
function showToast(message, duration = 3000) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s ease reverse";
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, duration);
}

// Add event listeners
function addEventListeners() {
  // Search
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderLibrary();
  });

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderLibrary();
    });
  });

  // Sort headers
  document.querySelectorAll("thead th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;

      // Update sort order
      if (sortOrder.field === field) {
        sortOrder.direction = sortOrder.direction === "asc" ? "desc" : "asc";
      } else {
        sortOrder.field = field;
        sortOrder.direction = "asc";
      }

      // Update header classes
      document.querySelectorAll("thead th").forEach((header) => {
        header.classList.remove("sorted-asc", "sorted-desc");
      });
      th.classList.add(`sorted-${sortOrder.direction}`);

      renderLibrary();
    });
  });

  // Select All checkbox
  document.getElementById("selectAll").addEventListener("change", (e) => {
    const checkboxes = document.querySelectorAll(".word-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = e.target.checked;
      const word = cb.dataset.word;
      if (e.target.checked) {
        selectedWords.add(word);
      } else {
        selectedWords.delete(word);
      }
    });
    updateSelectMode();
  });

  // Word checkboxes
  document.querySelectorAll(".word-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const word = e.target.dataset.word;
      if (e.target.checked) {
        selectedWords.add(word);
      } else {
        selectedWords.delete(word);
      }
      updateSelectMode();
    });
  });

  // Select button
  document.getElementById("selectBtn").addEventListener("click", () => {
    isSelectMode = !isSelectMode;
    if (!isSelectMode) {
      selectedWords.clear();
    }
    updateSelectMode();
  });

  // Delete button
  document
    .getElementById("deleteBtn")
    .addEventListener("click", deleteSelectedWords);

  // Table Body Event Delegation (Actions)
  const tableBody = document.getElementById("tableBody");
  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const target = e.target.closest(".action-btn");
      if (!target) return;

      const action = target.dataset.action;
      const word = target.dataset.word;

      if (action === "view") {
        viewContexts(word);
      } else if (action === "delete") {
        deleteWordFromTable(word);
      }
    });
  }

  // Modal Close Button
  const closeModalBtn = document.getElementById("closeModalBtn");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }
}

// Close modal on outside click
window.addEventListener("click", (e) => {
  const modal = document.getElementById("contextModal");
  if (e.target === modal) {
    closeModal();
  }
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadLibrary();
  addEventListeners();
});
