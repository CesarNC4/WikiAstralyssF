---
name: lore-relato
description: Escribir con el autor de Astralys piezas de la historia para Discord (escenas, combates, descripciones, capítulos, interludios sin los protagonistas, cuentos del pasado, capítulos dedicados a un personaje), fase por fase y escena a escena, con su memoria en lore/relatos/. Úsalo cuando el autor quiera escribir, continuar, corregir o montar para Discord una pieza narrativa, o retomar una que quedó a medias.
---

# Relatos

El autor narra la historia en Discord y quiere construirla contigo **fase por
fase y escena a escena**, con el máximo detalle. Nunca se escribe una pieza
entera de una vez: cada paso se enseña, se corrige y se aprueba antes del
siguiente.

## El reparto

- **La wiki es el mapa**: qué pasa, quién, dónde y cuándo. Capítulos y actos
  (sin prosa), fragmentos con su enlace de Discord, arcos, hojas de trama e
  hilos. Se lee con `/lore` y se cambia con propuestas (`/lore-fichas`).
- **`lore/relatos/` es la obra** (fuera de git): la prosa y lo que hace falta
  para escribirla y la wiki no guarda. Ahí no se copia lore: se lee de la wiki
  cada vez.

| Archivo | Qué guarda |
|---|---|
| `README.md` | El reparto y la estructura, para el autor |
| `voz.md` | Cómo escribe el autor y cómo quiere que suene, con sus correcciones |
| `continuidad.md` | Lo ya contado: qué sabe el lector, quién sabe qué, cómo quedó cada personaje y las semillas sembradas |
| `ideas.md` | Escenas y cuentos para algún día |
| `piezas/AAAA-MM-DD-<nombre>/` | Una pieza: `pieza.md`, `guion.md`, `escenas/` y `discord.md` |

## Al empezar o retomar

1. Lee `lore/relatos/voz.md` y `lore/relatos/continuidad.md`.
2. Si se retoma una pieza, lee su `pieza.md`: dice en qué fase está y qué
   falta. Sigue desde ahí y no rehagas lo aprobado.
3. Lee el lore que toque, en este orden:
   - `lore/canon/canon.md`, mientras dure la reconstrucción: manda sobre la wiki;
   - la wiki (`/lore`): las fichas de quien salga, del lugar y del momento y, si la
     pieza sigue a otra, el capítulo, el acto y sus hilos;
   - los textos del autor (`lore/canon/textos-del-autor.md`);
   - lo que ya vieron los jugadores (`lore/discord/`).

## Las fases

**No se pasa de fase ni de escena sin el visto bueno del autor.** Al cerrar
cada paso, deja `pieza.md` al día (fase, fecha y lo decidido), para que otro
chat pueda retomarla.

### 1. Planteamiento

Cuéntale primero, en pocas líneas, lo que ya dice la wiki del tema. Después
acordad, en tandas de preguntas con opciones (AskUserQuestion):

- qué es: escena, combate, descripción, capítulo, interludio sin los
  protagonistas, cuento del pasado o capítulo de un personaje;
- dónde encaja: libro, capítulo y acto de la wiki, o pieza suelta;
- cuándo (fecha del mundo, por eras) y dónde;
- quién sale y desde qué punto de vista;
- qué tiene que pasar y cómo termina;
- qué **no** se puede revelar: los lectores son los jugadores;
- tono, extensión y canal de Discord.

Crea la carpeta de la pieza con su `pieza.md`:

```markdown
# <Título provisional>

- Tipo:
- Encaja en:
- Fecha del mundo:
- Lugar:
- Personajes:
- Punto de vista:
- Tiene que pasar:
- Termina:
- No se revela:
- Tono y extensión:
- Canal:

## Estado
- Fase: 1. Planteamiento
- Escenas:

## Decisiones
- AAAA-MM-DD: …

## Preguntas abiertas
- …
```

### 2. Guion

En `guion.md`, las escenas numeradas. De cada una: propósito, punto de vista,
lugar y momento, los pasos en orden, cómo termina y qué siembra o paga.
Todavía sin prosa. Se enseña entero y se ajusta hasta que el autor lo apruebe.

### 3. Escena a escena

Cada escena va en `escenas/NN-<nombre>.md` y pasa por tres tiempos:

1. **Preparación**: cómo llegan los personajes (heridas, ánimo, qué saben), el
   lugar con el detalle de los sentidos, qué quiere cada uno y qué se lo
   impide, y los pasos finos. El autor la aprueba o la corrige.
