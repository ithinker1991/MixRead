/**
 * API Client - Unified HTTP client for backend communication
 *
 * Handles all API requests to the MixRead backend
 * Manages errors and response formatting
 */

class ApiClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.timeout = 10000; // 10 second timeout
  }

  /**
   * Make an HTTP request
   * @param {string} method - HTTP method (GET, POST, DELETE, etc.)
   * @param {string} path - API path (without base URL)
   * @param {object} data - Request body for POST/PUT/DELETE
   * @returns {Promise<object>} Response JSON
   */
  async request(method, path, data = null) {
    try {
      const url = `${this.baseURL}${path}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[MixRead API] ${method} ${path}`, error);
      throw error;
    }
  }

  // Convenience methods
  get(path) {
    return this.request('GET', path);
  }

  post(path, data) {
    return this.request('POST', path, data);
  }

  put(path, data) {
    return this.request('PUT', path, data);
  }

  delete(path) {
    return this.request('DELETE', path);
  }
}

// Create global API client instance
const apiClient = new ApiClient();
