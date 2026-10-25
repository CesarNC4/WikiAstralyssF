# Fragmentos del acto y sección Música — especificación y plan

> **Estado (2026-10-24): Fases 1–5 implementadas.** `migrate-fragmentos.ts`
> y `migrate-canciones.ts` aplicadas el 2026-10-24. Para las preguntas abiertas 1 y 2
> de §6 se tomó la propuesta: enlace opcional y borrado directo con
> confirmación. La 4 está respondida: el embed de Suno funciona (probado con
> una canción real del autor). Fase 6 (limpieza destructiva) pendiente.
>
> Decisiones de la Fase 5:
> - Las canciones de los fragmentos cuentan como del acto (y por tanto del
>   capítulo) en su banda sonora.
> - Nación, organización, región y locación pintan su banda sonora con
>   `BandaSonora` (y sus bloques `*_cancion:a` están en `BLOQUES_A_MANO`). Los
>   eventos no tienen ficha: salen en la de la canción.
> - El filtro por personaje del índice usa el vínculo directo personaje ↔
>   canción.
>
> Decisiones de la Fase 4:
> - Motores en `components/player/motores.tsx`, barra y panel en
>   `MusicPlayer.tsx`. Las fuentes sin control se resuelven en el estado
>   (`alCambiar` en `usePlayerStore`): al llegar a una, la cola se para y se
>   abre el panel con su embed, o se avisa si no lo hay.
> - Los enlaces cortos de Suno (`suno.com/s/…`) se convierten al guardar en
>   `suno.com/song/<uuid>` (`lib/media/suno.ts`): solo ese se puede incrustar.
> - Con el panel abierto, la ventanita de YouTube sube a la esquina superior
>   por encima del fondo del panel, para no dejar de verse.
>
> Decisiones de la Fase 3:
> - Panel: se amplió el admin genérico (`hasAudio` en `EntidadConfig`, sección
>   "Audio" con `AudioField`) en lugar de un editor propio.
> - Con audio propio, `canciones.url` guarda la URL de Cloudinary y
>   `tipo_fuente = 'audio'`: el reproductor lee siempre `url` + `tipo_fuente`.
> - `tipo_fuente` queda como dato derivado (`lib/media/fuentes.ts`). El catálogo
>   `cancion_fuente` ya no está enlazado a la columna; retirarlo es la pregunta 3.
> - `ENTIDAD_INFO.canciones.ruta` se deja para la Fase 5: hasta que exista
>   `/canciones`, el enlace daría 404.
>
> En el equipo personal sí se prueba en local (`pnpm dev` + navegador); la
> regla de "no probar en el navegador local" de §0 es solo del equipo con
> FortiEDR.
>
> Este documento está pensado para retomar el trabajo en otra conversación: se
> puede seguir sin más contexto.
>
> Tres encargos:
> 1. **Arreglo:** los bloques de relaciones del editor del acto se quedan en
>    "Cargando…" para siempre.
> 2. **Fragmentos:** varios enlaces por POV dentro de un acto, cada uno con su
>    fecha.
> 3. **Música:** reestructurar las canciones y darles una sección pública propia.

## Índice

