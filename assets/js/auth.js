/**
 * Authentication Service
 * 
 * Handles GitHub OAuth authentication and token management
 */

export class AuthService {
  constructor() {
    // GitHub OAuth configuration
    this.clientId = 'YOUR_GITHUB_CLIENT_ID'; // Replace with your actual client ID
    this.redirectUri = `${window.location.origin}/callback.html`;
    this.scope = 'repo';
    this.proxyUrl = 'https://your-token-exchange-proxy.com/exchange'; // Replace with your proxy URL
    
    // Authentication state
    this.token = null;
    this.userInfo = null;
  }

  /**
   * Check if the user is authenticated
   * @returns {boolean} - True if the user is authenticated
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Get the user's information
   * @returns {Object|null} - User information if authenticated, null otherwise
   */
  getUserInfo() {
    return this.userInfo || {};
  }

  /**
   * Get the authentication token
   * @returns {string|null} - The token if authenticated, null otherwise
   */
  getToken() {
    return this.token;
  }

  /**
   * Check the user's authentication status
   */
  async checkAuthStatus() {
    // Try to get token from localStorage
    const token = localStorage.getItem('github_token');
    if (!token) return;
    
    // Check token expiration
    const authTime = localStorage.getItem('auth_time');
    if (authTime) {
      const expirationTime = parseInt(authTime, 10) + (3600 * 1000); // 1 hour expiration
      if (Date.now() > expirationTime) {
        this.logout();
        return;
      }
    }
    
    // Set token
    this.token = token;
    
    // Try to get user info
    try {
      await this.fetchUserInfo();
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      this.logout();
    }
  }

  /**
   * Initiate the GitHub OAuth login process
   */
  initiateLogin() {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${this.scope}`;
    window.location.href = authUrl;
  }

  /**
   * Fetch user information from GitHub API
   */
  async fetchUserInfo() {
    if (!this.token) return;
    
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      this.userInfo = await response.json();
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw error;
    }
  }

  /**
   * Exchange OAuth code for access token using the proxy
   * @param {string} code - The authorization code from GitHub
   * @returns {Promise<string>} - The access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });
      
      if (!response.ok) {
        throw new Error(`Proxy server error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`OAuth error: ${data.error}`);
      }
      
      return data.access_token;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Log the user out
   */
  logout() {
    // Clear authentication state
    this.token = null;
    this.userInfo = null;
    
    // Clear localStorage
    localStorage.removeItem('github_token');
    localStorage.removeItem('auth_time');
  }
}