/**
 * Genera la lista de fotos por conseguir, ordenada por la fecha en que cada
 * lugar toca ser la respuesta del día (primero lo más urgente).
 *
 *   npm run fotos              -> FOTOS-ZONAS.txt
 *   node scripts/lista-fotos.js instituciones
 *   node scripts/lista-fotos.js locales
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODOS_POR_ID } from '../server/lib/modes.js';
import { cargarDatos } from '../server/lib/datos.js';
import { indiceDia, seleccionDelDia, fechaJuego } from '../server/lib/daily.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const modoId = process.argv[2] || 'zonas';
const modo = MODOS_POR_ID[modoId];
if (!modo) {
  console.error('Modo desconocido: ' + modoId + '. Usa zonas, instituciones o locales.');
  process.exit(1);
}

/** Qué debería mostrar la foto, según el tipo de lugar. */
const SUGERENCIAS = {
  Plaza: 'vista general del espacio, con el elemento más reconocible al centro',
  Parque: 'una vista amplia que muestre el entorno; evita el primer plano de una banca',
  Puente: 'el puente completo, de perfil o desde la ribera',
  Iglesia: 'la fachada y la torre, desde la vereda del frente',
  Monumento: 'el monumento completo, con algo de contexto alrededor',
  'Casa patrimonial': 'la fachada desde la vereda pública — NO entrar a la propiedad',
  Museo: 'la fachada del edificio, con la entrada visible',
  'Edificio patrimonial': 'la fachada del edificio, con la entrada visible',
  'Edificio público': 'la fachada del edificio, con la entrada visible',
  Teatro: 'la fachada del edificio, con la entrada visible',
  Mercado: 'la fachada o el pasillo principal',
  Estadio: 'la fachada o las galerías; con público es aún mejor',
  Terminal: 'la fachada y el letrero identificador',
  Aeropuerto: 'la fachada y el letrero identificador',
  Hospital: 'solo la fachada principal — nunca pacientes ni áreas clínicas',
  Cementerio: 'vista general respetuosa; es un sitio de memoria, evita primeros planos de tumbas',
  Calle: 'una vista a lo largo de la calle que deje ver su carácter'
};

const { items } = cargarDatos(modo);
const hoy = indiceDia();

/**
 * Si ya existe la lista, rescata los lugares marcados con [x] para no perder
 * el avance al regenerar.
 */
function yaMarcados(archivo) {
  const hechos = new Set();
  if (!fs.existsSync(archivo)) return hechos;

  const bloques = fs.readFileSync(archivo, 'utf8').split(/^-{10,}$/m);
  for (const bloque of bloques) {
    if (!/\[[xX]\]/.test(bloque)) continue;
    const id = bloque.match(/archivo \.+ public\/img\/[^/]+\/(.+?)\.\w+$/m);
    if (id) hechos.add(id[1]);
  }
  return hechos;
}

// Día en que cada item vuelve a tocar, para priorizar.
const proximo = new Map();
for (let d = hoy; d < hoy + items.length * 2 && proximo.size < items.length; d++) {
  const item = seleccionDelDia(modo.id, items, d);
  if (!proximo.has(item.id)) proximo.set(item.id, d);
}