0. [Cómo trabajar en este proyecto](#0-cómo-trabajar-en-este-proyecto)
1. [Arreglo: bloques en "Cargando…"](#1-arreglo-bloques-en-cargando)
2. [Fragmentos del acto](#2-fragmentos-del-acto)
3. [Canciones → sección Música](#3-canciones--sección-música)
4. [Plan por fases](#4-plan-por-fases)
5. [Decisiones tomadas por defecto](#5-decisiones-tomadas-por-defecto)
6. [Preguntas abiertas](#6-preguntas-abiertas)

---

## 0. Cómo trabajar en este proyecto

Antes de empezar, lee `README.md`, `docs/relaciones.md` y `AGENTS.md`. AGENTS.md
pide leer la guía de `node_modules/next/dist/docs/` antes de escribir código de
Next 16. Las dependencias ya están instaladas.

**Entorno del autor (Windows, con FortiEDR):**

- Node 24 portable en `C:\Users\clnegretec\node`, **fuera del PATH**. En cada
  terminal: `$env:PATH = "C:\Users\clnegretec\node;$env:PATH"`.
- En el equipo personal (`C:\Users\cesar`), Node 24 está en `C:\Users\cesar\node`
  **dentro del PATH** de usuario y `corepack enable` ya está hecho: `pnpm …`
  funciona directamente.
- pnpm **solo a través de corepack**: `corepack pnpm typecheck`, `corepack pnpm lint`,
  `corepack pnpm build`. No se instala nada global ni se añaden dependencias sin
  permiso del autor.
- En PowerShell 5.1, pnpm aparece como "NativeCommandError" porque escribe por
  el canal de errores. Es inofensivo: lo que cuenta es `$LASTEXITCODE`.
- **No se prueba en el navegador local** (decisión del autor). El flujo es:
  1. cambios;
  2. `typecheck` + `lint` (+ `build`) aquí;
  3. commit y push **solo cuando el autor lo pida**, preguntando antes si va a
     `master` (producción) o a una rama (despliegue de prueba);
  4. el autor prueba en Vercel.

**Base de datos:**

- Solo hay una base: **producción** (Supabase).
- Las migraciones viven en `scripts/migrations/` y siguen el patrón de
  `migrate-alturas.ts`:
  - ensayo por defecto, dentro de una transacción que se revierte;
  - `--aplicar` para escribir;
  - idempotentes.
- Se ejecutan con `node --env-file=.env.local scripts/migrations/<script>.ts`.
- **Ningún `--aplicar` sin el visto bueno del autor.** El entorno de Claude
  bloquea incluso las lecturas de producción: o el autor lanza el comando, o da
  permiso expreso para ese paso.
- Las migraciones que añaden van antes del despliegue. Las que borran van en una
  fase posterior, cuando el código desplegado ya no lea lo que se retira.

**Cada fase va en su propio commit.**

---

## 1. Arreglo: bloques en "Cargando…"

**Síntoma.** En Taller › Escribe, los bloques del acto (POV, Personajes que
aparecen, Naciones, Regiones, Locaciones, Arcos de trama, Canciones) muestran
"Cargando…" para siempre, aunque añadas fichas. Lo mismo pasa con "Canciones"
en la pantalla del capítulo.

**Causa.** `components/admin/vinculos/BloqueVinculos.tsx`:

- Solo llama a `cargar()` dentro de `alternar()`, es decir, al desplegar el bloque
  con un clic.
- `ActoEditor.tsx` y `CancionesManuales.tsx` lo montan con `abiertoInicial`: el
  bloque nace abierto, así que nunca se carga.
- `vincular` y `quitar` pasan por `conError`, que actualiza `filas` pero no marca
  `cargado`. Por eso lo añadido **sí se guarda** en la base (la lista de actos de
  la izquierda lo muestra, por ejemplo "POV: Lloyd, Aqua"), pero el bloque nunca
  lo pinta.
- Plegar y desplegar a mano lo arregla temporalmente.

**Arreglo.** Solo en `BloqueVinculos.tsx`:

- Si el bloque nace abierto, carga al montarse. Hazlo con un efecto que dependa
  solo de `relId`, `lado` y `ownerId`, para no reintroducir el bucle de peticiones
  que se arregló en `ed7dbe1` (allí la causa era depender de un array nuevo en
  cada render).
- Cualquier escritura que termine bien deja `cargado = true`.

**Otros usos de `abiertoInicial`.** `PanelConexiones.tsx` calcula
`abiertoInicial` a partir de `conteo`, que llega después del primer render. Hoy
esos bloques nacen cerrados y funcionan. Con el arreglo, en ese panel no debe
cambiar nada.

**Comprobación.** Al abrir un acto, los 7 bloques muestran sus vínculos. Al
vincular o quitar, la lista se actualiza al momento.

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

### 3.1 Estado actual (diagnóstico)

**Datos dispersos:**

| Dónde | Cómo |
|---|---|
| Personaje ↔ canción | Tabla `personaje_cancion` (`contexto`). Registro: `personaje_cancion`, medio `tabla`. La ficha la lee con `db.query` (`canciones: { with: { cancion: true } }` en `getPersonajeFicha` / `getPersonajePreview`, `lib/queries/fichas.ts`; relación en `db/relations.ts`) y la pinta a mano (`BLOQUES_A_MANO` en `lib/relaciones/omisiones.ts`) |
| Capítulo ↔ canción | Tabla `capitulo_cancion`. Registro: `capitulo_cancion`, medio `tabla`. Se lee en `cancionesDelCapitulo()` (`lib/queries/narrativa.ts`) |
| Acto ↔ canción | Tabla genérica `vinculo`, `relacion = 'acto_cancion'`. Se lee en `cancionesDe()` y `getCancionesDeActo()` |
| `acto_cancion`, `hoja_cancion` | Tablas viejas que **ya no usa ningún código** |

**Reproductor** (`components/player/MusicPlayerBar.tsx`, `hooks/usePlayerStore.ts`):

- Solo reproduce de verdad las fuentes "Local" (un `<audio>` con la URL).
- Con YouTube, Spotify o SoundCloud, play, pausa y siguiente no controlan nada.
  El iframe solo existe con el panel desplegado: al plegarlo se desmonta y la
  música se corta. Siguiente y anterior no arrancan el embed.
- Bandcamp, Suno y "Enlace externo" no suenan de ninguna forma.
- Si `tipoFuente` está vacío, la canción se trata como "Local" aunque el enlace
  sea de YouTube, y falla sin avisar.
- No existe forma de subir audio: el panel solo tiene un campo de texto para el
  enlace.

**Público:**

- Solo aparecen como "Banda sonora" (`components/fichas/SongList.tsx`) dentro de
  personaje, capítulo y acto.
- No tienen índice, ni ficha, ni entrada en `lib/entities.ts`, ni `ruta` en
  `ENTIDAD_INFO`.
- En el panel, `lib/admin/fields.ts` las tiene con `route: "/capitulos"` y
  `hasFicha: false`.

**Datos actuales:** 3 canciones de prueba (Poema, Prueba, Prueba 2). El autor
confirma que **se pueden borrar**: no hace falta migrar datos.

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

### 3.6 Reproductor (rehacer)

**Arquitectura.** La cola y el estado viven en `usePlayerStore`. Hay un **motor
por fuente**, montado **una sola vez** en `app/(public)/layout.tsx`, para que
siga sonando al navegar dentro de la wiki:

| Motor | Fuente | Control |
|---|---|---|
| `<audio>` | Audio propio | Completo: progreso, salto, volumen. **Media Session API**: controles y portada en la pantalla de bloqueo del móvil |
| YouTube IFrame API | YouTube | Play, pausa, salto y fin → siguiente |
| SoundCloud Widget API | SoundCloud | Igual que YouTube |
| Embed sin control | Suno (`suno.com/embed/<ID>`), Bandcamp y similares | Ninguno: se muestra su reproductor en el panel y la cola se detiene ahí. Si no hay embed, botón "Abrir en…" |
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

## 4. Plan por fases

Cada fase: un commit, `typecheck` + `lint` + `build`, y despliegue cuando el
autor lo diga.

| Fase | Contenido | Migración |
|---|---|---|
| **1** | Arreglo del "Cargando…" (sección 1). Independiente y pequeña: se puede desplegar ya | Ninguna |
| **2** | Fragmentos (sección 2): tabla, `ENTIDAD_INFO`, acciones, editor del taller, fecha derivada y ficha pública | `migrate-fragmentos.ts`: crea `acto_fragmento` (solo añade) |
| **3** | Canciones, datos y panel (3.3–3.5): columnas nuevas, vínculos al registro (incluidos `fragmento_cancion` y los nuevos), subida de audio con carpeta, purga y borrado adaptados, editor | `migrate-canciones.ts`: `letra`, `duracion`, `audio_asset_id` (solo añade) |
| **4** | Reproductor nuevo (3.6) | Ninguna |
| **5** | Sección Música (3.7): entidad, menús, índice, ficha y sitemap | Ninguna |
| **6** | Limpieza, después de desplegar 3–5: borrar las 3 canciones de prueba y sus vínculos; retirar `acto_cancion`, `hoja_cancion`, `personaje_cancion` y `capitulo_cancion` (y el catálogo `cancion_fuente` si se decide) | `migrate-canciones-retirada.ts`: **destructiva**. Ensayo + visto bueno |

Tras las fases 2 y 3, actualizar `README.md` (Estado actual),
`docs/relaciones.md` (relaciones nuevas) y `scripts/migrations/README.md`.
Correr `scripts/verificar-relaciones.mjs` y `scripts/verificar-catalogos.mjs`, que
necesitan `.env.local`, así que los lanza el autor.

---

## 5. Decisiones tomadas por defecto

Propuestas por Claude y no discutidas en detalle. El autor puede corregirlas:

- Los fragmentos **no** salen en la cronología: ya sale el acto entero y la
  saturarían.
- Los fragmentos **no** se listan en la ficha del personaje por ahora.
- El fragmento no tiene estado de publicación propio: hereda el del acto.
- Borrar un fragmento no quita su POV del acto.
- Spotify se queda solo como enlace o embed externo.
- La ruta es `/canciones` y en el menú se llama "Música".

## 6. Preguntas abiertas

- ¿El enlace del fragmento es obligatorio, o se puede crear un fragmento sin
  enlace para planificar antes de publicar? Propuesta: **opcional**.
- ¿Papelera para fragmentos o borrado directo? Propuesta: **borrado directo con
  confirmación**, porque el acto ya tiene papelera.
- ¿Se retira el catálogo `cancion_fuente` cuando la fuente pase a deducirse sola?
- ¿Probar el embed de Suno con una canción real del autor antes de la fase 4?
