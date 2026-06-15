const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5173;
const DIST_DIR = '/opt/pubg-query/frontend/dist';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 转发后端 API 请求
  if (req.url.startsWith('/api/')) {
    const apiReq = http.request({
      host: 'localhost',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, (apiRes) => {
      res.writeHead(apiRes.statusCode, apiRes.headers);
      apiRes.pipe(res);
    });

    apiReq.on('error', (err) => {
      res.statusCode = 502;
      res.end(JSON.stringify({ success: false, error: 'Bad Gateway connecting to backend API: ' + err.message }));
    });

    req.pipe(apiReq);
    return;
  }

  // 静态资源服务
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendFile(res, filePath);
    } else {
      // SPA fallback
      sendFile(res, path.join(DIST_DIR, 'index.html'));
    }
  });
});

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  fs.createReadStream(filePath).pipe(res);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PUBG.BAR Frontend server running at http://0.0.0.0:${PORT}`);
});
