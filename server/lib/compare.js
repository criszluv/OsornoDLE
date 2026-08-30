/**
 * Comparacion de un intento contra la respuesta del dia.
 * Devuelve una celda por atributo, lista para pintar en el frontend.
 *
 * estado: 'correcto' (verde) | 'parcial' (amarillo) | 'incorrecto' (rojo)
 * flecha: 'arriba' | 'abajo' | null  (solo en atributos numericos)
 */

const norm = (v) => (v === null || v === undefined || v === '' ? null : v);

function comoArray(v) {
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined && x !== '');
  if (norm(v) === null) return [];
  return [v];
}

function compararTexto(a, b) {
  if (norm(a) === null || norm(b) === null) return false;
  return String(a).trim().toLocaleLowerCase('es') === String(b).trim().toLocaleLowerCase('es');
}

function celdaNumerica(attr, intento, respuesta) {
  const g = Number(intento);
  const r = Number(respuesta);
  const sinDato = attr.sinDato || '?';

  if (!Number.isFinite(g) || !Number.isFinite(r)) {
    return {
      estado: 'incorrecto',
      flecha: null,
      texto: Number.isFinite(g) ? String(g) : sinDato,
      desconocido: true
    };
  }
  if (g === r) return { estado: 'correcto', flecha: null, texto: String(g) };

  const cerca = attr.cerca ?? 0;
  return {
    estado: cerca && Math.abs(g - r) <= cerca ? 'parcial' : 'incorrecto',
    flecha: g < r ? 'arriba' : 'abajo',
    texto: String(g)
  };
}

function celdaMulti(intento, respuesta) {
  const g = comoArray(intento);
  const r = comoArray(respuesta);
  const enComun = g.filter((x) => r.some((y) => compararTexto(x, y)));

  let estado = 'incorrecto';
  if (g.length === r.length && enComun.length === g.length && g.length > 0) estado = 'correcto';
  else if (enComun.length > 0) estado = 'parcial';

  return {
    estado,
    flecha: null,
    texto: g.length ? g.join(', ') : '—',
    partes: g.map((x) => ({
      texto: x,
      coincide: r.some((y) => compararTexto(x, y))
    }))
  };
}

export function compararAtributo(attr, itemIntento, itemRespuesta) {
  const intento = itemIntento[attr.key];
  const respuesta = itemRespuesta[attr.key];

  switch (attr.tipo) {
    case 'numeric':
      return celdaNumerica(attr, intento, respuesta);

    case 'multi':
      return celdaMulti(intento, respuesta);

    case 'boolean': {
      const g = Boolean(intento);
      const texto = g ? attr.etiquetaVerdadero || 'Si' : attr.etiquetaFalso || 'No';
      return { estado: g === Boolean(respuesta) ? 'correcto' : 'incorrecto', flecha: null, texto };
    }

    case 'color':
      return {
        estado: compararTexto(intento, respuesta) ? 'correcto' : 'incorrecto',
        flecha: null,
        texto: norm(intento) ?? '—',
        hex: attr.campoHex ? itemIntento[attr.campoHex] || null : null
      };

    default:
      return {
        estado: compararTexto(intento, respuesta) ? 'correcto' : 'incorrecto',
        flecha: null,
        texto: norm(intento) ?? '—'
      };
  }
}

/** Compara un item completo. */
export function compararItem(modo, itemIntento, itemRespuesta) {
  const celdas = modo.atributos.map((attr) => ({
    key: attr.key,
    ...compararAtributo(attr, itemIntento, itemRespuesta)
  }));

  return {
    id: itemIntento.id,
    nombre: itemIntento.nombre,
    correcto: itemIntento.id === itemRespuesta.id,
    celdas
  };
}
