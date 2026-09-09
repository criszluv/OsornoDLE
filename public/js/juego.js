/** Vista de juego: sirve tanto para los modos deductivos como para el visual. */

import { api } from './api.js';
import { el, limpiar, aviso, cuentaRegresiva, compartir, urlMapa } from './ui.js';
import { crearBuscador } from './autocompletar.js';
import { cargarPartida, guardarPartida, borrarPartida, registrarResultado } from './almacenamiento.js';

const EMOJI = { correcto: '🟩', parcial: '🟨', incorrecto: '🟥' };
const INTENTOS_PARA_RENDIRSE = 5;

let limpiezaVista = [];

/** Cancela temporizadores de la vista anterior. */
export function desmontarJuego() {
  limpiezaVista.forEach((fn) => fn());
  limpiezaVista = [];
}

export async function vistaJuego(contenedor, modo, contexto) {
  limpiar(contenedor).append(el('p', { class: 'cargando-texto' }, 'Cargando el desafío de hoy...'));

  let items, daily, partida;
  try {
    const primera = await Promise.all([api.items(modo.id), api.daily(modo.id, 0)]);
    items = primera[0].items;
    daily = primera[1];
    partida = cargarPartida(modo.id, daily.dia);

    // Los modos con revelado progresivo (foto o frases) necesitan volver a
    // pedir el estado en el punto donde iba la partida guardada.
    const progresivo = modo.tipo === 'imagen' || modo.tipo === 'frases';
    if (progresivo && (partida.fallidos > 0 || partida.terminado)) {
      const tope = modo.tipo === 'imagen' ? modo.nivelesImagen.length - 1 : 99;
      daily = await api.daily(modo.id, partida.terminado ? tope : partida.fallidos);
    }
  } catch (err) {
    limpiar(contenedor).append(
      el('div', { class: 'error-caja' }, el('p', {}, 'No se pudo cargar el desafío: ' + err.message))
    );
    return;
  }

  const estado = { modo, items, daily, partida, contexto };
  limpiar(contenedor);
  contenedor.append(cabecera(estado));

  const zonaJuego = el('div', { class: 'zona-juego' });
  const zonaResultado = el('div', { class: 'zona-resultado' });
  contenedor.append(zonaJuego, zonaResultado);

  estado.zonaJuego = zonaJuego;
  estado.zonaResultado = zonaResultado;

  if (modo.tipo === 'imagen') montarImagen(estado);
  else if (modo.tipo === 'frases') montarFrases(estado);
  else montarDeductivo(estado);
}

// --- Piezas comunes --------------------------------------------------------

function cabecera({ modo, daily, items }) {
  return el(
    'section',
    { class: 'juego-cabecera' },
    el('h1', {}, modo.emoji + ' ' + modo.titulo),
    el('p', {}, modo.descripcion),
    el(
      'div',
      { class: 'meta' },
      el('span', { class: 'chip' }, 'Desafío #' + daily.numero),
      el('span', { class: 'chip' }, items.length + ' opciones'),
      el('span', { class: 'chip', id: 'chip-intentos' }, 'Intentos: 0')
    )
  );
}

function actualizarChipIntentos(n) {
  const chip = document.getElementById('chip-intentos');
  if (chip) chip.textContent = 'Intentos: ' + n;
}

function guardar(estado) {
  guardarPartida(estado.modo.id, estado.partida);
}

function terminar(estado, gano, respuesta) {
  const { partida, modo, daily } = estado;
  partida.terminado = true;
  partida.gano = gano;
  partida.respuesta = respuesta || partida.respuesta;
  guardar(estado);
  registrarResultado(modo.id, daily.dia, gano, partida.intentos.length);
  if (estado.contexto.alTerminar) estado.contexto.alTerminar();
  estado.buscador.bloquear(gano ? '¡Resuelto por hoy!' : 'Vuelve mañana');
  pintarResultado(estado);
}

