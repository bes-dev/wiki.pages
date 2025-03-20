/**
 * Content Service
 * 
 * Handles content retrieval and management from GitHub repository
 */

export class ContentService {
  constructor() {
    // Storage for caching
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  /**
   * Get configuration from main application
   */
  getConfig() {
    if (window.wikiApp && window.wikiApp.config) {
      return window.wikiApp.config;
    }
    
    return {
      contentRepo: '',
      defaultBranch: 'main'
    };
  }

  /**
   * Get authentication token from AuthService
   */
  getAuthToken() {
    if (window.wikiApp && window.wikiApp.auth) {
      return window.wikiApp.auth.getToken();
    }
    
    return null;
  }

  /**
   * Generate API URL for the GitHub content API
   * @param {string} path - The path to the file
   * @returns {string} - The API URL
   */
  getApiUrl(path) {
    const config = this.getConfig();
    if (!config.contentRepo) {
      throw new Error('Content repository is not configured');
    }
    
    return `https://api.github.com/repos/${config.contentRepo}/contents/${path}?ref=${config.defaultBranch}`;
  }

  /**
   * Fetch a file from GitHub
   * @param {string} path - The path to the file
   * @returns {Promise<string>} - The file content
   */
  async getFile(path) {
    // Normalize path
    path = this.normalizePath(path);
    
    // Check cache first
    const cachedContent = this.getFromCache(path);
    if (cachedContent) {
      return cachedContent;
    }
    
    try {
      const url = this.getApiUrl(path);
      const headers = {
        'Accept': 'application/vnd.github.v3.raw'
      };
      
      // Add authentication if available
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // File not found
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const content = await response.text();
      
      // Cache the content
      this.addToCache(path, content);
      
      return content;
    } catch (error) {
      console.error(`Error fetching file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Save a file to GitHub
   * @param {string} path - The path to the file
   * @param {string} content - The file content
   * @param {string} message - The commit message
   * @returns {Promise<Object>} - The response from GitHub
   */
  async saveFile(path, content, message = 'Update file') {
    // Normalize path
    path = this.normalizePath(path);
    
    // Check if user is authenticated
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('User is not authenticated');
    }
    
    try {
      const config = this.getConfig();
      const url = this.getApiUrl(path);
      
      // First, try to get the file to check if it exists and get its SHA
      let sha = null;
      try {
        const fileResponse = await fetch(url, {
          headers: {
            'Authorization': `token ${token}`
          }
        });
        
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          sha = fileData.sha;
        }
      } catch (error) {
        // File doesn't exist, which is fine for creating a new file
        console.log(`Creating new file at ${path}`);
      }
      
      // Prepare request body
      const requestBody = {
        message,
        content: btoa(content), // Base64 encode content
        branch: config.defaultBranch
      };
      
      // Include SHA if updating existing file
      if (sha) {
        requestBody.sha = sha;
      }
      
      // Make request to update or create file
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
      }
      
      const responseData = await response.json();
      
      // Update cache
      this.addToCache(path, content);
      
      return responseData;
    } catch (error) {
      console.error(`Error saving file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get file history from GitHub
   * @param {string} path - The path to the file
   * @returns {Promise<Array>} - The commit history
   */
  async getFileHistory(path) {
    // Normalize path
    path = this.normalizePath(path);
    
    try {
      const config = this.getConfig();
      const url = `https://api.github.com/repos/${config.contentRepo}/commits?path=${path}&sha=${config.defaultBranch}`;
      
      const headers = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      // Add authentication if available
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error getting history for ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get directory contents from GitHub
   * @param {string} path - The directory path
   * @returns {Promise<Array>} - The directory contents
   */
  async getDirectoryContents(path = '') {
    // Normalize path
    path = this.normalizePath(path);
    
    try {
      const url = this.getApiUrl(path);
      const headers = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      // Add authentication if available
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          return []; // Directory not found
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const contents = await response.json();
      
      // Filter out non-markdown files and directories
      return Array.isArray(contents) ? contents : [contents];
    } catch (error) {
      console.error(`Error getting directory contents for ${path}:`, error);
      throw error;
    }
  }

  /**
   * Normalize a file path
   * @param {string} path - The path to normalize
   * @returns {string} - The normalized path
   */
  normalizePath(path) {
    // Remove leading and trailing slashes
    path = path.replace(/^\/+|\/+$/g, '');
    
    // Add .md extension if not present and not a directory
    if (path && !path.endsWith('/') && !path.includes('.')) {
      path = `${path}.md`;
    }
    
    return path;
  }

  /**
   * Add content to cache
   * @param {string} path - The file path
   * @param {string} content - The file content
   */
  addToCache(path, content) {
    this.cache.set(path, {
      content,
      timestamp: Date.now()
    });
  }

  /**
   * Get content from cache
   * @param {string} path - The file path
   * @returns {string|null} - The cached content or null if not in cache or expired
   */
  getFromCache(path) {
    const cached = this.cache.get(path);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(path);
      return null;
    }
    
    return cached.content;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}