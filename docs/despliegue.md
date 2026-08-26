# Despliegue

Cómo levantar Astralys en un equipo nuevo y cómo publicar cambios. Sustituye al
antiguo `PENDIENTE-migracion-y-despliegue.md`, que documentaba una migración
concreta y ya cumplida.

## 1. Requisitos

- **Node 20+** (probado en 24.18).
- **pnpm** — no hace falta instalarlo: la versión está fijada en `packageManager`
  y corepack la activa sola. Usa `corepack pnpm …` o `pnpm …` si ya lo tienes.

Sin permisos de administrador: descarga el **ZIP** "Windows Binary" de nodejs.org
(no el `.msi`), descomprímelo en tu carpeta de usuario y añádelo al PATH con
`setx PATH "C:uta
ode;%PATH%"` (no requiere admin; reabre la terminal).

## 2. Variables de entorno

`.env.local` está en `.gitignore` y **no viaja en el repositorio**: cópialo aparte
o recréalo desde el panel de Supabase.

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `DATABASE_URL` | Pooler puerto **6543** (transaction). Runtime de la app. | Sí |
| `DIRECT_URL` | Pooler puerto **5432** (session). Lo necesita drizzle-kit para DDL. | Para `db:*` |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente de Supabase. | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publicable (`sb_publishable_…`). | Sí |
| `NEXT_PUBLIC_SITE_URL` | Metadata, SEO y OG images. En producción, el dominio real. | Sí |
| `ADMIN_EMAIL` | Restringe el panel a ese correo (§12.1). | Recomendable |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cuenta de Cloudinary. | Si usas imágenes |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Preset del widget, en modo **Signed**. | Si usas imágenes |
| `CLOUDINARY_API_KEY` | Firma las subidas y borra los assets huérfanos. | Si usas imágenes |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | El **mismo valor**. El widget la manda en cada subida firmada. | Si usas imágenes |
| `CLOUDINARY_API_SECRET` | Secreto de firma. **Solo servidor**, nunca `NEXT_PUBLIC_`. | Si usas imágenes |
| `DISCORD_WEBHOOK_URL` | Aviso al publicar (§14). Vacío = no-op silencioso. | No |

> Sí, la API key va dos veces y una de ellas es pública. Es correcto: la
> `api_key` de Cloudinary **no es un secreto** — identifica la cuenta y viaja en
> cada subida firmada desde el navegador. El que jamás puede salir del servidor
> es `CLOUDINARY_API_SECRET`: si alguna vez lo ves con prefijo `NEXT_PUBLIC_`,
> rótalo desde el panel de Cloudinary.

> Las variables `NEXT_PUBLIC_` se incrustan **en tiempo de compilación**. Si
> añades o cambias una, reinicia `pnpm dev`; en producción, vuelve a desplegar.

## 3. Instalar

```bash
corepack pnpm install
```

Si aparece `ERR_PNPM_IGNORED_BUILDS`, **no lo apruebes a ciegas**: mira antes qué
hace ese script. El porqué está en el README, sección *Seguridad de dependencias*.

## 4. Comprobar antes de desplegar

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # build de producción; prerenderiza contra la base real
```

El `build` se conecta a Supabase para generar las páginas estáticas: si falla la
conexión, las páginas salen vacías en vez de romper (las queries llevan `.catch`).

## 5. Base de datos

La base es **remota** (Supabase) y ya está migrada. Una instalación nueva no tiene
que ejecutar nada: se conecta y funciona.

- Migraciones históricas ya aplicadas: `scripts/migrations/` (ver su README).
- Si editas `lib/catalogos.ts`, sincroniza la tabla `catalogos`:
  ```bash
  node --env-file=.env.local scripts/seed-catalogos.ts
  ```
- Diagnóstico de conexión (DNS + credenciales):
  ```bash
  node --env-file=.env.local scripts/test-db.mjs
  ```

## 6. Cloudinary

Las imágenes se suben **desde la wiki**: el widget del panel de admin las manda
directamente a Cloudinary y la aplicación solo anota la referencia en
`media_assets`. No hay que subir nada a mano.

### Organización

La carpeta la decide `lib/media/carpetas.ts` a partir de la entidad:

```
astralys/personajes/          imagen principal y banner de las fichas
astralys/personajes/galeria/  galería de la ficha
astralys/naciones/            …y lo mismo para cada sección
```

Las imágenes subidas **antes** de este cambio se quedan donde estaban; moverlas
es cosa de la Media Library de Cloudinary.

### El preset tiene que estar en modo *Signed*

Las subidas se firman en el servidor (`/api/cloudinary/firma`) después de
comprobar que quien sube es el admin. Para que eso sirva de algo, el preset debe
rechazar las subidas sin firma:

> Cloudinary → *Settings* → *Upload* → *Upload presets* → tu preset →
> **Signing Mode: Signed**.

Con el preset en *Unsigned*, su nombre viaja en el bundle de JavaScript y
cualquiera que abra la web puede subir archivos a tu cuenta, consumiendo tu
cuota. La ruta de firma además rechaza cualquier carpeta que no cuelgue de
`astralys/`.

### Limpieza de huérfanos

Cuando cambias la imagen de una ficha, quitas una de una galería o borras una
entidad, el archivo se queda en Cloudinary ocupando cuota. Para evitarlo,
`lib/media/purga.ts` hace una pasada de recolección tras cada guardado y cada
borrado definitivo: busca los assets que ya no referencia **nadie**
(`entidad_media` ni ninguna columna `imagen_asset_id` / `banner_asset_id`) y los
borra de Cloudinary y de la base.

Es un barrido completo, así que la primera vez limpia también todo lo que se
hubiera acumulado antes. Si la llamada a Cloudinary falla, la fila se conserva y
el siguiente barrido lo reintenta.

## 7. Desplegar

1. Configura en el hosting **todas** las variables del paso 2. Cuidado con
   `NEXT_PUBLIC_SITE_URL`: debe ser el dominio real, no `localhost:3000`.
2. Vercel detecta pnpm solo, por el `pnpm-lock.yaml`.
3. Despliega.

> ⚠️ **Si el cambio necesita una migración, córrela ANTES o a la vez que el
> deploy.** Si despliegas primero, el código nuevo escribirá en columnas que
> todavía no existen y las escrituras fallarán.

## 8. Pendiente

El roadmap vivo está en el README (*Pendiente*) y detallado en
[`docs/arquitectura.md`](./arquitectura.md) §19.
