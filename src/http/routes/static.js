const fs = require('fs');
const path = require('path');

const MIME_BY_EXT = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function sanitizeAssetPath(pathname) {
  try {
    const decoded = decodeURIComponent(pathname);
    if (decoded.includes('\0')) return null;
    const withoutPrefix = decoded.replace(/^\//, '');
    const normalized = path.posix.normalize(withoutPrefix);
    if (path.isAbsolute(normalized)) return null;
    if (normalized.startsWith('..')) return null;
    if (!normalized.startsWith('assets/')) return null;
    return normalized;
  } catch {
    return null;
  }
}

function createStaticRoutes({ staticDir, sendText, sendMethodNotAllowed }) {
  const staticRoot = path.resolve(staticDir);

  return async function handleStaticRoute(req, res, url) {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, ['GET'], { api: false });
        return true;
      }

      try {
        const html = await fs.promises.readFile(path.join(staticRoot, 'index.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch {
        sendText(res, 404, 'index.html not found');
      }
      return true;
    }

    if (!url.pathname.startsWith('/assets/')) {
      return false;
    }

    if (req.method !== 'GET') {
      sendMethodNotAllowed(res, ['GET'], { api: false });
      return true;
    }

    const normalized = sanitizeAssetPath(url.pathname);
    if (!normalized) {
      sendText(res, 403, 'Forbidden');
      return true;
    }

    const resolvedPath = path.resolve(path.join(staticRoot, normalized));
    if (!resolvedPath.startsWith(`${staticRoot}${path.sep}`)) {
      sendText(res, 403, 'Forbidden');
      return true;
    }

    try {
      const data = await fs.promises.readFile(resolvedPath);
      res.writeHead(200, { 'Content-Type': contentTypeFor(resolvedPath) });
      res.end(data);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        sendText(res, 404, 'Not found');
      } else {
        sendText(res, 500, 'Failed to load asset');
      }
    }

    return true;
  };
}

module.exports = {
  createStaticRoutes,
  contentTypeFor,
  sanitizeAssetPath,
};