const fechaDe = (dia) => {
  const base = new Date(fechaJuego() + 'T12:00:00');
  base.setDate(base.getDate() + (dia - hoy));
  return base.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

const nombreArchivo = 'FOTOS-' + modo.nombre.toUpperCase() + '.txt';
const destino = path.join(RAIZ, nombreArchivo);
const hechos = yaMarcados(destino);

const ordenados = [...items].sort((a, b) => (proximo.get(a.id) ?? 1e9) - (proximo.get(b.id) ?? 1e9));

const L = [];
const linea = (c = '=') => L.push(c.repeat(78));

linea();
L.push('OSORNODLE · FOTOS PENDIENTES — MODO ' + modo.nombre.toUpperCase());
L.push('Generado el ' + fechaJuego() + ' · ' + items.length + ' lugares');
linea();
L.push('');
L.push('CÓMO USAR ESTA LISTA');
L.push('  1. Consigue la foto de cada lugar respetando las reglas de más abajo.');
L.push('  2. Guárdala en  public/img/' + modo.id + '/  con el nombre exacto que dice');
L.push('     "archivo". Formato: JPG horizontal, ~1200 px de ancho, bajo 500 KB.');
L.push('  3. Agrega al item en data/' + modo.archivo + ' los campos "imagen" y "credito".');
L.push('  4. Corre  npm run validate  para confirmar que no falta nada.');
L.push('');
L.push('  El orden es por fecha en que cada lugar toca ser la respuesta del día:');
L.push('  los de arriba son los urgentes.');
L.push('');
linea();
L.push('REGLAS LEGALES — LEE ESTO ANTES DE DESCARGAR NADA');
linea();
L.push('');
L.push('EL EDIFICIO NO ES EL PROBLEMA. LA FOTO SÍ.');
L.push('  Chile tiene "libertad de panorama" (Ley 17.336 de Propiedad Intelectual,');
L.push('  art. 71 F): se puede reproducir y publicar libremente la imagen de obras');
L.push('  de arquitectura, monumentos y estatuas que adornan de forma permanente');
L.push('  plazas, avenidas y lugares públicos, sin pedir permiso ni pagar.');
L.push('');
L.push('  O sea: fotografiar la Catedral o el Fuerte Reina Luisa y publicarlo es');
L.push('  legal. El riesgo real es OTRO: la foto en sí tiene un dueño, que es quien');
L.push('  la tomó. Bajar una imagen de Google, Instagram o un diario y subirla al');
L.push('  juego es lo que te puede costar una carta de un abogado.');
L.push('');
L.push('DE DÓNDE SACAR LAS FOTOS, DE MÁS SEGURO A MENOS');
L.push('  1. TUYAS. Sales, las tomas tú. Eres el dueño y no le debes nada a nadie.');
L.push('     Es la opción recomendada y para casi todo Osorno es una tarde de');
L.push('     caminata.');
L.push('  2. WIKIMEDIA COMMONS (commons.wikimedia.org). Cada archivo dice su');
L.push('     licencia. CC0 y dominio público no piden nada; CC BY y CC BY-SA');
L.push('     obligan a nombrar al autor — por eso existe el campo "credito".');
L.push('  3. DONADAS por vecinos, con permiso POR ESCRITO. Un mensaje que diga');
L.push('     "sí, puedes usar mi foto en Osornodle" guardado en el chat ya sirve.');
L.push('  4. Municipalidad / SERNATUR: escríbeles y pregunta. Suelen tener banco');
L.push('     de imágenes y ceder su uso para proyectos de la comunidad.');
L.push('');
L.push('NO USAR NUNCA');
L.push('  · Google Imágenes, Pinterest, Instagram, Facebook.');
L.push('  · Fotos de medios (Diario de Osorno, radios, etc.): son con derechos.');
L.push('  · Bancos de imágenes con marca de agua.');
L.push('  · "Es que la encontré en internet" no es una licencia.');
L.push('');
L.push('PERSONAS EN LA FOTO');
L.push('  En Chile el derecho a la propia imagen está protegido. Si sale gente');
L.push('  reconocible en primer plano necesitas su permiso. Lo simple: fotografía');
L.push('  temprano o en días de poca gente, encuadra sin caras, o difumínalas.');
L.push('  Cuidado especial con menores de edad: ahí no hay margen, mejor evítalos.');
L.push('');
L.push('PROPIEDAD PRIVADA');
L.push('  La libertad de panorama cubre lo que se ve desde el espacio público.');
L.push('  Fotografía siempre parado en la vereda o la calle. No entres a un patio');
L.push('  ni uses dron sobre propiedad ajena.');
L.push('');
L.push('PARA EL MODO LOCALES (cuando llegues a eso)');
L.push('  Es un caso distinto y más delicado: ahí hay marcas, logos e interiores de');
L.push('  negocios. Pide permiso al dueño por escrito antes de usar la foto, y');
L.push('  ofrécele el trato obvio: su local aparece en un juego que juega toda la');
L.push('  ciudad. La mayoría dice que sí encantado.');
L.push('');
L.push('LLEVA EL REGISTRO');
L.push('  Anota de dónde salió cada foto en el campo "credito" del JSON. Ejemplos:');
L.push('    "credito": "Foto propia"');
L.push('    "credito": "Nombre Apellido / Wikimedia Commons, CC BY-SA 4.0"');
L.push('    "credito": "Cedida por la Municipalidad de Osorno"');
L.push('  El juego lo muestra abajo de la foto al resolver el desafío.');
L.push('');

let n = 0;
let sinVerificar = 0;

for (const item of ordenados) {
  n++;
  const dia = proximo.get(item.id);
  const cuando = dia === hoy ? 'toca HOY' : 'toca el ' + fechaDe(dia);
  const sugerencia = SUGERENCIAS[item.categoria] || 'una vista general reconocible del lugar';

  linea('-');
  const marca = hechos.has(item.id) ? '[x]' : '[ ]';
  L.push(marca + ' ' + String(n).padStart(2, '0') + '. ' + item.nombre.toUpperCase() + '   (' + cuando + ')');
  L.push('');
  if (item.sector) L.push('    sector .... ' + item.sector);
  if (item.categoria) L.push('    tipo ...... ' + item.categoria);
  if (item.direccion) L.push('    dónde ..... ' + item.direccion);
  L.push('    buscar .... "' + item.nombre + ' Osorno"');
  L.push('    la foto ... ' + sugerencia);
  L.push('    archivo ... public/img/' + modo.id + '/' + item.id + '.jpg');
  L.push('    json ...... "imagen": "img/' + modo.id + '/' + item.id + '.jpg",');
  L.push('                "credito": "Foto propia"');

  if (item.revisar && item.revisar.length) {
    sinVerificar++;
    L.push('    ⚠ FALTA ... confirmar ' + item.revisar.join(', ') + ' en data/' + modo.archivo);
  }
  L.push('');
}

linea();
L.push('RESUMEN');
L.push('  ' + items.length + ' lugares en total, ' + hechos.size + ' ya con foto, ' + (items.length - hechos.size) + ' por conseguir.');
L.push('  ' + sinVerificar + ' lugares tienen además datos por confirmar (marcados con ⚠).');
L.push('  Fuentes usadas para armar los datos: Consejo de Monumentos Nacionales,');
L.push('  catálogo "Atractivos Turísticos Comuna de Osorno" (2024) y Explora Osorno.');
L.push('');
L.push('  Esto es orientación práctica, no asesoría legal. Si vas a publicar el');
L.push('  juego con publicidad o fines comerciales, conviene revisarlo con un');
L.push('  abogado.');
linea();

fs.writeFileSync(destino, L.join('\r\n') + '\r\n', 'utf8');

console.log(
  '\n  ✓ ' + nombreArchivo + ': ' + items.length + ' lugares · ' + hechos.size + ' con foto · ' +
    (items.length - hechos.size) + ' por conseguir · ' + sinVerificar + ' con datos por confirmar.\n'
);