function pintarResultado(estado) {
  const { partida, modo, daily, zonaResultado } = estado;
  const respuesta = partida.respuesta;
  limpiar(zonaResultado);
  if (!partida.terminado || !respuesta) return;

  const intentos = partida.intentos.length;
  const caja = el('section', { class: 'resultado' + (partida.gano ? ' gano' : '') });

  caja.append(
    el('h2', {}, partida.gano ? '¡Correcto!' : 'Se acabó por hoy'),
    el('div', { class: 'respuesta' }, respuesta.nombre),
    el(
      'p',
      {},
      partida.gano
        ? intentos === 1
          ? 'A la primera. Impresionante.'
          : 'Lo sacaste en ' + intentos + ' intentos.'
        : 'Esa era la respuesta del desafío #' + daily.numero + '.'
    )
  );

  // En el modo visual la foto ya está arriba; aquí sería repetirla.
  if (modo.tipo !== 'imagen' && respuesta.imagen) {
    caja.prepend(
      el('img', {
        class: 'resultado-foto',
        src: respuesta.imagen,
        alt: 'Foto de ' + respuesta.nombre,
        loading: 'lazy'
      })
    );
  }

  if (respuesta.descripcion) caja.append(el('p', {}, respuesta.descripcion));

  // Atribución de la foto: obligatoria con licencias tipo CC BY.
  if (respuesta.credito) caja.append(el('p', { class: 'credito-foto' }, 'Foto: ' + respuesta.credito));

  const datos = el('div', { class: 'resultado-datos' });
  (respuesta.atributos || []).forEach((a) => datos.append(el('span', { class: 'chip' }, a.label + ': ' + a.valor)));
  if (respuesta.tipo) datos.append(el('span', { class: 'chip' }, respuesta.tipo));
  if (respuesta.rubro) datos.append(el('span', { class: 'chip' }, 'Rubro: ' + respuesta.rubro));
  if (respuesta.sector) datos.append(el('span', { class: 'chip' }, 'Sector: ' + respuesta.sector));
  if (respuesta.direccion) datos.append(el('span', { class: 'chip' }, '📍 ' + respuesta.direccion));
  if (datos.children.length) caja.append(datos);

  const acciones = el(
    'div',
    { class: 'resultado-acciones' },
    el(
      'button',
      {
        class: 'btn',
        type: 'button',
        onclick: async () => {
          const resultado = await compartir(textoCompartir(estado));
          if (resultado === 'copiado') aviso('¡Resultado copiado! Pégalo donde quieras.');
          else if (resultado === 'error') aviso('No se pudo copiar', true);
        }
      },
      '📋 Compartir resultado'
    ),
    el(
      'a',
      { class: 'btn secundario', href: urlMapa(respuesta.nombre), target: '_blank', rel: 'noopener' },
      '🗺️ Ver en el mapa'
    ),
    el(
      'button',
      {
        class: 'btn secundario',
        type: 'button',
        title: 'Borra tu partida de hoy en este modo y la empieza de cero',
        onclick: () => {
          borrarPartida(modo.id);
          location.reload();
        }
      },
      '🔄 Jugar de nuevo'
    )
  );
  caja.append(acciones);

  const reloj = el('strong', {}, '--:--:--');
  caja.append(el('div', { class: 'cuenta-regresiva' }, 'Próximo desafío de ' + modo.nombre + ' en', reloj));
  limpiezaVista.push(cuentaRegresiva(reloj, daily.proximoReinicio, () => location.reload()));

  zonaResultado.append(caja);
  caja.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function textoCompartir({ modo, partida, daily }) {
  const lineas = ['Osornodle ' + modo.emoji + ' ' + modo.nombre + ' #' + daily.numero];

  if (modo.tipo === 'imagen') {
    const fallidos = partida.fallidos;
    lineas.push('🟥'.repeat(fallidos) + (partida.gano ? '🟩' : ''));
    const nivel = Math.min(fallidos, modo.nivelesImagen.length - 1);
    lineas.push(
      partida.gano
        ? 'Reconocido con la foto al ' + porcentajeNitidez(modo, nivel) + '% de nitidez'
        : 'No lo saqué esta vez'
    );
  } else if (modo.tipo === 'frases') {
    lineas.push('🟥'.repeat(partida.fallidos) + (partida.gano ? '🟩' : ''));
    lineas.push(
      partida.gano
        ? 'Con ' + (partida.fallidos + 1) + ' pista(s) a la vista'
        : 'No lo saqué esta vez'
    );
  } else {
    partida.filas.forEach((fila) => {
      lineas.push(fila.celdas.map((c) => EMOJI[c.estado] || '⬜').join(''));
    });
    lineas.push(partida.gano ? partida.intentos.length + ' intento(s)' : 'Sin suerte hoy');
  }

  lineas.push(location.origin);
  return lineas.join('\n');
}

function porcentajeNitidez(modo, nivel) {
  const total = modo.nivelesImagen.length - 1;
  return Math.round((nivel / total) * 100);
}

function botonRendirse(estado) {
  return el(
    'div',
    { class: 'resultado-acciones', style: { marginTop: '18px' } },
    el(
      'button',
      {
        class: 'btn secundario',
        type: 'button',
        onclick: async () => {
          if (!confirm('¿Seguro? Se revelará la respuesta y contará como derrota.')) return;
          const datos = await api.rendirse(estado.modo.id);
          if (estado.modo.tipo === 'imagen') {
            estado.partida.fallidos = estado.modo.nivelesImagen.length - 1;
            await mostrarFoto(estado, datos.imagenToken);
          }
          if (estado.modo.tipo === 'frases' && estado.pintarFrases) {
            estado.pintarFrases(datos.frases, datos.frasesTotales, false);
          }
          terminar(estado, false, datos.respuesta);
        }
      },
      'Rendirse y ver la respuesta'
    )
  );
}

function refrescarRendirse(estado) {
  const previo = document.getElementById('zona-rendirse');
  if (previo) previo.remove();
  if (estado.partida.terminado || estado.partida.intentos.length < INTENTOS_PARA_RENDIRSE) return;
  const contenedor = botonRendirse(estado);
  contenedor.id = 'zona-rendirse';
  estado.zonaJuego.append(contenedor);
}

/** Crea el buscador y encadena el envío de intentos. */
function montarBuscador(estado, alResponder) {
  const { modo, items, partida } = estado;

  const buscador = crearBuscador({
    items,
    placeholder: modo.placeholder,
    alElegir: async (item) => {
      try {
        const respuesta = await api.adivinar(modo.id, item.id, partida.fallidos);
        buscador.marcarUsado(item.id);
        partida.intentos.push(item.id);
        if (!respuesta.correcto) partida.fallidos += 1;
        await alResponder(respuesta, item);
        actualizarChipIntentos(partida.intentos.length);
        guardar(estado);
        refrescarRendirse(estado);
      } catch (err) {
        aviso(err.message, true);
      }
    }
  });

  partida.intentos.forEach((id) => buscador.marcarUsado(id));
  estado.buscador = buscador;
  return buscador.nodo;
}

// --- Modo deductivo --------------------------------------------------------

function anchoColumnas(modo) {
  const columnas = ['minmax(120px, 1.5fr)'];
  modo.atributos.forEach((a) => columnas.push('minmax(84px, ' + (a.ancho || 1) + 'fr)'));
  return columnas.join(' ');
}

function celdaNodo(celda, indice, animar) {
  const hijos = [];

  if (celda.hex) {
    hijos.push(el('span', { class: 'punto-color', style: { background: celda.hex } }));
  }
  hijos.push(el('span', {}, celda.texto));
  if (celda.flecha) {
    hijos.push(el('span', { class: 'flecha' }, celda.flecha === 'arriba' ? '⬆️' : '⬇️'));
  }

  return el(
    'div',
    {
      class: 'celda ' + celda.estado,
      style: animar ? { animationDelay: indice * 0.09 + 's' } : null
    },
    ...hijos
  );
}

function filaNodo(fila, animar) {
  const nodo = el('div', { class: 'fila' + (animar ? ' nueva' : '') });
  nodo.append(
    el(
      'div',
      { class: 'celda nombre' + (fila.correcto ? ' correcto' : ''), style: animar ? { animationDelay: '0s' } : null },
      fila.nombre
    )
  );
  fila.celdas.forEach((celda, i) => nodo.append(celdaNodo(celda, i + 1, animar)));
  return nodo;
}

function montarDeductivo(estado) {
  const { modo, partida, zonaJuego } = estado;

  const grilla = el('div', { class: 'grilla' });
  grilla.style.setProperty('--cols', anchoColumnas(modo));

  const encabezado = el('div', { class: 'fila encabezado' }, el('div', { class: 'celda' }, 'Nombre'));
  modo.atributos.forEach((a) => encabezado.append(el('div', { class: 'celda' }, a.label)));

  const cuerpo = el('div', { class: 'grilla-cuerpo' });
  grilla.append(encabezado, cuerpo);

  zonaJuego.append(
    montarBuscador(estado, async (respuesta) => {
      partida.filas.push(respuesta.fila);
      cuerpo.prepend(filaNodo(respuesta.fila, true));
      if (respuesta.correcto) terminar(estado, true, respuesta.respuesta);
    }),
    el('div', { class: 'tabla' }, grilla),
    leyenda(modo)
  );

  // Reconstruye la partida guardada (más reciente arriba).
  partida.filas.forEach((fila) => cuerpo.prepend(filaNodo(fila, false)));
  actualizarChipIntentos(partida.intentos.length);

  if (partida.terminado) {
    estado.buscador.bloquear(partida.gano ? '¡Resuelto por hoy!' : 'Vuelve mañana');
    pintarResultado(estado);
  } else {
    estado.buscador.enfocar();
    refrescarRendirse(estado);
  }
}

function leyenda(modo) {
  const partes = [
    el('span', {}, el('i', { class: 'muestra correcto' }), 'Coincide'),
    el('span', {}, el('i', { class: 'muestra parcial' }), 'Parcial o cerca'),
    el('span', {}, el('i', { class: 'muestra incorrecto' }), 'No coincide')
  ];
  if (modo.atributos.some((a) => a.tipo === 'numeric')) {
    partes.push(el('span', {}, '⬆️ / ⬇️ la respuesta es mayor / menor'));
  }
  return el('div', { class: 'leyenda' }, ...partes);
}

// --- Modo por frases -------------------------------------------------------

function montarFrases(estado) {
  const { modo, partida, daily, zonaJuego } = estado;

  const lista = el('ol', { class: 'frases' });
  const contador = el('span', { class: 'frases-contador' }, '');
  const zonaPistas = el('div', { class: 'pistas' });
  const listaIntentos = el('ul', { class: 'intentos-lista' });
  estado.zonaPistas = zonaPistas;

  /** Repinta la lista; marca la última como recién revelada. */
  function pintarFrases(frases, total, animarUltima) {
    limpiar(lista);
    (frases || []).forEach((texto, i) => {
      const esUltima = i === frases.length - 1;
      lista.append(el('li', { class: 'frase' + (esUltima && animarUltima ? ' nueva' : '') }, texto));
    });
    const vistas = (frases || []).length;
    contador.textContent = vistas >= total ? 'Todas las pistas' : 'Pista ' + vistas + ' de ' + total;
  }

  estado.pintarFrases = pintarFrases;

  const buscador = montarBuscador(estado, async (respuesta, item) => {
    pintarFrases(respuesta.frases, respuesta.frasesTotales, true);
    pintarPistas(estado, respuesta.pistas);

    if (respuesta.correcto) {
      terminar(estado, true, respuesta.respuesta);
      return;
    }

    partida.filas.push({ nombre: item.nombre, correcto: false, celdas: [] });
    listaIntentos.prepend(el('li', { class: 'intento-fallido' }, item.nombre));
    if (respuesta.frases.length >= respuesta.frasesTotales) {
      aviso('Ya no quedan más pistas: es todo lo que se sabe del lugar.');
    }
  });

  zonaJuego.append(
    el(
      'section',
      { class: 'panel-frases' },
      el('header', { class: 'frases-cabecera' }, el('span', {}, '🧩 Pistas'), contador),
      lista
    ),
    zonaPistas,
    buscador,
    listaIntentos
  );

  partida.filas.forEach((fila) => listaIntentos.append(el('li', { class: 'intento-fallido' }, fila.nombre)));
  pintarFrases(daily.frases, daily.frasesTotales, false);
  pintarPistas(estado, daily.pistas);
  actualizarChipIntentos(partida.intentos.length);

  if (partida.terminado) {
    estado.buscador.bloquear(partida.gano ? '¡Resuelto por hoy!' : 'Vuelve mañana');
    pintarResultado(estado);
  } else {
    estado.buscador.enfocar();
    refrescarRendirse(estado);
  }
}

// --- Modo visual -----------------------------------------------------------

async function mostrarFoto(estado, token) {
  const { modo, marco } = estado;
  marco.classList.add('cargando');

  try {
    const res = await fetch(api.urlImagen(modo.id, token));
    if (!res.ok) throw new Error('No se pudo cargar la imagen');

    const pixelaCliente = res.headers.get('X-Pixelado') === 'cliente';
    const bloques = Number(res.headers.get('X-Bloques') || 0);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const lienzo = estado.lienzo;
    const ancho = 900;
    const alto = Math.round((bitmap.height / bitmap.width) * ancho) || 600;
    lienzo.width = ancho;
    lienzo.height = alto;

    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (pixelaCliente && bloques > 0) {
      // sharp no está disponible: pixelamos aquí (dos pasadas).
      const chicoAlto = Math.max(1, Math.round((bloques * bitmap.height) / bitmap.width));
      const temporal = document.createElement('canvas');
      temporal.width = bloques;
      temporal.height = chicoAlto;
      const tctx = temporal.getContext('2d');
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(bitmap, 0, 0, bloques, chicoAlto);
      ctx.drawImage(temporal, 0, 0, ancho, alto);
    } else {
      ctx.drawImage(bitmap, 0, 0, ancho, alto);
    }
    bitmap.close();
  } catch (err) {
    aviso(err.message, true);
  } finally {
    marco.classList.remove('cargando');
  }
}

function actualizarNitidez(estado) {
  const { modo, partida } = estado;
  const total = modo.nivelesImagen.length - 1;
  const nivel = partida.terminado ? total : Math.min(partida.fallidos, total);
  estado.barra.style.width = Math.max(6, (nivel / total) * 100) + '%';
  estado.etiquetaNitidez.textContent = 'Nitidez ' + nivel + '/' + total;
}

function pintarPistas(estado, pistas) {
  limpiar(estado.zonaPistas);
  (pistas || []).forEach((p) =>
    estado.zonaPistas.append(el('span', { class: 'chip pendiente' }, p.label + ': ' + p.valor))
  );
}

function montarImagen(estado) {
  const { modo, partida, daily, zonaJuego } = estado;

  const lienzo = el('canvas', { 'aria-label': 'Foto pixelada del local del día' });
  const marco = el('div', { class: 'foto-marco' }, lienzo);
  const barra = el('i', { style: { width: '6%' } });
  const etiquetaNitidez = el('span', {}, 'Nitidez 0/' + (modo.nivelesImagen.length - 1));
  const zonaPistas = el('div', { class: 'pistas' });
  const listaIntentos = el('ul', { class: 'intentos-lista' });

  Object.assign(estado, { lienzo, marco, barra, etiquetaNitidez, zonaPistas });

  const buscador = montarBuscador(estado, async (respuesta, item) => {
    await mostrarFoto(estado, respuesta.imagenToken);
    pintarPistas(estado, respuesta.pistas);

    if (respuesta.correcto) {
      terminar(estado, true, respuesta.respuesta);
    } else {
      partida.filas.push({ nombre: item.nombre, correcto: false, celdas: [] });
      listaIntentos.prepend(el('li', { class: 'intento-fallido' }, item.nombre));
      if (partida.fallidos >= modo.nivelesImagen.length - 1) {
        aviso('La foto ya está nítida. ¡Última oportunidad de reconocerla!');
      }
    }

    // Después de terminar(), para que la barra refleje la foto ya revelada.
    actualizarNitidez(estado);
  });

  zonaJuego.append(
    marco,
    el('div', { class: 'nitidez' }, etiquetaNitidez, el('div', { class: 'barra' }, barra)),
    zonaPistas,
    buscador,
    listaIntentos
  );

  partida.filas.forEach((fila) => listaIntentos.append(el('li', { class: 'intento-fallido' }, fila.nombre)));
  pintarPistas(estado, daily.pistas);
  actualizarNitidez(estado);
  actualizarChipIntentos(partida.intentos.length);
  mostrarFoto(estado, daily.imagenToken);

  if (partida.terminado) {
    estado.buscador.bloquear(partida.gano ? '¡Resuelto por hoy!' : 'Vuelve mañana');
    pintarResultado(estado);
  } else {
    estado.buscador.enfocar();
    refrescarRendirse(estado);
  }
}
