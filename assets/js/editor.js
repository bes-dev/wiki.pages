/**
 * Editor Module
 * 
 * Handles the markdown editor functionality for creating and editing wiki pages
 */

document.addEventListener('DOMContentLoaded', () => {
  const editor = new WikiEditor();
  window.wikiEditor = editor;
  editor.init();
});

class WikiEditor {
  constructor() {
    // Editor elements
    this.editorTextarea = null;
    this.previewDiv = null;
    this.titleInput = null;
    this.descriptionInput = null;
    this.tagsInput = null;
    
    // Current edited page path
    this.currentPath = '';
    
    // Markdown content
    this.content = '';
    
    // Draft autosave
    this.autosaveInterval = null;
    this.autosaveKey = 'wiki_draft';
    
    // Buttons
    this.saveButton = null;
    this.previewButton = null;
    this.saveDraftButton = null;
    this.cancelButton = null;
    
    // Editor state
    this.isPreviewActive = false;
    this.isFullscreen = false;
    this.isDirty = false;
  }

  /**
   * Initialize the editor
   */
  init() {
    // Get editor elements
    this.editorTextarea = document.getElementById('editor');
    this.previewDiv = document.getElementById('preview');
    this.titleInput = document.getElementById('page-title');
    this.descriptionInput = document.getElementById('page-description');
    this.tagsInput = document.getElementById('page-tags');
    
    // Get buttons
    this.saveButton = document.getElementById('save-button');
    this.previewButton = document.getElementById('preview-button');
    this.saveDraftButton = document.getElementById('save-draft-button');
    this.cancelButton = document.getElementById('cancel-button');
    
    if (!this.editorTextarea || !this.previewDiv) {
      console.error('Editor elements not found');
      return;
    }
    
    // Get current path from URL
    this.currentPath = this.getPathFromUrl();
    
    // Load the page content if editing existing page
    if (this.currentPath) {
      this.loadPage(this.currentPath);
    } else {
      // Check for saved draft
      this.loadDraft();
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start autosave
    this.startAutosave();
  }

  /**
   * Set up editor event listeners
   */
  setupEventListeners() {
    // Editor input events
    if (this.editorTextarea) {
      this.editorTextarea.addEventListener('input', () => {
        this.content = this.editorTextarea.value;
        this.updatePreview();
        this.isDirty = true;
      });
      
      // Handle tab key in editor
      this.editorTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          
          // Insert tab at cursor position
          const start = this.editorTextarea.selectionStart;
          const end = this.editorTextarea.selectionEnd;
          
          this.editorTextarea.value = this.editorTextarea.value.substring(0, start) + '  ' + this.editorTextarea.value.substring(end);
          
          // Move cursor position
          this.editorTextarea.selectionStart = this.editorTextarea.selectionEnd = start + 2;
          
          // Update content
          this.content = this.editorTextarea.value;
          this.isDirty = true;
        }
      });
    }
    
    // Title input event
    if (this.titleInput) {
      this.titleInput.addEventListener('input', () => {
        this.isDirty = true;
      });
      
      // Set title based on path
      if (this.currentPath && !this.titleInput.value) {
        const segments = this.currentPath.split('/');
        const fileName = segments[segments.length - 1].replace('.md', '');
        
        this.titleInput.value = fileName
          .replace(/-|_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
      }
    }
    
    // Button events
    if (this.saveButton) {
      this.saveButton.addEventListener('click', () => this.savePage());
    }
    
    if (this.previewButton) {
      this.previewButton.addEventListener('click', () => this.togglePreview());
    }
    
    if (this.saveDraftButton) {
      this.saveDraftButton.addEventListener('click', () => this.saveDraft());
    }
    
    if (this.cancelButton) {
      this.cancelButton.addEventListener('click', () => this.confirmCancel());
    }
    
    // Toolbar buttons
    const toolbarButtons = document.querySelectorAll('.editor-toolbar button');
    toolbarButtons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        if (action) {
          this.executeAction(action);
        }
      });
    });
    
    // Handle beforeunload event to warn about unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    });
  }

  /**
   * Get the page path from URL parameters
   * @returns {string} - The page path
   */
  getPathFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('path') || '';
  }

  /**
   * Load a page for editing
   * @param {string} path - The page path
   */
  async loadPage(path) {
    if (!path) return;
    
    try {
      // Show loading indicator
      this.showLoading(true);
      
      // Get wikiApp from parent window
      const wikiApp = window.wikiApp || window.parent?.wikiApp;
      
      if (!wikiApp || !wikiApp.content) {
        throw new Error('Wiki application not initialized');
      }
      
      // Get file content
      const content = await wikiApp.content.getFile(path);
      
      if (content) {
        // Parse front matter
        const { content: markdownContent, metadata } = this.parseFrontMatter(content);
        
        // Set content
        this.content = markdownContent;
        this.editorTextarea.value = markdownContent;
        
        // Set metadata fields
        if (metadata) {
          if (metadata.title && this.titleInput) {
            this.titleInput.value = metadata.title;
          }
          
          if (metadata.description && this.descriptionInput) {
            this.descriptionInput.value = metadata.description;
          }
          
          if (metadata.tags && this.tagsInput) {
            this.tagsInput.value = Array.isArray(metadata.tags) ? metadata.tags.join(', ') : metadata.tags;
          }
        }
        
        // Update preview
        this.updatePreview();
        
        // Clear draft for this path
        this.clearDraft();
      } else {
        // New page
        this.editorTextarea.value = '';
        this.updatePreview();
        
        // Check for draft
        this.loadDraft();
      }
      
      // Reset dirty flag
      this.isDirty = false;
    } catch (error) {
      console.error(`Failed to load page ${path}:`, error);
      this.showError(`Failed to load the page. ${error.message}`);
    } finally {
      this.showLoading(false);
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
   * Generate front matter from form fields
   * @returns {string} - The front matter
   */
  generateFrontMatter() {
    const metadata = {};
    
    // Get title
    if (this.titleInput && this.titleInput.value) {
      metadata.title = this.titleInput.value;
    }
    
    // Get description
    if (this.descriptionInput && this.descriptionInput.value) {
      metadata.description = this.descriptionInput.value;
    }
    
    // Get tags
    if (this.tagsInput && this.tagsInput.value) {
      const tags = this.tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (tags.length > 0) {
        metadata.tags = tags;
      }
    }
    
    // Add dates
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    metadata.updated = now;
    
    if (!this.currentPath) {
      metadata.created = now;
    }
    
    // Get user info if available
    const wikiApp = window.wikiApp || window.parent?.wikiApp;
    if (wikiApp && wikiApp.auth && wikiApp.auth.isAuthenticated()) {
      const userInfo = wikiApp.auth.getUserInfo();
      if (userInfo && userInfo.login) {
        metadata.author = userInfo.login;
      }
    }
    
    // Convert to YAML front matter
    let frontMatter = '---\n';
    
    Object.entries(metadata).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        frontMatter += `${key}: [${value.join(', ')}]\n`;
      } else {
        frontMatter += `${key}: ${value}\n`;
      }
    });
    
    frontMatter += '---\n\n';
    
    return frontMatter;
  }

  /**
   * Update preview pane with rendered markdown
   */
  updatePreview() {
    if (!this.previewDiv) return;
    
    if (!this.content || this.content.trim() === '') {
      this.previewDiv.innerHTML = '<p class="markdown-preview-placeholder">Preview will appear here as you type.</p>';
      return;
    }
    
    try {
      this.previewDiv.innerHTML = marked.parse(this.content);
    } catch (error) {
      console.error('Error rendering markdown preview:', error);
      this.previewDiv.innerHTML = '<p class="error">Error rendering preview.</p>';
    }
  }

  /**
   * Toggle between edit and preview modes
   */
  togglePreview() {
    const editorContainer = document.querySelector('.editor-container');
    if (!editorContainer) return;
    
    this.isPreviewActive = !this.isPreviewActive;
    
    if (this.isPreviewActive) {
      editorContainer.classList.add('preview-mode');
      this.previewButton.textContent = 'Edit';
      this.updatePreview();
    } else {
      editorContainer.classList.remove('preview-mode');
      this.previewButton.textContent = 'Preview';
    }
  }

  /**
   * Execute an editor toolbar action
   * @param {string} action - The action to execute
   */
  executeAction(action) {
    if (!this.editorTextarea) return;
    
    // Get current selection
    const start = this.editorTextarea.selectionStart;
    const end = this.editorTextarea.selectionEnd;
    const selectedText = this.editorTextarea.value.substring(start, end);
    const beforeText = this.editorTextarea.value.substring(0, start);
    const afterText = this.editorTextarea.value.substring(end);
    
    let replacement = '';
    let selectionStart = start;
    let selectionEnd = end;
    
    // Execute action based on type
    switch (action) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        selectionEnd = start + (selectedText ? selectedText.length + 4 : 10);
        break;
        
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        selectionEnd = start + (selectedText ? selectedText.length + 2 : 12);
        break;
        
      case 'heading':
        // Detect if we're already at the start of a line
        const isStartOfLine = start === 0 || beforeText.endsWith('\n');
        
        if (isStartOfLine) {
          replacement = `# ${selectedText || 'Heading'}`;
        } else {
          replacement = `\n# ${selectedText || 'Heading'}`;
        }
        selectionEnd = selectionStart + replacement.length;
        break;
        
      case 'link':
        replacement = `[${selectedText || 'link text'}](url)`;
        selectionEnd = selectionStart + (selectedText ? selectedText.length + 7 : 13);
        break;
        
      case 'image':
        replacement = `![${selectedText || 'image alt text'}](image-url)`;
        selectionEnd = selectionStart + (selectedText ? selectedText.length + 14 : 26);
        break;
        
      case 'code':
        if (selectedText.includes('\n')) {
          // Multiline code block
          replacement = '```\n' + selectedText + '\n```';
          selectionEnd = selectionStart + selectedText.length + 7;
        } else {
          // Inline code
          replacement = '`' + (selectedText || 'code') + '`';
          selectionEnd = selectionStart + (selectedText ? selectedText.length + 2 : 6);
        }
        break;
        
      case 'list':
        // Check if we should insert at the start of a line
        const shouldInsertNewLine = start !== 0 && !beforeText.endsWith('\n');
        
        if (shouldInsertNewLine) {
          replacement = '\n- ' + (selectedText || 'List item');
        } else {
          replacement = '- ' + (selectedText || 'List item');
        }
        selectionEnd = selectionStart + replacement.length;
        break;
        
      default:
        return;
    }
    
    // Update text area
    this.editorTextarea.value = beforeText + replacement + afterText;
    
    // Update selection
    this.editorTextarea.focus();
    this.editorTextarea.selectionStart = selectionStart;
    this.editorTextarea.selectionEnd = selectionEnd;
    
    // Update content and preview
    this.content = this.editorTextarea.value;
    this.updatePreview();
    this.isDirty = true;
  }

  /**
   * Save the current page
   */
  async savePage() {
    if (!this.editorTextarea) return;
    
    // Validate form
    if (!this.titleInput || !this.titleInput.value.trim()) {
      this.showError('Please enter a title for the page');
      return;
    }
    
    try {
      this.showLoading(true);
      
      // Get wikiApp from parent window
      const wikiApp = window.wikiApp || window.parent?.wikiApp;
      
      if (!wikiApp || !wikiApp.content) {
        throw new Error('Wiki application not initialized');
      }
      
      // Check if user is authenticated
      if (!wikiApp.auth || !wikiApp.auth.isAuthenticated()) {
        throw new Error('You must be signed in to save pages');
      }
      
      // Determine page path
      let pagePath = this.currentPath;
      
      if (!pagePath) {
        // Generate path from title
        const title = this.titleInput.value.trim();
        pagePath = title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-'); // Replace multiple hyphens with a single one
        
        // Add .md extension if not present
        if (!pagePath.endsWith('.md')) {
          pagePath += '.md';
        }
      }
      
      // Prepare content with front matter
      const frontMatter = this.generateFrontMatter();
      const content = frontMatter + this.content;
      
      // Save file
      await wikiApp.content.saveFile(pagePath, content, `Update ${pagePath}`);
      
      // Clear draft
      this.clearDraft();
      
      // Reset dirty flag
      this.isDirty = false;
      
      // Show success message
      this.showSuccess('Page saved successfully');
      
      // Navigate to the saved page
      setTimeout(() => {
        window.location.href = `/?path=${encodeURIComponent(pagePath.replace('.md', ''))}`;
      }, 1000);
    } catch (error) {
      console.error('Failed to save page:', error);
      this.showError(`Failed to save the page. ${error.message}`);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Save the current draft
   */
  saveDraft() {
    if (!this.editorTextarea) return;
    
    const draft = {
      content: this.editorTextarea.value,
      title: this.titleInput ? this.titleInput.value : '',
      description: this.descriptionInput ? this.descriptionInput.value : '',
      tags: this.tagsInput ? this.tagsInput.value : '',
      path: this.currentPath,
      timestamp: Date.now()
    };
    
    localStorage.setItem(this.autosaveKey, JSON.stringify(draft));
    this.showSuccess('Draft saved');
  }

  /**
   * Load a saved draft
   */
  loadDraft() {
    const draftJson = localStorage.getItem(this.autosaveKey);
    if (!draftJson) return;
    
    try {
      const draft = JSON.parse(draftJson);
      
      // Check if draft matches current path
      if (draft.path && draft.path !== this.currentPath) {
        return;
      }
      
      // Only load draft if it's less than 24 hours old
      const now = Date.now();
      const draftAge = now - (draft.timestamp || 0);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (draftAge > maxAge) {
        this.clearDraft();
        return;
      }
      
      // Ask user if they want to load the draft
      if (confirm('A draft from ' + new Date(draft.timestamp).toLocaleString() + ' was found. Load it?')) {
        // Load draft content
        if (draft.content && this.editorTextarea) {
          this.editorTextarea.value = draft.content;
          this.content = draft.content;
        }
        
        // Load draft metadata
        if (draft.title && this.titleInput) {
          this.titleInput.value = draft.title;
        }
        
        if (draft.description && this.descriptionInput) {
          this.descriptionInput.value = draft.description;
        }
        
        if (draft.tags && this.tagsInput) {
          this.tagsInput.value = draft.tags;
        }
        
        // Update preview
        this.updatePreview();
      } else {
        // Clear the draft if the user declines
        this.clearDraft();
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
      this.clearDraft();
    }
  }

  /**
   * Clear the saved draft
   */
  clearDraft() {
    localStorage.removeItem(this.autosaveKey);
  }

  /**
   * Start autosave interval
   */
  startAutosave() {
    // Autosave every 60 seconds
    this.autosaveInterval = setInterval(() => {
      if (this.isDirty && this.editorTextarea && this.editorTextarea.value.trim()) {
        this.saveDraft();
      }
    }, 60000);
  }

  /**
   * Stop autosave interval
   */
  stopAutosave() {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }

  /**
   * Confirm cancel and navigate away
   */
  confirmCancel() {
    if (this.isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        this.navigateAway();
      }
    } else {
      this.navigateAway();
    }
  }

  /**
   * Navigate away from the editor
   */
  navigateAway() {
    if (this.currentPath) {
      window.location.href = `/?path=${encodeURIComponent(this.currentPath.replace('.md', ''))}`;
    } else {
      window.location.href = '/';
    }
  }

  /**
   * Show loading indicator
   * @param {boolean} isLoading - Whether to show or hide loading
   */
  showLoading(isLoading) {
    // Implement loading indicator
    const buttons = [this.saveButton, this.previewButton, this.saveDraftButton, this.cancelButton].filter(Boolean);
    
    buttons.forEach(button => {
      if (isLoading) {
        button.setAttribute('disabled', 'disabled');
      } else {
        button.removeAttribute('disabled');
      }
    });
    
    // Add a loading class to the body
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
    const wikiApp = window.wikiApp || window.parent?.wikiApp;
    
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
    const wikiApp = window.wikiApp || window.parent?.wikiApp;
    
    if (wikiApp && wikiApp.ui && wikiApp.ui.showToast) {
      wikiApp.ui.showToast(message, 'success');
    }
  }
}