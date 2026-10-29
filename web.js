// web.js
// Servidor HTTP mínimo (sem dependências extras) que roda junto com o bot.
// Serve as páginas da pasta /public e uma rota /health para monitoramento.
//
// Rotas:
//   /              -> termos.html
//   /termos        -> termos.html
//   /privacidade   -> privacidade.html
//   /health        -> "ok"
//   /<arquivo>     -> qualquer arquivo dentro de /public (ex.: /termos.html)

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

// O Render define a variável PORT automaticamente. Não precisa configurar.
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const ROUTES = {
  '/': 'termos.html',
  '/termos': 'termos.html',
  '/privacidade': 'privacidade.html',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const COMMON_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { ...COMMON_HEADERS, ...extraHeaders });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Método não permitido', { Allow: 'GET, HEAD' });
    }

    const { pathname } = new URL(req.url, 'http://localhost');
    let urlPath;
    try {
      urlPath = decodeURIComponent(pathname);
    } catch {
      return send(res, 400, 'Requisição inválida');
    }

    if (urlPath === '/health') {
      return send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    }

    // Remove a barra final (ex.: /termos/ -> /termos), exceto na raiz
    if (urlPath.length > 1 && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);

    const relative = ROUTES[urlPath] ?? urlPath.replace(/^\/+/, '');
    const filePath = path.resolve(PUBLIC_DIR, relative);

    // Impede acessar arquivos fora da pasta public (ex.: /../.env)
    if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
      return send(res, 403, 'Acesso negado');
    }

    const content = await fs.readFile(filePath);
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';

    send(res, 200, req.method === 'HEAD' ? undefined : content, {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
    });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      return send(res, 404, 'Página não encontrada', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    console.error('[web] Erro ao atender requisição:', error);
    send(res, 500, 'Erro interno do servidor', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.on('error', (error) => {
  console.error('[web] Falha no servidor HTTP:', error.message);
});

// 0.0.0.0 é obrigatório no Render para a porta ser detectada
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[web] Servidor HTTP ouvindo na porta ${PORT}`);
});

module.exports = server;