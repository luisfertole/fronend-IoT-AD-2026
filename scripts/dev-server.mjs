import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlGateway } from '../server/control-gateway.mjs';
import { backendGateway } from '../server/backend-gateway.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mock = process.argv.includes('--mock');
const port = Number(process.env.PORT || 5500);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json' };
const allowed = path => ['index.html','monitoreo.html','admin.html','favicon.svg'].includes(path) || /^(src|assets)\//.test(path);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/api/control' || url.pathname === '/api/backend') {
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 8192) { res.writeHead(413).end(); return; } chunks.push(chunk); }
    req.body = Buffer.concat(chunks).toString();
    req.query = { path: url.searchParams.get('path') };
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); };
    if (mock) { res.status(200).json(req.method === 'GET' ? { ready:true, mock:true, vehicle:1 } : {ok:true}); return; }
    if (url.pathname === '/api/backend') await backendGateway(req, res);
    else await controlGateway(req, res);
    return;
  }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let path;
  try { path = decodeURIComponent(url.pathname).replace(/^\//,'') || 'index.html'; } catch { res.writeHead(400).end(); return; }
  const absolute = resolve(root, path), rel = relative(root, absolute);
  if (rel.startsWith('..') || isAbsolute(rel) || !allowed(rel.replaceAll('\\','/'))) { res.writeHead(404).end('No encontrado'); return; }
  try {
    let content = await readFile(absolute);
    if (mock && extname(path) === '.html') content = Buffer.from(content.toString().replace('<head>', '<head><script type="module" src="/src/dev/mock.js"></script>'));
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404).end('No encontrado'); }
}).listen(port, '127.0.0.1', () => console.log(`Unidad 02: http://127.0.0.1:${port}${mock ? ' · VISTA SIMULADA (sin conexión al vehículo)' : ''}`));
