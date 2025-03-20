/**
 * Search Service
 * 
 * Handles search functionality for the wiki
 */

export class SearchService {
  constructor() {
    this.searchIndex = null;
    this.searchResults = [];
    this.isIndexing = false;
    this.indexedFiles = new Set();
  }

  /**
   * Perform a search with the given query
   * @param {string} query - The search query
   */
  async performSearch(query) {
    if (!query || query.trim() === '') {
      return [];
    }
    
    // Initialize search index if needed
    if (!this.searchIndex && !this.isIndexing) {
      await this.initSearchIndex();
    }
    
    // If still indexing, show a message
    if (this.isIndexing) {
      if (window.wikiApp && window.wikiApp.ui) {
        window.wikiApp.ui.showToast('Search index is being built, please try again in a moment', 'info');
      }
      return [];
    }
    
    // Perform search
    try {
      const results = this.searchInFiles(query);
      
      // Display results
      this.displaySearchResults(query, results);
      
      return results;
    } catch (error) {
      console.error('Search error:', error);
      
      if (window.wikiApp && window.wikiApp.ui) {
        window.wikiApp.ui.showToast('Search failed: ' + error.message, 'error');
      }
      
      return [];
    }
  }

  /**
   * Initialize the search index
   */
  async initSearchIndex() {
    if (this.searchIndex || this.isIndexing) return;
    
    this.isIndexing = true;
    this.searchIndex = {};
    
    try {
      if (window.wikiApp && window.wikiApp.ui) {
        window.wikiApp.ui.showToast('Building search index...', 'info');
      }
      
      // Get content repository files
      await this.indexDirectory('');
      
      if (window.wikiApp && window.wikiApp.ui) {
        window.wikiApp.ui.showToast('Search index built successfully', 'success');
      }
    } catch (error) {
      console.error('Failed to initialize search index:', error);
      
      if (window.wikiApp && window.wikiApp.ui) {
        window.wikiApp.ui.showToast('Failed to build search index', 'error');
      }
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Index all files in a directory
   * @param {string} path - The directory path
   */
  async indexDirectory(path) {
    if (!window.wikiApp || !window.wikiApp.content) {
      throw new Error('Wiki app content service not available');
    }
    
    try {
      // Get directory contents
      const contents = await window.wikiApp.content.getDirectoryContents(path);
      
      // Process each item
      for (const item of contents) {
        if (item.name === '.wiki-config.json' || item.name === 'sidebar.md') {
          continue; // Skip special files
        }
        
        if (item.type === 'dir') {
          // Recursively index subdirectory
          await this.indexDirectory(item.path);
        } else if (item.type === 'file' && item.name.endsWith('.md')) {
          // Index markdown file
          await this.indexFile(item.path);
        }
      }
    } catch (error) {
      console.error(`Failed to index directory ${path}:`, error);
      throw error;
    }
  }

  /**
   * Index a specific file
   * @param {string} path - The file path
   */
  async indexFile(path) {
    if (this.indexedFiles.has(path)) {
      return; // Skip already indexed files
    }
    
    try {
      const content = await window.wikiApp.content.getFile(path);
      if (!content) return;
      
      // Remove front matter if present
      const { content: cleanContent, metadata } = this.parseFrontMatter(content);
      
      // Create a document object
      const doc = {
        path,
        title: metadata?.title || this.getFileTitle(path, cleanContent),
        content: cleanContent,
        metadata
      };
      
      // Add to search index with simple tokenization
      const tokens = this.tokenize(cleanContent);
      
      for (const token of tokens) {
        if (!this.searchIndex[token]) {
          this.searchIndex[token] = [];
        }
        
        // Check if this document is already indexed for this token
        const isAlreadyIndexed = this.searchIndex[token].some(item => item.path === path);
        if (!isAlreadyIndexed) {
          this.searchIndex[token].push(doc);
        }
      }
      
      // Mark file as indexed
      this.indexedFiles.add(path);
    } catch (error) {
      console.error(`Failed to index file ${path}:`, error);
      // Continue with other files even if one fails
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
   * Get the title from a markdown file
   * @param {string} path - The file path
   * @param {string} content - The file content
   * @returns {string} - The file title
   */
  getFileTitle(path, content) {
    // Try to extract title from first heading
    const titleMatch = content.match(/^# (.+)$/m);
    if (titleMatch) {
      return titleMatch[1];
    }
    
    // Fallback to file name
    const segments = path.split('/');
    const fileName = segments[segments.length - 1].replace('.md', '');
    
    // Convert slug to title case
    return fileName
      .replace(/-|_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Tokenize content for indexing
   * @param {string} content - The content to tokenize
   * @returns {Set<string>} - Set of tokens
   */
  tokenize(content) {
    // Convert to lowercase
    const lowerContent = content.toLowerCase();
    
    // Remove special characters and split by whitespace
    const words = lowerContent
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word && word.length > 2); // Filter out short words
    
    // Return unique words
    return new Set(words);
  }

  /**
   * Search in indexed files
   * @param {string} query - The search query
   * @returns {Array} - Array of search results
   */
  searchInFiles(query) {
    if (!this.searchIndex) {
      return [];
    }
    
    // Tokenize query
    const queryTerms = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term && term.length > 2);
    
    if (queryTerms.length === 0) {
      return [];
    }
    
    // Get matching documents for each term
    const termResults = {};
    let docScores = {};
    
    for (const term of queryTerms) {
      const matches = this.searchIndex[term] || [];
      
      for (const doc of matches) {
        // Calculate score based on term frequency
        const contentOccurrences = (doc.content.toLowerCase().match(new RegExp(term, 'g')) || []).length;
        const titleOccurrences = (doc.title.toLowerCase().match(new RegExp(term, 'g')) || []).length;
        
        // Title matches are worth more
        const score = contentOccurrences + (titleOccurrences * 3);
        
        if (!docScores[doc.path]) {
          docScores[doc.path] = 0;
        }
        
        docScores[doc.path] += score;
        
        if (!termResults[doc.path]) {
          termResults[doc.path] = doc;
        }
      }
    }
    
    // Convert to array and sort by score
    const results = Object.keys(termResults).map(path => {
      const doc = termResults[path];
      const score = docScores[path] || 0;
      
      // Create excerpt with highlighted terms
      let excerpt = doc.content.substring(0, 200) + '...';
      
      for (const term of queryTerms) {
        excerpt = excerpt.replace(new RegExp(term, 'gi'), match => `<mark>${match}</mark>`);
      }
      
      return {
        path,
        title: doc.title,
        excerpt,
        score
      };
    });
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }

  /**
   * Display search results
   * @param {string} query - The search query
   * @param {Array} results - Array of search results
   */
  displaySearchResults(query, results) {
    if (!window.wikiApp) return;
    
    const contentElement = document.getElementById('article-content') || document.getElementById('content');
    if (!contentElement) return;
    
    // Update page title
    document.title = `Search results for "${query}" - ${window.wikiApp.config.title}`;
    
    // Create results HTML
    let html = `
      <div class="search-results">
        <h1>Search Results</h1>
        <p>Results for <strong>${query}</strong> (${results.length} matches)</p>
    `;
    
    if (results.length === 0) {
      html += `
        <div class="no-results">
          <p>No results found. Try different keywords or check your spelling.</p>
        </div>
      `;
    } else {
      html += '<div class="results-list">';
      
      for (const result of results) {
        html += `
          <div class="result-item">
            <h3><a href="javascript:void(0)" data-path="${result.path}">${result.title}</a></h3>
            <p class="result-path">${result.path}</p>
            <p class="result-excerpt">${result.excerpt}</p>
          </div>
        `;
      }
      
      html += '</div>';
    }
    
    html += '</div>';
    
    // Set results HTML
    contentElement.innerHTML = html;
    
    // Add click handlers to result links
    const resultLinks = contentElement.querySelectorAll('.result-item a');
    resultLinks.forEach(link => {
      link.addEventListener('click', () => {
        const path = link.getAttribute('data-path');
        if (window.wikiApp.navigation) {
          window.wikiApp.navigation.navigateTo(path);
        }
      });
    });
  }
}