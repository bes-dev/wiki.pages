/**
 * GitHub OAuth Token Exchange Proxy
 * 
 * This is a simple proxy service that handles the exchange of an OAuth code for a token.
 * It should be deployed separately from the main GitHub Pages site, such as on a serverless
 * platform like Netlify Functions, Vercel Serverless Functions, or AWS Lambda.
 * 
 * Environment variables required:
 * - GITHUB_CLIENT_ID: Your GitHub OAuth App client ID
 * - GITHUB_CLIENT_SECRET: Your GitHub OAuth App client secret
 */

// This is an example for Netlify Functions or Vercel Serverless Functions
exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*', // In production, restrict this to your domain
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const code = requestBody.code;

    if (!code) {
      throw new Error('No code provided');
    }

    // Prepare request to GitHub
    const params = new URLSearchParams();
    params.append('client_id', process.env.GITHUB_CLIENT_ID);
    params.append('client_secret', process.env.GITHUB_CLIENT_SECRET);
    params.append('code', code);

    // Exchange code for token
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`GitHub error: ${data.error}`);
    }

    // Return token without exposing client secret
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: data.access_token,
        token_type: data.token_type,
        scope: data.scope
      })
    };
  } catch (error) {
    console.error('Token exchange error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

// Notes for deployment:
// 1. This file should be deployed to a serverless platform, not on GitHub Pages
// 2. Set environment variables for GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
// 3. Configure GitHub OAuth App callback URL to point to your main app
// 4. Update the callback.html file to point to this proxy endpoint