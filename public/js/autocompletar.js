/** Buscador con autocompletado (teclado + mouse) para elegir un item. */

import { el, limpiar, normalizar } from './ui.js';

const MAX_SUGERENCIAS = 8;

export function crearBuscador({ items, placeholder, alElegir }) {
  const usados = new Set();
  let visibles = [];
  let activo = -1;
  let bloqueado = false;

  const entrada = el('input', {
    type: 'text',
    placeholder,
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-autocomplete': 'list',
    'aria-controls': 'lista-sugerencias'
  });

  const boton = el('button', { class: 'btn', type: 'submit' }, 'Adivinar');

  const lista = el('ul', {
    class: 'sugerencias',
    id: 'lista-sugerencias',
    role: 'listbox',
    hidden: true
  });

  const formulario = el(
    'form',
    { class: 'buscador', autocomplete: 'off' },
    el('div', { class: 'buscador-caja' }, entrada, boton),
    lista
  );

  function coincidencias(texto) {
    const q = normalizar(texto);
    if (!q) return [];

    const empiezan = [];
    const contienen = [];

    for (const item of items) {
      const donde = item.busqueda.findIndex((b) => b.includes(q));
      if (donde === -1) continue;
      (item.busqueda.some((b) => b.startsWith(q)) ? empiezan : contienen).push(item);
    }

    return [...empiezan, ...contienen].slice(0, MAX_SUGERENCIAS);
  }

  function pintar() {
    limpiar(lista);

    if (!visibles.length) {
      lista.hidden = true;
      entrada.setAttribute('aria-expanded', 'false');
      return;
    }

    visibles.forEach((item, i) => {
      const yaUsado = usados.has(item.id);
      lista.append(
        el(
          'li',
          {
            class: 'sugerencia' + (yaUsado ? ' usada' : ''),
            role: 'option',
            id: 'sug-' + item.id,
            'aria-selected': String(i === activo),
            onmousedown: (ev) => {
              ev.preventDefault();
              elegir(item);
            }
          },
          el('span', {}, item.nombre),
          yaUsado ? el('small', {}, 'ya usado') : null
        )
      );
    });

    lista.hidden = false;
    entrada.setAttribute('aria-expanded', 'true');

    const opcion = lista.children[activo];
    if (opcion) {
      opcion.scrollIntoView({ block: 'nearest' });
      entrada.setAttribute('aria-activedescendant', opcion.id);
    } else {
      entrada.removeAttribute('aria-activedescendant');
    }
  }

  function cerrar() {
    visibles = [];
    activo = -1;
    pintar();
  }

  function elegir(item) {
    if (bloqueado || !item || usados.has(item.id)) return;
    entrada.value = '';
    cerrar();
    alElegir(item);
  }

  entrada.addEventListener('input', () => {
    visibles = coincidencias(entrada.value);
    activo = visibles.length ? 0 : -1;
    pintar();
  });

  entrada.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!visibles.length) return;
      ev.preventDefault();
      const paso = ev.key === 'ArrowDown' ? 1 : -1;
      activo = (activo + paso + visibles.length) % visibles.length;
      pintar();
    } else if (ev.key === 'Enter') {
      // No dependemos del envío implícito del formulario: en algunos
      // navegadores no se dispara con el desplegable abierto.
      ev.preventDefault();
      formulario.requestSubmit();
    } else if (ev.key === 'Escape') {
      cerrar();
    }
  });

  entrada.addEventListener('blur', () => setTimeout(cerrar, 120));

  entrada.addEventListener('focus', () => {
    if (entrada.value.trim()) {
      visibles = coincidencias(entrada.value);
      activo = visibles.length ? 0 : -1;
      pintar();
    }
  });

  formulario.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const elegido = visibles[activo] || coincidencias(entrada.value)[0];
    if (!elegido) {
      entrada.focus();
      return;
    }
    elegir(elegido);
  });

  return {
    nodo: formulario,
    enfocar: () => entrada.focus(),
    marcarUsado: (id) => usados.add(id),
    bloquear: (mensaje) => {
      bloqueado = true;
      entrada.disabled = true;
      boton.disabled = true;
      if (mensaje) entrada.placeholder = mensaje;
      cerrar();
    }
  };
}
