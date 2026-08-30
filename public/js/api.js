/** Cliente de la API de Osornodle. */

async function pedir(ruta, opciones = {}) {
  const res = await fetch(ruta, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones
  });

  let cuerpo = null;
  try {
    cuerpo = await res.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (!res.ok) {
    const error = new Error((cuerpo && cuerpo.error) || 'Error ' + res.status);
    error.codigo = res.status;
    throw error;
  }
  return cuerpo;
}

export const api = {
  config: () => pedir('/api/config'),
  estado: () => pedir('/api/estado'),
  items: (modo) => pedir('/api/' + modo + '/items'),
  daily: (modo, fallidos = 0) => pedir('/api/' + modo + '/daily?fallidos=' + fallidos),
  adivinar: (modo, id, fallidos) =>
    pedir('/api/' + modo + '/guess', {
      method: 'POST',
      body: JSON.stringify({ id, fallidos })
    }),
  rendirse: (modo) => pedir('/api/' + modo + '/rendirse', { method: 'POST' }),
  urlImagen: (modo, token) => '/api/' + modo + '/imagen?token=' + encodeURIComponent(token)
};
