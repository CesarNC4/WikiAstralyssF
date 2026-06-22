# PENDIENTE — pasos a hacer al desplegar

Tareas que **todavía debo ejecutar** para que los cambios (eliminación del subtítulo,
Poder de Combate dinámico y renombrado de magia `Hechizo` → `Tecnica`) queden activos.
El código ya está listo; falta la base de datos y el despliegue.

## 0. Tener Node disponible (sin admin)

Node portable ya está en `C:\Users\clnegretec\node` (no requiere administrador).
En cada terminal nueva, actívalo:
```
$env:Path = "C:\Users\clnegretec\node;$env:Path"
```
(o `setx PATH "C:\Users\clnegretec\node;$env:Path"` una sola vez — no necesita admin;
cierra y reabre la terminal después).

En otro equipo sin Node: descarga el **ZIP** "Windows Binary (.zip)" de nodejs.org
(no el `.msi`), descomprímelo en tu carpeta de usuario y haz lo mismo con el PATH.

## 1. Instalar dependencias (una vez por equipo)
```
npm install
```
`node_modules` está en `.gitignore`: no viaja en el commit, hay que instalarlo en cada equipo.

## 2. Verificar tipos (opcional, no toca nada)
```
npm run typecheck
```

## 3. Correr la migración de la base de datos
```
node --env-file=.env.local scripts/migrate-personaje-stats.mjs
```
- Necesita `.env.local` con `DATABASE_URL`. Ese archivo **no** está en el repo (gitignored):
  cópialo aparte al equipo donde corras esto.
- Apunta a la base **remota (Supabase)**, así que basta con **ejecutarla UNA sola vez
  desde cualquier equipo** con acceso a la BD; queda aplicada para todos.
- Es **idempotente**: se puede repetir sin daño.
- Hace: elimina `personajes.subtitulo`, añade `estadisticas.poder_de_combate`, migra la
  naturaleza de magia `Hechizo` → `Tecnica` (datos + catálogo) y siembra las naturalezas
  canónicas (Fundamento, Concepto, Tecnica, Tecnica Avanzada).

## 4. Desplegar el código.

---

## ⚠️ ADVERTENCIA IMPORTANTE

- **La migración borra la columna `subtitulo` y modifica la base de datos de
  PRODUCCIÓN (Supabase). Es una acción real y poco reversible.** Asegúrate de que
  `.env.local` apunta a la base correcta antes de ejecutarla.

- **El orden importa:** corre la migración **antes o junto** con el deploy. El código
  nuevo escribe la columna `estadisticas.poder_de_combate`; si despliegas antes de
  migrar, guardar un personaje fallará porque la columna aún no existe.

## Notas

- `poder_de_combate` se recalcula y guarda al guardar cada ficha. La vista pública lo
  recalcula al vuelo, así que se muestra correcto aunque la columna esté vacía (no hace
  falta backfill de fichas antiguas).
- Escalas: atributos primarios **1–10**, combate **1–300**, rangos
  **D · C · B · A · S · SS · SSS**. El Poder de Combate es el promedio de los tres
  porcentajes por sección.
