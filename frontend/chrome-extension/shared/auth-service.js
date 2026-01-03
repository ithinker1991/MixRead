/**
 * Auth Service - Handles Google Authentication and Session Management
 *
 * Requirements covered:
 * - 2.1, 2.2, 2.6: Google login flow with chrome.identity API
 * - 3.1, 3.2: Session persistence check
 * - 3.3: Logout and session clearing
 * - 4.1: Handle OAuth cancellation gracefully
 * - 4.3: Handle network errors with clear messages
 */

class AuthService {
  constructor() {
    this.tokenKey = "auth_token";
    this.userKey = "auth_user";
  }

  /**
   * Initiate Google Login Flow (Requirements 2.1, 2.2, 2.6)
   * Uses chrome.identity.getAuthToken to get Google token,
   * sends to backend /auth/google, and stores session in chrome.storage
   *
   * @returns {Promise<object>} User session data
   * @throws {Error} With specific error types for different failure scenarios
   */
  async login() {
    try {
      // 1. Get Google ID Token via Chrome Identity API (Req 2.1)
      const token = await this._getAuthToken();
      if (!token) {
        throw new Error("Failed to get Google Token");
      }

      // 2. Exchange ID Token for Session Token with Backend (Req 2.2)
      const session = await this._backendLogin(token);

      // 3. Save Session to chrome.storage (Req 2.6)
      await this._saveSession(session);

      return session;
    } catch (error) {
      // Handle user cancellation gracefully (Req 4.1)
      if (this._isUserCancellation(error)) {
        console.log("User cancelled OAuth flow");
        // Return null instead of throwing - caller should handle gracefully
        return null;
      }

      // Handle network errors (Req 4.3)
      if (this._isNetworkError(error)) {
        const networkError = new Error("Cannot connect to server");
        networkError.code = "NETWORK_ERROR";
        throw networkError;
      }

      // Re-throw other errors with context
      console.error("Login failed:", error);
      throw error;
    }
  }

