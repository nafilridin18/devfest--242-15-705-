/**
 * Tender Package Builder - Enterprise Node.js Server
 * Full REST API + Zero-Dependency Static File Server
 * DevFest 2026 Contest Official Backend
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleApiRoute } from './server/routes.mjs';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  // 1. Dispatch REST API requests (/api/*)
  try {
    const handled = await handleApiRoute(req, res);
    if (handled) return;
  } catch (err) {
    console.error('Unhandled API error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: true, message: err.message }));
    return;
  }

  // 2. Static File Serving
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/index.html';

  const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(process.cwd(), safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(`<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;padding:2rem;"><h2>404 Not Found</h2><p>The requested path <code>${safePath}</code> was not found on this server.</p><p><a href="/">Return to Tender Package Builder</a></p></body></html>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Headers
    const headers = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*'
    };

    if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (filePath.includes('vendor')) {
      headers['Cache-Control'] = 'public, max-age=86400';
    }

    res.writeHead(200, headers);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log('========================================================');
  console.log('   Tender Package Builder - Enterprise Backend Server   ');
  console.log('========================================================');
  console.log(` Server running at: http://localhost:${PORT}/`);
  console.log(` REST API Base:     http://localhost:${PORT}/api/`);
  console.log(` Health Check:      http://localhost:${PORT}/api/health`);
  console.log(` Packages Endpoint: http://localhost:${PORT}/api/packages`);
  console.log(' Dual Mode Active:  Client-Side + Backend REST API');
  console.log('========================================================\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down server...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});
