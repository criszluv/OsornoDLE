/**
 * Osornodle - servidor.
 *
 * Sin dependencias obligatorias: usa solo modulos nativos de Node.
 * Sirve /public como sitio estatico y expone la API en /api/*.
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const PUBLICO = path.join(RAIZ, 'public');

// Carga .env si existe (Node 20.6+). No es obligatorio.
try {
  const env = path.join(RAIZ, '.env');
  if (fs.existsSync(env) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(env);
  }
} catch (err) {
  console.warn('[osornodle] no se pudo leer .env:', err.message);
}

const { manejarApi } = await import('./routes/api.js');
const { MODOS } = await import('./lib/modes.js');
const { cargarDatos } = await import('./lib/datos.js');
const { fechaJuego, indiceDia, seleccionDelDia } = await import('./lib/daily.js');

const PUERTO = Number(process.env.PORT) || 3000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

async function servirEstatico(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  const destino = path.resolve(PUBLICO, '.' + rel);
  if (!destino.startsWith(PUBLICO)) {
    res.writeHead(403).end('Prohibido');
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(destino);
    if (stat.isDirectory()) throw new Error('dir');
  } catch {
    // Ruta desconocida -> devolvemos el index (navegacion con hash / rutas limpias).
    return servirArchivo(req, res, path.join(PUBLICO, 'index.html'));
  }
  return servirArchivo(req, res, destino, stat);
}

async function servirArchivo(req, res, archivo, stat) {
  try {
    stat = stat || (await fsp.stat(archivo));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
    return;
  }

  const ext = path.extname(archivo).toLowerCase();
  const etag = '"' + stat.size.toString(16) + '-' + Math.round(stat.mtimeMs).toString(16) + '"';

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304).end();
    return;
  }

  // HTML/JS/CSS se revalidan siempre (ETag) para no servir versiones viejas
  // tras un despliegue; las imágenes sí se cachean.
  const revalidar = ['.html', '.js', '.mjs', '.css', '.json'].includes(ext);
  res.writeHead(200, {
    'Content-Type': TIPOS[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    ETag: etag,
    'Cache-Control': revalidar ? 'no-cache' : 'public, max-age=3600'
  });

  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(archivo).pipe(res);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  try {
    if (await manejarApi(req, res, url)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('Metodo no permitido');
      return;
    }
    await servirEstatico(req, res, url);
  } catch (err) {
    console.error('[servidor]', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Error interno');
  }
});

function resumenInicio() {
  const dia = indiceDia();
  console.log('');
  console.log('  🌧️  Osornodle escuchando en http://localhost:' + PUERTO);
  console.log('     Fecha de juego: ' + fechaJuego() + '  ·  Desafio #' + (dia + 1));
  for (const modo of MODOS) {
    try {
      const { items } = cargarDatos(modo);
      const hoy = seleccionDelDia(modo.id, items, dia);
      console.log(
        '     ' + modo.emoji + ' ' + modo.nombre.padEnd(14) + items.length + ' items  ·  hoy: ' + hoy.nombre
      );
    } catch (err) {
      console.log('     ⚠️  ' + modo.nombre.padEnd(14) + err.message);
    }
  }
  console.log('');
}

servidor.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err;

  console.error('');
  console.error('  ⚠️  El puerto ' + PUERTO + ' ya está ocupado.');
  console.error('     Casi siempre es otra instancia de Osornodle que quedó corriendo.');
  console.error('');
  console.error('     Ver quién lo usa:   netstat -ano | findstr :' + PUERTO);
  console.error('     Cerrarlo:           taskkill /PID <el-pid-de-arriba> /F');
  console.error('     O usar otro puerto: $env:PORT=3001; npm start');
  console.error('');
  process.exit(1);
});

servidor.listen(PUERTO, () => resumenInicio());

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.close(() => process.exit(0));
  });
}
