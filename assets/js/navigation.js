/**
 * Navigation Service
 * 
 * Handles wiki navigation, sidebar generation, and URL routing
 */

export class NavigationService {
  constructor(app) {
    this.app = app;
    this.currentPath = '';
    this.sidebarData = null;
  }

  /**
   * Initialize the navigation service
   */
  async init() {
    // Parse the current URL path
    this.parseUrl();
    
    // Load and render sidebar
    await this.loadSidebar();
    
    // Set up event listeners for navigation
    this.setupEventListeners();
  }

  /**
   * Parse the current URL to determine the wiki path
   */
  parseUrl() {
    const url = new URL(window.location.href);
    const pathParam = url.searchParams.get('path');
    
    if (pathParam) {
      this.currentPath = pathParam;
    } else {
      // If no path provided, use home.md
      this.currentPath = 'home';
    }
  }

  /**
   * Get the current wiki path
   * @returns {string} - The current path
   */
  getCurrentPath() {
    return this.currentPath;
  }

  /**
   * Set the active path and update URL
   * @param {string} path - The path to navigate to
   * @param {boolean} updateUrl - Whether to update the URL
   */
  setActivePath(path, updateUrl = true) {
    this.currentPath = path;
    
    // Update URL if requested
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (path === 'home') {
        url.searchParams.delete('path');
      } else {
        url.searchParams.set('path', path);
      }
      
      // Update URL without reloading the page
      window.history.pushState({}, '', url.toString());
    }
    
