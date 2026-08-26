# Arquitectura Técnica Completa — Astralys Wiki

> **Qué es este documento.** El diseño de arquitectura original, con las decisiones
> de alto nivel y su justificación. Es la referencia del *porqué*: cuando dudes de
> por qué algo está montado así, la respuesta está aquí. No contiene código de
> producción; los fragmentos son pseudocódigo o diagramas ilustrativos.
>
> **No describe el estado actual.** La implementación se apartó del plan en varios
> puntos (tabla abajo). Para lo que hay hoy, mira el [README](../README.md).
>
> **Restricción rectora:** 100% gratuito, audiencia mayoritariamente móvil (1–5
> lectores), un único admin.

## Stack real (2026-08-25)

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Framer Motion ·
Server Actions · Zod · Drizzle ORM · Supabase (Postgres + Auth + FTS) · Cloudinary ·
React Flow (`@xyflow/react`) · Leaflet + Geoman · Zustand · lucide-react.

### Divergencias respecto al diseño original

El resto del documento conserva la redacción original, así que al leerlo ten
presente que estas piezas cambiaron:

| El documento dice | Lo que se hizo |
|---|---|
| Next.js 15 | **Next.js 16** |
| Cloudflare R2 | **Cloudinary**. La subida sale del navegador vía `next-cloudinary` pero va **firmada en el servidor** (`/api/cloudinary/firma`), organizada en carpetas por entidad, y los assets sin referencias se purgan solos (`lib/media/purga.ts`) |
| shadcn/ui | **Componentes propios** organizados por dominio (`components/fichas`, `/admin`, `/viz`…). No existe `components/ui` |
| Recharts (radar de stats) | **SVG propio** animado con Framer Motion (`components/fichas/personaje/StatRadar.tsx`) |
| Howler.js (audio) | **`<audio>` nativo** + embeds, con el estado en Zustand (`components/player/MusicPlayerBar.tsx`) |
| `db/types.ts` (§2.5) | No existe, y no se usa `InferSelectModel`. Cada módulo de `lib/queries` deriva sus tipos del retorno de su propia query (`Awaited<ReturnType<typeof …>>`) |
| D3 | No se usó |
| Sentry | No instalado |
| next-pwa | No instalado (sigue pendiente, §15) |

> Las referencias a R2, shadcn, Recharts y Howler que aparecen más adelante en el
> texto son del diseño original: valen como razonamiento, no como descripción de
> lo que hay en el repositorio.

---

## Índice

