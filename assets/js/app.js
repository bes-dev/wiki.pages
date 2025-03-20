/**
 * Main Application
 * 
 * This file contains the core functionality for the GitHub Wiki application
 */

import { AuthService } from './auth.js';
import { ContentService } from './content.js';
import { NavigationService } from './navigation.js';
import { UIService } from './ui.js';
import { SearchService } from './search.js';

class App {
  constructor() {
    // Initialize services
    this.auth = new AuthService();
    this.content = new ContentService();
    this.navigation = new NavigationService(this);
    this.ui = new UIService();
    this.search = new SearchService();
    
    // App configuration
    this.config = {
      title: 'GitHub Wiki',
      description: 'A static wiki engine based on GitHub Pages',
      contentRepo: '',
      defaultBranch: 'main'
    };
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Load configuration
      await this.loadConfig();
      
      // Set up UI event listeners
      this.setupEventListeners();
      
      // Check authentication status
      await this.auth.checkAuthStatus();
      
      // Update UI based on auth state
      this.updateAuthUI();
      
      // Initialize navigation
      await this.navigation.init();
      
      // Load current page or home page
      const path = this.navigation.getCurrentPath();
      if (path) {
        await this.loadPage(path);
      } else {
        await this.loadHomePage();
      }
    } catch (error) {
      console.error('Application initialization error:', error);
      this.showError('Failed to initialize the application. Please try again later.');
    }
  }

  /**
   * Load application configuration
   */
  async loadConfig() {
    try {
      // Try to load config from content repository
      const configData = await this.content.getFile('.wiki-config.json');
      if (configData) {
        const config = JSON.parse(configData);
        this.config = { ...this.config, ...config };
        
        // Update page title
        document.title = this.config.title;
        
        // Set title in sidebar
        const titleElement = document.querySelector('.sidebar-header h1');
        if (titleElement) {
          titleElement.textContent = this.config.title;
        }
      }
    } catch (error) {
      console.warn('Could not load configuration, using defaults:', error);
    }
  }

  /**
   * Set up event listeners for UI interactions
   */
  setupEventListeners() {
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        this.ui.toggleSidebar();
      });
    }
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.ui.toggleTheme();
      });
    }
    
    // Login/Logout
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
      loginButton.addEventListener('click', () => {
        this.auth.initiateLogin();
      });
    }
    
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.auth.logout();
        this.updateAuthUI();
      });
    }
    
    // Search
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput && searchButton) {
      searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
          this.search.performSearch(query);
        }
      });
      
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = searchInput.value.trim();
          if (query) {
            this.search.performSearch(query);
          }
        }
      });
    }
    
    // Article actions
    const editButton = document.getElementById('edit-button');
    if (editButton) {
      editButton.addEventListener('click', () => {
        const path = this.navigation.getCurrentPath();
        if (path) {
          window.location.href = `/edit.html?path=${encodeURIComponent(path)}`;
        }
      });
    }
    
    const historyButton = document.getElementById('history-button');
    if (historyButton) {
      historyButton.addEventListener('click', async () => {
        const path = this.navigation.getCurrentPath();
        if (path) {
          try {
            const history = await this.content.getFileHistory(path);
            this.ui.showHistoryDialog(history, path);
          } catch (error) {
            console.error('Failed to get file history:', error);
            this.showError('Could not retrieve file history.');
          }
        }
      });
    }
  }

  /**
   * Update UI based on authentication state
   */
  updateAuthUI() {
    const isAuthenticated = this.auth.isAuthenticated();
    const loginButton = document.getElementById('login-button');
    const userProfile = document.getElementById('user-profile');
    
    if (loginButton && userProfile) {
      if (isAuthenticated) {
        loginButton.classList.add('hidden');
        userProfile.classList.remove('hidden');
        
        // Update user profile information
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
          userAvatar.src = this.auth.getUserInfo().avatar_url || '';
        }
        
        // Show edit/admin buttons
        const editButton = document.getElementById('edit-button');
        if (editButton) {
          editButton.classList.remove('hidden');
        }
      } else {
        loginButton.classList.remove('hidden');
        userProfile.classList.add('hidden');
        
        // Hide edit/admin buttons
        const editButton = document.getElementById('edit-button');
        if (editButton) {
          editButton.classList.add('hidden');
        }
      }
    }
  }

  /**
   * Load the home page
   */
  async loadHomePage() {
    try {
      // Update navigation location
      this.navigation.setActivePath('home');
      
      // Load home page content
      const content = await this.content.getFile('home.md');
      if (content) {
        this.renderContent(content);
      } else {
        this.renderContent(`# Welcome to ${this.config.title}\n\nThis is a new wiki. Get started by creating content!`);
      }
    } catch (error) {
      console.error('Failed to load home page:', error);
      this.showError('Could not load the home page content.');
    }
  }

  /**
   * Load a specific page
   * @param {string} path - The path to the page
   */
  async loadPage(path) {
    try {
      // Update navigation
      this.navigation.setActivePath(path);
      
      // Generate breadcrumbs
      if (typeof this.navigation.updateBreadcrumbs === 'function') {
        this.navigation.updateBreadcrumbs(path);
      }
      
      // Load page content
      const content = await this.content.getFile(path);
      if (content) {
        this.renderContent(content);
      } else {
        this.showPageNotFound(path);
      }
    } catch (error) {
      console.error(`Failed to load page ${path}:`, error);
      this.showError(`Could not load the requested page "${path}".`);
    }
  }

  /**
   * Render markdown content to HTML and update the DOM
   * @param {string} markdownContent - The markdown content to render
   */
  renderContent(markdownContent) {
    // Parse front matter if present
    const { content, metadata } = this.parseFrontMatter(markdownContent);
    
    // Get content container
    const contentElement = document.getElementById('article-content') || document.getElementById('content');
    if (!contentElement) return;
    
    // Render markdown to HTML
    try {
      // Extract the title from the first heading if available
      let title = '';
      const titleMatch = content.match(/^# (.+)$/m);
      if (titleMatch) {
        title = titleMatch[1];
      } else if (metadata && metadata.title) {
        title = metadata.title;
      }
      
      // Update page title
      if (title) {
        document.title = `${title} - ${this.config.title}`;
      }
      
      // Render markdown
      contentElement.innerHTML = marked.parse(content);
      contentElement.classList.add('markdown-content');
      
      // Generate table of contents
      this.generateTableOfContents(contentElement);
      
      // Apply syntax highlighting if available
      if (window.Prism) {
        Prism.highlightAll();
      }
    } catch (error) {
      console.error('Error rendering markdown:', error);
      contentElement.innerHTML = `<p class="error">Error rendering content. Please try again later.</p>`;
    }
  }

  /**
   * Parse front matter from markdown content
   * @param {string} content - The markdown content
   * @returns {Object} - Object containing the content and metadata
   */
  parseFrontMatter(content) {
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    
    if (match) {
      try {
        // Simple YAML front matter parsing
        const yamlText = match[1];
        const metadata = {};
        
        // Parse each line
        yamlText.split('\n').forEach(line => {
          const keyValue = line.split(':');
          if (keyValue.length >= 2) {
            const key = keyValue[0].trim();
            const value = keyValue.slice(1).join(':').trim();
            
            // Handle arrays in the format key: [value1, value2]
            if (value.startsWith('[') && value.endsWith(']')) {
              const arrayValues = value.slice(1, -1).split(',');
              metadata[key] = arrayValues.map(v => v.trim());
            } else {
              metadata[key] = value;
            }
          }
        });
        
        return {
          metadata,
          content: match[2]
        };
      } catch (error) {
        console.warn('Error parsing front matter, treating as regular content:', error);
        return { content };
      }
    }
    
    return { content };
  }

  /**
   * Generate table of contents from content headings
   * @param {HTMLElement} contentElement - The content element
   */
  generateTableOfContents(contentElement) {
    const tocElement = document.getElementById('toc-content');
    if (!tocElement) return;
    
    // Get all headings
    const headings = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
      tocElement.innerHTML = '<p class="toc-empty">No headings found in this article.</p>';
      return;
    }
    
    // Create TOC structure
    const toc = document.createElement('ul');
    toc.className = 'toc-list';
    
    // Process headings
    headings.forEach((heading, index) => {
      // Add ID to heading if not present
      if (!heading.id) {
        heading.id = `heading-${index}`;
      }
      
      // Create TOC item
      const level = parseInt(heading.tagName.substring(1));
      const listItem = document.createElement('li');
      listItem.className = `toc-list-item toc-level-${level}`;
      
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      
      listItem.appendChild(link);
      toc.appendChild(listItem);
    });
    
    tocElement.innerHTML = '';
    tocElement.appendChild(toc);
  }

  /**
   * Show page not found message
   * @param {string} path - The path that was not found
   */
  showPageNotFound(path) {
    const contentElement = document.getElementById('article-content') || document.getElementById('content');
    if (!contentElement) return;
    
    contentElement.innerHTML = `
      <div class="not-found">
        <h1>Page Not Found</h1>
        <p>The page "${path}" does not exist yet.</p>
        ${this.auth.isAuthenticated() ? 
          `<p><a href="/edit.html?path=${encodeURIComponent(path)}" class="action-button">Create this page</a></p>` : 
          '<p>Sign in to create this page.</p>'}
      </div>
    `;
    
    document.title = `Page Not Found - ${this.config.title}`;
  }

  /**
   * Show error message
   * @param {string} message - The error message to display
   */
  showError(message) {
    const contentElement = document.getElementById('article-content') || document.getElementById('content');
    if (!contentElement) return;
    
    contentElement.innerHTML = `
      <div class="error-message">
        <h1>Error</h1>
        <p>${message}</p>
      </div>
    `;
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.wikiApp = app; // Make app instance accessible globally
  app.init();
});

// Handle navigation within the SPA
window.addEventListener('popstate', (event) => {
  if (window.wikiApp) {
    const path = window.wikiApp.navigation.getCurrentPath();
    if (path) {
      window.wikiApp.loadPage(path);
    } else {
      window.wikiApp.loadHomePage();
    }
  }
});