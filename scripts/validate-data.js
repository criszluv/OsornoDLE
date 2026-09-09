/**
 * Revisa los archivos de data/ antes de publicar.
 *
 *   npm run validate
 *
 * Detecta: campos faltantes, ids/nombres duplicados, imágenes que no existen,
 * valores escritos de una sola forma (posibles typos) e items sin verificar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODOS } from '../server/lib/modes.js';
import { cargarDatos, normalizar } from '../server/lib/datos.js';
import { seleccionDelDia, indiceDia, fechaJuego } from '../server/lib/daily.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let errores = 0;
let advertencias = 0;

const error = (msg) => {
  errores++;
  console.log('  ✗ ' + msg);
};
const alerta = (msg) => {
  advertencias++;
  console.log('  ! ' + msg);
};

console.log('\nOsornodle · validación de datos');
console.log('Fecha de juego: ' + fechaJuego() + ' (día ' + indiceDia() + ')\n');

for (const modo of MODOS) {
  console.log('── ' + modo.emoji + ' ' + modo.nombre + ' (data/' + modo.archivo + ')');

  let items;
  try {
    items = cargarDatos(modo).items;
  } catch (err) {
    error(err.message);
    console.log('');
    continue;
  }

  if (!items.length) {
    error('no hay items activos');
    console.log('');
    continue;
  }

  // Nombres repetidos (aunque el id sea distinto, confunden al buscador).
  const porNombre = new Map();
  for (const item of items) {
    const clave = normalizar(item.nombre);
    if (porNombre.has(clave)) error('nombre repetido: "' + item.nombre + '"');
    porNombre.set(clave, item);
  }

  // Atributos obligatorios según la configuración del modo.
  for (const attr of modo.atributos) {
    const faltan = items.filter((it) => {
      const v = it[attr.key];
      return v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    });
    if (faltan.length) {
      const lista = faltan.slice(0, 4).map((i) => i.id).join(', ');
      const resto = faltan.length > 4 ? ' (+' + (faltan.length - 4) + ')' : '';
      const nulosOk = attr.tipo === 'numeric';
      const decir = nulosOk ? alerta : error;
      decir('sin "' + attr.key + '": ' + lista + resto);
    }

    // Vocabulario cerrado: cualquier valor fuera de la lista es un typo.
    if (attr.valores) {
      const permitidos = new Set(attr.valores.map(normalizar));
      const fuera = new Set();
      items.forEach((it) => {
        const valores = Array.isArray(it[attr.key]) ? it[attr.key] : [it[attr.key]];
        valores.forEach((v) => {
          if (v && !permitidos.has(normalizar(v))) fuera.add(v);
        });
      });
      if (fuera.size) {
        error('"' + attr.key + '" con valores no permitidos: ' + [...fuera].join(', '));
        console.log('    permitidos: ' + attr.valores.join(' | '));
      }
    }
  }

  // Frases del modo por descripción.
  if (modo.tipo === 'frases') {
    for (const item of items) {
      const frases = Array.isArray(item.frases) ? item.frases : [];
      if (frases.length < 2) {
        error(item.id + ' necesita al menos 2 frases (tiene ' + frases.length + ')');
        continue;
      }
      const nombre = normalizar(item.nombre);
      frases.forEach((f, i) => {
        // Una frase que nombra el lugar regala la respuesta.
        if (normalizar(f).includes(nombre)) {
          error(item.id + ': la frase ' + (i + 1) + ' menciona el nombre del lugar');
        }
      });
    }
    const promedio = items.reduce((s, i) => s + (i.frases || []).length, 0) / items.length;
    console.log('  · ' + promedio.toFixed(1) + ' frases por item en promedio');
  }

  // Imágenes del modo visual.
  if (modo.tipo === 'imagen') {
    for (const item of items) {
      if (!item.imagen) {
        error(item.id + ' no tiene campo "imagen"');
        continue;
      }
      if (!fs.existsSync(path.join(RAIZ, 'public', item.imagen))) {
        error('falta el archivo public/' + item.imagen + ' (' + item.id + ')');
      }
    }
  }

  const sinVerificar = items.filter((it) => it.verificado !== true);
  if (sinVerificar.length) {
    alerta(sinVerificar.length + ' de ' + items.length + ' items sin verificar (verificado: true)');
  }

  // Vista previa de la rotación.
  const dia = indiceDia();
  const proximos = [];
  for (let i = 0; i < 5; i++) {
    const item = seleccionDelDia(modo.id, items, dia + i);
    proximos.push((i === 0 ? 'hoy' : '+' + i) + ': ' + item.nombre);
  }
  console.log('  ✓ ' + items.length + ' items · ciclo de ' + items.length + ' días sin repetir');
  console.log('    ' + proximos.join(' | '));
  console.log('');
}

console.log('Resultado: ' + errores + ' error(es), ' + advertencias + ' advertencia(s).\n');
process.exit(errores ? 1 : 0);
