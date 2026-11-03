---
name: lore-fichas
description: Proponer fichas nuevas o cambios en fichas de la wiki de Astralys a partir de material del autor (notas, ideas, texto suelto, respuestas de una entrevista). Úsalo cuando el autor quiera crear, completar, enriquecer o corregir fichas. Escribe propuestas en lore/propuestas/; nunca toca la base.
---

# Proponer fichas

Claude **propone** y el autor **aplica**. El resultado de este skill son
bloques en `lore/propuestas/<área>.md`, en el formato de
`docs/propuestas-formato.md`. Nunca se escribe en la base.

## Antes de escribir nada

1. Lee `lore/guia-de-estilo.md` y `docs/propuestas-formato.md`.
2. Entiende qué fichas toca el material. Para cada una:
   - `pnpm --silent lore buscar <nombre>`: ¿existe ya, quizá con otro nombre?
   - Si existe: `pnpm --silent lore ficha <tipo> <nombre>` para ver lo que hay.
   - `pnpm --silent lore campos <tipo>` para el molde: rótulos exactos,
     opciones de catálogo, títulos de las conexiones y fechas posibles.
3. Si hay dudas que cambian el resultado (¿es la misma persona?, ¿esto es
   secreto?, ¿en qué año?), pregúntalas **juntas y antes** de escribir, en
   pocas preguntas cortas.

## Al escribir

- **Solo lo que dice el autor o ya está en la wiki.** Si redactas a partir de
  sus notas, conserva sus ideas y su voz; no añadas hechos. Lo deducido va en
  las notas de autor diciendo de dónde sale.
- Rótulos y opciones exactos del molde. Una opción que no existe se marca
  `(opción nueva)`.
- En una ficha que existe, escribe solo lo que cambia. Para ampliar un texto
  sin pisarlo, `### <Rótulo> (añadir)`.
- Marca con 🔒 lo que pueda ser secreto o spoiler (identidades, muertes,
  parentescos ocultos, giros). Decide el autor.
- Conecta: si el material dice que A pertenece a B, eso es una conexión, no
  solo una frase en la historia.
- Añade los bloques **al final** del archivo del área, tras una línea
  `<!-- AAAA-MM-DD · de dónde sale -->`. Crea el archivo si no existe.

## Al terminar

Resume en el chat: qué archivos, cuántas fichas nuevas y cuántas con cambios,
qué quedó oculto con 🔒 y qué dudas siguen abiertas. Recuerda al autor que
lo aplica él (desde la bandeja del panel cuando exista, o a mano) y que borre
cada propuesta al aplicarla.

Si el autor corrige el estilo o una decisión de fondo, añádelo a
"Correcciones del autor" en `lore/guia-de-estilo.md`.
