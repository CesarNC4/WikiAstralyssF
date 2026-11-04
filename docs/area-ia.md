# Área IA — Claude como asistente de lore

> **Estado (2026-11-03): Fases 1–5 hechas, guía de estilo respondida, web
> fuera de los buscadores y datos de prueba limpios.** Ya se puede trabajar:
> `/lore`, `/lore-fichas` y `/lore-entrevista` funcionan, y el autor aplica las
> propuestas desde `/admin/propuestas`. Siguiente: Fase 6 (`/lore-revisar`). Este
> documento sirve para retomar el trabajo desde cualquier chat sin más contexto.

## Qué es

Claude (en Claude Code, desde este repositorio) ayuda al autor a llenar la
wiki: le entrevista para sacar lo que tiene en la cabeza, ordena notas sueltas,
propone fichas nuevas y cambios en las existentes, y revisa la coherencia del
mundo.

**Reglas que no cambian:**

1. **Claude lee la base, nunca escribe lore en ella.** Lo que propone va a
   archivos en `lore/propuestas/`, y es **el autor quien lo aplica** desde el
   panel: decide qué se publica, qué queda en borrador, qué va a sus notas
   privadas y qué se descarta.
2. **La base es la única fuente de verdad del lore.** No se copia el lore a
   documentos aparte (se desactualizarían): cada chat lee la wiki cuando lo
   necesita. Las propuestas son de usar y tirar: el autor las borra al aplicarlas.
3. **El repositorio es público.** La carpeta `lore/` está en `.gitignore`: ahí
   va todo lo que no está publicado (propuestas, entrevistas, guía de estilo).
   Nada de lore sin publicar entra en un commit.

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Contexto fijo | `CLAUDE.md` | Lo lee cualquier chat al arrancar: reglas y dónde está cada cosa |
| Contexto personal | `CLAUDE.local.md` (fuera de git) | El equipo del autor: rutas de Node, cómo probar en local |
| Carpeta de trabajo | `lore/` (fuera de git) | `propuestas/`, `entrevistas/`, `guia-de-estilo.md` |
| Lectura | `scripts/lore/leer.ts` (`pnpm --silent lore …`) | Lee fichas, conexiones, fechas, catálogos y moldes. Solo lectura |
| Moldes | `lib/propuestas/moldes.ts` | Los campos de cada ficha con los rótulos del panel. Lo usan la lectura y la bandeja |
| Formato | [propuestas-formato.md](./propuestas-formato.md) | Cómo se escribe una propuesta |
| Verificador | `scripts/lore/verificar-ocultos.ts` (`pnpm --silent verificar-ocultos`) | Comprueba que nada oculto llega a un lector |
| Skills | `.claude/skills/` | `/lore`, `/lore-fichas`, `/lore-entrevista` (y `/lore-revisar` en la Fase 6) |
| Bandeja | `/admin/propuestas` | El autor abre sus propuestas y las aplica dato a dato |
| Pruebas | `scripts/lore/probar-propuestas.ts` (`pnpm --silent probar-propuestas`) | Comprueba lo puro de la bandeja: el formato, las fechas, la comparación y la reescritura del archivo |

`scripts/lore/registrar.mjs` permite ejecutar con Node el código de `lib/` y
`db/` (alias `@/…`, imports sin extensión, `server-only`): la lectura usa las
mismas definiciones que la web, sin dependencias nuevas.

## Plan por fases

### Fase 1 — Contexto ✔ hecha

`CLAUDE.md`, `CLAUDE.local.md`, `lore/` en `.gitignore` con su guía de estilo,
y este documento.

### Fase 2 — Lectura y `/lore` ✔ hecha

`scripts/lore/leer.ts` con: `resumen`, `buscar`, `lista`, `ficha`, `menciones`,
`campos` y `catalogo`. La salida de `ficha` usa el mismo formato que las
propuestas, así una ficha leída sirve de punto de partida para proponer cambios.
Skill `/lore` para consultar ("¿qué sabemos de…?").

### Fase 3 — Propuestas, `/lore-fichas` y `/lore-entrevista` ✔ hecha

El formato ([propuestas-formato.md](./propuestas-formato.md)), un archivo por
área (personajes, naciones y lugares, organizaciones, razas y criaturas, magia
y objetos, historia, taller, música). Desde aquí el autor ya puede trabajar,
pasando los datos al panel a mano.

### Antes de la Fase 4 — web sin indexar y limpieza

Decidido en la entrevista de la guía de estilo (2026-11-02):

- **Web sin indexar** ✔ hecha (2026-11-02). La wiki la consultan el autor y
  sus amigos: abierta a quien tenga el enlace, pero fuera de los buscadores
  (`noindex` en todo, sin sitemap, rastreadores de IA bloqueados; detalle en
  docs/arquitectura.md §11.4).
