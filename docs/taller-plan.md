# Taller del autor — plan de implementación

> Plan para construir lo que fija [taller-del-autor.md](./taller-del-autor.md)
> (la *spec*). Los "§" remiten a las secciones de la spec.

## Reglas de toda la obra

- **Solo hay una base: la de producción.** Cada fase que toca el schema trae un
  script en `scripts/migrations/` que por defecto hace un **ensayo** (todo dentro
  de una transacción que se revierte, mostrando qué cambiaría) y solo escribe con
  `--aplicar`. **Ningún `--aplicar` se ejecuta sin el visto bueno del autor.**
- Las migraciones son **aditivas** hasta que la fase siguiente demuestra que lo
  viejo ya no se lee. Las columnas viejas (`fecha_lore` en texto, por ejemplo) se
  retiran en una fase posterior, nunca en la misma que las reemplaza.
- Cada fase termina con `pnpm typecheck`, `pnpm lint`, `pnpm build`, los
  verificadores (`verificar-relaciones`, `verificar-catalogos`) y una prueba
  manual en `pnpm dev`. Cada fase va en **su propio commit**.
- Antes de escribir código de Next se lee la guía correspondiente en
  `node_modules/next/dist/docs/` (AGENTS.md).

## Decisiones técnicas transversales

### Fechas: tabla polimórfica `fecha_lore`

En lugar de unas 10 columnas por fecha repetidas en más de 10 tablas, se crea una
sola tabla:

```
fecha_lore(id, entidad_tipo, entidad_id, rol,            -- rol: 'principal', 'nacimiento', 'muerte', 'fundacion', 'caida', 'inicio'…
           ini_anio, ini_segmento_id?, ini_dia?,           -- segmento = mes o bloque de días fuera de mes
           fin_anio?, fin_segmento_id?, fin_dia?,          -- fin vacío = la fecha es un punto
           aproximada bool, importante bool,
           clave_ini bigint, clave_fin bigint)             -- día absoluto, para ordenar y comparar
```

- Es el mismo patrón que `vinculo` y `entidad_media`: integridad por código y una
  purga de huérfanas. Añadir fechas a una entidad no exige migración.
- La cronología derivada (§14) sale de **una sola consulta** sobre esta tabla.
- `clave_ini` y `clave_fin` (día absoluto en el eje) se calculan en el servidor al
  guardar y **se recalculan todas** cuando cambia el calendario.
- Calendario: `calendario_segmento(id, orden, nombre, dias, tipo 'mes'|'intercalar')`
  y `calendario_dia_semana(orden, nombre)`. Eras: `era(id, nombre, abreviatura,
  anio_inicio null = primera era)`.
- Toda la aritmética vive en `lib/fechas/` (client-safe y pura): clave absoluta,
  formato en eras o absoluto, precisión, edad entre dos fechas, día de la semana.

### Visibilidad y caché
Se sigue el patrón existente: queries server-only con filtro de visibilidad, y
`revalidatePath` en las Server Actions. Nada de caché nueva sin leer antes
`01-getting-started/08-caching.md` y `09-revalidating.md`.

### Dependencias nuevas (aprobadas el 2026-10-11)
- **Arrastrar y soltar** (Organizar y Estructura): sin dependencia, con la API
  nativa HTML5. El taller es solo de escritorio, así que basta.
- **Grafos con fuerzas, 2D y 3D** (§11): `react-force-graph-2d` y
  `react-force-graph-3d` (traen `three`). El 3D se carga con import dinámico solo
  en escritorio, de modo que el móvil no descarga three.js.

---

## Fase 1 — Cimientos: shell del taller y sistema de fechas

**Objetivo:** existe `/admin/taller` con su menú y el modelo de fechas funciona de
punta a punta, aunque todavía no lo use ninguna ficha.

> **Estado (2026-10-11):** código terminado; `typecheck`, `lint` y `build` pasan. El
> ensayo de `migrate-fechas.ts` convierte 50 fechas y deja 2 para revisar a mano
> ("19 días" y "Desconocido"). Migración **aplicada** el mismo día (commit
> 5f8099d). Pendiente: la prueba manual del calendario con sesión de autor.

