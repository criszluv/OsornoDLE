/**
 * Muestra las respuestas de hoy (y de los próximos días) sin abrir el navegador.
 *
 *   npm run hoy          -> respuestas de hoy
 *   node scripts/hoy.js 7 -> las de los próximos 7 días
 */

import { MODOS } from '../server/lib/modes.js';
import { cargarDatos } from '../server/lib/datos.js';
import { indiceDia, fechaJuego, seleccionDelDia } from '../server/lib/daily.js';

const dias = Math.max(1, Number(process.argv[2]) || 1);
const hoy = indiceDia();

console.log('\nOsornodle · ' + fechaJuego() + ' (desafío #' + (hoy + 1) + ')\n');

for (let i = 0; i < dias; i++) {
  const dia = hoy + i;
  const etiqueta = i === 0 ? 'HOY  ' : '+' + String(i).padEnd(4);
  const respuestas = MODOS.map((modo) => {
    try {
      const { items } = cargarDatos(modo);
      return modo.emoji + ' ' + seleccionDelDia(modo.id, items, dia).nombre;
    } catch (err) {
      return modo.emoji + ' (' + err.message + ')';
    }
  });
  console.log(etiqueta + '#' + (dia + 1) + '  ' + respuestas.join('   ·   '));
}

console.log('');
