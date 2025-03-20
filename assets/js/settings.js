/**
 * Settings Module
 * 
 * Handles the wiki settings functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  const settings = new WikiSettings();
  window.wikiSettings = settings;
  settings.init();
});

class WikiSettings {
  constructor() {
    this.settingsForm = null;
    this.themeSelector = null;
    this.originalSettings = {};
    this.isDirty = false;
  }

  /**
   * Initialize settings module
   */
  init() {
    // Get form element
    this.settingsForm = document.getElementById('wiki-config-form');
    this.themeSelector = document.getElementById('theme-selector');
    
    if (!this.settingsForm) {
      console.error('Settings form not found');
      return;
    }
    
    // Load current settings
    this.loadSettings();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Form submission
    if (this.settingsForm) {
      this.settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
      
      // Track changes in form inputs
      const formInputs = this.settingsForm.querySelectorAll('input, textarea, select');
      formInputs.forEach(input => {
        input.addEventListener('change', () => {
          this.isDirty = true;
        });
      });
    }
    
    // Theme selector
    if (this.themeSelector) {
      this.themeSelector.addEventListener('change', () => {
        this.applyTheme(this.themeSelector.value);
      });
      
      // Set initial value from localStorage
      const currentTheme = localStorage.getItem('wiki_theme') || 'auto';
      this.themeSelector.value = currentTheme;
    }
    
    // Warn about unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    });
  }

  /**
   * Load current settings
   */
  async loadSettings() {
    try {
      // Show loading state
      this.setLoading(true);
      
      // Get wikiApp from window
      const wikiApp = window.wikiApp;
      
      if (!wikiApp || !wikiApp.content) {
        throw new Error('Wiki application not initialized');
      }
      
      // Check if user is authenticated
      if (!wikiApp.auth || !wikiApp.auth.isAuthenticated()) {
        throw new Error('You must be signed in to access settings');
      }
      
      // Get current settings
      const configJson = await wikiApp.content.getFile('.wiki-config.json');
      
      if (configJson) {
        try {
          const settings = JSON.parse(configJson);
          this.originalSettings = settings;
          
          // Fill form fields
          this.populateForm(settings);
        } catch (parseError) {
          console.error('Failed to parse settings JSON:', parseError);
          this.showError('Failed to parse settings. Using defaults.');
        }
      } else {
        // No settings file found, use defaults
        this.populateForm(wikiApp.config);
        this.originalSettings = { ...wikiApp.config };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showError(`Failed to load settings: ${error.message}`);
      
      // Redirect to home if not authenticated
      if (error.message.includes('signed in')) {
        window.location.href = '/';
      }
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Populate form with settings
   * @param {Object} settings - The settings object
   */
  populateForm(settings) {
    if (!this.settingsForm) return;
    
    // Wiki title
    const titleInput = document.getElementById('wiki-title');
    if (titleInput && settings.title) {
      titleInput.value = settings.title;
    }
    
    // Wiki description
    const descriptionInput = document.getElementById('wiki-description');
    if (descriptionInput && settings.description) {
      descriptionInput.value = settings.description;
    }
    
    // Content repository
    const contentRepoInput = document.getElementById('content-repo');
    if (contentRepoInput && settings.contentRepo) {
      contentRepoInput.value = settings.contentRepo;
    }
    
    // Default branch
    const defaultBranchInput = document.getElementById('default-branch');
    if (defaultBranchInput && settings.defaultBranch) {
      defaultBranchInput.value = settings.defaultBranch;
    }
    
    // Reset dirty flag
    this.isDirty = false;
  }

  /**
   * Save settings
   */
  async saveSettings() {
    if (!this.settingsForm) return;
    
    try {
      // Show loading state
      this.setLoading(true);
      
      // Get wikiApp from window
      const wikiApp = window.wikiApp;
      
      if (!wikiApp || !wikiApp.content) {
        throw new Error('Wiki application not initialized');
      }
      
      // Check if user is authenticated
      if (!wikiApp.auth || !wikiApp.auth.isAuthenticated()) {
        throw new Error('You must be signed in to save settings');
      }
      
      // Get form data
      const formData = new FormData(this.settingsForm);
      const settings = {};
      
      // Convert form data to settings object
      for (const [key, value] of formData.entries()) {
        settings[key] = value;
      }
      
      // Save settings
      const settingsJson = JSON.stringify(settings, null, 2);
      await wikiApp.content.saveFile('.wiki-config.json', settingsJson, 'Update wiki configuration');
      
      // Update original settings
      this.originalSettings = { ...settings };
      
      // Update app config
      Object.assign(wikiApp.config, settings);
      
      // Reset dirty flag
      this.isDirty = false;
      
      // Show success message
      this.showSuccess('Settings saved successfully');
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showError(`Failed to save settings: ${error.message}`);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Apply theme
   * @param {string} theme - The theme to apply (light, dark, auto)
   */
  applyTheme(theme) {
    // Save theme preference to localStorage
    localStorage.setItem('wiki_theme', theme);
    
    // Apply theme
    if (theme === 'auto') {
      // Remove explicit theme
      document.documentElement.removeAttribute('data-theme');
      
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } else {
      // Set explicit theme
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Whether to show loading state
   */
  setLoading(isLoading) {
    if (!this.settingsForm) return;
    
    const submitButton = this.settingsForm.querySelector('button[type="submit"]');
    if (submitButton) {
      if (isLoading) {
        submitButton.setAttribute('disabled', 'disabled');
        submitButton.textContent = 'Saving...';
      } else {
        submitButton.removeAttribute('disabled');
        submitButton.textContent = 'Save Settings';
      }
    }
    
    // Add loading class to body
    if (isLoading) {
      document.body.classList.add('loading');
    } else {
      document.body.classList.remove('loading');
    }
  }

  /**
   * Show error message
   * @param {string} message - The error message
   */
  showError(message) {
    const wikiApp = window.wikiApp;
    
    if (wikiApp && wikiApp.ui && wikiApp.ui.showToast) {
      wikiApp.ui.showToast(message, 'error');
    } else {
      alert(message);
    }
  }

  /**
   * Show success message
   * @param {string} message - The success message
   */
  showSuccess(message) {
    const wikiApp = window.wikiApp;
    
    if (wikiApp && wikiApp.ui && wikiApp.ui.showToast) {
      wikiApp.ui.showToast(message, 'success');
    } else {
      alert(message);
    }
  }
}