  /**
   * Logout and clear all session data (Requirement 3.3)
   * Clears chrome.storage and optionally revokes the cached auth token
   */
  async logout() {
    try {
      // Get current token before clearing (for revocation)
      const currentToken = await this.getToken();

      // Clear local storage - both token and user data
      await chrome.storage.local.remove([this.tokenKey, this.userKey]);

      // Revoke cached Google auth token if available
      if (currentToken) {
        try {
          // Also try to remove the Google OAuth token from cache
          const googleToken = await this._getCachedGoogleToken();
          if (googleToken) {
            await this._removeCachedAuthToken(googleToken);
          }
        } catch (revokeError) {
          // Token revocation is optional, don't fail logout if it fails
          console.warn("Failed to revoke cached token:", revokeError);
        }
      }

      console.log("Logout successful");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  /**
   * Check if user is currently logged in (Requirements 3.1, 3.2)
   * Checks chrome.storage for existing valid session
   *
   * @returns {Promise<boolean>} True if valid session exists
   */
  async isLoggedIn() {
    try {
      const token = await this.getToken();
      const user = await this.getUser();

      // Both token and user data must exist for valid session
      return !!(token && user && user.user_id);
    } catch (error) {
      console.error("Error checking login status:", error);
      return false;
    }
  }

  /**
   * Get current authenticated user
   * @returns {Promise<object|null>} User data or null if not logged in
   */
  async getUser() {
    try {
      const result = await chrome.storage.local.get(this.userKey);
      return result[this.userKey] || null;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }

  /**
   * Get backend access token
   * @returns {Promise<string|null>} Access token or null if not logged in
   */
  async getToken() {
    try {
      const result = await chrome.storage.local.get(this.tokenKey);
      return result[this.tokenKey] || null;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  /**
   * Private: Get Auth Token from Chrome Identity API
   * Uses launchWebAuthFlow for unpacked extensions (development)
   * @returns {Promise<string>} Google OAuth token
   */
  async _getAuthToken() {
    // Check if chrome.identity API is available
    if (!chrome.identity) {
      const error = new Error(
        "Google Login not configured. Please add 'identity' permission to manifest.json."
      );
      error.code = "OAUTH_NOT_CONFIGURED";
      throw error;
    }

    // For unpacked/development extensions, use launchWebAuthFlow
    // getAuthToken only works for extensions published to Chrome Web Store
    return this._launchWebAuthFlow();
  }

  /**
   * Private: Launch Web Auth Flow for OAuth
   * This works for unpacked extensions during development
   * @returns {Promise<string>} Google access token
   */
  async _launchWebAuthFlow() {
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id;

    if (!clientId) {
      throw new Error("OAuth2 client_id not configured in manifest.json");
    }

    const redirectUri = chrome.identity.getRedirectURL();
    const scopes = (manifest.oauth2?.scopes || []).join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", scopes);

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (!responseUrl) {
            reject(new Error("No response from Google OAuth"));
            return;
          }

          // Extract access token from URL fragment
          const url = new URL(responseUrl);
          const params = new URLSearchParams(url.hash.substring(1));
          const accessToken = params.get("access_token");

          if (accessToken) {
            resolve(accessToken);
          } else {
            const error = params.get("error");
            reject(new Error(error || "Failed to get access token"));
          }
        }
      );
    });
  }

  /**
   * Private: Get cached Google token (non-interactive)
   * @returns {Promise<string|null>} Cached token or null
   */
  async _getCachedGoogleToken() {
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError || !token) {
          resolve(null);
        } else {
          resolve(token);
        }
      });
    });
  }

  /**
   * Private: Remove cached auth token
   * @param {string} token - Token to remove from cache
   */
  async _removeCachedAuthToken(token) {
    return new Promise((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Private: Exchange token with backend
   * @param {string} googleToken - Google OAuth token
   * @returns {Promise<object>} Session data from backend
   */
  async _backendLogin(googleToken) {
    try {
      // Use the global apiClient if available, otherwise fetch directly
      if (window.apiClient) {
        return await window.apiClient.post("/auth/google", {
          token: googleToken,
        });
      } else {
        // Fallback fetch if apiClient not ready
        const response = await fetch("http://localhost:8000/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: googleToken }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.detail || "Backend login failed");
          error.status = response.status;
          throw error;
        }

        return await response.json();
      }
    } catch (error) {
      // Check if this is a network error (fetch failed entirely)
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        const networkError = new Error("Cannot connect to server");
        networkError.code = "NETWORK_ERROR";
        throw networkError;
      }
      throw error;
    }
  }

  /**
   * Private: Save session data to chrome.storage
   * @param {object} session - Session data from backend
   */
  async _saveSession(session) {
    await chrome.storage.local.set({
      [this.tokenKey]: session.access_token,
      [this.userKey]: {
        user_id: session.user_id,
        email: session.email,
        name: session.name,
        avatar: session.avatar,
      },
    });
  }

  /**
   * Private: Check if error is due to user cancellation (Req 4.1)
   * @param {Error} error - Error to check
   * @returns {boolean} True if user cancelled OAuth flow
   */
  _isUserCancellation(error) {
    if (!error) return false;

    const message = error.message || "";
    const errorString = String(error);

    // Chrome identity API cancellation messages
    return (
      message.includes("The user did not approve") ||
      message.includes("User cancelled") ||
      message.includes("canceled") ||
      message.includes("cancelled") ||
      errorString.includes("The user did not approve") ||
      errorString.includes("User cancelled")
    );
  }

  /**
   * Private: Check if error is a network error (Req 4.3)
   * Detects when backend is unreachable
   * @param {Error} error - Error to check
   * @returns {boolean} True if network error (backend unreachable)
   */
  _isNetworkError(error) {
    if (!error) return false;

    // Check for explicit network error code
    if (error.code === "NETWORK_ERROR") return true;

    // Check for fetch/network related errors
    const message = error.message || "";
    const errorName = error.name || "";

    return (
      errorName === "TypeError" ||
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("Network request failed") ||
      message.includes("ERR_CONNECTION_REFUSED") ||
      message.includes("ECONNREFUSED") ||
      message.includes("net::ERR_")
    );
  }
}

// Create global AuthService instance
window.authService = new AuthService();
