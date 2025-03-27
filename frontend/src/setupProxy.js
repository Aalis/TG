const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

module.exports = function(app) {
  // Proxy API requests to the backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
    })
  );

  // Handle any other route by serving the index.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.url.includes('.')) {
      // For any URL that doesn't contain a dot (likely not a static asset)
      // Send the index.html file
      res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
      // Continue to the next middleware
      next();
    }
  });
}; 