1. **Migración `migrate-fechas.mjs`:** crea `era`, `calendario_segmento`,
   `calendario_dia_semana` y `fecha_lore`. Siembra un calendario por defecto
   (12 meses de 30 días y semana de 7, como StoryCamp) y las 4 eras del catálogo
   `era`, solo con el nombre: los años de inicio y las abreviaturas los pone el
   autor en el taller (decidido el 2026-10-11).
2. **Schema Drizzle:** `db/schema/fechas.ts` y su export en el barrel.
3. **`lib/fechas/`:** tipos, cálculo de clave, formato (eras y absoluto), edad y
   *parser* de los textos viejos ("-10000 a -6000", "Año -1", "aproximadamente").
4. **Shell del taller:** `app/(admin)/admin/taller/layout.tsx` a pantalla
   completa, con menú propio y `assertAdmin`. Enlace desde `AdminShell`.
   Las secciones aún vacías muestran "Próximamente".
5. **Universo > Calendario (configuración):** editar meses, días fuera de mes,
   días de la semana y eras. Al guardar se recalculan todas las claves.
6. **Componente `FechaInput`:** punto o rango, precisión por extremo, aproximada e
   importante.
7. **Conversión de los textos existentes** (§15) como paso de ensayo del script:
   lista lo que convertiría (39 eventos, capítulos, actos, demonio,
   organizaciones) y lo que no entiende. Escribe en `fecha_lore` **sin tocar** las
   columnas viejas.

**Hecho cuando:** el calendario y las eras se editan en el taller, `lib/fechas`
formatea bien los casos de la spec (primera era hacia atrás, año 0, días fuera
de mes) y el ensayo de conversión cuadra con lo que espera el autor.

## Fase 2 — Modelo narrativo

**Objetivo:** el schema y la lógica de capítulos y actos según §3, §4 y §7, sin
pantallas todavía.

> **Estado (2026-10-11):** hecha y aplicada. Ajustes respecto a lo previsto:
> - La intro del capítulo es la columna `descripcion` que ya existía, no una
>   columna `intro` nueva.
> - `catalogos.meta` (jsonb) en lugar de una columna `numerado`: servirá también
>   para color, icono y estilo de las categorías de relación (Fase 8).
> - El rótulo del capítulo se **guarda** en `numero` (lo reescribe el servidor) para
>   que buscador, fichas y Atlas lo sigan leyendo igual. Los tipos sin número se
>   rotulan con su nombre, con ordinal romano si se repiten en el libro
>   ("Interludio II").
> - Hilos: `acto_apertura_id` / `acto_cierre_id`, para abrir o cerrar un hilo en
>   un acto (§4).
> - Las relaciones del acto van por `vinculo` (sin migración) y sin bloque público
>   hasta la Fase 5. "Capítulos en los que aparece" del personaje ya sale de los
>   actos.
> - El admin genérico de capítulos renumera al guardar hasta que desaparezca
>   (Fase 4).

1. **Migración `migrate-taller-narrativa.mjs`:**
   - `estructura_plantilla(id, nombre, predeterminada)` y
     `estructura_fase(id, plantilla_id, orden, nombre, abreviatura, color, guia)`;
   - en `capitulos`: `plantilla_id` (nullable solo por la excepción temporal de
     §15), `intro`, `orden`;
   - en `actos`: `fase_id`, `notas_privadas`, `discord_url`;
   - en `timeline_eventos`: `acto_id`;
   - casilla `numerado` en los catálogos (para `capitulo_tipo`);
   - quita "Acto I:" de los nombres existentes (en el ensayo se ve antes y después);
   - elimina `capitulo_personaje` (0 filas).
2. **Relaciones nuevas en el registro:** acto↔personaje (POV y aparece, con un
   campo `rol`), acto↔nación/región/locación, acto↔arco, acto↔canción. Se retira
   `capitulo_personaje` del registro.
3. **Lógica derivada** (`lib/queries/narrativa.ts`): numeración automática por
   libro (saltando tipos no numerados), número romano del acto, descripción
   compuesta, personajes, lugares y canciones calculados, y rango de fechas del
   capítulo.
