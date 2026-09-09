import { MODOS, MODOS_POR_ID, configPublica } from '../lib/modes.js';
import { cargarDatos, listaPublica, buscarItem } from '../lib/datos.js';
import { indiceDia, fechaJuego, proximoReinicio, seleccionDelDia, TZ, EPOCH } from '../lib/daily.js';
import { compararItem } from '../lib/compare.js';
import { crearToken, leerToken } from '../lib/token.js';
import { pixelar, rutaImagen, pixeladoEnServidor } from '../lib/imagen.js';

const json = (res, codigo, cuerpo) => {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(texto)
  });
  res.end(texto);
};

const error = (res, codigo, mensaje) => json(res, codigo, { error: mensaje });

async function leerCuerpo(req) {
  const partes = [];
  let total = 0;
  for await (const trozo of req) {
    total += trozo.length;
    if (total > 64 * 1024) throw new Error('cuerpo demasiado grande');
    partes.push(trozo);
  }
  if (!partes.length) return {};
  return JSON.parse(Buffer.concat(partes).toString('utf8'));
}

/** Respuesta del dia para un modo (item completo, uso interno). */
function respuestaDelDia(modo, dia) {
  const { items } = cargarDatos(modo);
  const item = seleccionDelDia(modo.id, items, dia);
  if (!item) throw new Error('No hay items cargados para el modo ' + modo.id);
  return { item, total: items.length };
}

function formatearValor(attr, valor) {
  if (Array.isArray(valor)) return valor.join(', ');
  if (attr.tipo === 'boolean') {
    return valor ? attr.etiquetaVerdadero || 'Si' : attr.etiquetaFalso || 'No';
  }
  if (valor === null || valor === undefined || valor === '') return attr.sinDato || '—';
  return String(valor);
}

/** Datos que se pueden mostrar una vez resuelto (o al rendirse). */
function fichaRevelada(modo, item) {
  const ficha = {
    id: item.id,
    nombre: item.nombre,
    descripcion: item.descripcion || null,
    direccion: item.direccion || null,
    imagen: item.imagen || null,
    credito: item.credito || null,
    mapa: item.mapa || null,
    atributos: modo.atributos.map((a) => ({
      label: a.label,
      valor: formatearValor(a, item[a.key])
    }))
  };
  if (modo.tipo === 'imagen') {
    ficha.rubro = item.rubro || null;
    ficha.sector = item.sector || null;
  }
  if (modo.tipo === 'frases') {
    ficha.tipo = item.tipo || null;
    ficha.sector = item.sector || null;
  }
  return ficha;
}

/**
 * Frases reveladas segun los intentos fallidos: siempre al menos una, y
 * una mas por cada fallo, sin pasarse del total.
 */
function frasesVisibles(item, fallidos) {
  const todas = Array.isArray(item.frases) ? item.frases : [];
  return todas.slice(0, Math.min(fallidos + 1, todas.length));
}

function pistasVisibles(modo, item, fallidos) {
  return (modo.pistas || [])
    .filter((p) => fallidos >= p.desde && item[p.key])
    .map((p) => ({ label: p.label, valor: String(item[p.key]) }));
}

function nivelImagen(modo, fallidos) {
  const niveles = modo.nivelesImagen || [0];
  return Math.min(Math.max(fallidos, 0), niveles.length - 1);
}

function cabeceraDia(modo, dia) {
  const { total } = respuestaDelDia(modo, dia);
  return {
    modo: modo.id,
    dia,
    numero: dia + 1,
    fecha: fechaJuego(),
    proximoReinicio: proximoReinicio(),
    totalItems: total
  };
}

// --- handlers --------------------------------------------------------------

async function getConfig(res) {
  json(res, 200, {
    modos: configPublica(),
    zonaHoraria: TZ,
    epoch: EPOCH,
    pixeladoEnServidor: await pixeladoEnServidor(),
    fecha: fechaJuego(),
    dia: indiceDia(),
    proximoReinicio: proximoReinicio()
  });
}

function getEstado(res) {
  const dia = indiceDia();
  json(res, 200, {
    dia,
    fecha: fechaJuego(),
    proximoReinicio: proximoReinicio(),
    modos: MODOS.map((m) => {
      let total = 0;
      try {
        total = cargarDatos(m).items.length;
      } catch {
        total = 0;
      }
      return { id: m.id, nombre: m.nombre, numero: dia + 1, totalItems: total };
    })
  });
}

function getItems(res, modo) {
  json(res, 200, { modo: modo.id, items: listaPublica(modo) });
}

function getDaily(res, modo, params) {
  const dia = indiceDia();
  const cabecera = cabeceraDia(modo, dia);

  if (modo.tipo === 'imagen') {
    // `fallidos` permite retomar una partida en curso tras recargar la pagina.
    const fallidos = Math.max(0, Number(params?.get('fallidos')) || 0);
    const { item } = respuestaDelDia(modo, dia);
    const nivel = nivelImagen(modo, fallidos);
    cabecera.nivel = nivel;
    cabecera.nivelesTotales = (modo.nivelesImagen || [0]).length;
    cabecera.imagenToken = crearToken(modo.id, dia, nivel);
    cabecera.pistas = pistasVisibles(modo, item, fallidos);
  }

  if (modo.tipo === 'frases') {
    const fallidos = Math.max(0, Number(params?.get('fallidos')) || 0);
    const { item } = respuestaDelDia(modo, dia);
    cabecera.frases = frasesVisibles(item, fallidos);
    cabecera.frasesTotales = (item.frases || []).length;
    cabecera.pistas = pistasVisibles(modo, item, fallidos);
  }

  json(res, 200, cabecera);
}