- **Limpieza de los datos de prueba** ✔ aplicada (2026-11-03,
  `scripts/migrations/migrate-limpieza-prueba.ts`), con ensayo y el visto
  bueno del autor (sin copia previa, por decisión suya). El HTML no estaba
  solo en las razas: la web enseñaba las etiquetas como texto también en la
  magia, el gremio y la cronología, y se convirtió todo. Los personajes se
  quedan solo con nombre y estado: fuera sus textos, imágenes, estadísticas,
  habilidades, relaciones, fechas y conexiones. Se borra la canción. El resto
  de secciones, los catálogos y el calendario se quedan. En el mismo script:
  quitar el HTML pegado de Word de los textos de las razas (mismo texto, sin
  el código) y vaciar los textos de relleno de la nación.
- **Fuera `personaje_narrativa`**: los secretos van ocultos en la ficha (Fase
  4), y lo demás en las notas privadas o en las hojas de trama.

### Fase 4 — Visibilidad completa ✔ hecha (2026-11-03)

Que cualquier dato pueda ocultarse al público por separado. Decisiones del
autor (2026-11-02 y 2026-11-03):

- **Dos niveles**: un dato lo ve todo el mundo o solo el autor. No hay
  visibilidad por lector.
- **Lo oculto deja una marca "???"**: se nota que hay algo, pero no qué
  ("Nombre real: ???"). Vale para campos, conexiones y fechas.
- **Edad**: si se oculta el nacimiento, la edad también sale como "???".
- **Grafos** (Atlas y mini-grafos): una conexión oculta no se dibuja.
- **Identidad oculta**: campo de nombre real en el personaje, oculto por
  defecto; la ficha lleva el alias con el que la conocen los lectores. Los
  personajes que hoy llevan "???" en el nombre los pasa el autor a mano.
- **Conexión oculta**: la marca sale en las dos fichas. En el árbol genealógico y
  el organigrama, la casilla sale como "???", sin enlace, y conserva sus líneas.
- **Campo marcado y vacío**: sale "???" igualmente. El nombre real es la
  excepción: vacío no sale, o saldría en todas las fichas.
- **Estadísticas en bloque, habilidades una a una.**
- **Trozos ocultos**: dentro de un texto largo, `[[oculto]]…[[/oculto]]` sale como
  "???". Lo que aún no ha salido en la historia suele ser solo una parte de un texto.

Cómo está hecho:

- `lib/visibilidad.ts` (client-safe) tiene las reglas; `lib/queries/visibilidad.ts`
  lee las marcas y enmascara. Todo se quita en el servidor: lo oculto no llega al
  navegador. Cada consulta pública pasa por ahí, incluidas las de datos de la ficha
  de al lado (el apellido de quien sale en una relación).
- El buscador lo respeta en la propia base: `search_index_sync` y
  `search_index_acto` dejan fuera los campos marcados y los trozos
  (`censurar_oculto`), y al marcar un campo se reindexa la ficha.
- Las listas agregadas (el reparto de un capítulo, los personajes de un evento en
  la cronología, las canciones de una ficha) no dejan marca: lo oculto no sale.
- Los formularios que borran y reinsertan filas conservan el candado: habilidades,
  historial y árbol lo llevan en la fila; el resto lo recuerdan por el otro extremo.
- `pnpm --silent verificar-ocultos [url]` pide las páginas como un lector sin
  sesión y comprueba el HTML en bruto. **Pásalo si tocas una consulta pública.**

Limitaciones conocidas, si se oculta a mano en el taller: la fecha de un acto se
calcula de sus fragmentos, también de los ocultos, y el POV de un fragmento entra en
el bloque POV del acto. Si un fragmento lleva una fecha o un POV secretos, hay que
ocultar también los del acto. La bandeja lo hace sola al aplicar un fragmento con 🔒.

Lo que se pedía:

- **Campos ocultos en todas las fichas.** Hoy (`campo_visibilidad`) solo los
  respetan naciones, razas, bestias, minerales, conceptos, misiones, lords
  demonio, artefactos, lore, capítulos, arcos, organizaciones y familias, y el
  panel solo ofrece el control en las fichas del admin genérico. Faltan:
  personajes (lo primero), regiones, locaciones, gremio, canciones, el control
  del panel en organizaciones y familias, y revisar eventos y actos.
- **Conexiones ocultas.** Una conexión que existe pero no se ve (que alguien es
  espía de una organización). Según el medio: columna `oculto` en `vinculo` y en
  las tablas de `TABLAS_REL`; en las de medio "referencia", la columna es un
  campo de la ficha y se oculta como campo. Filtrar en los bloques públicos, el
  Atlas, los mini-grafos y las consultas a mano.
- **Fechas ocultas.** Columna `oculto` en `fecha_lore`. Filtrar en fichas,
  cronología y calendario. Si se oculta el nacimiento, también la edad (la
  delataría).
- Candado en el panel para cada campo, conexión y fecha.
- Un verificador que recorra lo público y compruebe que nada oculto se escapa.