4. **Server Actions** (`lib/actions/taller.ts`): CRUD de capítulo, acto y
   plantilla, con las reglas de §7 (fase obligatoria, cambio de plantilla a la
   primera fase, no borrar una fase en uso).

**Hecho cuando:** los verificadores pasan con las relaciones nuevas y la lógica
derivada devuelve lo esperado sobre los 2 capítulos reales.

## Fase 3 — Taller: Escribe, Capítulos y Estructura

> **Estado (2026-10-11):** hecha. Escribe (lista con filtros + editor del acto con
> fecha, relaciones, hojas, hilos y eventos), Organizar (arrastre nativo, panel
> rápido), pantalla del capítulo (con lo calculado de sus actos y canciones
> propias) y Estructura (tablero y plantillas). Hojas e hilos ganaron arco y
> acto en sus formularios.

1. **Escribe:** lista de actos con los filtros de §5 y editor del acto con todos
   los campos de §4 (relaciones a través del motor del registro, fechas con
   `FechaInput`).
2. **Pantalla del capítulo** y **panel rápido** en Organizar (§3).
3. **Organizar:** árbol libro > capítulo > acto. Se arrastran capítulos dentro de
   su libro y actos entre capítulos.
4. **Estructura:** gestión de plantillas y fases, y tablero de un capítulo con
   arrastre entre fases. Aviso de los capítulos sin plantilla.

## Fase 4 — Taller: Trama, Estadísticas y Papelera

> **Estado (2026-10-11):** hecha. Trama reutiliza el formulario genérico dentro del
> taller (`rutaBase`). Las rutas viejas de `/admin/<capitulos|actos|arcos|hojas|hilos>`
> redirigen al taller (`lib/admin/taller.ts`); el dashboard y la actividad
> reciente enlazan allí. Un capítulo con actos no se borra para siempre.

1. **Trama:** pantallas propias para arcos, hojas e hilos, con los mismos datos
   (§8).
2. **Estadísticas** (§9).
3. **Papelera** del taller.
4. **Retirada del admin genérico:** capítulos, actos, arcos, hojas e hilos salen
   de `ENTIDAD_TABLES`, `fields.ts` y el dashboard. Sus rutas viejas redirigen al
   taller.

## Fase 5 — Narrativa pública

> **Estado (2026-10-11):** hecha y migración aplicada. Ficha de capítulo (intro +
> resúmenes, personajes con POV, lugares, banda sonora, fechas), ficha de acto
> anidada con navegación anterior/siguiente, buscador, sitemap, feed y Atlas.
> Los enlaces de los bloques usan la ruta real de la ficha (`FilaVinculo.ruta`).
>
> **Corrección de infraestructura:** el cliente de base pasa a `max_pipeline: 0`
> (`db/client.ts`). Con pipelining, postgres.js + el pooler de Supabase en modo
> transacción dejaban consultas colgadas hasta el statement_timeout al mezclar
> consultas con y sin parámetros; lo destapó la ficha del acto.

1. **Ficha de capítulo:** intro + resúmenes, personajes, lugares, canciones y
   rango de fechas calculados, y lista de actos visibles.
2. **Ficha de acto** en `/capitulos/[id]/actos/[id]`, oculta si su capítulo no
   está publicado.
3. **Búsqueda ⌘K:** trigger de `search_index` para `actos`, con la URL anidada
   (variante de `search_index_sync`).
4. **Sitemap, feed y grafo:** los actos entran en los tres.
5. **"Capítulos en los que aparece"** del personaje: pasa a calcularse a partir
   de los actos.

## Fase 6 — Fechas en todas las fichas

> **Estado (2026-10-11):** hecha. Ajustes respecto a lo previsto:
> - Los roles de cada ficha están en un solo sitio, `lib/fechas/roles.ts`; de ahí
>   salen el editor, la ficha pública y la cronología.
> - El editor de fechas (`FechasFicha`) se guarda por su cuenta, como el panel de
>   conexiones, así que va igual en el formulario genérico y en los propios
>   (personaje, organización, familia, gremio, lore). Aparece al editar, no al crear.
> - El servidor escribe cada fecha en las dos lecturas y el navegador enseña la
>   elegida (`components/fechas/`): el cliente no necesita el calendario para
>   pintar una fecha.
> - La edad del personaje usa el momento de lectura (Zustand, en memoria de la
>   pestaña); `personajes.edad` se queda como texto manual de respaldo.
> - Los eventos guardan su escala de importancia (Anécdota… Definitorio), que es
>   un catálogo del autor; lo que decide la cronología destacada es la casilla
>   "Importante" de la fecha. La migración marcó los Mayor, Crítico y Definitorio.
> - La retirada de columnas (`migrate-fechas-retirada.ts`) va aparte porque el
>   despliegue anterior aún las lee: se aplica con el nuevo ya en producción.