async function postGuess(req, res, modo) {
  let cuerpo;
  try {
    cuerpo = await leerCuerpo(req);
  } catch {
    return error(res, 400, 'Cuerpo invalido');
  }

  const intento = buscarItem(modo, String(cuerpo.id || ''));
  if (!intento) return error(res, 404, 'No conozco esa opcion. Elige una de la lista.');

  const dia = indiceDia();
  const { item: respuesta } = respuestaDelDia(modo, dia);
  const correcto = intento.id === respuesta.id;

  // Intentos fallidos previos que declara el jugador; este suma uno si falla.
  const previos = Number.isInteger(cuerpo.fallidos) ? Math.max(0, cuerpo.fallidos) : 0;
  const fallidos = correcto ? previos : previos + 1;

  const salida = {
    correcto,
    dia,
    numero: dia + 1,
    intento: { id: intento.id, nombre: intento.nombre }
  };

  if (modo.tipo === 'imagen') {
    const nivel = correcto ? modo.nivelesImagen.length - 1 : nivelImagen(modo, fallidos);
    salida.nivel = nivel;
    salida.nivelesTotales = modo.nivelesImagen.length;
    salida.imagenToken = crearToken(modo.id, dia, nivel);
    salida.pistas = pistasVisibles(modo, respuesta, fallidos);
  } else if (modo.tipo === 'frases') {
    // Al acertar se muestran todas: ya no hay nada que proteger.
    salida.frases = correcto ? respuesta.frases || [] : frasesVisibles(respuesta, fallidos);
    salida.frasesTotales = (respuesta.frases || []).length;
    salida.pistas = pistasVisibles(modo, respuesta, fallidos);
  } else {
    salida.fila = compararItem(modo, intento, respuesta);
  }

  if (correcto) salida.respuesta = fichaRevelada(modo, respuesta);
  json(res, 200, salida);
}

function postRendirse(res, modo) {
  const dia = indiceDia();
  const { item } = respuestaDelDia(modo, dia);
  const salida = { dia, numero: dia + 1, respuesta: fichaRevelada(modo, item) };
  if (modo.tipo === 'imagen') {
    salida.nivel = modo.nivelesImagen.length - 1;
    salida.imagenToken = crearToken(modo.id, dia, salida.nivel);
  }
  if (modo.tipo === 'frases') {
    salida.frases = item.frases || [];
    salida.frasesTotales = (item.frases || []).length;
  }
  json(res, 200, salida);
}

async function getImagen(res, modo, params) {
  if (modo.tipo !== 'imagen') return error(res, 404, 'Este modo no usa imagenes');

  const datos = leerToken(modo.id, params.get('token'));
  if (!datos) return error(res, 403, 'Token de imagen invalido');

  const diaActual = indiceDia();
  if (datos.dia !== diaActual) return error(res, 410, 'Ese desafio ya expiro, recarga la pagina');

  const { item } = respuestaDelDia(modo, datos.dia);
  const ruta = rutaImagen(item.imagen);
  if (!ruta) {
    return error(res, 404, 'Falta la imagen del item "' + item.id + '" (' + (item.imagen || 'sin ruta') + ')');
  }

  const niveles = modo.nivelesImagen;
  const anchoBloques = niveles[Math.min(datos.nivel, niveles.length - 1)];

  const pixelada = await pixelar(ruta, anchoBloques);
  if (pixelada) {
    res.writeHead(200, {
      'Content-Type': pixelada.tipo,
      'Cache-Control': 'no-store',
      'X-Pixelado': 'servidor',
      'Content-Length': pixelada.buffer.length
    });
    return res.end(pixelada.buffer);
  }

  // Sin sharp: entregamos la original y avisamos al cliente que la pixele el.
  const { createReadStream } = await import('node:fs');
  const ext = ruta.split('.').pop().toLowerCase();
  const tipos = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif'
  };
  res.writeHead(200, {
    'Content-Type': tipos[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Pixelado': 'cliente',
    'X-Bloques': String(anchoBloques)
  });
  createReadStream(ruta).pipe(res);
}

// --- router ----------------------------------------------------------------

export async function manejarApi(req, res, url) {
  const partes = url.pathname.split('/').filter(Boolean); // ['api', modo, accion]
  if (partes[0] !== 'api') return false;

  try {
    if (partes.length === 2 && partes[1] === 'config' && req.method === 'GET') {
      await getConfig(res);
      return true;
    }
    if (partes.length === 2 && partes[1] === 'estado' && req.method === 'GET') {
      getEstado(res);
      return true;
    }

    const modo = MODOS_POR_ID[partes[1]];
    if (!modo) {
      error(res, 404, 'Modo desconocido');
      return true;
    }

    const accion = partes[2] || '';
    if (req.method === 'GET' && accion === 'items') getItems(res, modo);
    else if (req.method === 'GET' && accion === 'daily') getDaily(res, modo, url.searchParams);
    else if (req.method === 'GET' && accion === 'imagen') await getImagen(res, modo, url.searchParams);
    else if (req.method === 'POST' && accion === 'guess') await postGuess(req, res, modo);
    else if (req.method === 'POST' && accion === 'rendirse') postRendirse(res, modo);
    else error(res, 404, 'Ruta no encontrada');

    return true;
  } catch (err) {
    console.error('[api]', err);
    error(res, 500, err.message || 'Error interno');
    return true;
  }
}