0. [Principios rectores de la arquitectura](#0-principios-rectores)
1. [Problemas del schema actual — resolución](#1-problemas-del-schema)
2. [Organización de Drizzle ORM](#2-organización-de-drizzle-orm)
3. [Arquitectura de rutas y estructura de carpetas](#3-rutas-y-carpetas)
4. [Estrategia de rendering y caché](#4-rendering-y-caché)
5. [Sistema de componentes](#5-sistema-de-componentes)
6. [Sistema de animaciones (Framer Motion)](#6-animaciones)
7. [Identidad visual y design system](#7-design-system)
8. [Navegación y búsqueda](#8-navegación-y-búsqueda)
9. [Reproductor de música](#9-reproductor-de-música)
10. [Visualizaciones interactivas](#10-visualizaciones)
11. [SEO y metadata](#11-seo)
12. [Autenticación y protección del admin](#12-auth)
13. [Sistema de visibilidad y previews](#13-visibilidad-y-previews)
14. [Notificaciones Discord](#14-discord)
15. [PWA](#15-pwa)
16. [Experiencia móvil específica](#16-móvil)
17. [Páginas de error personalizadas](#17-errores)
18. [Herramientas de desarrollo](#18-tooling)
19. [Apéndice: orden de implementación recomendado](#19-roadmap)

---

<a name="0-principios-rectores"></a>
## 0. Principios rectores de la arquitectura

Antes de las secciones numeradas, fijo cinco principios que atraviesan todo el documento y de los que derivan casi todas las decisiones. Cuando una sección posterior parezca arbitraria, casi siempre se justifica por uno de estos:

1. **El contenido es casi estático.** Solo el admin cambia datos, y con baja frecuencia (escribe en Discord, no aquí). Esto empuja todo hacia **SSG/ISR + revalidación on-demand**, lo que a su vez minimiza bandwidth de Vercel y lecturas de Supabase. Es la palanca más importante para mantenerse en free tier.

2. **La audiencia es diminuta y móvil.** 1–5 lectores significa que **no optimizamos para escala sino para peso por página y batería**. Menos JS, lazy loading agresivo, animaciones reducidas en móvil. Nunca necesitamos Redis, edge functions de pago, ni colas.

3. **Un solo escritor de confianza.** No hay RLS, no hay multi-tenant, no hay rate-limiting de escritura, no hay moderación. La seguridad se reduce a **una puerta**: el middleware de `/admin`. Esto simplifica enormemente el backend.

4. **El schema es la fuente de verdad y tiene deuda.** Hay tres problemas estructurales (relaciones, secciones fijas, imágenes sueltas) que **deben resolverse antes** de construir el frontend, porque condicionan los tipos de Drizzle, los componentes y el SEO. Por eso la sección 1 va primero.

5. **Cada byte cuenta para el free tier, pero el tiempo del autor cuenta más.** Es un proyecto en solitario. Prefiero soluciones simples y mantenibles a soluciones "perfectas" que el autor no podrá mantener. Rechazo la sobreingeniería explícitamente cuando aparece (ej. separación R2/Supabase Storage, ver §1).

---

<a name="1-problemas-del-schema"></a>
## 1. Problemas del schema actual — resolución

Esta sección decide la **dirección arquitectónica**, no el DDL final. Pero las decisiones aquí son vinculantes para Drizzle (§2), componentes (§5), media (§7, §11) y visibilidad (§13).

### Problema 1 — Tabla `relaciones` (mezcla PJ/organización en una columna)

**Diagnóstico.** La tabla actual mete en `nombre_pj_organizacion (varchar)` tanto el nombre libre de una organización como, alternativamente, se apoya en `personaje_relacionado_id (int)` para relaciones con otro personaje. Es un campo polimórfico "pobre": no hay FK fiable, no se puede hacer join, y el mismo concepto ("con quién se relaciona") vive en dos columnas incompatibles. Además ya existe `personaje_organizacion` como tabla N:M propia, lo que genera **redundancia conceptual**.

**Decisión.** Separar por **tipo de objetivo (target)**, no meter más polimorfismo. Tres movimientos:

1. **Relaciones personaje↔personaje** → se quedan en `relaciones`, pero la tabla se **especializa**: `personaje_id` (origen) + `personaje_relacionado_id` (destino, ahora **FK obligatoria a `personajes.id`**), `tipo_relacion`, `subtipo_relacion`, `descripcion`. Se **elimina** `nombre_pj_organizacion`. Conceptualmente la tabla pasa a llamarse, en el modelo mental, `personaje_relacion_personaje` (puede conservar el nombre `relaciones` por compatibilidad de datos existentes).

2. **Relaciones personaje↔organización** → ya tienen hogar canónico: `personaje_organizacion` (con `rol`, `tipo`, `descripcion`). Cualquier fila de `relaciones` que hoy apunte a una organización por texto se **migra** allí. Lo mismo aplica a `personaje_nacion`, `personaje_raza`, `familia_jerarquia`, etc. — cada relación con una entidad del Mundo tiene su tabla N:M tipada.

3. **Relaciones con entidades aún no modeladas o "sueltas"** (un personaje relacionado con algo que no es PJ ni una entidad existente: una facción mencionada, un grupo sin ficha) → en lugar de revivir el varchar, se permite que `personaje_relacionado_id` sea NULL y se añade un `nombre_externo (varchar, nullable)` **explícitamente nombrado como excepción**. Pero la regla es: si tiene ficha, va por FK.

**Por qué así y no un polimórfico genérico.** Un diseño polimórfico tipo `(target_tipo, target_id)` sería tentador, pero Postgres no puede garantizar integridad referencial sobre FK polimórficas, y aquí ya tenemos tablas N:M tipadas que funcionan. Mantener FKs reales nos da: joins baratos (importante para no multiplicar lecturas en free tier), integridad garantizada, y tipos Drizzle correctos sin `unions` manuales. El coste —tener una tabla por tipo de relación— es asumible porque el número de tipos es finito y conocido.

> **Bidireccionalidad.** Las relaciones PJ↔PJ se almacenan **una sola vez** (A→B) y se renderizan en ambos sentidos por query (la ficha de B busca filas donde `personaje_relacionado_id = B`). Evita duplicar y desincronizar. La etiqueta inversa ("padre" ↔ "hijo") se resuelve con una pequeña tabla/diccionario de `tipo_relacion` que define el inverso, o se muestra neutra ("relacionado con") en la dirección inversa en fase 1.

### Problema 2 — `paginas_lore` con `seccion1_titulo … seccion6_titulo`

**Diagnóstico.** Seis pares de columnas fijas (`seccionN_titulo`, presumiblemente `seccionN_contenido`) imponen un techo rígido (máx. 6 secciones), desperdician espacio con NULLs, y no permiten reordenar sin reescribir columnas. Es un anti-patrón clásico de "columnas como filas".

**Decisión.** Normalizar a una tabla hija **`pagina_secciones`**:

```
pagina_secciones
  id            pk
  pagina_id     fk -> paginas_lore.id   (on delete cascade)
  orden         integer  not null        -- controla el orden de render
  titulo        varchar  nullable
  contenido     text     nullable        -- markdown/richtext
  tipo          varchar  default 'texto' -- 'texto' | 'galeria' | 'cita' | 'tabla' ...
  visible       boolean  default true    -- visibilidad a nivel sección (ver §13)
```

`paginas_lore` conserva la cabecera (`slug`, `titulo`, `subtitulo`, `introduccion`, media, `visible`) y **pierde** las 12 columnas de sección.

**Por qué.** Extensibilidad ilimitada, reordenación trivial (cambiar `orden`), y —clave para §13— la visibilidad a nivel de campo se vuelve natural: cada sección es una fila con su propio `visible`. El `tipo` discriminador abre la puerta a bloques ricos (galería, cita destacada) sin tocar el schema. El coste de un join extra es irrelevante con ISR (se paga una vez por revalidación, no por lector).

**Generalización.** Este patrón "entidad + tabla de secciones ordenadas" es reutilizable. Las entidades grandes con prosa larga (personaje `historia`, nación `historia`, organización `historia`) **podrían** migrar a este modelo en el futuro, pero **no ahora**: sus campos son semánticamente fijos y bien tipados (`motivacion`, `miedos`, `filosofia`…), y convertirlos a secciones genéricas perdería estructura útil para los componentes (§5). Solo `paginas_lore` (contenido libre de formato variable) justifica la normalización hoy.

### Problema 3 — Imágenes sueltas → tabla `media_assets`

**Diagnóstico.** Casi todas las tablas tienen `imagen_url` y `banner_url` como `varchar`. Esto impide: guardar metadatos (alt para accesibilidad/SEO, dimensiones para evitar layout shift, tipo, tamaño), reutilizar una imagen en varias entidades, y controlar el storage de forma centralizada.

**Decisión.** Crear **`media_assets`** como catálogo único de medios, y vincularla mediante una tabla de unión polimórfica controlada.

```
media_assets
  id            pk
  storage       varchar  -- 'r2' | 'supabase'  (de dónde se sirve)
  bucket_key    varchar  -- path/key dentro del bucket
  url_publica   varchar  -- URL servible (CDN de R2 o Supabase public URL)
  tipo          varchar  -- 'imagen' | 'audio' (audio propio también vive aquí)
  mime          varchar
  alt           varchar  nullable   -- accesibilidad + SEO
  ancho         integer  nullable
  alto          integer  nullable
  bytes         integer  nullable
  blurhash      varchar  nullable   -- placeholder LQIP para móvil
  creado_en     timestamptz default now()
```

**Vinculación entidad↔media.** Dos estrategias evaluadas:

- **(A) FK directa en cada entidad** (`personajes.imagen_asset_id`, `personajes.banner_asset_id`): simple, type-safe, sin polimorfismo. Pero requiere una columna por "rol de imagen" por tabla.
- **(B) Tabla de unión polimórfica** `entidad_media (entidad_tipo, entidad_id, asset_id, rol)`: flexible, permite galerías (N imágenes por entidad), pero sin integridad referencial real sobre `entidad_id`.

**Decisión: híbrido pragmático.** Para las **dos imágenes canónicas** que toda entidad tiene (avatar/`imagen` y `banner`), uso **FK directa (A)**: `imagen_asset_id` y `banner_asset_id` como FK nullable a `media_assets`. Es lo que consumen los componentes de ficha y card en el 95% de los casos, y conviene que sea type-safe. Para **galerías y medios adicionales** (varias ilustraciones de un personaje, mapas de una nación), uso una tabla de unión **(B)** `entidad_media` con `(entidad_tipo, entidad_id, asset_id, orden, rol)`.

Así obtengo lo mejor de ambos: las rutas calientes (card, hero de ficha, og:image) son joins simples y tipados; lo extensible (galerías) vive en la tabla polimórfica donde la flexibilidad importa más que la FK estricta. La migración desde los `varchar` actuales: por cada `imagen_url` no nula, crear un `media_asset` y poblar `imagen_asset_id`.

### Problema adicional — `visible bool` ¿suficiente?

**Diagnóstico.** Un booleano colapsa estados que el flujo de autoría sí distingue: **borrador** (en construcción, nunca mostrar), **publicado** (visible al lector), **oculto/spoiler** (existe y está terminado, pero se esconde temporalmente para no spoilear). Con un bool no puedes diferenciar "borrador a medias" de "terminado pero guardado para más tarde", y eso afecta a notificaciones Discord (§14: el webhook debe dispararse en la *primera* publicación) y a previews (§13).

**Decisión: evolucionar a un `estado_publicacion` enum.** Reemplazar `visible (bool)` por:

```
estado_publicacion  enum('borrador', 'publicado', 'oculto')  default 'borrador'
```

- `borrador` → invisible para lectores, editable, **no** dispara webhook.
- `publicado` → visible para lectores; la transición borrador→publicado (o oculto→publicado por primera vez) dispara el webhook de "nueva entidad".
- `oculto` → terminado pero retirado (spoiler/reorganización); invisible para lectores, **sí** se considera "ya publicado alguna vez" para no re-notificar.

Para saber si una entidad **ya fue publicada alguna vez** (y así distinguir "publicar por primera vez" de "republicar"), añado `publicado_primera_vez_en timestamptz nullable`. Se setea la primera vez que pasa a `publicado` y nunca se borra. El webhook de "nueva" se dispara solo cuando este campo es NULL en el momento de publicar; los siguientes son "actualización".

**Trade-off considerado.** ¿Por qué no dejar `bool` + un segundo bool `es_borrador`? Porque dos booleanos permiten estados imposibles (`visible=true, es_borrador=true`) y obligan a validar combinaciones. Un enum de 3 valores es mutuamente excluyente por construcción, se mapea limpio a Drizzle (`pgEnum`), y es directamente el filtro de las queries públicas (`where estado_publicacion = 'publicado'`). El coste de migración es mínimo (un `CASE` sobre el bool actual).

> Esta decisión **alimenta directamente la §13** (visibilidad a nivel de campo y previews) y la **§14** (lógica de notificación). Se referencian mutuamente.

### Problema adicional — Storage: ¿R2 + Supabase Storage o sobreingeniería?

**Diagnóstico.** El stack propone R2 para "imágenes HD" y Supabase Storage para "thumbnails". Para 1–5 lectores y ~10GB de presupuesto en R2 vs 1GB en Supabase, mantener **dos** sistemas de storage, dos SDKs, dos flujos de subida y dos orígenes de URL es complejidad que hay que justificar.

**Decisión: simplificar a un solo origen — Cloudflare R2 — y generar thumbnails on-the-fly, no en un segundo bucket.**

Razonamiento:
- R2 tiene **egress gratuito ilimitado** y 10GB de almacenamiento gratis. Servir *todas* las imágenes (HD y thumbnails) desde R2 no consume el bandwidth de Vercel ni el de Supabase. Esto **protege el límite de 100GB/mes de Vercel**, que es el cuello de botella real.
- Los "thumbnails" no necesitan un bucket aparte: Next.js `<Image>` ya genera y cachea variantes redimensionadas. Combinado con `blurhash`/LQIP (guardado en `media_assets`) cubrimos el placeholder móvil sin storage extra.
- Mantener Supabase Storage en su rol original (1GB) **se reserva** solo si en el futuro se necesita un flujo de subida muy integrado con Auth; hoy no aporta y añade superficie.

**Conclusión:** la separación R2/Supabase Storage **es sobreingeniería para esta escala**. Decisión: **R2 como único origen de binarios** (imágenes y audio propio), servido vía su dominio público/CDN; Next/Image para redimensionado; `media_assets.storage` queda como campo preparado por si algún día se reintroduce Supabase Storage, pero su valor será `'r2'` en la práctica. Esto reduce a un solo SDK de subida en el admin y un solo dominio en `next.config` (`remotePatterns`).

---

<a name="2-organización-de-drizzle-orm"></a>
## 2. Organización de Drizzle ORM

### 2.1 Organización de los archivos de schema → **por dominio**

Tres opciones: monolítico (un `schema.ts`), por tabla (un archivo por tabla), por dominio. **Decisión: por dominio**, alineado con los 8 dominios del prompt.

```
/db
  /schema
    narrativa.ts      // capitulos, actos, trama_arcos, trama_hojas, hilo_narrativo, hoja_*
    personajes.ts     // personajes, estadisticas, habilidades, relaciones, eventos_personaje,
                      //   personaje_narrativa, personaje_narrativa_hito
    mundo.ts          // naciones, razas, organizaciones, familias, bestias, minerales, gremio
    jerarquias.ts     // *_jerarquia, *_facciones, *_rangos, *_historial, familia_arbol
    relacionesNM.ts   // capitulo_personaje, personaje_nacion, personaje_raza,
                      //   personaje_organizacion, nacion_*, familia_arbol vínculos
    lore.ts           // conceptos, magia_fundamentos, paginas_lore, pagina_secciones,
                      //   lord_demonio, misiones, timeline_eventos
    media.ts          // media_assets, entidad_media, canciones, *_cancion
    objetos.ts        // armas_artefactos, equipamiento, objetos_importantes, sistema_monetario
    admin.ts          // nota_privada
    enums.ts          // estado_publicacion, niveles, rarezas, rangos... (pgEnum compartidos)
    index.ts          // re-exporta todo: export * from './narrativa' ...
  relations.ts        // todas las relations() de Drizzle (ver 2.2)
  client.ts           // instancia drizzle(postgres(DATABASE_URL))
  types.ts            // InferSelectModel / InferInsertModel por entidad
```

**Por qué por dominio y no monolítico:** el schema tiene ~50 tablas; un solo archivo de 2000+ líneas es inmanejable y produce conflictos mentales. **Por qué no por tabla:** demasiados archivos minúsculos y muchos imports cruzados (las N:M tocan dos dominios). El dominio es el punto medio: cada archivo tiene cohesión semántica y un tamaño revisable. `enums.ts` se separa porque los enums (especialmente `estado_publicacion`) se comparten entre dominios y deben definirse una sola vez.

### 2.2 Declaración de relaciones en Drizzle

Drizzle separa **constraints de DB** (definidos con `.references()` en la columna FK) de **relaciones de query** (la API `relations()` para `db.query.x.findMany({ with: {...} })`). 

**Decisión:** centralizar todas las `relations()` en **`/db/relations.ts`**. Aunque Drizzle permite definirlas junto a cada tabla, centralizarlas evita import cíclico entre archivos de dominio (personajes↔mundo se referencian mutuamente) y da un único lugar para ver el grafo del modelo. Las FK físicas (`.references()`) sí van en la definición de cada columna, en su archivo de dominio.

Patrón:
```
// relations.ts (pseudocódigo)
personajesRelations = relations(personajes, ({ one, many }) => ({
  imagen:        one(mediaAssets, ...),     // FK directa (Problema 3)
  banner:        one(mediaAssets, ...),
  estadisticas:  one(estadisticas, ...),    // 1:1
  habilidades:   many(habilidades),
  relaciones:    many(relaciones),          // PJ->PJ
  naciones:      many(personajeNacion),     // N:M via tabla puente
  canciones:     many(personajeCancion),
  galeria:       many(entidadMedia),        // polimórfica, filtrada por entidad_tipo
}))
```

Las N:M se modelan siempre como **dos `one` dentro de la tabla puente + dos `many` en las entidades extremo** (patrón estándar Drizzle). La polimórfica `entidad_media` se filtra en la query por `entidad_tipo` (Drizzle no resuelve el polimorfismo solo; se filtra en el `where` de la relación o en la query).

### 2.3 Queries reutilizables → `/lib/queries/[dominio].ts`, funciones nombradas

**Decisión:** una carpeta `/lib/queries` espejo de los dominios, con **funciones nombradas, async, server-only**, que encapsulan cada lectura. Nunca llamar a `db` directamente desde un componente o página: siempre a través de estas funciones. Esto crea una **capa de acceso a datos** única, testeable y donde se centraliza el filtro de visibilidad.

```
/lib/queries
  personajes.ts   // getPersonajeById, getPersonajeFichaCompleta, listPersonajes, ...
  naciones.ts
  lore.ts
  busqueda.ts     // FTS global (§8)
  _shared.ts      // helpers: aplicarVisibilidad(), withMedia(), etc.
```

Convenciones:
- `get*` → una entidad (o null). `list*` → colecciones (índices). `count*` → conteos.
- **Filtro de visibilidad centralizado.** Toda query pública pasa por un helper `soloPublicado(query)` que añade `where estado_publicacion = 'publicado'`. Las queries del admin usan una variante `incluirNoPublicado()`. Esto garantiza que **nunca** se filtre un borrador a un lector por olvido — el default seguro vive en un solo sitio.
- Las funciones que alimentan fichas completas (`getPersonajeFichaCompleta`) hacen **un solo `db.query` con `with`** para traer todo el árbol (stats, habilidades, relaciones, media, canciones) en una ida, minimizando round-trips a Supabase.
- `import 'server-only'` en la cabecera de cada archivo de queries para impedir que se empaqueten en el cliente por accidente.

### 2.4 Server Actions → `/lib/actions/[dominio].ts`

**Decisión:** Server Actions agrupados por dominio en `/lib/actions`, **solo para mutaciones del admin** (los lectores no escriben nada). Convención de nombres verbo-entidad.

```
/lib/actions
  personajes.ts   // crearPersonaje, actualizarPersonaje, publicarPersonaje,
                  //   ocultarPersonaje, eliminarPersonaje, subirImagenPersonaje
  lore.ts
  media.ts        // subirAsset (a R2), eliminarAsset
  _auth.ts        // assertAdmin(): guard reutilizable en cada action
```

Patrón de cada action:
1. `'use server'` al inicio del archivo.
2. **`await assertAdmin()`** como primera línea de toda mutación (lee la sesión Supabase; lanza/redirige si no es admin). Defensa en profundidad además del middleware (§12).
3. **Validación con Zod** del input (un `schema` por entidad en `/lib/validation/[dominio].ts`).
4. Mutación vía Drizzle.
5. **Revalidación** (`revalidatePath` / `revalidateTag`, ver §4) de las rutas afectadas.
6. Efectos secundarios (webhook Discord §14) **después** de confirmar la escritura, idealmente sin bloquear la respuesta.

Separar `actions` (escritura, mutan + revalidan) de `queries` (lectura, puras) es la división limpia que mantiene el modelo mental claro: *las páginas leen con queries, los formularios del admin escriben con actions*.

### 2.5 Tipos

`/db/types.ts` deriva tipos con `InferSelectModel`/`InferInsertModel` por entidad, re-exportados. Los componentes consumen estos tipos, no redeclaran formas. Los tipos de "ficha completa" (entidad + relaciones) se derivan del tipo de retorno de la query (`Awaited<ReturnType<typeof getPersonajeFichaCompleta>>`), evitando duplicación.

---

<a name="3-rutas-y-carpetas"></a>
## 3. Arquitectura de rutas y estructura de carpetas

### 3.1 Árbol `/app`

Uso **route groups** para separar el shell público del shell de admin sin afectar la URL:

```
/app
  layout.tsx                 // root: <html>, fuentes, providers globales, dark theme fijo
  globals.css
  not-found.tsx              // 404 global temático (§17)
  error.tsx                  // 500 global, error boundary raíz (§17)
  sitemap.ts                 // sitemap dinámico (§11)
  robots.ts                  // robots (§11)
  manifest.ts                // PWA manifest (§15)
  opengraph-image.tsx        // OG por defecto del sitio (§11)

  (public)                   // route group → shell de lector (navbar, music player, search)
    layout.tsx               // layout público: TopNav + BottomNav móvil + reproductor global
    page.tsx                 // HOME: hero con cosmos animado + accesos + mapa destacado
    loading.tsx

    personajes
      page.tsx               // ÍNDICE: grid de cards + filtros + búsqueda (patrón §5)
      loading.tsx
      [id]
        page.tsx             // FICHA personaje (tabs) — URL /personajes/42
        loading.tsx
        not-found.tsx        // 404 de sección
    naciones/[id], organizaciones/[id], familias/[id], razas/[id],
    bestias/[id], minerales/[id], conceptos/[id], misiones/[id]
                             // mismo patrón índice + [id]
    magia
      page.tsx               // fundamentos de magia (de magia_fundamentos)
      [id]/page.tsx
    lore
      page.tsx               // índice de paginas_lore
      [slug]/page.tsx        // ← excepción: lore usa SLUG, no id (ver 3.4)
    timeline/page.tsx        // visualización D3 (§10)
    mapa/page.tsx            // Leaflet (§10)
    buscar/page.tsx          // (opcional) resultados full-page; el principal es el ⌘K modal

  (admin)                    // route group → shell de autor, protegido por middleware
    layout.tsx               // layout admin: sidebar de gestión, sin navbar público
    admin
      page.tsx               // dashboard: estado de publicación, contadores, accesos
      login/page.tsx         // email/password (Supabase Auth) — fuera del guard
      personajes
        page.tsx             // tabla de gestión (todos los estados)
        nuevo/page.tsx
        [id]/editar/page.tsx
      [...resto de entidades con mismo patrón]
      media/page.tsx         // gestor de media_assets
      notas/page.tsx         // nota_privada
      preview/[tipo]/[id]/page.tsx   // modo preview (§13)

  api                        // route handlers mínimos
    og/[tipo]/[id]/route.tsx // generación og:image dinámica (§11) — si no se usa file-based
    revalidate/route.ts      // (opcional) endpoint de revalidación manual
```

### 3.2 Convenciones de archivos especiales

- **`page.tsx`** — Server Component por defecto. Solo se vuelve `'use client'` cuando hay interactividad pura (raro: la mayoría son server).
- **`layout.tsx`** — uno por route group (`(public)`, `(admin)`) + el root. **No** anido un layout por cada sección salvo que aporte (las secciones comparten el layout público; la cabecera específica de sección la pone un componente, no un layout, para no fragmentar).
- **`loading.tsx`** — en cada índice y cada `[id]`. Muestra **skeletons temáticos** (cards fantasma con shimmer) — crítico en móvil para percepción de velocidad.
- **`error.tsx`** — root + uno en `(public)` para errores de datos de sección. Client Component obligatorio (lleva `reset()`).
- **`not-found.tsx`** — root global + uno por sección donde el mensaje deba ser específico ("Este personaje se ha desvanecido en el vacío").

### 3.3 Separación `components / lib / hooks / types`

```
/components
  /ui            // shadcn/ui generado (button, dialog, command, tabs, badge...)
  /layout        // TopNav, BottomNav, Sidebar(admin), Footer, MusicPlayerBar
  /entity        // EntityCard, EntityIndexGrid, FilterBar, StatTable, AbilityList, Badge*
  /fichas        // PersonajeFicha, NacionFicha, BestiaFicha, FamiliaFicha, OrgFicha
  /viz           // WorldMap(Leaflet), Timeline(D3), FamilyTree(ReactFlow), RelationGraph
  /search        // CommandPalette (⌘K), SearchResultItem
  /motion        // wrappers Framer: FadeIn, StaggerGrid, EntityEntrance, ParticleField
  /media         // MediaImage (wrapper next/image+blurhash), Gallery, AudioEmbed
/lib
  /queries       // §2.3 (server-only)
  /actions       // §2.4 (server)
  /validation    // schemas Zod por dominio
  utils.ts       // cn(), formateadores, slugify
  r2.ts          // cliente subida/borrado R2 (server-only)
  supabase       // server.ts (server client), middleware.ts helper
  discord.ts     // envío de embeds (§14, server-only)
/hooks           // client only: useMediaQuery, useDebounce, useSearch, usePlayerStore...
/types           // tipos de dominio compartidos no derivables de Drizzle (UI props, enums UI)
/db              // §2.1
/styles          // tokens, animaciones keyframe css si hace falta
```

### 3.4 Slugs vs IDs numéricos

**Regla general (decidida por el prompt): las URLs usan ID numérico** → `/personajes/42`. Razones a favor que confirmo: los IDs ya existen (PK), son estables, no colisionan, y no requieren columna `slug` ni resolución extra en la mayoría de entidades. Para 1–5 lectores el beneficio SEO de un slug bonito es marginal.

**Excepción justificada: `paginas_lore` usa `slug`.** El schema ya define `paginas_lore.slug (unique)`, y las páginas de lore son contenido editorial donde una URL legible (`/lore/el-despertar-cosmico`) sí aporta (son las páginas más "linkeables" y compartibles). Coste: resolver por slug en la query (`where slug = ...`). Es la única sección con slug.

**Mejora opcional de SEO sin romper la regla:** soportar URLs híbridas `/personajes/42/kael-astralys` donde el segmento de nombre es **decorativo e ignorado** (canonical apunta a `/personajes/42`). Next.js puede aceptar `[id]/[[...slug]]`. Se deja como *nice-to-have* fase 2; la fase 1 usa solo `[id]`.

### 3.5 Layout compartido entre secciones

Todas las secciones públicas comparten el `(public)/layout.tsx`: `TopNav` (desktop) + `BottomNav` (móvil) + `MusicPlayerBar` global (§9) + el provider del ⌘K (§8). Las **fichas individuales no tienen layout propio**; su estructura única vive en el componente `*Ficha` (§5), no en un `layout.tsx`, para no fragmentar el árbol de layouts ni romper el reproductor persistente (un layout intermedio que se remonte mataría el estado del player; mantenerlo en el layout público raíz lo preserva — ver §9).

---

<a name="4-rendering-y-caché"></a>
## 4. Estrategia de rendering y caché

Premisa (Principio 1): el contenido solo cambia cuando el admin publica. Esto hace que **ISR con revalidación on-demand** sea casi siempre la respuesta correcta. Decido página por tipo:

| Tipo de página | Estrategia | Justificación |
|---|---|---|
| **Home** | **SSG** + revalidate on-demand | Composición fija; cambia raramente. Se regenera cuando se publica algo destacado. |
| **Índices** (`/personajes`, etc.) | **ISR**, `revalidate` largo (p.ej. 1h) **+ on-demand** | Listas que solo cambian al publicar/ocultar una entidad de esa sección. Se regeneran al instante vía tag al publicar; el tiempo largo es solo red de seguridad. |
| **Fichas** (`/personajes/[id]`) | **ISR con `generateStaticParams`** (solo entidades publicadas) + on-demand | Pre-renderizamos en build las publicadas; las nuevas se generan bajo demanda al primer acceso y se cachean. Revalidación puntual por tag al editar esa ficha. |
| **Páginas de lore** (`/lore/[slug]`) | **ISR** igual que fichas | Idem; slug en vez de id. |
| **Timeline / Mapa** | **SSG del shell** + datos vía ISR; **viz client-side** | El HTML/SEO es estático; D3/Leaflet hidratan en cliente con datos ya embebidos o fetch cacheado. |
| **Búsqueda (⌘K)** | **Dinámica** (Server Action / route handler) | Depende del input del usuario; no se cachea el resultado, pero el índice FTS sí (§8). |
| **Admin `/admin/*`** | **SSR dinámico, sin caché** (`dynamic = 'force-dynamic'`) | Datos en tiempo real, incluye borradores, depende de sesión. Nunca cachear. |
| **Preview** (§13) | **SSR dinámico, no-store** | Debe reflejar el estado exacto sin publicar. |

**Por qué ISR y no SSR puro para lo público:** SSR ejecutaría una query a Supabase **por cada visita**. Con 1–5 lectores el número es bajo, pero ISR reduce las lecturas a *una por revalidación* (no por visita) y sirve HTML estático desde la CDN de Vercel → **menos bandwidth, menos lecturas Supabase, mejor TTFB móvil**. Es estrictamente superior aquí. SSG puro (sin ISR) sería viable pero obligaría a un redeploy por cada edición de contenido; la revalidación on-demand evita rebuilds completos.

### 4.1 Estrategia de caché explícita

**Modelo de tags por entidad + por colección.** Cada query pública etiqueta su resultado:

```
// en la query (pseudocódigo)
unstable_cache(fn, keyParts, {
  tags: [`personaje:${id}`, 'personajes:list', 'sitemap'],
  revalidate: 3600,
})
```

Convención de tags:
- `entidad:{tipo}:{id}` → una ficha concreta. Ej. `personaje:42`.
- `{tipo}:list` → el índice de esa sección. Ej. `personajes:list`.
- `sitemap` → para regenerar el sitemap (§11).
- `home` → composición de portada.

**Al publicar/editar desde un Server Action**, revalido los tags exactos afectados:

```
async function publicarPersonaje(id) {
  // ... mutación ...
  revalidateTag(`personaje:${id}`)   // la ficha
  revalidateTag('personajes:list')   // su índice
  revalidateTag('sitemap')           // entró/salió del sitemap
  revalidateTag('home')              // por si aparece en portada
  // si cambian relaciones, revalidar también las fichas relacionadas:
  for (const relId of idsRelacionados) revalidateTag(`personaje:${relId}`)
}
```

**`revalidatePath` vs `revalidateTag`:** uso **`revalidateTag` como mecanismo principal** porque una entidad aparece en múltiples rutas (su ficha, su índice, el home, fichas relacionadas, el sitemap) y los tags desacoplan "qué dato cambió" de "qué URLs lo muestran". `revalidatePath` se reserva para casos donde la ruta es 1:1 con el dato y es más directo (p.ej. revalidar `/mapa` tras editar polígonos). 

**Coste y límites:** la revalidación on-demand no consume build minutes de GitHub Actions (ocurre en runtime de Vercel) y mantiene el bandwidth bajo porque solo se regenera lo que cambió. Encaja en Hobby sin problema dado el volumen.

---

<a name="5-componentes"></a>
## 5. Sistema de componentes

### 5.1 Componentes base

- **`EntityCard`** — card de índice, **polimórfica por variante**. Props: `{ href, titulo, subtitulo, imagen (asset), badges[], variant }`. Una sola implementación con `variant` (`personaje | nacion | bestia | ...`) que ajusta acentos de color (§7) y badges. Imagen vía `MediaImage` (next/image + blurhash). Aspecto ratio fijo para **cero layout shift** en móvil.
- **`Badge`** — sistema de badges semántico: `BadgeRareza`, `BadgeRango`, `BadgeNivelAmenaza`, `BadgeEstado`. Cada uno mapea un valor del schema a color+icono. Construidos sobre el `badge` de shadcn con variantes Tailwind.
- **`StatTable`** — tabla de stats de personaje (de `estadisticas`). Render dual: en desktop tabla; en móvil **lista de barras** (más legible en pantalla estrecha). Usa fuente monoespaciada (§7) para números. Recharts opcional para un radar de los 6 atributos primarios (fuerza/destreza/…/carisma).
- **`AbilityList`** — sección de habilidades (de `habilidades`), agrupada por `categoria`, cada una expandible (accordion shadcn). Vincula `magia_fundamento_id` → link a `/magia/[id]`.
- **`MusicPlayerBar`** — reproductor (detallado en §9).
- **`MediaImage`** — wrapper de `next/image` con `blurhash` placeholder, `sizes` responsive y `loading="lazy"` por defecto (excepto el hero de ficha que es `priority`).

### 5.2 Fichas individuales por entidad

Cada ficha comparte un **esqueleto común** (`<FichaShell banner avatar titulo subtitulo>`) y diverge en el cuerpo:

**Ficha de Personaje** — la más rica, con **tabs** (shadcn `Tabs`, en móvil pasan a tabs deslizables/scroll horizontal o un selector — §16):
- **Historia** — prosa (`historia`, `motivacion`, `miedos`, `filosofia`, `gustos`/`disgustos`), `eventos_personaje` como mini-timeline vertical.
- **Stats** — `StatTable` + radar Recharts + datos de combate (`circuito_forte`, `essentia`, `zenithra`, `bendicion`, `nivel_de_consciencia`).
- **Habilidades** — `AbilityList` + tipo de magia principal/secundaria.
- **Relaciones** — lista agrupada de `relaciones` (PJ↔PJ) + pertenencias (`personaje_organizacion`, `personaje_nacion`, `personaje_raza`, familia). En fase 2, link al grafo React Flow (§10).
- Lateral/footer: canciones asociadas (`personaje_cancion`) con botón que alimenta el reproductor (§9); galería (`entidad_media`).

**Ficha de Nación** — sin tabs (menos densa): hero banner, bloque de datos clave (gobierno, capital, idioma, población, `elemento_fundamental`, `concepto_divino`, `dios_fundador`), prosa (`historia`, `estructura`), **mini-mapa Leaflet** centrado en la región (§10), personajes asociados (grid de `EntityCard` mini vía `personaje_nacion`), razas (`nacion_raza`), organizaciones (`nacion_organizacion`).

**Ficha de Bestia** — hero + `BadgeNivelAmenaza` prominente, datos (`habitat`, `ciclo_vida`, `comportamiento`, `recursos`), galería. Estética más "bestiario": tipografía display agresiva.

**Ficha de Familia** — hero + poder (económico/político/militar como barras), liderazgo, y el **árbol genealógico React Flow** (§10) como pieza central (de `familia_arbol`), más `familia_jerarquia` (tabla de títulos) y `familia_facciones`.

**Ficha de Organización / Gremio** — comparten layout (gremio = organización especializada): descripción, ideología/objetivo, **jerarquía** (de `org_jerarquia`/`gremio_jerarquia` + `org_rangos`/`gremio_rangos`, render como organigrama o lista ordenada por `peso`/`orden`), facciones (`*_facciones` con color), historial (`*_historial`), miembros destacados (cards de personajes). El gremio añade bloques propios (`sistema_misiones`, `jerarquia_rangos`, `principios`, `normas_contratos`).

### 5.3 Patrón de página índice (reutilizable)

Todas las secciones (`/personajes`, `/naciones`, …) comparten **`EntityIndexPage`**:

```
EntityIndexPage
 ├─ HeaderSección (título épico + contador + breadcrumb)
 ├─ FilterBar     (filtros por categoría propios del tipo: rareza, rango, nación...)
 │                 + input que abre/enfoca el ⌘K (§8)
 └─ EntityIndexGrid (grid responsive de EntityCard; 1 col móvil, 2-3 tablet, 4 desktop)
                     con StaggerGrid de Framer (§6) y skeletons (loading.tsx)
```

Los **filtros** se manejan vía **URL search params** (`?rareza=epico`) para ser shareables, server-rendered y compatibles con ISR (cada combinación se cachea). El filtrado fino se hace server-side en la query (`list*` acepta filtros). La búsqueda textual se delega al ⌘K global (§8), no se duplica un buscador por sección.

---

<a name="6-animaciones"></a>
## 6. Animaciones con Framer Motion

**Filosofía:** animación **estratégica, no decorativa**. Cada animación debe comunicar (jerarquía, entrada de contenido, transición espacial), nunca solo "moverse". En móvil, reducir o desactivar (Principio 2).

### 6.1 Dónde sí animar
- **Hero / Home:** entrada cinematográfica + fondo cósmico animado.
- **Fichas:** entrada del banner/avatar y stagger del contenido al montar.
- **Índices:** stagger de cards al aparecer (intersection observer, una vez).
- **Transiciones de página:** fundido suave entre rutas (Framer `AnimatePresence` o las View Transitions del App Router para lo barato).
- **Tabs y accordions:** micro-animaciones de layout (shadcn ya las trae).

### 6.2 Fondo cósmico del hero
**Decisión: partículas en `<canvas>` con `tsparticles` (preset de estrellas/nebulosa)**, **no** Framer para esto. Framer Motion no es adecuado para cientos de partículas (reflows DOM). `tsparticles` pinta en canvas (GPU-friendly), tiene preset de estrellas y es ligero. Alternativa aún más barata: un **CSS gradient animado + capa de estrellas SVG con `prefers-reduced-motion`**. 

**En móvil:** el campo de partículas se reduce a **~30% de densidad** o se sustituye por un gradiente estático con un par de capas de parallax CSS, según `useMediaQuery` + batería. La animación pesada es solo desktop.

### 6.3 Entradas distintas por tipo de entidad
Justificación: refuerza la identidad de cada dominio (el lector "siente" que entró a un personaje vs a una bestia). Se implementan como **variants de Framer reutilizables** en `/components/motion/EntityEntrance`:

| Entidad | Animación de entrada | Por qué |
|---|---|---|
| **Personaje** | Fade + slide-up suave del avatar, stagger de tabs | Presentación "heroica", centrada en la persona. |
| **Nación** | Reveal horizontal (wipe) del banner, como desplegar un mapa | Evoca territorio/extensión. |
| **Bestia** | Scale-in con leve "impacto" (spring rápido) + glitch sutil | Sensación de amenaza/aparición. |
| **Familia** | Fade encadenado por generación (el árbol se dibuja de arriba abajo) | Refleja la genealogía/herencia. |
| **Organización/Gremio** | Stagger jerárquico (de arriba del organigrama hacia abajo) | Refleja estructura de poder. |
| **Concepto/Lore/Magia** | Fade-in etéreo + leve blur→focus | Sensación de "conocimiento revelado". |

Todas comparten duración y easing base (tokens, §7) para coherencia; solo cambia el gesto.

### 6.4 Reglas de rendimiento (móvil)
- **`prefers-reduced-motion`**: respetar siempre; si está activo, todas las entradas se reducen a un fade mínimo o se anulan.
- **`useMediaQuery('(max-width: 768px)')`** → desactiva parallax, partículas pesadas y stagger largos; conserva micro-feedback.
- Animar **solo `transform` y `opacity`** (compositor GPU), nunca `width/height/top/left`.
- `whileInView` con `viewport={{ once: true }}` para no re-animar al hacer scroll.
- Las viz pesadas (D3/Leaflet/ReactFlow) **no** se envuelven en Framer; tienen sus propias transiciones internas.
- Cargar Framer solo donde se use; los componentes de motion son client components aislados para no inflar el bundle de las páginas server.

---

<a name="7-design-system"></a>
## 7. Identidad visual y design system

Referencia: **Genshin Impact (fantasy isekai, colores vivos, dorados) + cosmos/nebulosa (azules profundos, violetas, estrellas)**. Dark mode único (sin light mode).

### 7.1 Paleta de colores

**Fondos (de más profundo a más cercano) — base cósmica:**
| Token | Hex | Rol |
|---|---|---|
| `bg-void` | `#0A0A14` | Fondo base (el "vacío" espacial), body |
| `bg-deep` | `#12121F` | Superficies de sección |
| `bg-surface` | `#1A1A2E` | Cards, paneles |
| `bg-elevated` | `#252540` | Modales, popovers, hover de cards |
| `bg-overlay` | `rgba(10,10,20,.7)` | Backdrop de modal/⌘K |

**Marca:**
| Token | Hex | Rol |
|---|---|---|
| `primary` | `#7B5CFF` (violeta nebulosa) | Color primario, CTAs, links activos |
| `primary-glow` | `#9D7BFF` | Hover/estado luminoso del primario |
| `secondary` | `#2DD4BF` (cian estelar) | Secundario, acentos fríos, datos |
| `accent` | `#FFD66B` (dorado isekai) | Acento épico, destacados, rareza alta, títulos |
| `accent-warm` | `#FF8C5A` | Acento cálido secundario (energía/fuego) |

**Texto:**
| Token | Hex | Rol |
|---|---|---|
| `text-primary` | `#F5F3FF` | Texto principal (casi blanco con tinte violeta) |
| `text-secondary` | `#B8B5D1` | Texto secundario, descripciones |
| `text-muted` | `#7A7895` | Metadatos, placeholders, deshabilitado |
| `border` | `#2E2E4A` | Bordes sutiles |
| `border-glow` | `#5B4B9E` | Bordes acentuados (focus, card activa) |

**Semánticos:**
| Token | Hex | Rol |
|---|---|---|
| `success` | `#4ADE80` | Éxito, estado "publicado" en admin |
| `error` | `#F87171` | Error, peligro, nivel amenaza alto |
| `warning` | `#FBBF24` | Alerta, "borrador", spoiler |
| `info` | `#60A5FA` | Información |

**Escalas de rareza/rango** (para badges, §5): se mapea con una rampa fija (común→gris, raro→azul, épico→violeta `primary`, legendario→dorado `accent`, mítico→gradiente animado dorado-violeta). Esta rampa es un token aparte (`rarity-*`).

### 7.2 Tipografía (3 fuentes de Google Fonts)

| Rol | Fuente | Uso |
|---|---|---|
| **Display** | **Cinzel** (serif romana epigráfica, muy "fantasy épico") | Títulos de entidad, nombres, hero. Alternativa: *Marcellus*. |
| **UI / Body** | **Inter** | Navegación, labels, botones, prosa, todo el body. Legibilidad móvil impecable. |
| **Mono** | **JetBrains Mono** | Stats, números, valores de juego (`essentia`, `zenithra`), códigos. |

Cargadas con **`next/font/google`** (self-hosted automático, sin request a Google, sin layout shift, con `subset` latino y `display: swap`). Tres familias es el límite razonable de peso para móvil; se cargan solo los pesos usados (Cinzel 600/700, Inter 400/500/600, JetBrains 400/500).

### 7.3 Tokens de Tailwind y variables CSS

**Decisión sobre CSS vars vs tokens Tailwind:**
- **Variables CSS en `:root`** para los **valores semánticos de color** (`--primary`, `--bg-surface`, …). Razón: permiten theming en runtime si algún día hace falta (p.ej. un acento por sección/nación) y las consume shadcn/ui de forma nativa (shadcn ya trabaja con CSS vars HSL).
- **Tokens de Tailwind** (`tailwind.config.ts` → `theme.extend`) que **referencian** esas CSS vars (`colors.primary = 'hsl(var(--primary))'`). Así se escribe `bg-primary text-accent` con autocompletado y purga, pero el valor real vive en una variable. Lo mejor de ambos.

`tailwind.config.ts` extiende además:
- `fontFamily` → `display`, `sans` (Inter), `mono` (vía las CSS vars que inyecta `next/font`).
- `boxShadow` → glows cósmicos (`glow-primary`, `glow-accent`) usando `box-shadow` con color de marca y blur amplio.
- `backgroundImage` → gradientes nebulosa reutilizables (`nebula`, `aurora`).
- `keyframes`/`animation` → `shimmer` (skeletons), `pulse-glow`, `float` (estrellas).
- `borderRadius`, `spacing` → escala consistente; radios generosos (cards 16px) para suavidad.

Convención: **nunca hex sueltos en JSX**; todo color sale de un token. Esto mantiene coherencia y permite ajustar la paleta en un sitio.

---

<a name="8-navegación-y-búsqueda"></a>
## 8. Navegación y búsqueda

### 8.1 Navegación

**Patrón decidido — adaptativo desktop/móvil:**

- **Desktop:** `TopNav` fija (logo Astralys + secciones principales agrupadas en menús + trigger ⌘K + acceso discreto al admin). Las 13 secciones no caben en una barra; se agrupan en **3-4 menús temáticos** (mega-menu shadcn `NavigationMenu`): *Personajes*, *Mundo* (naciones, razas, organizaciones, familias, bestias, minerales), *Lore* (conceptos, magia, lore, misiones), *Explorar* (timeline, mapa).
- **Móvil (prioritario):** **Bottom Navigation Bar** fija con 4-5 destinos clave (Home, Buscar ⌘K, Personajes, Mundo, Mapa) + un **Drawer/Sheet** (hamburguesa) para el resto de secciones. Razón: el bottom bar es el patrón nativo móvil (alcance del pulgar), y la búsqueda merece un slot fijo porque es la forma principal de navegar una wiki. El reproductor de música (§9) se ancla **justo encima** del bottom bar cuando hay algo sonando.

Justificación del estilo: la navegación es minimalista y oscura para no competir con el contenido épico; los acentos dorados/violeta marcan el estado activo. Breadcrumbs en fichas para orientación dentro de jerarquías (familia → miembro).

### 8.2 Búsqueda global — Command Palette (⌘K)

**Presentación:** modal tipo command palette (shadcn `Command` + `Dialog`), estilo Notion/Linear. Se abre con **⌘K / Ctrl+K** (desktop) y desde el slot fijo de búsqueda (móvil). Es el corazón de la navegación de la wiki.

**Backend — Postgres Full-Text Search nativo de Supabase.**

**Decisión clave: tabla de índice de búsqueda centralizada (materializada), no queries separadas por tabla.**

Razones:
- Buscar "Kael" debe mirar personajes, naciones, organizaciones, lore… simultáneamente. Hacer N queries (una por tabla) y mezclar/ordenar en app es lento, difícil de rankear de forma homogénea y multiplica lecturas Supabase.
- Una tabla `search_index` unificada permite **un solo `tsvector` con ranking global** (`ts_rank`), un solo índice GIN, y una query única.

Diseño:
```
search_index
  id            pk
  entidad_tipo  varchar   -- 'personaje' | 'nacion' | 'lore' | ...
  entidad_id    integer   -- (o slug para lore)
  titulo        varchar
  subtitulo     varchar   nullable
  resumen       varchar   nullable  -- snippet para el resultado
  imagen_url    varchar   nullable  -- thumbnail del resultado
  url           varchar             -- destino directo (/personajes/42)
  documento     tsvector            -- titulo+subtitulo+cuerpo, weighted (A/B/C)
  estado_publicacion enum           -- para filtrar solo 'publicado' en búsqueda pública
  -- índice GIN sobre documento
```

**Mantenimiento del índice:** se rellena/actualiza desde los **Server Actions** de publicar/editar (la misma action que muta la entidad hace un `upsert` en `search_index`). Alternativa con triggers de Postgres (más robusta, sincroniza aunque se edite por fuera). **Decisión: triggers de Postgres** que mantienen `search_index` y el `tsvector` automáticamente en INSERT/UPDATE/DELETE de cada tabla relevante. Razón: garantiza consistencia sin depender de que toda escritura pase por la app, y el `tsvector` se computa en la DB (idioma `spanish` para stemming correcto en español). El Server Action solo dispara `revalidateTag`.

**Ranking y pesos:** `setweight` A=título, B=subtítulo, C=cuerpo. Ranking con `ts_rank_cd`. Filtros por categoría (`entidad_tipo`) como chips en el palette (todo / personajes / mundo / lore).

**Frontend (cliente):**
- **Debounce 200–250ms** (`useDebounce` hook) antes de disparar la búsqueda.
- La consulta va a un **Server Action** `buscar(query, tipos[])` que ejecuta el FTS y devuelve top-N (p.ej. 8 por categoría). No se cachea por query (input variable), pero el índice sí está optimizado.
- **Estado del modal** en cliente (`useState` local del `CommandPalette`, no necesita store global): abierto/cerrado, query, resultados, índice seleccionado (navegación con flechas).
- **Navegación desde resultados:** `Enter` o click → `router.push(result.url)` y cierra el modal. Atajos de teclado (↑↓ navegar, Enter abrir, Esc cerrar). En móvil, lista táctil grande.
- **Estados vacíos/iniciales:** al abrir sin query, mostrar "destinos rápidos" (secciones, último visto) y entidades destacadas, estilo Linear.

---

<a name="9-reproductor-de-música"></a>
## 9. Reproductor de música

Canciones vinculadas a personajes/capítulos/actos/hojas vía tablas puente. Dos fuentes: **propia** (archivo en R2 → Howler.js) y **externa** (embed YouTube/Spotify/SoundCloud).

### 9.1 ¿Persiste entre navegaciones? → **Sí, reproductor global persistente.**

Justificación: es una wiki narrativa donde la música ambienta la lectura; cortar la canción al navegar de la ficha de un personaje a su nación rompería la experiencia. Persistencia = el `MusicPlayerBar` vive en el **layout público raíz** (`(public)/layout.tsx`) y **no se desmonta** al cambiar de ruta (App Router preserva el layout entre navegaciones de páginas hijas). Por eso (§3.5) las fichas **no** introducen layouts intermedios que remonten el árbol.

### 9.2 Estado global → **Zustand.**

Evaluación: Context re-renderiza todo el árbol consumidor en cada tick de progreso (mala idea para una barra que actualiza segundos); URL state no sirve para estado efímero de reproducción; Redux es overkill. **Zustand** es ligero, vive fuera de React (no fuerza re-render del árbol salvo en los selectores suscritos), perfecto para `{ track actual, queue, isPlaying, progress, volume, source }`. El instance de Howler se guarda en un ref del store (fuera del estado reactivo).

```
usePlayerStore:
  estado: trackActual, cola[], isPlaying, progreso, volumen, fuente('propia'|'externa')
  acciones: play(track), pause, toggle, next, prev, seek, setVolumen, cargarCola(tracks)
  ref interno: instancia Howl (solo fuente propia)
```

### 9.3 Distinguir y renderizar propia vs externa

`canciones.tipo_fuente` discrimina. El `MusicPlayerBar` renderiza condicionalmente:
- **`propia`** → controla un `Howl` (Howler.js): play/pause/seek/volumen reales, barra de progreso propia, gapless. La URL apunta al asset de audio en R2 (`media_assets` tipo `audio`).
- **`externa`** → renderiza el **embed oficial** (iframe de YouTube/Spotify/SoundCloud) en el panel expandido del reproductor. No controlamos seek/progreso finos (limitación de los iframes), así que la barra muestra el embed con sus propios controles. El "mini-bar" solo muestra título/artista + botón abrir/expandir. 

Para no mezclar paradigmas: una canción externa **pausa** cualquier Howl propio en curso y viceversa (un solo audio a la vez, gestionado por el store).

### 9.4 Acceso desde una ficha
Cada bloque "Canciones" de una ficha (personaje/capítulo/acto) lista las canciones asociadas (`*_cancion` con su `contexto`). Click en una canción → `usePlayerStore.cargarCola([...canciones de esta ficha])` y `play(seleccionada)`. Así el lector puede reproducir toda la "banda sonora" de un personaje en cola.

### 9.5 Rendimiento móvil
- El `<audio>`/Howl usa **`preload="none"`**; solo carga al darle play (no descargar audio al abrir cada ficha → ahorra datos y batería).
- Los **iframes externos se montan lazy** (solo al expandir el reproductor), nunca en el render inicial de la ficha — los embeds de YouTube/Spotify son pesadísimos; montarlos siempre destrozaría el rendimiento móvil.
- La barra mini es ligera (sin iframe); el panel expandido (con embed) se monta on-demand vía Sheet.
- Respetar políticas de autoplay móvil (requiere gesto del usuario; no auto-reproducir al navegar).

---

<a name="10-visualizaciones"></a>
## 10. Visualizaciones interactivas

Regla común: todas son **client components con `dynamic(() => import(...), { ssr: false })`** porque Leaflet/D3/ReactFlow tocan `window`/DOM y no deben ejecutarse en SSR. El shell de la página es server (SEO), la viz hidrata en cliente.

### 10.1 Mapa del mundo — Leaflet.js

- **Integración Next 15:** `dynamic import` con `ssr: false`, envuelto en un componente cliente. CSS de Leaflet importado en ese componente. Imagen custom del mundo servida con **`L.CRS.Simple`** (coordenadas de píxel, no geográficas) sobre `L.imageOverlay` — es un mapa de fantasía, no la Tierra.
- **Regiones clickeables:** se definen como **polígonos GeoJSON** (en coordenadas del CRS Simple) almacenados asociados a cada nación. **Decisión de datos:** añadir a `naciones` un campo `mapa_poligono jsonb (nullable)` con el polígono (o un array de puntos) y `mapa_centro jsonb`. Al clickear un polígono → `router.push('/naciones/${id})`. Los polígonos los dibuja el admin una vez (en fase 1 pueden hardcodearse/cargarse desde un JSON semilla y migrar a la columna después).
- **Dónde vive:** componente `WorldMap` reutilizable, usado en **`/mapa`** (full screen, principal), embebido pequeño en el **Home** (teaser) y como **mini-mapa** centrado en la región en cada **ficha de nación**. Un solo componente, distintas props (`zoom`, `interactive`, `focusNacionId`).
- **Móvil:** controles táctiles de Leaflet (pinch-zoom), límites de zoom para no perderse, y degradación: en pantallas muy pequeñas el mapa del home se reduce a una imagen estática enlazada a `/mapa` (cargar Leaflet completo en el home móvil no compensa).

### 10.2 Timeline — D3

- **Estructura en React/Next:** componente cliente `Timeline` que usa **D3 solo para cálculo de escalas/layout** (`d3-scale`, `d3-time`) y **React para renderizar el SVG** (patrón "D3 calcula, React pinta"). Evita que D3 y React peleen por el DOM. Para zoom/pan se usa `d3-zoom` sobre el `<g>` raíz.
- **Datos:** `timeline_eventos` (`fecha_lore`, `importancia`, `categoria`, `capitulo_id`). El eje es la línea temporal del lore; el tamaño/color del nodo = `importancia`/`categoria`. Click en evento → tooltip + link al capítulo (`/...`) o entidad relacionada.
- **Filtros:** por `categoria`, por época (rango del eje), y por personaje (vía join `capitulo_personaje` → eventos de capítulos donde aparece). Filtros como chips; el filtrado se hace en cliente sobre el dataset ya cargado (es pequeño) o server-side si crece.
- **Móvil:** la timeline horizontal degrada a **lista vertical cronológica** (scroll natural) por debajo de cierto breakpoint — una timeline horizontal con zoom es hostil en móvil. El SVG interactivo queda para desktop/tablet.

### 10.3 Árbol genealógico — React Flow

- **Datos:** `familia_arbol` (`padre_id`, `madre_id`, `generacion`, `personaje_id`, `estado`, `destacado`). Transformación DB → React Flow:
  - **Nodos:** cada fila de `familia_arbol` = un nodo; posición Y por `generacion`, X por orden dentro de la generación (auto-layout con **Dagre** o **elkjs** para árboles, calculado una vez). El nodo enlaza a `/personajes/[id]` si `personaje_id` no es nulo. `destacado` resalta visualmente.
  - **Edges:** una arista `padre_id → hijo` y `madre_id → hijo` por cada relación parental. Para parejas, edge de unión entre ambos padres.
- **Dónde vive:** dentro de la **ficha de familia**, como bloque central (lazy `dynamic`). En móvil: React Flow con pan/zoom táctil + un botón "ver en pantalla completa" (Sheet a fullscreen), porque un árbol no cabe en una columna estrecha.

### 10.4 Grafo de relaciones — React Flow (Fase 2)

Solo arquitectura de datos: se alimenta de `relaciones` (PJ↔PJ, ya saneada en §1) + pertenencias (`personaje_organizacion`, `personaje_nacion`, familia). Nodos = personajes/entidades; edges tipados por `tipo_relacion` con color. Mismo patrón de transform (query → `{nodes, edges}`) y auto-layout force-directed. **No se profundiza** (fase 2). Reutilizará el componente base de React Flow del árbol genealógico.

---

<a name="11-seo"></a>
## 11. SEO y metadata

### 11.1 Metadata base vs dinámica (App Router)
- **Metadata base** en el root `layout.tsx` vía `export const metadata` (título plantilla `%s · Astralys`, descripción del sitio, `themeColor` cósmico, iconos, OG por defecto).
- **Metadata dinámica por ficha** vía `export async function generateMetadata({ params })`: lee la entidad (query cacheada, reusa la misma de la página → sin doble fetch gracias a la dedupe de React), construye título (`{nombre} · {tipo}`), descripción (`subtitulo`/resumen), y OG.

### 11.2 og:image dinámico
**Decisión: usar la imagen real de la entidad (`imagen_asset_id` / `banner_asset_id` desde `media_assets`) como `og:image`** cuando existe — es la opción de **coste cero** (la imagen ya está en R2, solo se referencia su URL). 

Para entidades **sin imagen propia**, generar una **og:image dinámica con `next/og` (Vercel OG / `ImageResponse`)** vía la convención de archivo **`opengraph-image.tsx`** dentro de cada `[id]`: compone una tarjeta temática (fondo nebulosa + nombre en Cinzel + badge de tipo). Esto se renderiza on-demand y se cachea (ISR), así que no consume recursos por visita. 

**Por qué no generar siempre con Vercel OG:** generar una imagen por render gasta CPU/función; si ya tenemos una ilustración HD del personaje, usarla directamente es más bonito y gratis. Híbrido: imagen real si existe, generada si no.

### 11.3 sitemap.xml dinámico
**`app/sitemap.ts`** genera el sitemap consultando **todas las entidades con `estado_publicacion = 'publicado'`** (una query ligera por dominio que devuelve `{id, updatedAt}`). Incluye índices + todas las fichas + páginas de lore (por slug). Se revalida vía el tag `sitemap` cuando el admin publica/oculta algo (§4). `lastModified` desde `updated_en` para señalar frescura.

### 11.4 robots.txt
**`app/robots.ts`**: permite indexar todo lo público, **bloquea `/admin` y `/api`** y `/*/preview`. Apunta al sitemap. (Aun siendo wiki personal, dejarla indexable está bien; si el autor prefiere privacidad, basta cambiar a `disallow: /` — decisión del autor, el default es indexable.)

### 11.5 Datos estructurados (opcional, bajo coste)
JSON-LD `Article`/`CreativeWork` por ficha para enriquecer resultados. Nice-to-have fase 2.

---

<a name="12-auth"></a>
## 12. Autenticación y protección del admin

Un solo admin, email/password, **sin RLS** (proyecto personal, un escritor de confianza — Principio 3).

### 12.1 Capas de protección (defensa en profundidad)
1. **Middleware de Next.js** (`middleware.ts`) con matcher `'/admin/:path*'` (excepto `/admin/login`): lee la sesión de Supabase desde las cookies usando el helper SSR de `@supabase/ssr`, refresca el token si hace falta, y **redirige a `/admin/login`** si no hay sesión válida. Es la puerta principal.
2. **`assertAdmin()` en cada Server Action y en cada page de admin** (§2.4): segunda verificación a nivel de servidor antes de cualquier mutación o lectura sensible. Razón: el middleware protege la navegación, pero los Server Actions son endpoints invocables; nunca confiar solo en el middleware para mutaciones.
3. Como solo hay un usuario, `assertAdmin` puede además comprobar que el `user.id`/email coincide con el admin esperado (variable de entorno `ADMIN_EMAIL`), cerrando incluso el caso improbable de otro registro en Supabase Auth.

### 12.2 Sesión en Server Components / Server Actions
Usar **`@supabase/ssr`** con un cliente de servidor creado por request que lee/escribe cookies (patrón oficial Next 15):
- En **Server Components / pages**: `createServerClient()` con acceso de solo lectura a cookies para `getUser()`.
- En **Server Actions / Route Handlers**: cliente con capacidad de **escribir cookies** (set/remove) para refrescar la sesión.
- El **middleware** es quien refresca proactivamente el token en cada navegación protegida y reescribe las cookies, manteniendo la sesión viva.

`getUser()` (que valida contra el servidor de Auth) en vez de confiar en `getSession()` del cliente para las comprobaciones de seguridad server-side.

### 12.3 Login
`/admin/login` (fuera del guard) con form → Server Action `signInWithPassword`. Sin signup, sin recuperación pública compleja (un solo usuario; si pierde la contraseña, se resetea desde el dashboard de Supabase). Sin OAuth, sin magic links (el prompt fija email/password).

---

<a name="13-visibilidad-y-previews"></a>
## 13. Sistema de visibilidad y previews del admin

Complementa la decisión de §1 (`estado_publicacion` enum: borrador / publicado / oculto).

### 13.1 Visibilidad a dos niveles

**Nivel entidad:** ya resuelto con `estado_publicacion`. Las queries públicas filtran `= 'publicado'` (helper centralizado §2.3).

**Nivel campo (granular).** El admin quiere ocultar campos concretos de una entidad publicada (p.ej. mostrar el personaje pero ocultar `secretos`/`segundo_despertar` por spoiler). Dos enfoques evaluados:

- **(A) Columna `*_visible` por campo:** rígido, explota el ancho de tabla, no escala.
- **(B) Tabla `campo_visibilidad`** `(entidad_tipo, entidad_id, campo, visible)`: una fila solo por cada campo **ocultado** (default = visible si no hay fila). Flexible, no toca el schema de cada entidad, escala a cualquier campo.

**Decisión: (B) tabla `campo_visibilidad`** con semántica "ausente = visible". Las queries públicas de ficha traen, junto a la entidad, su set de campos ocultos y el componente de ficha omite esos campos. Para `paginas_lore` esto ya es nativo: cada `pagina_secciones` tiene su propio `visible` (§1, Problema 2), que es el caso más común de ocultar-por-sección. `campo_visibilidad` cubre el resto de entidades con campos fijos.

Ventaja sobre tocar el schema: "no rompe el schema" (requisito del prompt) porque la información de visibilidad vive en una tabla lateral, no en columnas nuevas por entidad.

### 13.2 Modo preview

**Objetivo:** el admin ve la ficha *exactamente como la verá el lector*, **incluyendo o no** los borradores/campos ocultos, antes de publicar.

**Decisión: ruta de preview dedicada + draft mode de Next.js.**
- Next.js 15 tiene **`draftMode()`** (cookie firmada). El admin activa draft mode desde el dashboard; mientras está activo, las queries usan la variante `incluirNoPublicado()` y muestran contenido sin filtrar por visibilidad. Es el mecanismo nativo, server-side, sin query params manipulables.
- **Ruta `/admin/preview/[tipo]/[id]`** que renderiza el **mismo componente de ficha público** pero alimentado por la query de admin (todos los campos, cualquier estado), envuelto en un banner "MODO PREVIEW — así lo verán los lectores" con un toggle "ver como lector" (que reactiva los filtros de visibilidad para simular la vista pública real). Esto cubre los dos casos: *previsualizar un borrador* y *verificar qué se oculta tras publicar*.

**Por qué draft mode y no query param (`?preview=1`):** un query param es manipulable por cualquiera (un lector podría ver borradores). `draftMode()` usa una cookie firmada que solo el admin autenticado puede activar → seguro. El query param se descarta por inseguro.

Las páginas de preview son **`force-dynamic`, no cacheadas** (§4) para reflejar el estado exacto en cada carga.

---

<a name="14-discord"></a>
## 14. Notificaciones Discord

Disparar webhook cuando: (a) se **publica una entidad nueva** (primera vez → `publicado_primera_vez_en` pasa de NULL a fecha, §1) y (b) se **actualiza una ya publicada**. Embed enriquecido (imagen, descripción, link).

### 14.1 ¿Desde el Server Action o desde GitHub Actions?

**Decisión: directo desde el Server Action de publicar/actualizar.** 

Justificación frente a GitHub Actions:
- **Latencia:** el Server Action ya tiene en mano los datos de la entidad recién escrita; postear a Discord es un `fetch` de ~100ms. Pasar por GitHub Actions implicaría un trigger (commit/dispatch), arranque de runner (decenas de segundos) y consumo de los **2000 min/mes** de Actions para algo trivial. Sin sentido.
- **Confiabilidad:** menos piezas = menos puntos de fallo. El webhook depende solo de Discord estando arriba; no de la cola de Actions.
- **Coste:** GitHub Actions tiene minutos limitados; los webhooks de Discord no cuestan nada. Gastar build minutes en notificaciones es desperdiciar el recurso más escaso para CI real.

GitHub Actions se reserva para lo suyo: **CI/CD** (lint, typecheck, build en PR), no para efectos de runtime.

### 14.2 Implementación
- Helper `notificarDiscord(tipo, entidad)` en `/lib/discord.ts` (server-only). Construye el **embed**: `title` = nombre, `description` = subtítulo/resumen recortado, `url` = link absoluto a la ficha, `image`/`thumbnail` = `imagen_url` de R2, `color` = color de marca según tipo de entidad, `footer` = "Astralys · {sección}", `timestamp`.
- Lógica de tipo de evento: si `publicado_primera_vez_en` era NULL → embed "✨ Nueva entrada en Astralys"; si ya existía → "📝 Actualizado".
- **No bloquear la respuesta del action:** ejecutar el `fetch` a Discord de forma que un fallo no rompa la publicación (try/catch que loguea a Sentry pero no aborta la mutación). La publicación es la operación crítica; la notificación es best-effort.
- **Idempotencia/anti-spam:** evitar disparar en cada `save` de borrador (solo en transición a `publicado` y en ediciones de ya-publicados). Un guard simple sobre el cambio de estado lo garantiza. Opcional: debounce de ediciones múltiples seguidas.
- Webhook URL en variable de entorno (`DISCORD_WEBHOOK_URL`), nunca en cliente.

---

<a name="15-pwa"></a>
## 15. PWA

Nivel objetivo: **instalable + notificaciones push**.

### 15.1 Configuración `next-pwa`
- `next-pwa` envolviendo `next.config`, con SW solo en producción (deshabilitado en dev para no entorpecer). Genera el service worker con Workbox.
- **`app/manifest.ts`** (Metadata Route nativa de Next 15) con: nombre "Astralys", `display: standalone`, `theme_color`/`background_color` = `#0A0A14` (bg-void), iconos (192/512 + maskable), `orientation: portrait` (móvil-first), categorías.

### 15.2 Qué cachear (estrategias Workbox)
- **App shell** (layout, navegación, fuentes, CSS, JS de chunks comunes) → **precache** en install. Permite abrir la app offline al instante.
- **Páginas de ficha/índice visitadas** → **StaleWhileRevalidate** (sirve la versión cacheada al instante, revalida en background). Da experiencia offline de "lo que ya visité".
- **Imágenes (R2)** → **CacheFirst** con expiración (p.ej. 60 días, máx N entradas) — las imágenes son inmutables una vez subidas; cachearlas agresivamente ahorra datos móviles y bandwidth.
- **Audio propio** → **no** precache (pesado); CacheFirst opcional bajo demanda.
- **Llamadas a Server Actions / datos dinámicos** → NetworkFirst con fallback, para que el contenido fresco gane pero haya degradación offline.
- **Fallback offline:** una `offline.tsx` temática ("Las estrellas se han nublado… sin conexión").

### 15.3 Notificaciones push
- **Destinatarios: los lectores** (1–5). Son quienes quieren enterarse de nuevo lore. El admin ya recibe todo por Discord (§14) y es quien publica, así que no necesita push.
- **Suscripción:** los lectores no tienen cuenta, así que la suscripción push se basa en el **`PushSubscription` del navegador** (Web Push API). Al instalar la PWA / aceptar permisos, el navegador genera una suscripción que se guarda en una tabla ligera `push_subscriptions (endpoint, keys, creado_en)` en Supabase. Sin login: la suscripción es anónima y por dispositivo.
- **Envío:** cuando el admin publica una entidad nueva, el **mismo Server Action** (§14) que notifica Discord recorre `push_subscriptions` y envía Web Push (protocolo VAPID, con la librería `web-push`, server-only). Claves VAPID en env.
- **Eventos que disparan push:** **solo publicación de entidad nueva** (no cada edición menor — evitar fatiga de notificaciones a los amigos). Quizá un "resumen" para actualizaciones grandes, pero por defecto: nueva entrada = push.
- **Coste:** Web Push es gratuito (no usa servicio de pago); el envío a 1–5 endpoints es trivial y no afecta límites. El SW maneja el evento `push` → muestra notificación con título, cuerpo y deep-link a la ficha.

> Nota de viabilidad: Web Push en iOS requiere que la PWA esté **instalada en la pantalla de inicio** (Safari/iOS ≥16.4). Dado que la audiencia es móvil y amigos cercanos, instruir "añadir a pantalla de inicio" es aceptable. En Android/desktop funciona directo.

---

<a name="16-móvil"></a>
## 16. Experiencia móvil específica

La audiencia principal es móvil; estas decisiones son de primera clase, no adaptaciones tardías.

- **Navegación:** **Bottom Navigation Bar** (pulgar) + Drawer para secciones secundarias (§8). El ⌘K tiene slot fijo. Reproductor anclado sobre el bottom bar.
- **Fichas con tabs (personaje):** en móvil las 4 tabs (Historia/Stats/Habilidades/Relaciones) se vuelven **tabs deslizables con scroll horizontal** o un **segmented control** fijo bajo el hero; el contenido de cada tab hace scroll vertical natural. Alternativa para densidad: convertir las tabs en **secciones acordeón** apiladas (una sola columna, cada sección colapsable) — **decisión: segmented control fijo + swipe entre tabs**, porque preserva la metáfora de "pestañas" y evita scroll infinito. El hero (banner+avatar) se compacta al hacer scroll (sticky mini-header con el nombre).
- **Reproductor persistente:** mini-bar fija (título + play/pause + progreso) anclada encima del bottom nav; tap → expande a Sheet con controles completos / embed. `preload="none"`, iframes externos lazy (§9). No tapa el contenido (padding-bottom reservado).
- **Timeline:** degrada de SVG horizontal con zoom → **lista vertical cronológica** scrolleable (§10.2). Cada evento como card.
- **Mapa:** Leaflet táctil con pinch-zoom en `/mapa`; en home, **imagen estática enlazada** en vez de cargar Leaflet (§10.1). Mini-mapa de nación: interacción limitada, botón "ver completo".
- **Árbol genealógico / React Flow:** pan/zoom táctil + botón fullscreen (Sheet) porque no cabe en columna estrecha (§10.3).
- **Rendimiento:**
  - **Framer reducido** en móvil: sin parallax, partículas al 30% o gradiente estático, stagger corto, respetar `prefers-reduced-motion` (§6.4).
  - **Lazy loading agresivo:** `next/image` lazy por defecto + blurhash LQIP; viz pesadas con `dynamic`/`ssr:false` y solo al entrar en viewport; iframes solo on-demand.
  - **ISR + CDN** (§4) → HTML estático ligero, TTFB bajo en redes móviles.
  - Bundle: client components mínimos (la mayoría son server), code-splitting por viz, fuentes self-hosted subsetadas (§7).
  - Imágenes desde R2 (egress gratis) con `sizes` responsive → no se descarga el HD en móvil.

---

<a name="17-errores"></a>
## 17. Páginas de error personalizadas

Estilo fantasy/cósmico coherente con el design system.

- **`app/not-found.tsx` (404 global):** visual cósmico (estrella apagada / portal cerrado), mensaje temático: *"Esta página se ha perdido en el vacío de Astralys."* + botón "Volver al cosmos" (home) + acceso al ⌘K para buscar. Tipografía Cinzel en el código de error.
- **`not-found` por sección** (en `[id]/not-found.tsx`): mensaje específico — personaje: *"Este personaje se ha desvanecido entre las estrellas"*; nación: *"Este territorio aún no ha sido cartografiado"*. Se dispara con `notFound()` desde la page cuando la query devuelve null o la entidad no está `publicado`.
- **`app/error.tsx` (500 / error boundary raíz):** Client Component con `reset()`. Visual de "ruptura cósmica" (nebulosa fracturada), mensaje: *"Una distorsión ha sacudido el cosmos."* + botón "Reintentar" (`reset()`) + "Volver al inicio". **Reporta a Sentry** (`captureException`) en el `useEffect`. No expone el stack al lector.
- **`error.tsx` en `(public)`** para errores de carga de datos de sección sin tumbar todo el layout (el shell —nav, reproductor— sobrevive porque el boundary está por debajo del layout).
- **`global-error.tsx`** para fallos del propio root layout (caso extremo), con HTML mínimo autocontenido.
- Todos los estados de error y vacío comparten ilustraciones del set cósmico para coherencia de marca, y son **ligeros** (SVG/CSS, no imágenes pesadas) para cargar incluso en fallo.

---

<a name="18-tooling"></a>
## 18. Herramientas de desarrollo

Proyecto en solitario: el objetivo es **calidad sin fricción burocrática**.

- **TypeScript `strict: true` → SÍ.** No negociable. En un proyecto data-heavy con ~50 tablas, el strict mode (con `strictNullChecks`) atrapa la inmensa mayoría de bugs de `nullable` (que abundan en este schema) en tiempo de compilación. El coste marginal para un solo dev es bajo y Drizzle ya provee tipos estrictos que se aprovechan mejor en strict. Añadir `noUncheckedIndexedAccess` para acceso seguro a arrays.
- **ESLint: el config de Next.js (`next/core-web-vitals`) + extras moderados, no "ultra-estricto".** Añadir: `@typescript-eslint` (reglas recomendadas), `eslint-plugin-tailwindcss` (orden de clases, evita clases inválidas), y reglas de a11y (`jsx-a11y`, ya en core-web-vitals). **No** añadir configs draconianos (airbnb completo) que generan ruido en solitario. Regla pragmática: errores que importan (no-unused, exhaustive-deps, no-floating-promises), warnings para estilo.
- **Prettier: SÍ**, config mínima + **`prettier-plugin-tailwindcss`** (ordena clases automáticamente, complementa el plugin de lint). Integrado con ESLint vía `eslint-config-prettier` (Prettier manda en formato, ESLint en calidad). Formateo on-save.
- **Husky + lint-staged (ligero):** un pre-commit que corre `prettier` + `eslint --fix` + `tsc --noEmit` solo sobre staged. Opcional pero barato y evita romper el build de Vercel. Para solitario, puede bastar con el check en GitHub Actions.
- **GitHub Actions (CI):** un workflow simple en PR/push: `install → typecheck (tsc) → lint → build`. Esto es el uso legítimo de los 2000 min/mes (a diferencia de §14). Cachear `node_modules`/`.next/cache` para minimizar minutos.
- **Sentry:** integrado vía `@sentry/nextjs`, free tier (5k errores/mes — sobrado para 1–5 usuarios). Captura errores server y client; los `error.tsx` reportan explícitamente (§17). Configurar `tracesSampleRate` bajo para no agotar cuota.
- **Drizzle Kit:** `drizzle-kit` para generar migraciones a partir del schema (`generate`/`migrate`). El schema saneado (§1) se versiona; las migraciones documentan la evolución desde el schema actual con deuda.

---

<a name="19-roadmap"></a>
## 19. Apéndice — orden de implementación recomendado

Para materializar esta arquitectura sin bloquearse, sugiero este orden (cada paso desbloquea el siguiente):

1. **Saneamiento de schema (§1)** + Drizzle schema/relations/migraciones (§2.1–2.2). *Fundacional: todo lo demás depende de los tipos.*
2. **Capa de datos:** queries con filtro de visibilidad centralizado (§2.3), `media_assets` + subida a R2 (§1, §15-img), `search_index` con triggers FTS (§8).
3. **Design system** (§7): tokens, fuentes, CSS vars, `tailwind.config`, shadcn instalado. *Desbloquea todos los componentes.*
4. **Shell público** (§3): layouts, navegación móvil/desktop (§8), reproductor global vacío (§9), ⌘K (§8).
5. **Componentes base + patrón índice** (§5.1, §5.3) → primero `/personajes` end-to-end (índice + ficha con tabs) como vertical de referencia.
6. **Resto de fichas** (§5.2) replicando el patrón; rendering ISR + tags de caché (§4).
7. **Admin:** auth + middleware (§12), CRUD por entidad, estados de publicación, preview/draft mode (§13).
8. **Efectos de publicación:** revalidación on-demand (§4), Discord webhook (§14), push (§15).
9. **Visualizaciones** (§10): mapa, timeline, árbol genealógico (lazy, `ssr:false`).
10. **Animaciones** (§6), **SEO/OG/sitemap** (§11), **PWA** (§15), **páginas de error** (§17).
11. **Pulido móvil** (§16) transversal + Sentry + CI (§18).
12. **Fase 2:** grafo de relaciones (§10.4), JSON-LD, URLs híbridas con slug decorativo (§3.4).

---

### Resumen de decisiones no obvias (las que más se desvían de "lo esperado")

- **R2 como único storage**, descartando la separación R2/Supabase Storage por sobreingeniería (§1).
- **`estado_publicacion` enum de 3 estados** + `publicado_primera_vez_en` en vez de `visible bool`, porque alimenta notificaciones y previews (§1, §13, §14).
- **Visibilidad de campo en tabla lateral** (`campo_visibilidad`) "ausente = visible", para no tocar el schema de cada entidad (§13).
- **`search_index` materializada con triggers Postgres FTS**, no queries por tabla (§8).
- **Discord/push desde el Server Action, nunca desde GitHub Actions** (latencia + ahorro de build minutes) (§14).
- **Draft mode (cookie firmada) para previews, no query param** (seguridad) (§13).
- **ISR + revalidación on-demand por tags** como estrategia dominante, derivada de que el contenido solo cambia al publicar (§4).
- **Zustand para el reproductor global persistente** anclado en el layout raíz (§9), lo que condiciona §3.5 (no layouts intermedios).
