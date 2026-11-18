/* 零依赖静态服务器：手机连同一个 Wi-Fi，访问 http://<电脑局域网IP>:8080 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || 8080);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' ) rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + rel); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',            // 改完刷新即生效
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
  });
}).listen(PORT, '0.0.0.0', () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if ((a.family === 'IPv4' || a.family === 4) && !a.internal) ips.push(a.address);
  }
  console.log('serving ' + ROOT);
  for (const ip of ips) console.log('  http://' + ip + ':' + PORT + '/');
});
