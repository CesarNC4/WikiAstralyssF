# Migraciones aplicadas

Scripts de **un solo uso** que ya se ejecutaron contra la base de datos de
producción (Supabase). No forman parte del arranque del proyecto: una instalación
nueva se conecta a la base ya migrada y no necesita correr nada de aquí.

Se conservan porque documentan cómo evolucionó el schema, lo que ayuda a entender
datos raros o columnas con nombre extraño. Todos son **idempotentes**: repetirlos
no rompe nada, pero tampoco hace falta.

| Script | Qué hizo |
|---|---|
| `migrate-frente-a.mjs` | Añadió columnas de auditoría (`creado_en`, `actualizado_en`, `eliminado_en`) a las entidades que no las tenían, para que encajaran en el admin genérico (papelera, orden, edición). |
| `migrate-frente-a-search.mjs` | Enganchó los triggers de `search_index_sync` a las entidades nuevas, para que aparezcan en el buscador ⌘K. |
| `migrate-mapa.mjs` | Frente C: creó el tipo `tipo_locacion`, las tablas `regiones` y `locaciones`, añadió geometría a `naciones` y enganchó los triggers de búsqueda y `actualizado_en`. |
| `backfill-media.mjs` | Frente D: creó `media_assets` a partir de las `imagen_url` / `banner_url` existentes y añadió las columnas `*_asset_id`. |
| `migrate-magia-estructurada.mjs` | Pasó la magia del personaje a columnas estructuradas (tipo/variante) parseando el texto `"Tipo (Variante)"`. Aditiva: no borró las columnas de texto. |
| `migrate-lugar-nacimiento.mjs` | Añadió `lugar_nacimiento_nacion_id` / `_region_id` / `_locacion_id` a `personajes`. |
| `migrate-personaje-stats.mjs` | Eliminó `personajes.subtitulo`, añadió `estadisticas.poder_de_combate` y renombró la naturaleza de magia `Hechizo` → `Tecnica`. **Aplicada el 2026-06-26.** |
| `migrate-conectividad.mjs` | Frente E: unificó `personaje_organizacion` dentro de `org_jerarquia`, creó la tabla genérica `vinculo` y añadió **57 claves foráneas** y 36 índices que faltaban (la base pasó de 75 a 130). Comprueba que no haya filas huérfanas antes de escribir nada y aborta si las encuentra. **Aplicada el 2026-08-26.** |
| `migrate-narrativa-admin.mjs` | Frente E: dio estado de publicación y columnas de auditoría a `capitulos`, `actos`, `trama_arcos`, `trama_hojas`, `hilo_narrativo`, `canciones` y `elementos` para que el admin genérico pudiera gestionarlas, y enganchó capítulos y arcos al buscador. **Aplicada el 2026-08-26.** |
| `migrate-selects.mjs` | Frente F: la reforma de los desplegables. Añade **35 columnas**, retira cuatro que sobraban (`bestias.categoria`, `armas_artefactos.propietario_actual`, y las afinidades sueltas de razas y minerales, que se mudan a `entidad_elemento`), convierte `naciones.terreno` en lista, saca `locaciones.tipo` del enum rígido de cuatro valores y migra los valores ya guardados a su forma nueva. **Corre en ensayo por defecto**: sin `--aplicar` hace todo el trabajo dentro de una transacción que revierte al final y te enseña qué cambiaría. |

## Si necesitas ejecutar una

```bash
node --env-file=.env.local scripts/migrations/<script>.mjs
```

Requiere `DATABASE_URL` en `.env.local`. Apuntan a la base **remota**, así que
basta con correrlas una vez desde cualquier equipo.

> ⚠️ `migrate-personaje-stats.mjs` **borra la columna `subtitulo`**. Es una acción
> real sobre producción y poco reversible. Comprueba a qué base apunta tu
> `.env.local` antes de lanzarla.

## Lo que sí sigue vivo

En `scripts/` (un nivel arriba) quedan las utilidades que se usan de forma
recurrente, y esas no son migraciones:

- **`seed-catalogos.ts`** — siembra la tabla `catalogos` y la tabla `elementos`
  desde `lib/catalogos.ts` y `lib/elementos.ts`. **Es aditivo**: inserta lo que
  falta y corrige el orden, pero no borra nada. Antes era un espejo estricto, y
  eso ahora destruiría lo que hayas añadido desde `/admin/catalogos`.
- **`verificar-relaciones.mjs`** — comprueba que el registro de relaciones cuadra
  con las tablas y columnas reales.
- **`verificar-catalogos.mjs`** — comprueba que los catálogos cuadran: que las
  columnas declaradas existan, que ningún desplegable se quede sin opciones y que
  ninguna ficha guarde un valor fuera de su catálogo.
- **`test-db.mjs`** — diagnóstico de conexión a la base (DNS + credenciales).
