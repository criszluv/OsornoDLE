/**
 * Pixelado de las fotos del modo Locales.
 *
 * Si `sharp` esta instalado, el pixelado se hace en el servidor y el navegador
 * nunca recibe la foto nitida antes de tiempo (lo ideal).
 * Si no lo esta, se entrega la original y el frontend la pixela en un <canvas>;
 * el juego funciona igual, pero es "trampeable" desde las herramientas de red.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DIR_PUBLICO = path.resolve(AQUI, '../../public');

const ANCHO_SALIDA = 900;
const cache = new Map();
const MAX_CACHE = 60;

let sharp = null;
let sharpListo = false;

async function cargarSharp() {
  if (sharpListo) return sharp;
  sharpListo = true;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    sharp = null;
    console.warn(
      '[osornodle] sharp no esta instalado: el pixelado se hara en el navegador.\n' +
        '            Para pixelar en el servidor: npm install sharp'
    );
  }
  return sharp;
}

export async function pixeladoEnServidor() {
  return Boolean(await cargarSharp());
}

/** Ruta absoluta y segura dentro de /public para una imagen declarada en los datos. */
export function rutaImagen(relativa) {
  if (!relativa) return null;
  const limpia = String(relativa).replace(/^\/+/, '');
  const destino = path.resolve(DIR_PUBLICO, limpia);
  if (!destino.startsWith(DIR_PUBLICO)) return null;
  return fs.existsSync(destino) ? destino : null;
}

/**
 * Devuelve { buffer, tipo } con la imagen pixelada a `anchoBloques`.
 * anchoBloques = 0 -> imagen original (solo redimensionada).
 * Devuelve null si sharp no esta disponible.
 */
export async function pixelar(ruta, anchoBloques) {
  const lib = await cargarSharp();
  if (!lib) return null;

  const stat = fs.statSync(ruta);
  const clave = `${ruta}|${stat.mtimeMs}|${anchoBloques}`;
  if (cache.has(clave)) return cache.get(clave);

  const base = lib(ruta).rotate();
  let salida;

  if (!anchoBloques) {
    salida = await base.resize({ width: ANCHO_SALIDA, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
  } else {
    const chico = await base.resize({ width: anchoBloques, fit: 'inside' }).toBuffer();
    salida = await lib(chico)
      .resize({ width: ANCHO_SALIDA, kernel: 'nearest' })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  const resultado = { buffer: salida, tipo: 'image/jpeg' };
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(clave, resultado);
  return resultado;
}
