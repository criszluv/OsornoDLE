# Osornodle

Tres desafíos diarios sobre Osorno, al estilo loldle.net. Sin cuentas, sin login: un
desafío nuevo de cada modo a la medianoche de Chile, con racha y estadísticas guardadas
en el navegador de cada jugador.

- **🗺️ Zonas** — adivina el lugar del día (plazas, parques, puentes, edificios) comparando
  macro-sector, categoría, acceso, si es techado y el año.
- **🎓 Instituciones** — misma mecánica, sobre colegios, liceos e instituciones de
  educación superior: sector, nivel educativo, dependencia, género, color institucional y
  año de fundación.
- **📸 Locales** — reconocimiento visual: una foto pixelada al extremo que se va aclarando
  con cada intento fallido, más pistas de texto que se desbloquean por el camino.

## Poner en marcha

```bash
npm install
```

```bash
npm start
```

Queda en <http://localhost:3000>. `npm install` es **opcional**: el servidor usa solo
módulos nativos de Node (18+). La única dependencia, `sharp`, sirve para pixelar las fotos
en el servidor; sin ella el juego funciona igual pero el pixelado se hace en el navegador
(ver "Sobre las trampas").

Para desarrollo, con recarga al guardar:

```bash
npm run dev
```

## Comandos útiles

| Comando | Para qué sirve |
| --- | --- |
| `npm start` | Levanta el servidor |
| `npm run dev` | Igual, pero reinicia al guardar archivos |
| `npm run validate` | Revisa los datos: campos faltantes, valores inválidos, fotos que no existen |
| `npm run hoy` | Muestra las respuestas de hoy en la consola (`node scripts/hoy.js 7` para una semana) |
| `npm run fotos` | Genera `FOTOS-ZONAS.txt`: qué foto falta, ordenada por urgencia, con las reglas legales |
| `node scripts/placeholders.js` | Genera imágenes marcador para el modo Locales |

## Estructura

```
data/                  Contenido del juego (lo que vas a editar seguido)
  zonas.json
  instituciones.json
  locales.json
public/                Frontend (HTML + CSS + JS, sin build ni framework)
  index.html
  css/estilos.css
  js/                  app, juego, autocompletar, api, almacenamiento, ui
  img/locales/         Fotos del modo visual
server/
  index.js             Servidor HTTP y archivos estáticos
  lib/modes.js         ⭐ Configuración de los 3 modos y sus atributos
  lib/daily.js         Sorteo determinista del desafío del día
  lib/compare.js       Lógica de colores y flechas
  lib/imagen.js        Pixelado progresivo
  lib/token.js         Firma de las URLs de imagen
  routes/api.js        Endpoints
scripts/               validate-data, hoy, placeholders
```

## Cómo se elige el desafío del día

No hay cron ni base de datos. El día se calcula en zona horaria `America/Santiago` y con
él se genera una permutación barajada de todos los items (semilla derivada del modo y del
número de ciclo). Consecuencias:

- Ningún item se repite hasta que **salieron todos**. Con 24 zonas, cada lugar vuelve a
  aparecer 24 días después.
- El resultado es reproducible: `npm run hoy 30` te muestra el mes completo por adelantado.
- Agregar items cambia la rotación futura (no el historial de hoy hacia atrás dentro del
  ciclo en curso).

El día 1 se define con `GAME_EPOCH` (ver Configuración). El cambio de desafío ocurre a la
medianoche de Osorno.

## Agregar o editar contenido

Todo vive en `data/*.json`. El formato es un objeto con `items` (los campos `_nota` y
`_campos` son documentación, el servidor los ignora).

### Una zona

```json
{
  "id": "puente-san-pedro",
  "nombre": "Puente San Pedro",
  "alias": ["Puente Rahue"],
  "sector": "Rahue",
  "categoria": "Puente",
  "acceso": "Público",
  "techado": false,
  "anio": 1940,
  "descripcion": "Se muestra al resolver el desafío.",
  "direccion": "Sobre el río Rahue",
  "verificado": true
}
```

- `id` es opcional (se genera desde el nombre), pero **una vez publicado no lo cambies**:
  es lo que se guarda en las partidas de la gente.
- `alias` solo afecta al buscador; no se muestra nunca.
- `activo: false` saca un item de la rotación sin borrarlo.
- `anio` puede ser `null` si no lo sabes: se muestra `¿?` y siempre cuenta como fallo.

### Una institución

Igual, con `niveles` (array), `dependencia`, `genero`, `color` + `colorHex` y `fundacion`.

### Un local

```json
{
  "id": "panaderia-la-espiga",
  "nombre": "Panadería La Espiga",
  "alias": ["La Espiga"],
  "imagen": "img/locales/panaderia-la-espiga.jpg",
  "tipoImagen": "Fachada",
  "rubro": "Panadería",
  "sector": "Centro",
  "direccion": "Centro"
}
```

La foto va en `public/img/locales/`. `tipoImagen`, `rubro` y `sector` se revelan como
pistas a los 2, 3 y 5 intentos fallidos.

**Recomendaciones para las fotos:** horizontal 3:2, ~1200 px de ancho, JPG. Evita que el
nombre del local se lea en la imagen (o el juego se acaba en el primer nivel). Consigue
permiso del comercio antes de publicar su fachada o sus productos.

Después de cualquier cambio:

```bash
npm run validate
```

### Cambiar los atributos del juego