    // Update active class in sidebar
    this.updateActiveSidebarItem();
  }

  /**
   * Update active class on sidebar items
   */
  updateActiveSidebarItem() {
    const sidebarItems = document.querySelectorAll('.sidebar-content a');
    
    sidebarItems.forEach(item => {
      const itemPath = item.getAttribute('data-path');
      if (itemPath === this.currentPath) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * Load sidebar data and render it
   */
  async loadSidebar() {
    try {
      // Try to load sidebar.md first
      let sidebarContent = await this.app.content.getFile('sidebar.md');
      
      if (sidebarContent) {
        // If sidebar.md exists, use it to generate the sidebar
        this.renderSidebarFromMarkdown(sidebarContent);
      } else {
        // If sidebar.md doesn't exist, generate sidebar from directory structure
        await this.generateSidebarFromStructure();
      }
    } catch (error) {
      console.error('Failed to load sidebar:', error);
      // Fallback to empty sidebar
      this.renderSidebarFromMarkdown('# Navigation\n\n- [Home](home)');
    }
  }

  /**
   * Render sidebar from markdown content
   * @param {string} markdownContent - The markdown content for the sidebar
   */
  renderSidebarFromMarkdown(markdownContent) {
    const sidebarElement = document.getElementById('sidebar-content');
    if (!sidebarElement) return;
    
    // Parse markdown to HTML
    const html = marked.parse(markdownContent);
    
    // Set sidebar content
    sidebarElement.innerHTML = html;
    
    // Process links to add data-path attributes and click handlers
    const links = sidebarElement.querySelectorAll('a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http')) {
        // Normalize path
        const path = href.replace(/^\/+|\/+$/g, '');
        
        // Set data-path attribute
        link.setAttribute('data-path', path);
        
        // Replace href to prevent default navigation
        link.setAttribute('href', 'javascript:void(0)');
        
        // Add click handler
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateTo(path);
        });
      }
    });
    
    // Update active item
    this.updateActiveSidebarItem();
  }

  /**
   * Generate sidebar from repository structure
   */
  async generateSidebarFromStructure() {
    try {
      // Get root directory contents
      const rootContents = await this.app.content.getDirectoryContents('');
      
      // Build sidebar HTML
      let sidebarHtml = '<h3>Navigation</h3><ul class="sidebar-nav">';
      
      // Add home link
      sidebarHtml += '<li><a href="javascript:void(0)" data-path="home">Home</a></li>';
      
      // Sort contents
      const sortedContents = rootContents.sort((a, b) => {
        // Directories first, then sort alphabetically
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Process content items
      for (const item of sortedContents) {
        if (item.name === 'home.md' || item.name === 'sidebar.md' || item.name === '.wiki-config.json') {
          continue; // Skip special files
        }
        
        if (item.type === 'dir') {
          // Add directory
          sidebarHtml += `<li class="sidebar-folder">
            <span class="folder-name">${item.name}</span>
            <ul class="sidebar-subnav">`;
          
          // Get directory contents
          const dirContents = await this.app.content.getDirectoryContents(item.path);
          
          // Sort directory contents
          const sortedDirContents = dirContents.sort((a, b) => a.name.localeCompare(b.name));
          
          // Add directory items
          for (const subItem of sortedDirContents) {
            if (subItem.type === 'file' && subItem.name.endsWith('.md')) {
              const name = subItem.name.replace('.md', '');
              const path = subItem.path.replace('.md', '');
              
              sidebarHtml += `<li>
                <a href="javascript:void(0)" data-path="${path}">${name}</a>
              </li>`;
            }
          }
          
          sidebarHtml += '</ul></li>';
        } else if (item.name.endsWith('.md')) {
          // Add file
          const name = item.name.replace('.md', '');
          const path = item.path.replace('.md', '');
          
          sidebarHtml += `<li>
            <a href="javascript:void(0)" data-path="${path}">${name}</a>
          </li>`;
        }
      }
      
      sidebarHtml += '</ul>';
      
      // Set sidebar content
      const sidebarElement = document.getElementById('sidebar-content');
      if (sidebarElement) {
        sidebarElement.innerHTML = sidebarHtml;
        
        // Add click handlers to links
        const links = sidebarElement.querySelectorAll('a');
        links.forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const path = link.getAttribute('data-path');
            this.navigateTo(path);
          });
        });
        
        // Add click handlers to folder toggles
        const folderNames = sidebarElement.querySelectorAll('.folder-name');
        folderNames.forEach(folder => {
          folder.addEventListener('click', () => {
            const li = folder.closest('.sidebar-folder');
            li.classList.toggle('open');
          });
        });
        
        // Update active item
        this.updateActiveSidebarItem();
      }
    } catch (error) {
      console.error('Failed to generate sidebar from structure:', error);
      // Fallback to basic sidebar
      this.renderSidebarFromMarkdown('# Navigation\n\n- [Home](home)');
    }
  }

  /**
   * Set up event listeners for navigation
   */
  setupEventListeners() {
    // Handle clicks on any wiki links within the content
    document.addEventListener('click', (e) => {
      // Check if the click is on a wiki link
      if (e.target.tagName === 'A') {
        const href = e.target.getAttribute('href');
        
        // Handle internal wiki links but not external links
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          e.preventDefault();
          this.navigateTo(href);
        }
      }
    });
  }

  /**
   * Navigate to a specific wiki page
   * @param {string} path - The path to navigate to
   */
  navigateTo(path) {
    // Normalize path
    path = path.replace(/^\/+|\/+$/g, '');
    
    // Update current path
    this.setActivePath(path);
    
    // Load the page content
    this.app.loadPage(path);
  }

  /**
   * Update breadcrumbs for the current path
   * @param {string} path - The current path
   */
  updateBreadcrumbs(path) {
    const breadcrumbsElement = document.getElementById('breadcrumbs');
    if (!breadcrumbsElement) return;
    
    // Split the path into segments
    const segments = path.split('/');
    let html = '<a href="javascript:void(0)" data-path="home">Home</a>';
    let currentPath = '';
    
    // Build breadcrumbs HTML
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment) continue;
      
      // Build cumulative path
      currentPath += (currentPath ? '/' : '') + segment;
      
      // Remove .md extension if present
      const displayName = segment.replace('.md', '');
      
      // Add separator
      html += '<span> / </span>';
      
      // Add link (except for the last segment)
      if (i === segments.length - 1) {
        html += `<span>${displayName}</span>`;
      } else {
        html += `<a href="javascript:void(0)" data-path="${currentPath}">${displayName}</a>`;
      }
    }
    
    // Set breadcrumbs content
    breadcrumbsElement.innerHTML = html;
    
    // Add click handlers to breadcrumb links
    const links = breadcrumbsElement.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const linkPath = link.getAttribute('data-path');
        this.navigateTo(linkPath);
      });
    });
  }
}