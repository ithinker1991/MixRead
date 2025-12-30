/**
 * Auth Service - Handles Google Authentication and Session Management
 */

class AuthService {
  constructor() {
    this.tokenKey = "auth_token";
    this.userKey = "auth_user";
  }

  /**
   * Initiate Google Login Flow
   * @returns {Promise<object>} User session data
   */
  async login() {
    try {
      // 1. Get Google ID Token via Chrome Identity API
      const token = await this._getAuthToken();
      if (!token) {
        throw new Error("Failed to get Google Token");
      }

      // 2. Exchange ID Token for Session Token with Backend
      const session = await this._backendLogin(token);

      // 3. Save Session
      await this._saveSession(session);

      return session;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout() {
    // Clear local storage
    await chrome.storage.local.remove([this.tokenKey, this.userKey]);

    // Revoke token (optional, good practice)
    // chrome.identity.removeCachedAuthToken({ token: current_access_token }, ...);
  }

  /**
   * Get current authenticated user
   */
  async getUser() {
    const result = await chrome.storage.local.get(this.userKey);
    return result[this.userKey];
  }

  /**
   * Get backend access token
   */
  async getToken() {
    const result = await chrome.storage.local.get(this.tokenKey);
    return result[this.tokenKey];
  }

  /**
   * Private: Get Auth Token from Chrome Identity
   */
  async _getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  }

  /**
   * Private: Exchange token with backend
   */
  async _backendLogin(googleToken) {
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
      if (!response.ok) throw new Error("Backend login failed");
      return await response.json();
    }
  }

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
}

window.authService = new AuthService();
