/** Utilidades de interfaz compartidas por todas las vistas. */

/** Crea un elemento: el('div', { class: 'x' }, 'texto', otroNodo) */
export function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(props || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class') nodo.className = valor;
    else if (clave === 'html') nodo.innerHTML = valor;
    else if (clave === 'dataset') Object.assign(nodo.dataset, valor);
    else if (clave === 'style') Object.assign(nodo.style, valor);
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }

  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

export function limpiar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

// --- Avisos ----------------------------------------------------------------

let temporizadorAviso;

export function aviso(mensaje, esError = false) {
  const caja = document.getElementById('aviso');
  caja.textContent = mensaje;
  caja.classList.toggle('error', esError);
  caja.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => caja.classList.remove('visible'), 2600);
}

// --- Cuenta regresiva ------------------------------------------------------

function dosDigitos(n) {
  return String(n).padStart(2, '0');
}

/** Actualiza `nodo` con el tiempo restante hasta `iso`. Devuelve un stop(). */
export function cuentaRegresiva(nodo, iso, alTerminar) {
  const objetivo = new Date(iso).getTime();
  let id;

  const tick = () => {
    const resto = objetivo - Date.now();
    if (resto <= 0) {
      nodo.textContent = '¡Ya hay desafío nuevo!';
      clearInterval(id);
      if (alTerminar) alTerminar();
      return;
    }
    const h = Math.floor(resto / 3600000);
    const m = Math.floor((resto % 3600000) / 60000);
    const s = Math.floor((resto % 60000) / 1000);
    nodo.textContent = dosDigitos(h) + ':' + dosDigitos(m) + ':' + dosDigitos(s);
  };

  tick();
  id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

// --- Portapapeles / compartir ---------------------------------------------

export async function compartir(texto) {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return 'compartido';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelado';
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    return 'copiado';
  } catch {
    // Último recurso para navegadores sin permiso de portapapeles.
    const area = el('textarea', { style: { position: 'fixed', opacity: '0' } }, texto);
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok ? 'copiado' : 'error';
  }
}

// --- Texto -----------------------------------------------------------------

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function fechaLegible(iso) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  } catch {
    return iso;
  }
}

export function urlMapa(nombre) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(nombre + ', Osorno, Chile');
}
