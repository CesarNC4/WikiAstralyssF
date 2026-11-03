# Fragmentos del acto y sección Música — especificación

> Implementado y desplegado el 2026-10-24. Describe cómo funcionan los
> fragmentos de un acto y la música (datos, panel, reproductor y sección
> pública), y por qué. El código remite a sus secciones (§2, §3.x).

## Índice

2. [Fragmentos del acto](#2-fragmentos-del-acto)
3. [Canciones → sección Música](#3-canciones--sección-música)
4. [Decisiones](#4-decisiones)

---

## 2. Fragmentos del acto

**El problema.** La historia no se escribe de corrido. Dentro de un acto puede
haber un POV de Lloyd, luego uno de Aqua días antes, luego Lloyd con un salto de
un mes. Hoy el acto tiene un único `discord_url`, y un enlace solo no lo deja
claro.

### 2.1 Decisiones del autor

| Pregunta | Decisión |
|---|---|
| Estructura | **Una sola lista de fragmentos** por acto. Cada fragmento lleva POV, enlace y fecha. Se ve la alternancia Lloyd → Aqua → Lloyd |
| Orden | **Orden de lectura** (manual, arrastrando), con un **conmutador para ver por fecha del mundo** |
| Visibilidad | **Públicos** en la ficha del acto |
| Fecha del acto | **Se calcula de los fragmentos**: del más temprano al más tardío. Si ninguno tiene fecha, sigue manual |
| Enlace del acto | Se mantiene `actos.discord_url` como enlace del comienzo del acto |

### 2.2 Modelo de datos

Tabla nueva `acto_fragmento`, en una migración que solo añade:

```
acto_fragmento
  id            serial pk
  acto_id       int not null  → actos.id (FK, on delete cascade)
  orden         int not null default 0      -- orden de lectura dentro del acto
  personaje_id  int           → personajes.id (FK)  -- el POV
  titulo        varchar null                -- corto y opcional ("Despertar")
  enlace        varchar null                -- Discord u otro
  creado_en, actualizado_en                 -- y eliminado_en solo si se decide
                                            -- papelera (ver 6); auditColumns()
                                            -- trae las tres
```

- **La fecha** va en `fecha_lore` con `entidad_tipo = 'fragmentos'` y
  `rol = 'principal'`. Puede ser un punto o un rango, con su precisión,
  `aproximada` e `importante`. Se escribe con `escribirFecha()` de
  `lib/queries/fechas.ts`, dentro de la misma transacción. No hacen falta
  columnas de fecha nuevas.
- **Schema Drizzle:** añadir la tabla en `db/schema/narrativa.ts`. El barrel
  `db/schema/index.ts` ya exporta ese archivo.
- **Registrar `fragmentos` en `ENTIDAD_INFO`** (`lib/relaciones/tablas.ts`).
  Es imprescindible: `purgarVinculosHuerfanos()` da por huérfano todo vínculo
  cuyo tipo no reconoce `etiquetas()`, y los borraría. Hace falta para el vínculo
  canción ↔ fragmento de la sección 3. Sin `ruta` propia: si hace falta enlazar,
  se usa `rutaAnidada` hacia el acto.

### 2.3 Reglas

- **POV automático.** Si un fragmento se crea con un POV que el acto aún no
  tiene en `acto_pov` (tabla `vinculo`, `relacion = 'acto_pov'`), se añade a ese
  bloque. Borrar el fragmento **no** quita el POV.
- **Fecha del acto derivada.**
  - Cada vez que se crea, edita o borra un fragmento con fecha, se recalcula la
    fecha `principal` del acto en `fecha_lore`, en la misma transacción.
  - El inicio es el extremo inicial del fragmento con la clave más baja; el fin,
    el extremo final del de clave más alta. Toma como modelo `fechaDe()` de
    `lib/queries/narrativa.ts`, que ya hace lo mismo para el capítulo a partir de
    sus actos.
  - Se conserva el `importante` que tuviera la fecha del acto.
  - Al guardarse como fecha del acto, el rango del capítulo, la cronología y las
    edades ("momento de lectura") siguen funcionando sin cambios. Si cambia el
    calendario, `lib/actions/calendario.ts` recalcula todas las claves de
    `fecha_lore`, incluidas estas.
  - Si el acto **no** tiene fragmentos con fecha, la fecha es manual, como hoy.
    `guardarActo()` (`lib/actions/taller.ts`) debe ignorar la `fecha` que llegue
    del formulario cuando haya fragmentos con fecha.
- **Papelera y borrado.** Al eliminar un acto definitivamente
  (`eliminarDelTaller`), se borran también sus fragmentos, las filas de
  `fecha_lore` de esos fragmentos y sus vínculos.
- **Publicación.** El fragmento no tiene estado propio: se ve si se ve su acto
  (acto publicado y capítulo publicado).

### 2.4 Taller › Escribe (`components/taller/escribe/ActoEditor.tsx`)

- Nueva sección **"Fragmentos"**, entre la fecha y "Personajes, lugares y trama".
- Lista en orden de lectura, reordenable arrastrando con la API nativa de HTML5.
  `components/taller/capitulos/Organizar.tsx` y
  `components/taller/estructura/Tablero.tsx` ya lo hacen así.
- Conmutador "Lectura / Por fecha". Arrastrar solo funciona en "Lectura".
- Cada fila tiene: POV (selector de personaje), título, enlace, fecha (componente
  `FechaInput`) y botón para borrar. Se guarda al momento, como los vínculos.
- Si hay fragmentos con fecha, el campo "Fecha (inicio y fin)" del acto pasa a
  solo lectura con el aviso "Calculada de N fragmentos".
- Opcional: en la lista de actos (`ListaActos.tsx`), indicar cuántos fragmentos
  tiene cada acto.
- Acciones nuevas en `lib/actions/taller.ts` (todas con `assertAdmin`):
  `crearFragmento`, `guardarFragmento`, `borrarFragmento` y `reordenarFragmentos`.
  Datos del editor: ampliar `getActoEditor()` en `lib/queries/taller.ts`.

### 2.5 Ficha pública del acto (`app/(public)/capitulos/[id]/actos/[actoId]/page.tsx`)

- Sección **"Fragmentos"**. Cada fila muestra:
  - número;
  - POV (avatar y nombre, enlazado a su ficha);
  - título;
  - fecha (respeta el conmutador eras/absoluto del lector, `components/fechas/Lectura.tsx`);
  - botón "Leer en Discord".
- **Salto temporal** respecto al fragmento anterior en orden de lectura ("3 días
  antes", "+1 mes", "mismo día"). Se calcula con las claves de `fecha_lore`
  (`lib/fechas/calendario.ts`). Es lo que más aporta frente a un enlace único.
- Conmutador "Orden de lectura / Por fecha".
- El botón "Leer en Discord" del acto (`acto.discordUrl`) se mantiene.
- La ficha se revalida con `revalidatePath` al guardar un fragmento. Sigue el
  patrón de `conCapitulo()` en `lib/actions/taller.ts`.

---

## 3. Canciones → sección Música

### 3.2 Decisiones del autor

| Pregunta | Decisión |
|---|---|
| Fuentes | **YouTube**, **audio propio** (subido desde el panel a Cloudinary) y **otros enlaces** (Suno web, SoundCloud, Bandcamp). Spotify no lo marcó |
| Reproductor | **Completo**: audio propio y YouTube controlados desde la barra (play, pausa, siguiente, cola), y sigue sonando al cambiar de página |
| Vista pública | **Banda sonora tipo álbum** |
| Agrupación | **Conmutador** entre "por uso" y "por historia" (libro › capítulo) |
| Navegación | **Quinto apartado del menú principal** e **icono en la barra inferior del móvil** (pasa de 5 a 6) |
| Ficha | **Ficha propia**, con **letra** y el **momento exacto en que suena** (ligada a fragmentos) |
| Vínculos | Además de personajes, capítulos y actos: **naciones y organizaciones**, **lugares** (regiones y locaciones) y **eventos de la cronología** |
| Buscador ⌘K y Atlas | **No** lo marcó: fuera de los dos |

### 3.3 Modelo de datos

En `canciones` (migración que solo añade columnas):

| Columna | Para qué |
|---|---|
| `letra text` | Se muestra en la ficha y en el panel del reproductor |
| `duracion int` (segundos) | Para el audio propio, la rellena el resultado de la subida a Cloudinary (`duration`). Para YouTube no se puede saber sin clave de su API: se muestra solo al reproducir |
| `audio_asset_id int` → `media_assets.id` | El archivo propio. En `media_assets`, `tipo = 'audio'` |

- **`tipo_fuente` deja de elegirse a mano.** El servidor la deduce del enlace o
  de la subida (`audio`, `youtube`, `soundcloud`, `suno`, `bandcamp`, `spotify`,
  `externo`). El campo puede quedarse como dato derivado, o retirarse junto con el
  catálogo `cancion_fuente` (ver 6).
- **`uso`** sigue siendo el catálogo `cancion_uso`. Es lo que agrupa la vista
  "por uso".

**Todos los vínculos en el registro** (`lib/relaciones/registro.ts`), medio
`vinculo`, campo `nota` ("suena cuando Aqua despierta") y `fueraDelAtlas: true`:

| id | lado A | lado B (canciones) |
|---|---|---|
| `personaje_cancion` | personajes | Personajes |
| `capitulo_cancion` | capitulos | Capítulos |
| `acto_cancion` | actos | Actos (ya existe así) |
| `fragmento_cancion` | fragmentos | Momentos |
| `nacion_cancion` | naciones | Naciones |
| `organizacion_cancion` | organizaciones | Organizaciones |
| `region_cancion` | regiones | Regiones |
| `locacion_cancion` | locaciones | Locaciones |
| `evento_cancion` | timeline | Eventos |

- `personaje_cancion` y `capitulo_cancion` pasan de medio `tabla` a `vinculo`:
  - quitarlas de `TABLAS_REL` (`lib/relaciones/tablas.ts`);
  - quitar `personajeCancion` de `db/relations.ts`;
  - cambiar las lecturas de `getPersonajeFicha`, `getPersonajePreview`,
    `PersonajeFichaBody`, `cancionesDelCapitulo()` y el borrado en
    `eliminarDelTaller`.
- `ENTIDAD_INFO.canciones` gana `ruta: "/canciones"`, para que los bloques
  enlacen a la ficha de la canción.
- Las fichas que ya pintan su banda sonora a mano deben listar el bloque en
  `BLOQUES_A_MANO` para no duplicarlo.

### 3.4 Subida de audio (Cloudinary)

Se reutiliza el widget firmado de las imágenes (`components/admin/ImageField.tsx`,
`CldUploadWidget` con `signatureEndpoint`). Tres cosas hay que cambiar **en la
misma fase** que la subida, o se pierden archivos:

1. **`lib/media/carpetas.ts`.** `CARPETA_VALIDA` solo admite
   `astralys/<x>(/galeria)?`. Hay que permitir una carpeta de audio, por ejemplo
   `astralys/canciones/audio`. Si no, la ruta de firma rechaza la subida.
2. **`lib/media/purga.ts`.** `purgarMediosHuerfanos()` solo considera
   referenciados los `imagen_asset_id` / `banner_asset_id` (los busca en
   `information_schema`). **Sin añadir `audio_asset_id`, daría por huérfano y
   borraría cada audio subido.**
3. **`lib/cloudinary.ts`.** `borrarDeCloudinary()` llama siempre a
   `/image/destroy`. Cloudinary guarda el audio como recurso `video`, así que
   necesita `/video/destroy` según el `tipo` del asset.

Widget de audio: `resourceType: "video"` y `clientAllowedFormats` con mp3, wav,
ogg y m4a. A esta escala el plan gratuito de Cloudinary sobra: cada tema ocupa
unos 3–8 MB.

### 3.5 Panel

- Editor de canción con: título, artista, uso, portada, **subir audio** o
  **pegar enlace** (uno de los dos), letra, notas y reproducción de prueba.
- Los vínculos se editan desde el panel de conexiones, que el registro genera
  solo, y desde la otra ficha.
- Decidir si se amplía el admin genérico (`lib/admin/fields.ts` con un tipo de
  campo `audio`) o se hace un editor propio. El genérico es preferible si basta.
- El vínculo con un fragmento ("momento exacto") se elige **desde el fragmento**,
  en su fila del editor del acto, con un `BloqueVinculos` de `fragmento_cancion`.

### 3.6 Reproductor

**Arquitectura.** La cola y el estado viven en `usePlayerStore`. Hay un **motor
por fuente**, montado **una sola vez** en `app/(public)/layout.tsx`, para que
siga sonando al navegar dentro de la wiki:

| Motor | Fuente | Control |
|---|---|---|
| `<audio>` | Audio propio | Completo: progreso, salto, volumen. **Media Session API**: controles y portada en la pantalla de bloqueo del móvil |
| YouTube IFrame API | YouTube | Play, pausa, salto y fin → siguiente |
| SoundCloud Widget API | SoundCloud | Igual que YouTube |
| Embed sin control | Suno (`suno.com/embed/<ID>`), Bandcamp y similares | Ninguno: se muestra su reproductor (en el panel, o flotando sobre la barra al cerrarlo, sin dejar de sonar) y la cola se detiene ahí. Si no hay embed, botón "Abrir en…" |
| Embed | Spotify | Solo enlace o embed. Sin sesión de Spotify, el oyente solo oye 30 s |

**Límites que hay que respetar o avisar:**

- **YouTube exige que su reproductor sea visible y mida al menos 200×200 px.**
  Mientras suene un tema de YouTube tiene que haber una ventanita flotante con el
  vídeo. No se puede ocultar ni reducir más.
- **En el móvil (sobre todo en iPhone), YouTube se corta** al bloquear la
  pantalla o cambiar de app. El audio propio sigue sonando.
- **Suno:** un enlace "solo con enlace" se escucha en suno.com sin hacerlo
  público. El embed `suno.com/embed/<ID>` solo está documentado por terceros, no
  por Suno: **hay que probarlo con una canción real**. *(Probado el 2026-10-24:
  funciona con el id largo de la canción; el corto de "Compartir" se resuelve
  al guardar.)* Para que un tema de Suno
  funcione como los demás, el autor puede descargarlo y subirlo como audio propio.
  Según esa fuente, Suno cambió las descargas el 3 de septiembre de 2026; hay que
  comprobar qué permite su plan.
- **Si algo no se puede reproducir, se dice** ("No se puede reproducir aquí ·
  Abrir enlace"). Nada de fallar sin avisar.

**Barra:** portada, título y artista, play/pausa, anterior/siguiente, progreso
(cuando el motor lo permite) y cerrar. El panel desplegado muestra la letra y el
embed cuando la fuente lo necesita.

### 3.7 Sección pública "Música"

**Navegación:**

- En `lib/entities.ts`: entidad `canciones` con `route: "/canciones"`, plural
  "Música" y `icon: "Music"`.
- Nuevo grupo en `NAV_GROUPS` (quinto apartado de `TopNav`); `EntityGroup` se
  amplía.
- Sexto icono en `components/layout/BottomNav.tsx` → `/canciones`.

**Índice `/canciones`, estilo álbum:**

- Conmutador **"Por uso" / "Por historia"**:
  - **Por uso:** grupos del catálogo `cancion_uso` (temas principales, de
    personaje, batalla…).
  - **Por historia:** libro › capítulo donde suena. Junta el vínculo directo con
    el capítulo, los de sus actos y los de sus fragmentos. Una canción puede
    repetirse en varios capítulos. Las que no están en ninguno van a un grupo
    aparte.
- Filtros por libro, personaje y uso.
- "Reproducir todo" para toda la lista y para cada grupo; carga la cola en
  `usePlayerStore`.

**Ficha `/canciones/[id]`:**

- Portada, botón de reproducir, artista, uso, duración y **letra**.
- **Dónde suena**, con los bloques del registro (`Conexiones`): personajes,
  naciones, organizaciones, lugares, eventos, capítulos y actos. Los
  **momentos** son los fragmentos, con su acto y su nota.
- ISR igual que el resto de fichas: `revalidate`, `generateStaticParams` con las
  publicadas.
- Entra en el sitemap. **No** entra en el buscador ⌘K ni en el Atlas: no tocar
  `search_index` y poner `fueraDelAtlas` en todas sus relaciones.

**En las demás fichas,** la "Banda sonora" (`SongList`) se alimenta del registro
y cada canción enlaza a su ficha.

---

## 4. Decisiones

Tomadas durante la implementación, por fase del plan original:

**Sección Música (Fase 5).**

- Las canciones de los fragmentos cuentan como del acto (y por tanto del
  capítulo) en su banda sonora.
- Nación, organización, región y locación pintan su banda sonora con
  `BandaSonora` (y sus bloques `*_cancion:a` están en `BLOQUES_A_MANO`). Los
  eventos no tienen ficha: salen en la de la canción.
- El filtro por personaje del índice usa el vínculo directo personaje ↔
  canción.

**Reproductor (Fase 4).**

- Motores en `components/player/motores.tsx`, barra y panel en
  `MusicPlayer.tsx`. Las fuentes sin control se resuelven en el estado
  (`alCambiar` en `usePlayerStore`): al llegar a una, la cola se para y se
  abre el panel con su embed, o se avisa si no lo hay.
- Los enlaces cortos de Suno (`suno.com/s/…`) se convierten al guardar en
  `suno.com/song/<uuid>` (`lib/media/suno.ts`): solo ese se puede incrustar.
- Con el panel abierto, la ventanita de YouTube sube a la esquina superior
  por encima del fondo del panel, para no dejar de verse.
- El reproductor de Suno y Spotify (`Embebido` en `MusicPlayer.tsx`) vive
  fuera del panel, así que cerrarlo o navegar no lo corta: con el panel
  abierto se encaja al pie del panel y, cerrado, flota encima de la barra
  (Suno a 120 px de alto, Spotify en su formato compacto de 80 px). Lo que
  flota sobre la barra hace crecer la página por abajo para no tapar su final.

**Datos y panel de canciones (Fase 3).**

- Panel: se amplió el admin genérico (`hasAudio` en `EntidadConfig`, sección
  "Audio" con `AudioField`) en lugar de un editor propio.
- Con audio propio, `canciones.url` guarda la URL de Cloudinary y
  `tipo_fuente = 'audio'`: el reproductor lee siempre `url` + `tipo_fuente`.
- `tipo_fuente` queda como dato derivado (`lib/media/fuentes.ts`). El catálogo
  `cancion_fuente` se desenlazó de la columna y se retiró en la Fase 6.

Respuestas del autor a las preguntas abiertas: el enlace del fragmento es
**opcional**; los fragmentos se borran **directamente, con confirmación**
(el acto ya tiene papelera); el catálogo `cancion_fuente` **se retiró**; el
embed de Suno **funciona** con el id largo de la canción.

Propuestas por Claude y aceptadas sin discusión:

- Los fragmentos **no** salen en la cronología: ya sale el acto entero y la
  saturarían.
- Los fragmentos **no** se listan en la ficha del personaje por ahora.
- El fragmento no tiene estado de publicación propio: hereda el del acto.
- Borrar un fragmento no quita su POV del acto.
- Spotify se queda solo como enlace o embed externo.
- La ruta es `/canciones` y en el menú se llama "Música".
