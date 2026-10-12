# Astralys — Wiki de fantasía

Wiki del mundo de **Astralys**, construida sobre la [arquitectura](./docs/arquitectura.md).
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM · Supabase · Framer Motion · Zustand.

## Puesta en marcha

1. **Instala dependencias** (ya hecho si tienes `node_modules`):
   ```bash
   pnpm install
   ```

2. **Configura el entorno.** Crea `.env.local` (está en `.gitignore`: no viaja en
   el repositorio). La lista completa de variables y de dónde sale cada una está
   en [docs/despliegue.md](./docs/despliegue.md#2-variables-de-entorno).

   Sin `DATABASE_URL` las páginas cargan pero salen vacías: las queries fallan de
   forma controlada con `.catch`.

3. **Arranca en desarrollo:**
   ```bash
   pnpm dev
   ```
   Abre http://localhost:3000

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:pull` | Introspecciona la DB a Drizzle (requiere `DIRECT_URL`) |
| `pnpm db:studio` | Drizzle Studio |

## Seguridad de dependencias

El proyecto usa **pnpm** (fijado en `packageManager`), no npm. `npm install`
ejecuta los *lifecycle scripts* de cualquiera de las ~590 dependencias
transitivas sin preguntar, que es el vector de los ataques de cadena de
suministro de npm. pnpm los **bloquea por defecto**.

La política vive en `pnpm-workspace.yaml`:

- **`allowBuilds`** — lista blanca explícita: ningún paquete ejecuta código al
  instalarse salvo que aparezca aquí con `true`. Hoy hay tres denegados a
  propósito (`esbuild`, `sharp`, `unrs-resolver`): sus binarios nativos llegan
  como `optionalDependencies` normales, verificadas por hash en el lockfile,
  así que su script sobra. Comprobado: `typecheck`, `lint` y `build` pasan.
- **`minimumReleaseAge: 10080`** — cuarentena de 7 días. Rechaza versiones
  recién publicadas, que es la ventana en la que el malware sigue vivo antes
  de ser detectado y retirado.

Si al instalar sale `ERR_PNPM_IGNORED_BUILDS`, **no lo apruebes a ciegas**:
mira qué hace el script y decide con `pnpm approve-builds <pkg>` para permitir
o `pnpm approve-builds '!<pkg>'` para denegar.

## Estructura

```
app/(public)/     wiki pública (índices + fichas + timeline + mapa)
app/(admin)/      panel del autor (login + dashboard), protegido por proxy.ts
components/        UI (entity, fichas, layout, player, search, motion, viz)
db/               Drizzle schema (por dominio), client, relations
lib/queries/      capa de acceso a datos (server-only, filtra visibilidad)
lib/actions/      Server Actions (auth, búsqueda)
lib/entities.ts   registro central de secciones (nav, índices, búsqueda)
lib/relaciones/   registro de relaciones: cada arista del mundo, declarada una vez
lib/catalogos.ts  semilla de las listas de los desplegables (la tabla `catalogos` manda)
docs/             arquitectura (el porqué) y runbook de despliegue
scripts/          utilidades vivas + migrations/ (histórico ya aplicado)
```

## Estado actual

- Design system cósmico (tokens Tailwind v4, fuentes Cinzel/Inter/JetBrains).
- Capa Drizzle completa (70 tablas) + queries con filtro de visibilidad.
- Navegación adaptativa (top nav desktop + bottom nav móvil + drawer).
- Búsqueda global ⌘K sobre índice FTS materializado (`search_index`, mantenido
  por triggers): tsquery en español + similitud trigram + prefijo, tolerante a
  acentos y erratas.
- Reproductor de música global persistente (Zustand + `<audio>` + embeds).
- Índices de las 13 secciones + fichas (personaje con tabs; nación, organización,
  familia con árbol; genéricas para el resto) + lore por slug.
- Timeline vertical, mapa de naciones, páginas de error temáticas.
- SEO (metadata dinámica, sitemap, robots), ISR + revalidación.
- Admin con Supabase Auth (login, proxy de protección, dashboard) y CRUD completo
  por entidad: alta, edición, papelera, preview y validación con Zod.
- Subida de imágenes a Cloudinary desde el propio panel, **firmada en el servidor**
  y organizada en carpetas por entidad (`astralys/personajes`, `…/galeria`).
  Los assets que dejan de estar referenciados se purgan solos de Cloudinary.
- **Conectividad bidireccional.** Cada relación se declara una sola vez en
  `lib/relaciones/registro.ts` y de ahí salen el editor de las dos fichas, los
  bloques públicos de ambas y las aristas del grafo: **55 declaraciones producen
  206 bloques**. Vincular un personaje a una organización desde cualquiera de las
  dos fichas es la misma fila en la base. Ver [docs/relaciones.md](./docs/relaciones.md).
- Panel de conexiones fijo en el admin mientras editas, con buscador de fichas
  con contexto, vinculación en lote y creación de borradores al vuelo.
- **Catálogos editables.** Las listas de todos los desplegables se editan desde
  `/admin/catalogos` sin tocar código: añadir una opción, reordenarla o
  renombrarla — y renombrar arrastra el valor en las fichas que lo usaban. Se
  puede escribir un valor nuevo en el propio desplegable y queda en el catálogo.
  Ver [docs/catalogos.md](./docs/catalogos.md).
- Desplegables dependientes: la variante de un artefacto depende de su tipo, el
  subtipo de una relación de su tipo, y el elemento de una magia de su escuela.
- **Mapa por capas.** Cuatro niveles (base, naciones, regiones, locaciones) con
  solo uno interactivo a la vez, así los polígonos dejan de pisarse. La región de
  una locación y la nación de una región se deducen de la geometría al guardar.
- Notas privadas del autor y visibilidad por campo: ocultar un dato al público
  sin borrarlo.
- Mapa con Leaflet + Geoman, grafo global en `/atlas` y mini-grafo por ficha,
  ambos alimentados por el registro de relaciones.
- Acciones en lote y duplicado de fichas en el panel. Duplicar arrastra también
  las conexiones de la ficha original.
- Dominio narrativo gestionable: capítulos, actos, arcos, hojas de trama e hilos.
  Capítulos y arcos tienen ficha pública e índice propio; las hojas y los hilos se
  quedan en el panel porque guardan giros y notas de autor.
- **Taller del autor** (`/admin/taller`), a pantalla completa y solo para
  escritorio, es el único sitio donde se editan capítulos, actos, arcos, hojas e
  hilos. Ver [docs/taller-del-autor.md](./docs/taller-del-autor.md) y
  [docs/taller-plan.md](./docs/taller-plan.md).
  - *Escribe*: los actos, con POV, personajes, lugares, arcos, canciones, fecha,
    hojas, hilos y eventos.
  - *Capítulos*: el árbol libro > capítulo > acto, con arrastre.
  - *Estructura*: plantillas propias y un tablero de fases por capítulo.
  - *Trama*, *Estadísticas*, *Papelera* y *Universo > Calendario* (vista por
    año con alta de eventos, y configuración de meses, semana y eras).
  - *Universo > Personajes* (cuadrícula con filtros) y *Universo > Mapa de
    relaciones*: grafo 2D editable donde se unen dos fichas pulsándolas y se
    edita o borra una conexión pulsando su línea. Las relaciones entre
    personajes se pintan por categorías (color, icono y línea) que se definen en
    `/admin/catalogos`.
- **Numeración automática**: los capítulos se numeran por libro (los tipos sin
  número se marcan en el catálogo `capitulo_tipo`) y los actos en romanos.
- **El capítulo se calcula de sus actos**: personajes, lugares, canciones y
  fechas. Cada acto tiene su ficha pública en `/capitulos/<id>/actos/<id>` y
  entra en el buscador, el sitemap, el feed y el Atlas.
- **Fechas del lore estructuradas** (`fecha_lore`, `lib/fechas/`): eje absoluto
  con el año 0 en el inicio de la trama, eras, calendario propio con días fuera
  de mes. Cada ficha tiene sus fechas (nacimiento y muerte, fundación y caída…,
  ver `lib/fechas/roles.ts`), el lector elige entre eras y año absoluto, y la
  edad de un personaje se calcula según el momento de lectura (el capítulo o el
  acto que tenga abierto).
- **Cronología derivada** (`/timeline`): los eventos y todo lo que tiene fecha en
  las fichas, ordenado por día absoluto, con filtros por tipo, era y ficha, y
  solo lo importante por defecto. Submenú con el calendario por año
  (`/timeline/calendario`).
- Canciones y catálogo de elementos gestionables desde el panel.
- Feed RSS en `/feed.xml` con las últimas entidades publicadas.
- PWA instalable con service worker propio (sin dependencias): navegación sin
  conexión de lo ya visitado. El panel y las APIs nunca se cachean.

## Pendiente

El plan original está en [docs/arquitectura.md](./docs/arquitectura.md) §19. De
aquel roadmap queda por hacer:

- **Notificaciones push (§15).** La PWA ya es instalable y funciona sin
  conexión; faltan las notificaciones push, que necesitan claves VAPID y un
  endpoint de suscripción.
- **Webhook de Discord (§14).** El código está listo en `lib/discord.ts`; solo
  falta configurar `DISCORD_WEBHOOK_URL` (vacío = no-op silencioso).
- **Visualizaciones con D3 (§10).** React Flow y Leaflet ya están; D3 no se usó.

Ya no está pendiente, aunque el documento de arquitectura lo dé por hacer: el
saneamiento de schema §1 (enum `estado_publicacion`, `media_assets`,
`pagina_secciones`, FTS materializado) y el admin CRUD §13 están **completos**.