2. **Texto**: solo esa escena, entera en el chat y en el archivo.
3. **Correcciones**, hasta que el autor la dé por buena. Lo que corrija de
   estilo va a «Correcciones del autor» en `voz.md`.

La voz no es una jaula: el autor quiere ir construyéndola y probar cosas.
Cuando veas otra forma de contar una escena que pueda enriquecerla (otro punto
de vista, otro ritmo, otra estructura), ofrécela como opción junto al texto, no
en su lugar.

Cierra cada escena con una lista corta de **detalles nuevos**: lo que no salía
de la wiki (un nombre, una cicatriz, un objeto), para que el autor sepa qué se
añadió. Solo entonces se pasa a la siguiente.

```markdown
# Escena NN: <nombre>

## Preparación
## Hoja de combate
## Texto
## Detalles nuevos
## Estado
```

**Combates.** La preparación lleva una **hoja de combate**:

- cada combatiente, con lo que puede hacer y sus límites, sacados de la wiki
  (habilidades, magia, armas, artefactos y estadísticas si están rellenas);
- el terreno y lo que se puede usar de él;
- qué quiere cada bando, y el resultado con lo que cuesta (heridas, pérdidas);
- los intercambios en orden: tanteo, escalada, giro, clímax y desenlace.

Nadie usa un poder que no esté en la wiki o que no haya aprobado el autor. Si a
un poder le faltan los límites, pregunta con 2 o 3 opciones.

**Capítulo de un personaje.** Lee su ficha entera: personalidad, historia y
relaciones. Cómo habla se apunta en `voz.md` cuando el autor lo fije.

**Cuento del pasado.** Va con la voz de leyenda de `voz.md`. Los cuentos son
leyendas con verdad: apunta en `pieza.md` qué es cierto y qué es rumor, y que
lo decida el autor.

### 4. Repaso

Con todas las escenas aprobadas, repasa el conjunto:

- la continuidad, contra la wiki y `continuidad.md`;
- el ritmo y las transiciones;
- las palabras y las imágenes repetidas entre escenas;
- **qué revela la pieza** frente a lo oculto de la wiki: 🔒, `[[oculto]]`, notas
  de autor y borradores.

Enseña lo que encuentres y corrige solo lo que apruebe.

### 5. Versión para Discord

En `discord.md`, la pieza entera con el formato de Discord que dice `voz.md`.
No se parte en mensajes ni se cuentan caracteres: el autor la corta al
publicarla, y en el canal se lee completa.

En el chat va en bloques de código (` ```text `), uno por escena, para que al
copiarla conserve los `**`, `*` y `>` que Discord necesita.

### 6. Cierre

Cuando el autor lo haya publicado:

1. En `continuidad.md`: qué se contó, qué sabe ahora el lector, quién sabe qué,
   cómo quedan los personajes y las semillas, con sus palabras exactas.
2. En `ideas.md`: lo que haya salido para más adelante.
3. Pregunta qué pasa a la wiki y propónlo con `/lore-fichas`:
   - el capítulo o el acto, con sus fragmentos (POV, enlace del mensaje de
     Discord y fecha);
   - los hilos que se abren o se cierran;
   - los hechos nuevos que el autor dé por canon;
   - quitar el candado a lo que la pieza haya revelado.
4. En `pieza.md`: «Publicada», con la fecha.

## Reglas

- **Nutre.** Lo que da el autor es el esqueleto: la prosa, los gestos, el
  detalle de los sentidos y los diálogos los pones tú, con su voz. Los hechos
  de peso (muertes, parentescos, afiliaciones, giros, secretos y poderes) se
  preguntan con 2 o 3 opciones y nunca se deciden solos.
- **Personajes de jugador** (la lista está en `lore/guia-de-estilo.md`): no
  decidas lo que hacen, dicen o sienten más allá de lo ya jugado o de lo que
  confirme el autor. Si la escena lo necesita, pregunta.
- **Nada se pierde.** `lore/` no está en git: antes de reescribir un texto
  aprobado, guarda la versión anterior en `escenas/anteriores/`. Nunca borres
  una pieza ni una escena si el autor no lo pide.
- **Nada de lore en el repositorio**: todo va en `lore/relatos/`. Lo que se
  cuenta no es canon hasta que el autor lo diga.
