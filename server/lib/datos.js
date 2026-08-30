/**
 * Carga y normalizacion de los archivos de datos (data/*.json).
 * Se cachea en memoria y se recarga solo si cambia la fecha de modificacion,
 * asi se puede editar el JSON sin reiniciar el servidor.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DIR_DATOS = path.resolve(AQUI, '../../data');

const cache = new Map();

/** Quita tildes, mayusculas y signos: base para buscar y para generar ids. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slug(texto) {
  return normalizar(texto).replace(/ /g, '-');
}

function normalizarItem(bruto, indice, modoId) {
  if (!bruto || typeof bruto !== 'object') {
    throw new Error(`[${modoId}] el item #${indice} no es un objeto`);
  }
  if (!bruto.nombre) {
    throw new Error(`[${modoId}] el item #${indice} no tiene "nombre"`);
  }

  const item = { ...bruto };
  item.id = bruto.id || slug(bruto.nombre);
  item.alias = Array.isArray(bruto.alias) ? bruto.alias : [];
  item.busqueda = [item.nombre, ...item.alias].map(normalizar);
  return item;
}

/** Devuelve { items, mtime } del modo indicado. */
export function cargarDatos(modo) {
  const ruta = path.join(DIR_DATOS, modo.archivo);
  let stat;
  try {
    stat = fs.statSync(ruta);
  } catch {
    throw new Error(`Falta el archivo de datos: data/${modo.archivo}`);
  }

  const previo = cache.get(modo.id);
  if (previo && previo.mtime === stat.mtimeMs) return previo;

  const crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const lista = Array.isArray(crudo) ? crudo : crudo.items;
  if (!Array.isArray(lista)) {
    throw new Error(`data/${modo.archivo} debe ser un array o { "items": [...] }`);
  }

  const items = lista
    .filter((it) => it && it.activo !== false)
    .map((it, i) => normalizarItem(it, i, modo.id));

  const vistos = new Set();
  for (const item of items) {
    if (vistos.has(item.id)) throw new Error(`[${modo.id}] id duplicado: ${item.id}`);
    vistos.add(item.id);
  }

  const resultado = { items, mtime: stat.mtimeMs };
  cache.set(modo.id, resultado);
  return resultado;
}

/** Lista liviana para el autocompletado (sin filtrar atributos secretos). */
export function listaPublica(modo) {
  const { items } = cargarDatos(modo);
  return items
    .map((it) => ({ id: it.id, nombre: it.nombre, busqueda: it.busqueda }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function buscarItem(modo, id) {
  const { items } = cargarDatos(modo);
  return items.find((it) => it.id === id) || null;
}
