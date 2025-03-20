/**
 * UI Service
 * 
 * Handles UI-related functionality such as theme switching, dialogs, and UI state
 */

export class UIService {
  constructor() {
    this.themeKey = 'wiki_theme';
    this.initTheme();
  }

  /**
   * Initialize theme based on user preference or system preference
   */
  initTheme() {
    const savedTheme = localStorage.getItem(this.themeKey);
    
    if (savedTheme) {
      // Use saved theme preference
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(this.themeKey, newTheme);
  }

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('sidebar-collapsed');
    }
  }

  /**
   * Show a dialog with the given content
   * @param {string} title - The dialog title
   * @param {string} content - The dialog content (HTML)
   * @param {Array} buttons - Array of button configurations
   */
  showDialog(title, content, buttons = []) {
    // Create dialog element if it doesn't exist
    let dialogContainer = document.getElementById('dialog-container');
    if (!dialogContainer) {
      dialogContainer = document.createElement('div');
      dialogContainer.id = 'dialog-container';
      document.body.appendChild(dialogContainer);
    }
    
    // Create dialog content
    const dialogHTML = `
      <div class="dialog-overlay"></div>
      <div class="dialog">
        <div class="dialog-header">
          <h2>${title}</h2>
          <button class="dialog-close" aria-label="Close">&times;</button>
        </div>
        <div class="dialog-content">
          ${content}
        </div>
        <div class="dialog-footer">
          ${buttons.map(button => `
            <button 
              class="dialog-button ${button.primary ? 'primary' : ''}" 
              data-action="${button.action || 'close'}"
              ${button.attributes ? button.attributes.join(' ') : ''}
            >
              ${button.text}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    // Set dialog HTML
    dialogContainer.innerHTML = dialogHTML;
    
    // Show the dialog
    dialogContainer.classList.add('active');
    
    // Set up event listeners
    const closeButton = dialogContainer.querySelector('.dialog-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.closeDialog());
    }
    
    const overlay = dialogContainer.querySelector('.dialog-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeDialog());
    }
    
    // Handle button actions
    const dialogButtons = dialogContainer.querySelectorAll('.dialog-button');
    dialogButtons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        
        if (action === 'close') {
          this.closeDialog();
        } else {
          // Find the button configuration
          const buttonConfig = buttons.find(b => b.action === action);
          if (buttonConfig && buttonConfig.handler) {
            buttonConfig.handler();
          }
        }
      });
    });
    
    // Return the dialog container for further manipulation
    return dialogContainer;
  }

  /**
   * Close the dialog
   */
  closeDialog() {
    const dialogContainer = document.getElementById('dialog-container');
    if (dialogContainer) {
      dialogContainer.classList.remove('active');
    }
  }

  /**
   * Show a toast notification
   * @param {string} message - The notification message
   * @param {string} type - The notification type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds to show the notification
   */
  showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.classList.add('active');
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('active');
      
      // Remove from DOM after animation
      setTimeout(() => {
        toastContainer.removeChild(toast);
      }, 300);
    }, duration);
  }

  /**
   * Show a confirmation dialog
   * @param {string} message - The confirmation message
   * @param {Function} onConfirm - Callback function on confirm
   * @param {Function} onCancel - Callback function on cancel
   */
  showConfirmation(message, onConfirm, onCancel) {
    return this.showDialog('Confirm', `<p>${message}</p>`, [
      {
        text: 'Cancel',
        action: 'cancel',
        handler: onCancel
      },
      {
        text: 'Confirm',
        action: 'confirm',
        primary: true,
        handler: onConfirm
      }
    ]);
  }

  /**
   * Show file history dialog
   * @param {Array} history - Array of commit objects
   * @param {string} path - The file path
   */
  showHistoryDialog(history, path) {
    if (!history || history.length === 0) {
      this.showToast('No history available for this file', 'info');
      return;
    }
    
    const historyItems = history.map(commit => `
      <div class="history-item">
        <div class="history-info">
          <div class="history-author">
            <img src="${commit.author?.avatar_url || ''}" alt="Avatar" class="history-avatar">
            <span>${commit.commit.author.name}</span>
          </div>
          <div class="history-date">${new Date(commit.commit.author.date).toLocaleString()}</div>
        </div>
        <div class="history-message">${commit.commit.message}</div>
        <div class="history-actions">
          <button class="history-view-button" data-sha="${commit.sha}" data-path="${path}">View this version</button>
        </div>
      </div>
    `).join('');
    
    const dialogContent = `
      <div class="history-container">
        <h3>History for ${path}</h3>
        <div class="history-list">
          ${historyItems}
        </div>
      </div>
    `;
    
    const dialog = this.showDialog('File History', dialogContent, [
      {
        text: 'Close',
        action: 'close'
      }
    ]);
    
    // Add event listeners for view buttons
    const viewButtons = dialog.querySelectorAll('.history-view-button');
    viewButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const sha = button.getAttribute('data-sha');
        const filePath = button.getAttribute('data-path');
        
        try {
          await this.viewHistoricalVersion(filePath, sha);
          this.closeDialog();
        } catch (error) {
          console.error('Failed to view historical version:', error);
          this.showToast('Failed to load historical version', 'error');
        }
      });
    });
  }

  /**
   * View a historical version of a file
   * @param {string} path - The file path
   * @param {string} sha - The commit SHA
   */
  async viewHistoricalVersion(path, sha) {
    if (!window.wikiApp) return;
    
    try {
      const config = window.wikiApp.config;
      const url = `https://api.github.com/repos/${config.contentRepo}/contents/${path}?ref=${sha}`;
      
      const headers = {
        'Accept': 'application/vnd.github.v3.raw'
      };
      
      // Add authentication if available
      const token = window.wikiApp.auth.getToken();
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const content = await response.text();
      
      // Show this content with a header indicating it's a historical version
      const contentElement = document.getElementById('article-content') || document.getElementById('content');
      if (contentElement) {
        // Remember original content to enable restoration
        if (!window.originalContent) {
          window.originalContent = contentElement.innerHTML;
        }
        
        // Create a banner to indicate historical version
        const banner = document.createElement('div');
        banner.className = 'historical-banner';
        banner.innerHTML = `
          <p>You are viewing a historical version of this page from ${new Date(sha.created_at || '').toLocaleString()}</p>
          <button id="restore-current" class="action-button">Return to current version</button>
        `;
        
        // Render the historical content
        contentElement.innerHTML = '';
        contentElement.appendChild(banner);
        
        // Add the parsed content
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = marked.parse(content);
        contentElement.appendChild(contentDiv);
        
        // Add event listener to restore current version
        const restoreButton = document.getElementById('restore-current');
        if (restoreButton) {
          restoreButton.addEventListener('click', () => {
            if (window.originalContent) {
              contentElement.innerHTML = window.originalContent;
              window.originalContent = null;
            } else {
              // If original content not saved, reload the page
              window.wikiApp.loadPage(path);
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to view historical version:', error);
      throw error;
    }
  }
}