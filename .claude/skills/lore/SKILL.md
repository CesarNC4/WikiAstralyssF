---
name: lore
description: Consultar el lore de Astralys en la wiki (solo lectura). Úsalo cuando el autor pregunte qué se sabe de un personaje, nación, organización, evento o cualquier ficha, quién pertenece a qué, qué fichas existen, qué falta en una ficha o dónde se menciona algo.
---

# Consultar el lore

La base de datos de la wiki es la única fuente de verdad del lore. Lee de ahí
con la herramienta de lectura, que **solo lee**:

```
pnpm --silent lore resumen                    cuántas fichas hay de cada tipo
pnpm --silent lore buscar <texto>             fichas por nombre, en todas las secciones
pnpm --silent lore lista <tipo> [estado]      todas las de un tipo
pnpm --silent lore ficha <tipo> <id|nombre>   una ficha completa: campos, conexiones, fechas, notas
pnpm --silent lore menciones <texto>          dónde aparece un texto dentro de las fichas y notas
pnpm --silent lore campos <tipo>              qué campos, conexiones y fechas admite un tipo
pnpm --silent lore catalogo [campo]           las opciones de un desplegable
```

Cómo trabajar:

1. Busca antes de responder. No contestes de memoria ni de lo hablado en otros
   chats: el autor puede haber cambiado la ficha desde el panel.
2. Para "¿quién pertenece a X?" lee la ficha de X: sus conexiones las listan
   desde su lado. Para lo que no es una conexión, usa `menciones`.
3. Responde en español y cita las fichas (`Alhaitham, personaje #33`).
4. Distingue lo publicado de lo que no: la salida marca `[borrador]` u
   `[oculto]`, el 🔒 señala un campo, una conexión o una fecha ocultos al público,
   `[[oculto]]…[[/oculto]]` es un trozo oculto de un texto y las notas de autor son
   privadas. Todo eso es material del autor: puedes usarlo con él, pero
   dilo cuando un dato no sea público.
5. Si falta información o algo no cuadra (una edad que no casa con la fecha,
   dos fichas que se contradicen), dilo y ofrece `/lore-fichas` para proponer
   el cambio, `/lore-entrevista` para preguntarle al autor o `/lore-revisar` para
   auditar todo el tema.

Nunca escribas en la base. Si el autor pide cambiar algo, eso es
`/lore-fichas`: se propone en un archivo y lo aplica él.
