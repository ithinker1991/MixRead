// MixRead Review Page Script

// Initialize review manager
const userId =
  new URLSearchParams(window.location.search).get("user_id") || "test_user";

console.log(`[Review Page] Initializing for user: ${userId}`);

let reviewManager;
try {
  if (typeof ReviewManager === "undefined") {
    throw new Error(
      "ReviewManager class is not defined. Script might have failed to load."
    );
  }
  reviewManager = new ReviewManager(userId);
  console.log("[Review Page] ReviewManager initialized successfully");
} catch (error) {
  console.error(
    "[Review Page] Critical error initializing ReviewManager:",
    error
  );
  alert(`Error: ${error.message}`);
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Review Page] DOM Content Loaded");

  // Session selector buttons
  const mixedBtn = document.getElementById("mixed-btn");
  const newBtn = document.getElementById("new-btn");
  const reviewBtn = document.getElementById("review-btn");

  if (mixedBtn) {
    mixedBtn.addEventListener("click", () => {
      console.log("[Review Page] Mixed button clicked");
      startReviewSession("mixed");
    });
  } else {
    console.error("[Review Page] Mixed button not found in DOM");
  }

  if (newBtn) {
    newBtn.addEventListener("click", () => {
      console.log("[Review Page] New button clicked");
      startReviewSession("new");
    });
  }

  if (reviewBtn) {
    reviewBtn.addEventListener("click", () => {
      console.log("[Review Page] Review button clicked");
      startReviewSession("review");
    });
  }
});

async function startReviewSession(sessionType) {
  if (!reviewManager) {
    console.error("[Review Page] ReviewManager is not initialized");
    alert(
      "Cannot start session: Review system not initialized properly. Please refresh the page."
    );
    return;
  }

  try {
    console.log(`[Review Page] Requesting start of session: ${sessionType}`);
    // Show loading state
    const container = document.getElementById("review-container");
    if (container) {
      const originalContent = container.innerHTML;
      container.innerHTML =
        '<div style="text-align:center; padding:40px;"><h2>⏳ Starting Session...</h2></div>';

      try {
        // Load template
        const template = document.getElementById("review-session-template");

        // Start session via manager
        await reviewManager.startSession(sessionType);
      } catch (innerError) {
        // Restore content if failed
        container.innerHTML = originalContent;
        // Note: If we restore content, we might lose event listeners if we're not careful,
        // but since the original content was static HTML from the initial load,
        // and listeners were attached to IDs, we'd need to re-attach them if we just set innerHTML back.
        // However, simpler is just to reload or show error.
        throw innerError;
      }
    } else {
      // Just start if no container (unlikely)
      await reviewManager.startSession(sessionType);
    }
  } catch (error) {
    console.error("[Review Page] Failed to start review:", error);
    if (reviewManager) {
      reviewManager.showError(
        `Failed to start review session: ${error.message}`
      );
    }
    alert(`Failed to start review session: ${error.message}`);

    // Reload page to reset state
    setTimeout(() => window.location.reload(), 2000);
  }
}

console.log(`
    ╔════════════════════════════════╗
    ║   MixRead Review Shortcuts      ║
    ╠════════════════════════════════╣
    ║  Space - Show answer            ║
    ║  1     - Again (< 1 day)        ║
    ║  2     - Hard (3 days)          ║
    ║  3     - Good (1 week)          ║
    ║  4     - Easy (2 weeks)         ║
    ║  4     - Easy (2 weeks)         ║
    ╚════════════════════════════════╝
`);
