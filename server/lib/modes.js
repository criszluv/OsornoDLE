/**
 * Configuracion de los tres modos de juego.
 *
 * Esta configuracion es la unica fuente de verdad: el servidor la usa para
 * comparar respuestas y el frontend la recibe por /api/config para dibujar
 * las columnas de la grilla. Agregar un atributo aqui + en el JSON de datos
 * es todo lo necesario para que aparezca en el juego.
 *
 * Tipos de atributo soportados:
 *   exact    -> verde si coincide, rojo si no
 *   multi    -> array; verde si el conjunto es identico, amarillo si hay
 *               interseccion parcial, rojo si no hay nada en comun
 *   boolean  -> como exact pero con etiquetas si/no configurables
 *   numeric  -> verde si coincide; flecha arriba/abajo segun corresponda,
 *               amarillo si esta dentro de `cerca`
 *   color    -> como exact, pero muestra un circulo con el color
 */

export const MODOS = [
  {
    id: 'zonas',
    nombre: 'Zonas',
    emoji: '🗺️',
    titulo: 'Adivina el lugar de Osorno',
    descripcion:
      'Plazas, parques, calles, puentes y edificios emblemáticos. Compara los atributos y deduce el lugar del día.',
    tipo: 'deductivo',
    placeholder: 'Escribe un lugar de Osorno...',
    archivo: 'zonas.json',
    atributos: [
      {
        key: 'sector',
        label: 'Macro-sector',
        tipo: 'exact',
        ancho: 1.15,
        valores: ['Centro', 'Rahue', 'Ovejería', 'Francke', 'Oriente', 'Norte', 'Sur']
      },
      { key: 'categoria', label: 'Categoría', tipo: 'exact', ancho: 1.1 },
      { key: 'acceso', label: 'Acceso', tipo: 'exact', valores: ['Público', 'Privado', 'Mixto'] },
      {
        key: 'techado',
        label: 'Espacio',
        tipo: 'boolean',
        etiquetaVerdadero: 'Techado',
        etiquetaFalso: 'Aire libre'
      },
      { key: 'anio', label: 'Año', tipo: 'numeric', cerca: 15, sinDato: '¿?' }
    ]
  },
  {
    id: 'instituciones',
    nombre: 'Instituciones',
    emoji: '🎓',
    titulo: 'Adivina la institución académica',
    descripcion:
      'Desde colegios históricos hasta educación superior. Misma mecánica deductiva, ecosistema educativo local.',
    tipo: 'deductivo',
    placeholder: 'Escribe un colegio, liceo o instituto...',
    archivo: 'instituciones.json',
    atributos: [
      {
        key: 'sector',
        label: 'Sector',
        tipo: 'exact',
        ancho: 1.15,
        valores: ['Centro', 'Rahue', 'Ovejería', 'Francke', 'Oriente', 'Norte', 'Sur']
      },
      {
        key: 'niveles',
        label: 'Nivel educativo',
        tipo: 'multi',
        ancho: 1.2,
        valores: ['Parvularia', 'Básica', 'Media', 'Técnica', 'Superior']
      },
      {
        key: 'dependencia',
        label: 'Dependencia',
        tipo: 'exact',
        ancho: 1.15,
        valores: ['Municipal', 'Particular subvencionado', 'Particular pagado', 'Estatal', 'Delegada']
      },
      { key: 'genero', label: 'Género', tipo: 'exact', valores: ['Mixto', 'Femenino', 'Masculino'] },
      { key: 'color', label: 'Color', tipo: 'color', campoHex: 'colorHex' },
      { key: 'fundacion', label: 'Fundación', tipo: 'numeric', cerca: 20, sinDato: '¿?' }
    ]
  },
  {
    id: 'locales',
    nombre: 'Locales',
    emoji: '📸',
    titulo: 'Adivina el local o comercio',
    descripcion:
      'Una foto pixelada al extremo. Cada intento fallido la vuelve más nítida. ¿Cuánto necesitas para reconocerla?',
    tipo: 'imagen',
    placeholder: 'Escribe un local, tienda o restaurante...',
    archivo: 'locales.json',
    atributos: [],
    /**
     * Ancho en pixeles al que se reduce la imagen antes de volver a
     * ampliarla (efecto pixelado). Indice = intentos fallidos.
     * El ultimo valor (0) significa imagen original.
     */
    nivelesImagen: [7, 12, 20, 34, 58, 100, 0],
    /**
     * Pistas de texto que se revelan tras N intentos fallidos.
     */
    pistas: [
      { desde: 2, key: 'tipoImagen', label: 'La foto muestra' },
      { desde: 3, key: 'rubro', label: 'Rubro' },
      { desde: 5, key: 'sector', label: 'Sector' }
    ]
  }
];

export const MODOS_POR_ID = Object.fromEntries(MODOS.map((m) => [m.id, m]));

/** Version publica de la config (sin nombres de archivo internos). */
export function configPublica() {
  return MODOS.map(({ archivo, ...resto }) => resto);
}
