/** Arranque, navegación y modales de Osornodle. */

import { api } from './api.js';
import { el, limpiar, aviso, fechaLegible, cuentaRegresiva } from './ui.js';
import { cargarPartida, cargarStats, rachaVigente, borrarTodo } from './almacenamiento.js';
import { vistaJuego, desmontarJuego } from './juego.js';

const vista = document.getElementById('vista');
const navPestanas = document.getElementById('pestanas');

let config = null;
let limpiezaPortada = [];

// --- Arranque --------------------------------------------------------------

async function iniciar() {
  try {
    config = await api.config();
  } catch (err) {
    limpiar(vista).append(
      el(
        'div',
        { class: 'error-caja' },
        el('h2', {}, 'No se pudo contactar al servidor'),
        el('p', {}, err.message),
        el('p', {}, 'Revisa que el servidor esté corriendo (npm start).')
      )
    );
    return;
  }

  pintarPestanas();
  conectarModales();
  window.addEventListener('hashchange', enrutar);
  enrutar();
}

function modoActual() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  return config.modos.find((m) => m.id === id) || null;
}

function enrutar() {
  desmontarJuego();
  limpiezaPortada.forEach((fn) => fn());
  limpiezaPortada = [];

  const modo = modoActual();
  marcarPestanaActiva(modo);
  document.title = modo ? 'Osornodle · ' + modo.nombre : 'Osornodle · el juego diario de Osorno';

  if (modo) vistaJuego(vista, modo, { config, alTerminar: pintarPestanas });
  else vistaPortada();

  vista.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// --- Pestañas --------------------------------------------------------------

function estadoDelModo(modo) {
  const partida = cargarPartida(modo.id, config.dia);
  const stats = cargarStats(modo.id);
  return {
    terminado: partida.terminado,
    gano: partida.gano,
    intentos: partida.intentos.length,
    racha: rachaVigente(stats, config.dia)
  };
}

function pintarPestanas() {
  limpiar(navPestanas);
  config.modos.forEach((modo) => {
    const { terminado } = estadoDelModo(modo);
    navPestanas.append(
      el(
        'a',
        { class: 'pestana', href: '#/' + modo.id, 'data-modo': modo.id },
        el('span', {}, modo.emoji),
        el('span', {}, modo.nombre),
        terminado ? el('span', { class: 'punto', title: 'Ya lo jugaste hoy' }) : null
      )
    );
  });
  marcarPestanaActiva(modoActual());
}

function marcarPestanaActiva(modo) {
  navPestanas.querySelectorAll('.pestana').forEach((a) => {
    if (modo && a.dataset.modo === modo.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// --- Portada ---------------------------------------------------------------

function vistaPortada() {
  limpiar(vista);

  const reloj = el('strong', {}, '--:--:--');

  vista.append(
    el(
      'section',
      { class: 'hero' },
      el('h1', {}, 'Cuatro desafíos diarios sobre Osorno'),
      el(
        'p',
        {},
        'Un lugar, una institución, un local y una descripción nuevos cada día. Sin cuenta y sin ' +
          'instalar nada: juega y compite con tus amigos por resolverlo en menos intentos.'
      ),
      el('div', { class: 'hero-fecha' }, '📅 ' + fechaLegible(config.fecha) + ' · Desafío #' + (config.dia + 1))
    ),
    el('div', { class: 'tarjetas' }, ...config.modos.map(tarjetaModo)),
    el(
      'div',
      { class: 'cuenta-regresiva', style: { textAlign: 'center', marginTop: '30px' } },
      'Los desafíos cambian en',
      reloj
    )
  );

  limpiezaPortada.push(cuentaRegresiva(reloj, config.proximoReinicio, () => location.reload()));
}

function tarjetaModo(modo) {
  const { terminado, gano, intentos, racha } = estadoDelModo(modo);

  const estado = terminado
    ? el('span', { class: 'chip ok' }, gano ? '✓ Resuelto en ' + intentos : '✗ Jugado hoy')
    : el('span', { class: 'chip pendiente' }, '● Pendiente hoy');

  return el(
    'a',
    { class: 'tarjeta', href: '#/' + modo.id },
    el('span', { class: 'tarjeta-emoji' }, modo.emoji),
    el('h2', {}, modo.nombre),
    el('p', {}, modo.descripcion),
    el(
      'div',
      { class: 'tarjeta-pie' },
      estado,
      racha > 0 ? el('span', { class: 'chip' }, '🔥 Racha ' + racha) : null
    )
  );
}

// --- Modales ---------------------------------------------------------------

function conectarModales() {
  const modalAyuda = document.getElementById('modal-ayuda');

  const abrirAyuda = () => {
    pintarAyuda();
    modalAyuda.showModal();
  };

  document.getElementById('btn-ayuda').addEventListener('click', abrirAyuda);
  document.getElementById('btn-ayuda-pie').addEventListener('click', abrirAyuda);

  document.getElementById('btn-borrar').addEventListener('click', () => {
    if (!confirm('¿Borrar tus partidas guardadas? Podrás volver a jugar los desafíos de hoy desde cero.')) return;
    borrarTodo();
    aviso('Listo, puedes jugar de nuevo');
    pintarPestanas();
    enrutar();
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.querySelector('[data-cerrar]').addEventListener('click', () => modal.close());
    // Cerrar al hacer clic fuera de la caja.
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) modal.close();
    });
  });
}

function pintarAyuda() {
  const cuerpo = limpiar(document.getElementById('ayuda-cuerpo'));

  cuerpo.append(
    el('p', {}, 'Cada día hay cuatro desafíos independientes sobre Osorno. Se reinician a la medianoche.'),
    el('h3', {}, 'Los colores'),
    el(
      'ul',
      {},
      el('li', {}, el('b', {}, '🟩 Verde: '), 'el atributo coincide exactamente con la respuesta.'),
      el('li', {}, el('b', {}, '🟨 Amarillo: '), 'coincide en parte (o el número está cerca).'),
      el('li', {}, el('b', {}, '🟥 Rojo: '), 'no hay ninguna coincidencia.')
    )
  );

  config.modos.forEach((modo) => {
    cuerpo.append(el('h3', {}, modo.emoji + ' ' + modo.nombre), el('p', {}, modo.descripcion));
    if (modo.atributos.length) {
      cuerpo.append(
        el('p', {}, 'Atributos que se comparan: ' + modo.atributos.map((a) => a.label).join(', ') + '.')
      );
    }
    if (modo.tipo === 'imagen') {
      cuerpo.append(
        el(
          'p',
          {},
          'Cada intento fallido revela un poco más la foto (' +
            (modo.nivelesImagen.length - 1) +
            ' niveles de nitidez) y desbloquea pistas de texto.'
        )
      );
    }
    if (modo.tipo === 'frases') {
      cuerpo.append(
        el(
          'p',
          {},
          'Empiezas con una sola frase, la más vaga. Cada intento fallido suma otra, ' +
            'cada vez más específica. Aquí no hay colores: solo leer y deducir.'
        )
      );
    }
  });

  cuerpo.append(
    el('h3', {}, 'Tus datos'),
    el(
      'p',
      {},
      'No hay cuentas ni login: tus partidas se guardan solo en este navegador. Puedes borrarlas ' +
        'cuando quieras desde el pie de página, o repetir un desafío con el botón "Jugar de nuevo".'
    )
  );
}

iniciar();
