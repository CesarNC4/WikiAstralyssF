@AGENTS.md

# Astralys — wiki de fantasía

Wiki del mundo de Astralys: Next.js 16 (App Router), React 19, Drizzle y
Supabase. El autor habla español: responde, comenta el código y documenta en
español.

## Reglas

- **Hay una sola base de datos, la de producción.** Ningún script escribe en
  ella sin el visto bueno del autor. Las migraciones se ensayan primero (sin
  `--aplicar`): ver `scripts/migrations/README.md`.
- **El repositorio es público.** Nunca se sube lore sin publicar: la carpeta
  `lore/` está fuera de git.
- **Al terminar cada tarea**, con todo verificado, commit y push a `master` sin
  preguntar (master publica en la web). Las migraciones siguen necesitando el
  visto bueno del autor antes de `--aplicar`.
- No se instalan dependencias ni nada global sin permiso. Gestor: pnpm.
- No ejecutar `pnpm build` con `pnpm dev` en marcha.
- Antes de dar algo por terminado: `pnpm typecheck`, `pnpm lint` y `pnpm build`,
  y si cambia algo visual, **probarlo en el navegador** (cómo, en
  `CLAUDE.local.md`) y contar lo que se vio.
- Si tocas una consulta pública, respeta lo oculto (`lib/queries/visibilidad.ts`) y
  pasa `pnpm --silent verificar-ocultos`: el público nunca debe recibir un dato oculto.

## Dónde está cada cosa

- `README.md`: estado actual de la wiki.
- `docs/arquitectura.md` (el porqué), `docs/relaciones.md` (el registro de
  relaciones), `docs/catalogos.md`, `docs/taller-del-autor.md`,
  `docs/despliegue.md`, `docs/fragmentos-y-musica.md`.
- `docs/area-ia.md`: el trabajo de lore con Claude (plan y estado).

## Trabajo de lore

Claude **lee** la base y **propone** en archivos de `lore/propuestas/`; el
autor los aplica desde el panel. Claude nunca escribe lore en la base.

- `/lore`: consultar el lore.
- `/lore-fichas`: proponer fichas nuevas o cambios.
- `/lore-entrevista`: sacar lo que el autor tiene en la cabeza.
- `/lore-revisar`: auditar la coherencia del lore.

Lectura: `pnpm --silent lore <orden>` (`scripts/lore/leer.ts`; `pnpm --silent lore ayuda`).
Si tocas el formato o la bandeja de propuestas, pasa `pnpm --silent probar-propuestas`.
Si tocas las reglas de la revisión, pasa `pnpm --silent probar-revision`.
