# Astralys — Wiki de fantasía

Wiki del mundo de **Astralys**, construida sobre la [arquitectura](./astralys-arquitectura.md).
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM · Supabase · Framer Motion · Zustand.

## Puesta en marcha

1. **Instala dependencias** (ya hecho si tienes `node_modules`):
   ```bash
   pnpm install
   ```

2. **Configura el entorno.** `.env.local` ya tiene la URL y la clave pública de tu
   proyecto Supabase `wikiastralys`. **Falta la contraseña de la base de datos**
   (es un secreto que no se puede leer por API):

   - Ve a *Supabase → Project Settings → Database → Connection string*.
   - Sustituye `[TU-DB-PASSWORD]` en `DATABASE_URL` y `DIRECT_URL`.

   Sin esto, las páginas cargan pero salen vacías (las queries fallan de forma
   controlada con `.catch`).

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
```

## Estado actual

- Design system cósmico (tokens Tailwind v4, fuentes Cinzel/Inter/JetBrains).
- Capa Drizzle completa (54 tablas) + queries con filtro de visibilidad.
- Navegación adaptativa (top nav desktop + bottom nav móvil + drawer).
- Búsqueda global ⌘K (ILIKE multi-tabla).
- Reproductor de música global persistente (Zustand + `<audio>` + embeds).
- Índices de las 13 secciones + fichas (personaje con tabs; nación, organización,
  familia con árbol; genéricas para el resto) + lore por slug.
- Timeline vertical, mapa de naciones, páginas de error temáticas.
- SEO (metadata dinámica, sitemap, robots), ISR + revalidación.
- Admin con Supabase Auth (login email/password, proxy de protección, dashboard).

## Pendiente (roadmap §19)

- Saneamiento de schema (§1): enum `estado_publicacion`, `media_assets`,
  `pagina_secciones`, FTS materializado — migraciones **no aplicadas aún** para no
  tocar tus datos reales.
- Admin CRUD por entidad + Zod + preview con draft mode (§13).
- Webhook Discord + push PWA (§14, §15) · subida a Cloudinary · `next-pwa`.
- Visualizaciones avanzadas: React Flow, D3, Leaflet (§10).