`server/lib/modes.js` es la única fuente de verdad: el servidor compara con ella y el
frontend dibuja las columnas a partir de ella. Para agregar una columna, súmala al array
`atributos` del modo y agrega el campo en el JSON. Tipos disponibles: `exact`, `multi`
(array, permite amarillo parcial), `boolean`, `numeric` (flechas ⬆️⬇️ y amarillo si está
dentro de `cerca`) y `color` (círculo de color).

Los atributos con `valores: [...]` tienen vocabulario cerrado: `npm run validate` marca
como error cualquier valor fuera de la lista, así no se cuelan typos que rompen el juego.

## Estado actual de los datos

Cada modo va por su lado:

**🗺️ Zonas — investigado.** 30 lugares, todos de **uso público o monumentos nacionales**
(nada de propiedad comercial privada, para evitar problemas de permisos). Los datos salen
del Consejo de Monumentos Nacionales, del catálogo *Atractivos Turísticos Comuna de
Osorno* (2024) y de Explora Osorno; cada item lleva su campo `fuente`. 21 de 30 están
marcados `verificado: true`. Los que traen un array `revisar` necesitan que alguien con
conocimiento local confirme esos campos puntuales.

Dos cosas conocidas de este set: 12 de 30 lugares tienen `anio` (el resto muestra `¿?` y
siempre cuenta como fallo), y 20 de 30 son del sector Centro, así que la columna de sector
discrimina poco. Ambas se arreglan completando datos o subdividiendo los sectores.

**🎓 Instituciones — pendiente.** Solo la Universidad de Los Lagos y el Instituto Alemán
están verificados. Para el resto, la fuente autoritativa de `dependencia`, `niveles` y
`genero` es el [Directorio de Establecimientos del
MINEDUC](https://datosabiertos.mineduc.cl/directorio-de-establecimientos-educacionales/):
filtra por comuna Osorno y salen los datos oficiales con RBD.

**📸 Locales — ficticio.** Los 12 locales son inventados y las imágenes están generadas
por script. Hay que reemplazarlos por comercios reales, **con permiso escrito del dueño**.

En los tres casos: marca `"verificado": true` a medida que confirmes, y usa
`npm run validate` para ver cuántos faltan.

## Fotos y derechos

`npm run fotos` genera `FOTOS-ZONAS.txt` con la lista de fotos por conseguir, ordenada por
la fecha en que cada lugar toca ser la respuesta, y con las reglas legales al principio.

El resumen corto: Chile tiene libertad de panorama (Ley 17.336, art. 71 F), así que
fotografiar y publicar monumentos y edificios desde la vía pública es legal. Lo que **no**
puedes hacer es tomar la foto de otra persona desde Google o Instagram: esa foto tiene
dueño. Lo seguro es tomarlas tú, o usar Wikimedia Commons respetando la licencia.

Cuando un item tiene `imagen`, el juego la muestra al resolver el desafío, y si tiene
`credito` lo imprime debajo — que es lo que exigen las licencias tipo CC BY:

```json
{
  "imagen": "img/zonas/plaza-de-armas.jpg",
  "credito": "Nombre Apellido / Wikimedia Commons, CC BY-SA 4.0"
}
```

## Configuración

Copia `.env.example` a `.env`:

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `PORT` | `3000` | Puerto del servidor |
| `GAME_EPOCH` | `2026-01-01` | Fecha del desafío #1. Define la numeración |
| `IMG_SECRET` | valor de desarrollo | Firma de las URLs de imagen. **Cámbialo en producción** |
| `TZ_GAME` | `America/Santiago` | Zona horaria del cambio de día |

## API

| Método | Ruta | Qué devuelve |
| --- | --- | --- |
| `GET` | `/api/config` | Configuración de los 3 modos, fecha y próximo reinicio |
| `GET` | `/api/estado` | Resumen del día para los 3 modos |
| `GET` | `/api/:modo/items` | Lista para el autocompletado (sin atributos) |
| `GET` | `/api/:modo/daily` | Datos del desafío de hoy (sin la respuesta) |
| `POST` | `/api/:modo/guess` | `{ id, fallidos }` → comparación por atributo |
| `POST` | `/api/:modo/rendirse` | Revela la respuesta |
| `GET` | `/api/locales/imagen?token=` | Foto al nivel de pixelado autorizado |

La respuesta del día **nunca** viaja al cliente hasta que se acierta o el jugador se rinde.

## Sobre las trampas

Es un juego comunitario, no un banco. Las defensas son proporcionales:

- La respuesta del día no se envía al navegador hasta resolverla.
- Las URLs de imagen van firmadas (HMAC), así que no se puede pedir la foto nítida
  cambiando un número en la URL.
- Con `sharp` instalado, el navegador nunca recibe la imagen sin pixelar. Sin `sharp`, se
  entrega la original y se pixela con canvas: quien mire la pestaña de red puede verla.
  Si te importa, deja `sharp` instalado.
- El conteo de intentos vive en el navegador: alguien puede borrar su `localStorage` y
  reintentar. No hay forma de evitarlo sin cuentas de usuario.

## Publicar

Es un servidor Node sin build. Sirve cualquier VPS o plataforma que corra Node 18+:

```bash
IMG_SECRET="una-cadena-larga-y-aleatoria" GAME_EPOCH="2026-01-01" npm start
```

Detrás de un proxy (Nginx, Caddy) apuntando al puerto configurado. No requiere base de
datos ni volúmenes: todo el estado del jugador vive en su navegador.

Si más adelante quieres ranking entre amigos o estadísticas globales, ahí sí hará falta
una base de datos y alguna forma de identificar al jugador.