Migración con ensayo; ningún `--aplicar` sin el visto bueno del autor.

### Fase 5 — Bandeja de propuestas ✔ hecha (2026-11-03)

`/admin/propuestas`: el autor abre sus propuestas, ve cada ficha (nueva, o actual
frente a propuesta, con lo que cambia resaltado) y elige por dato: **Visible**,
**Oculto**, **A notas**, **Descartar** o **Luego**, pudiendo editarlo antes. Los nombres
de otras fichas se resuelven a su id; si no existe o es ambiguo, el autor elige o crea
un borrador al vuelo. Decisiones del autor (2026-11-03):

- **Carpeta recordada**: se elige una vez `lore/propuestas/` y el panel la recuerda;
  lo aplicado se quita del archivo y el archivo vacío se borra. En un navegador sin
  acceso a carpetas se suben los archivos y se descarga lo que queda.
- **"Luego"** aplica el resto de la ficha y deja ese dato pendiente en el archivo.
- **Por ficha y "Aplicar todas"**, con confirmación, las que no tengan nada por resolver.
- **Lo sustituido no se guarda**: la bandeja lo enseña antes, y la wiki no tiene versiones.
- **Nombre que ya existe**: se aplica sobre esa ficha por defecto, y se puede crear otra.
- **Conexión que ya existe con otros datos**: se actualiza esa fila por defecto, y se
  puede añadir otra.
- **El formato cubre también** habilidades, estadísticas, rangos, facciones, miembros
  con rango, árbol, historial, secciones de lore y fragmentos de acto.

Cómo está hecho:

- `lib/propuestas/formato.ts` lee el Markdown sin mirar la base, con las líneas exactas
  de cada dato; `lib/queries/propuestas.ts` lo compara con la base (solo lee);
  `lib/propuestas/aplicar.ts` escribe; `lib/propuestas/archivo.ts` reescribe el archivo,
  buscando cada bloque por su texto porque puede haber cambiado mientras tanto.
- **No hay nada en la base**: ni migración ni tabla. El archivo vive en el disco del autor
  y en el navegador, y las Server Actions solo lo reciben para analizarlo y aplicarlo.
- **Aplicar nunca borra y reinserta**, a diferencia de los formularios: lo que la propuesta
  no menciona no se toca. Va dato a dato por las vías de siempre (`crearVinculo`,
  `guardarFechaFicha`, `crearCapitulo`…); uno que falla se queda en el archivo con su
  motivo y no detiene al resto. Por eso se puede repetir: cada dato busca antes lo que hay,
  y lo que ya está así se salta.
- Una ficha nueva no hereda los valores por defecto de la base que los admiten vacíos: una
  propuesta no debe traer datos que nadie ha dicho. Lo que hace falta para nacer (el libro
  de un capítulo, el capítulo de un acto, el arco de una hoja) lo pide aunque no venga.
- **Publicar por primera vez avisa por Discord**, como en el resto del panel. Al probar en
  local con fichas publicadas, los webhooks de `.env.local` deben apuntar a otro sitio.

Sin probar con la ventana real del sistema: el selector de carpetas y su permiso se
sustituyeron por una carpeta privada del navegador (OPFS), que tiene la misma API.

### Fase 6 — `/lore-revisar`

Auditoría de coherencia: edades frente a fechas, fichas a medias, conexiones
que faltan o se contradicen, referencias rotas. Si llena demasiado el chat, se
pasa a un agente lector.

## Decisiones

- 2026-11-02: guía de estilo respondida (`lore/guia-de-estilo.md`, fuera de
  git). Lo que toca al código está arriba: web sin indexar, limpieza, quitar
  `personaje_narrativa` y las decisiones de la Fase 4. Los textos de las
  fichas de antes de la guía eran de prueba: no sirven de modelo de estilo.
- 2026-11-02: la lectura muestra también lo que el panel no deja editar
  (habilidades y estadísticas del personaje) como "solo lectura". La tabla
  `personaje_narrativa` (secretos pendientes, notas de autor del personaje)
  existe pero ningún formulario la edita: queda fuera de los moldes, y se
  quita en la limpieza.
- Datos raros vistos al probar: comillas escapadas (`\"Sabio\"`) en la
  historia de Alhaitham (se va con la limpieza de personajes), textos de
  relleno en Sylvaterra ("aba", "Mucho conocimiento") y HTML de Word en los
  textos de las razas (los dos últimos, en el script de la limpieza).

- 2026-11-02: el autor aplica las propuestas él mismo (bandeja en el panel), en
  lugar de que Claude escriba en la base. Discord queda fuera: son notas sueltas
  de apoyo. Lo importante es lo que el autor tiene en la cabeza, que es sobre
  todo material del taller.
- Gemini: la clave gratuita (`GEMINI_API_KEY` en `.env.local`) funciona con
  `gemini-3.5-flash` y el razonamiento en "low" (1–2 s). Queda como opción para
  procesar mucho volumen, no como pieza del flujo.