1. `FechaInput` en todos los editores, con los roles de §13: nacimiento y muerte,
   fundación y caída, creación y destrucción, origen y extinción, etc.
2. **Edad:** campo de texto manual de respaldo y cálculo según el momento de
   lectura (un store de Zustand en el cliente; capítulo y acto lo fijan al
   abrirse).
3. **Conmutador eras/absoluto** del lector, guardado en `localStorage` con
   try/catch.
4. **Retirada** de las columnas de texto viejas (`fecha_lore`, `anio_lore`,
   `era_aparicion`, `edad`, `fundacion`…) cuando nada las lee. Migración aparte,
   con ensayo.

## Fase 7 — Cronología y calendario

> **Estado (2026-10-11):** hecha. `lib/queries/cronologia.ts` saca los sucesos de
> `fecha_lore` (los capítulos, del rango de sus actos). La línea temporal y el
> calendario comparten filtros (`components/cronologia/`); el calendario del
> taller es el mismo con todo lo no publicado y alta de eventos por día, mes o
> año. La configuración del calendario pasó a `universo/calendario/configurar`.
> El gestor de eventos del admin ordena por fecha (ya no se arrastra) y el
> evento admite un acto, que fija su capítulo.

1. **Cronología pública:** eventos y sucesos derivados de `fecha_lore`, con filtros
   por tipo, era y entidad, e importantes por defecto. `TimelineEspiral` pasa a
   ordenar por `clave_ini`.
2. **Vista de calendario por año**, pública (submenú de la cronología) y en el
   taller (con alta de eventos). Incluye la franja "todo el año".
3. Los eventos se pueden ligar a un capítulo y, opcionalmente, a un acto.

## Fase 8 — Universo: personajes y mapa de relaciones del taller

1. **Universo > Personajes:** cuadrícula con filtros; cada personaje enlaza a su
   editor.
2. **Categorías de relación** en `/admin/catalogos`: nombre, color, icono y estilo
   de línea, y asignación de los 26 tipos.
3. **Mapa 2D editable:** se crea un vínculo uniendo dos nodos (se ofrecen las
   relaciones del registro para ese par de tipos) y se edita o borra pulsando la
   arista. Filtros por tipo de entidad y categoría, y buscador. Reutiliza la
   lectura y escritura genéricas de `lib/relaciones/consultas.ts`.

## Fase 9 — Atlas 3D y mini-mapa

1. **Atlas:** 3D navegable en escritorio y 2D en móvil, con esferas por tipo de
   entidad. Sustituye a `components/atlas/`.
2. **Mini-mapa 2D** centrado en cada ficha, que sustituye a `MiniGrafoFicha` y
   `MiniGrafo`.

## Fase 10 — Comparador de alturas

1. **Migración:** `altura`, `longitud` y `silueta` en `bestias` y `lord_demonio`.
2. **Campos** en sus editores, incluido el selector de forma.
3. **Página pública** en Explorar: filtros y selección libre, escala real con zoom,
   conmutador alto/largo y paleta automática. Excluye a quien no tenga altura o la
   tenga oculta.

---

## Orden y dependencias

```
F1 fechas + shell ──► F2 modelo narrativo ──► F3 taller ──► F4 trama/retirada
        │                     └──────────────► F5 narrativa pública
        └──► F6 fechas en fichas ──► F7 cronología y calendario
F8 universo y mapa ──► F9 atlas 3D          F10 alturas (independiente)
```

Las fases 8, 9 y 10 no dependen del taller narrativo y podrían adelantarse si se
prefiere ver antes algo público.
