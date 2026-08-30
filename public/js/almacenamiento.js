/**
 * Persistencia local: partida en curso + estadísticas por modo.
 * Todo vive en el navegador del jugador, no hay cuentas ni servidor de perfiles.
 */

const PREFIJO = 'osornodle:v1:';

function leer(clave, porDefecto) {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    return crudo ? JSON.parse(crudo) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* modo incógnito o almacenamiento lleno: el juego sigue funcionando */
  }
}

// --- Partida del día -------------------------------------------------------

const partidaVacia = (dia) => ({
  dia,
  intentos: [],
  filas: [],
  fallidos: 0,
  terminado: false,
  gano: false,
  respuesta: null,
  nivel: 0
});

export function cargarPartida(modo, dia) {
  const guardada = leer('partida:' + modo, null);
  if (!guardada || guardada.dia !== dia) return partidaVacia(dia);
  return { ...partidaVacia(dia), ...guardada };
}

export function guardarPartida(modo, partida) {
  escribir('partida:' + modo, partida);
}

// --- Estadísticas ----------------------------------------------------------

const statsVacias = () => ({
  jugadas: 0,
  ganadas: 0,
  racha: 0,
  mejorRacha: 0,
  ultimoDia: null,
  distribucion: {}
});

export function cargarStats(modo) {
  return { ...statsVacias(), ...leer('stats:' + modo, {}) };
}

export function guardarStats(modo, stats) {
  escribir('stats:' + modo, stats);
}

/**
 * Registra el fin de una partida. Es idempotente por día: si ya se registró
 * el día actual no vuelve a sumar (evita duplicar al recargar).
 */
export function registrarResultado(modo, dia, gano, intentos) {
  const stats = cargarStats(modo);
  if (stats.ultimoDia === dia) return stats;

  const consecutivo = stats.ultimoDia === dia - 1;
  stats.jugadas += 1;

  if (gano) {
    stats.ganadas += 1;
    stats.racha = consecutivo ? stats.racha + 1 : 1;
    stats.mejorRacha = Math.max(stats.mejorRacha, stats.racha);
    const cubo = intentos >= 8 ? '8+' : String(intentos);
    stats.distribucion[cubo] = (stats.distribucion[cubo] || 0) + 1;
  } else {
    stats.racha = 0;
  }

  stats.ultimoDia = dia;
  guardarStats(modo, stats);
  return stats;
}

/** La racha se corta sola si el jugador se saltó un día. */
export function rachaVigente(stats, diaActual) {
  if (stats.ultimoDia === null) return 0;
  if (stats.ultimoDia === diaActual || stats.ultimoDia === diaActual - 1) return stats.racha;
  return 0;
}

export function borrarTodo() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIJO))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nada que hacer */
  }
}
