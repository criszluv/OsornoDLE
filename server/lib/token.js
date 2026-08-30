/**
 * Firma de los tokens que autorizan pedir una imagen a cierto nivel de
 * pixelado. Evita que alguien cambie ?nivel=6 en la URL para ver la foto
 * nitida sin gastar intentos. No es seguridad fuerte (el cliente igual puede
 * mirar la red), pero corta el atajo obvio.
 */

import crypto from 'node:crypto';

const SECRETO = process.env.IMG_SECRET || 'osornodle-dev-secret';

function firma(datos) {
  return crypto.createHmac('sha256', SECRETO).update(datos).digest('base64url').slice(0, 16);
}

export function crearToken(modoId, dia, nivel) {
  const datos = `${modoId}:${dia}:${nivel}`;
  return `${dia}.${nivel}.${firma(datos)}`;
}

export function leerToken(modoId, token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const dia = Number(partes[0]);
  const nivel = Number(partes[1]);
  if (!Number.isInteger(dia) || !Number.isInteger(nivel) || nivel < 0) return null;

  const esperada = firma(`${modoId}:${dia}:${nivel}`);
  const a = Buffer.from(partes[2]);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return { dia, nivel };
}
