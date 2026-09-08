/**
 * Seleccion determinista del desafio diario.
 *
 * No hay base de datos ni cron: el "sorteo" se calcula a partir de la fecha.
 * Cualquier servidor (o cualquier persona con este codigo) obtiene el mismo
 * resultado para el mismo dia, y el historico es reproducible.
 *
 * Estrategia: cada ciclo de N dias (N = cantidad de items) se genera una
 * permutacion barajada con una semilla derivada del numero de ciclo y del
 * modo. Asi ningun item se repite hasta que se hayan usado todos.
 */

export const TZ = process.env.TZ_GAME || 'America/Santiago';
export const EPOCH = process.env.GAME_EPOCH || '2026-01-01';

const fmtFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const fmtHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

/** Fecha local de Osorno en formato YYYY-MM-DD. */
export function fechaJuego(fecha = new Date()) {
  return fmtFecha.format(fecha);
}

/** Dias transcurridos desde EPOCH (dia 0 = EPOCH). */
export function indiceDia(fecha = new Date()) {
  const hoy = Date.parse(`${fechaJuego(fecha)}T00:00:00Z`);
  const cero = Date.parse(`${EPOCH}T00:00:00Z`);
  return Math.round((hoy - cero) / 86400000);
}

/** Milisegundos que faltan para la medianoche de Osorno. */
export function msHastaProximo(fecha = new Date()) {
  const [h, m, s] = fmtHora.format(fecha).split(':').map(Number);
  const transcurrido = h * 3600 + m * 60 + s;
  return (86400 - transcurrido) * 1000;
}

/** Instante ISO del proximo cambio de desafio. */
export function proximoReinicio(fecha = new Date()) {
  return new Date(fecha.getTime() + msHastaProximo(fecha)).toISOString();
}

// --- PRNG determinista -----------------------------------------------------

function hashTexto(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permutacion(n, semilla) {
  const orden = Array.from({ length: n }, (_, i) => i);
  const rnd = mulberry32(semilla);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  return orden;
}

function semillaCiclo(modoId, ciclo) {
  return (hashTexto(`osornodle:${modoId}`) ^ Math.imul(ciclo + 1, 2654435761)) >>> 0;
}

function ordenDelCiclo(modoId, ciclo, n) {
  const orden = permutacion(n, semillaCiclo(modoId, ciclo));
  if (n < 6 || ciclo <= 0) return orden;

  // Dentro de un ciclo nunca hay repeticiones, pero en el borde entre dos
  // ciclos un item puede caer al final de uno y al principio del siguiente.
  // Aqui se exige una separacion minima: los primeros K del ciclo nuevo no
  // pueden estar entre los ultimos K del anterior.
  //
  // Los intercambios se hacen solo con posiciones intermedias [K, n-K), asi
  // la cola de un ciclo nunca cambia y se puede calcular a partir de la
  // permutacion cruda del ciclo anterior, sin recursion hacia atras.
  const k = Math.min(3, Math.floor(n / 4));
  if (k < 1) return orden;

  const anterior = permutacion(n, semillaCiclo(modoId, ciclo - 1));
  const recientes = new Set(anterior.slice(n - k));

  for (let i = 0; i < k; i++) {
    if (!recientes.has(orden[i])) continue;
    for (let j = k; j < n - k; j++) {
      if (!recientes.has(orden[j])) {
        [orden[i], orden[j]] = [orden[j], orden[i]];
        break;
      }
    }
  }
  return orden;
}

function modulo(a, n) {
  return ((a % n) + n) % n;
}

/**
 * Indice del item que corresponde jugar el dia `dia` para el modo `modoId`.
 */
export function indiceSeleccion(modoId, total, dia) {
  if (total <= 0) return -1;
  if (total === 1) return 0;
  const ciclo = Math.floor(dia / total);
  const posicion = modulo(dia, total);
  return ordenDelCiclo(modoId, ciclo, total)[posicion];
}

/** Item que corresponde jugar el dia `dia`. */
export function seleccionDelDia(modoId, items, dia) {
  const i = indiceSeleccion(modoId, items.length, dia);
  return i >= 0 ? items[i] : null;
}
