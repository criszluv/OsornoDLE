/**
 * Genera imágenes marcador para el modo Locales, para poder probar el juego
 * antes de tener las fotos reales.
 *
 *   node scripts/placeholders.js          -> crea las que falten
 *   node scripts/placeholders.js --force  -> regenera todas
 *
 * Escribe PNG a mano (zlib + CRC32), sin dependencias externas.
 * Borra estos archivos cuando subas las fotos de verdad.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ANCHO = 900;
const ALTO = 600;

// --- PNG minimo ------------------------------------------------------------

const TABLA_CRC = (() => {
  const tabla = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c;
  }
  return tabla;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function escribirPng(ancho, alto, pixeles) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // color RGB
  const crudo = Buffer.alloc(alto * (ancho * 3 + 1));
  for (let y = 0; y < alto; y++) {
    const destino = y * (ancho * 3 + 1);
    crudo[destino] = 0; // filtro none
    pixeles.copy(crudo, destino + 1, y * ancho * 3, (y + 1) * ancho * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]);
}

// --- dibujo ----------------------------------------------------------------

const FUENTE = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '101111111111101', O: '010101101101010', P: '110101110100100',
  Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '?': '110001010000010'
};

function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function iniciales(nombre) {
  const palabras = nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((p) => p.length > 2);
  const letras = (palabras.length ? palabras : ['?']).slice(0, 2).map((p) => p[0]);
  return letras.map((l) => (FUENTE[l] ? l : '?'));
}

function generar(item) {
  const semilla = hash(item.id);
  const tono = semilla % 360;
  const tono2 = (tono + 40 + (semilla % 90)) % 360;
  const fondoA = hsl(tono, 0.55, 0.32);
  const fondoB = hsl(tono2, 0.6, 0.55);
  const acento = hsl((tono + 180) % 360, 0.7, 0.6);
  const forma = semilla % 3;

  const pix = Buffer.alloc(ANCHO * ALTO * 3);
  const cx = ANCHO * (0.35 + ((semilla >> 3) % 30) / 100);
  const cy = ALTO * (0.4 + ((semilla >> 7) % 25) / 100);
  const radio = Math.min(ANCHO, ALTO) * (0.22 + ((semilla >> 11) % 15) / 100);

  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const t = (x / ANCHO) * 0.6 + (y / ALTO) * 0.4;
      let r = fondoA[0] + (fondoB[0] - fondoA[0]) * t;
      let g = fondoA[1] + (fondoB[1] - fondoA[1]) * t;
      let b = fondoA[2] + (fondoB[2] - fondoA[2]) * t;

      const dentro =
        forma === 0
          ? (x - cx) ** 2 + (y - cy) ** 2 < radio * radio
          : forma === 1
            ? Math.abs(x - cx) + Math.abs(y - cy) < radio * 1.25
            : (x + y * 2) % 190 < 70;

      if (dentro) {
        r = r * 0.35 + acento[0] * 0.65;
        g = g * 0.35 + acento[1] * 0.65;
        b = b * 0.35 + acento[2] * 0.65;
      }

      const i = (y * ANCHO + x) * 3;
      pix[i] = r;
      pix[i + 1] = g;
      pix[i + 2] = b;
    }
  }

  // Iniciales grandes, centradas.
  const letras = iniciales(item.nombre);
  const escala = 46;
  const anchoTexto = letras.length * 4 * escala - escala;
  const x0 = Math.round((ANCHO - anchoTexto) / 2);
  const y0 = Math.round((ALTO - 5 * escala) / 2);

  letras.forEach((letra, indice) => {
    const mapa = FUENTE[letra];
    for (let fila = 0; fila < 5; fila++) {
      for (let col = 0; col < 3; col++) {
        if (mapa[fila * 3 + col] !== '1') continue;
        const px = x0 + indice * 4 * escala + col * escala;
        const py = y0 + fila * escala;
        for (let dy = 0; dy < escala; dy++) {
          for (let dx = 0; dx < escala; dx++) {
            const i = ((py + dy) * ANCHO + px + dx) * 3;
            pix[i] = 250;
            pix[i + 1] = 250;
            pix[i + 2] = 252;
          }
        }
      }
    }
  });

  return escribirPng(ANCHO, ALTO, pix);
}

// --- main ------------------------------------------------------------------

const forzar = process.argv.includes('--force');
const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/locales.json'), 'utf8'));
const items = Array.isArray(datos) ? datos : datos.items;

let creadas = 0;
let saltadas = 0;

for (const item of items) {
  if (!item.imagen) {
    console.warn('  ! ' + item.nombre + ' no tiene campo "imagen"');
    continue;
  }
  const destino = path.join(RAIZ, 'public', item.imagen);
  if (fs.existsSync(destino) && !forzar) {
    saltadas++;
    continue;
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, generar(item));
  creadas++;
  console.log('  + ' + item.imagen);
}

console.log('\n' + creadas + ' imagen(es) generada(s), ' + saltadas + ' ya existían.');
if (saltadas && !forzar) console.log('Usa --force para regenerarlas todas.');
