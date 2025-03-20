# GitHub Pages Wiki Engine

A fully static wiki engine built to run on GitHub Pages with content stored in a GitHub repository, without dependencies on external frameworks.

## Features

- Fully static implementation using vanilla HTML, CSS, and JavaScript
- Modern, responsive UI inspired by wiki.js
- Content stored as Markdown in a GitHub repository
- GitHub OAuth authentication for editing
- Client-side search functionality
- Dark and light theme support
- Markdown editor with live preview
- Support for images and rich content
- Mobile-friendly design

## Setup Instructions

### 1. Create GitHub Repositories

You'll need two GitHub repositories:
1. **Wiki Site Repository**: For hosting the wiki engine (where you'll deploy this code)
2. **Content Repository**: For storing your wiki content

### 2. Configure GitHub OAuth Application

1. Go to your GitHub account settings
2. Navigate to "Developer settings" > "OAuth Apps" > "New OAuth App"
3. Fill in the details:
   - **Application name**: Your Wiki Name
   - **Homepage URL**: Your GitHub Pages URL (e.g., https://username.github.io/wiki/)
   - **Authorization callback URL**: Your GitHub Pages URL + `/callback.html`
4. Register the application and note down the Client ID and Client Secret

### 3. Set Up Token Exchange Proxy

Since GitHub OAuth requires a server-side component to exchange the authorization code for a token, you'll need to deploy the token exchange proxy:

1. Deploy the `proxy/token-exchange.js` file to a serverless platform like:
   - Netlify Functions
   - Vercel Serverless Functions
   - AWS Lambda
   - Google Cloud Functions

2. Set environment variables in your serverless platform:
   - `GITHUB_CLIENT_ID`: Your OAuth app client ID
   - `GITHUB_CLIENT_SECRET`: Your OAuth app client secret

### 4. Configure the Wiki

1. Edit `assets/js/auth.js` to set your GitHub OAuth client ID and proxy URL
2. Deploy the wiki code to your wiki site repository
3. Enable GitHub Pages for the repository

### 5. Initial Setup

1. Visit your wiki site
2. Sign in with GitHub
3. Go to Settings to configure:
   - Wiki title
   - Description
   - Content repository (format: username/repository)
   - Default branch (usually 'main')

## Development

### Local Development

For local development, you can use any simple web server:

```bash
# Using Python
python -m http.server

# Using Node.js http-server
npx http-server
```

### Project Structure

- `index.html` - Main page
- `article.html` - Article viewing template
- `edit.html` - Article editing page
- `settings.html` - Wiki settings
- `callback.html` - OAuth callback handler
- `assets/` - Static assets
  - `css/` - Stylesheets
  - `js/` - JavaScript modules
  - `img/` - Images
  - `lib/` - Third-party libraries

### Core Modules

- `app.js` - Main application logic
- `auth.js` - Authentication handling
- `content.js` - Content management and GitHub API
- `navigation.js` - Wiki navigation and routing
- `ui.js` - UI components and utilities
- `search.js` - Search functionality
- `editor.js` - Markdown editor

## Content Repository Structure

The content repository should have the following structure:

```
/
├── .wiki-config.json           # Wiki configuration (created automatically)
├── home.md                     # Home page
├── sidebar.md                  # Optional custom sidebar
└── ...                         # Other Markdown files and directories
```

## Markdown Format

Wiki articles use standard Markdown with YAML front matter:

```markdown
---
title: Article Title
description: Brief description
tags: [tag1, tag2]
created: 2023-04-01
updated: 2023-04-02
author: username
---

# Article Title

Article content goes here...
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.