# Formato de las propuestas de lore

Cómo escribe Claude lo que propone (docs/area-ia.md) y qué entiende la bandeja
de propuestas del panel. Es Markdown normal: el autor lo lee y lo puede
corregir a mano antes de aplicarlo.

Los rótulos de los campos son **exactamente los del formulario del panel**:
salen de `lib/propuestas/moldes.ts`, y `pnpm --silent lore campos <tipo>` los lista
con sus opciones. `pnpm --silent lore ficha <tipo> <nombre>` escribe una ficha que ya
existe en este mismo formato.

## Archivos

Viven en `lore/propuestas/` (fuera de git: el repositorio es público). Uno por
área; cada archivo existe solo mientras tiene algo pendiente, y el autor borra
cada propuesta al aplicarla.

| Archivo | Fichas |
|---|---|
| `personajes.md` | personajes |
| `naciones-y-lugares.md` | naciones, regiones, locaciones |
| `organizaciones.md` | organizaciones, familias, gremio |
| `razas-y-criaturas.md` | razas, bestias, lords demonio |
| `magia-y-objetos.md` | conceptos, magia, elementos, artefactos, minerales, economía |
| `historia.md` | eventos de la cronología, misiones, páginas de lore |
| `taller.md` | capítulos, actos, arcos, hojas de trama, hilos, y lo suelto |
| `musica.md` | canciones |

Las propuestas nuevas se añaden **al final** del archivo, con una línea que
dice de dónde salen:

```markdown
<!-- 2026-11-03 · entrevista sobre la Orden Abisal -->
```

## Una ficha

```markdown
## Personaje: Kael Varn · nueva
- Estado: borrador
- Apellido: Varn
- Género: Masculino
- Ocupación: Aventurero
- Edad (texto): 34 🔒

### Historia
Párrafos en markdown, tal cual irán en la ficha.

### Conexiones
- Organizaciones: ORDEN ABISAL (Rol: Ex miembro) 🔒
- Nació en (nación): SYLVATERRA
- Relaciones: Alhaitham (Relación: Rival)

### Fechas
- Nacimiento: Año -34 🔒

### Notas de autor
Lo que solo ve el autor: por qué lo traicionaron, qué se revelará y cuándo.
```

**Cabecera.** `## <Tipo>: <Nombre> · nueva` para una ficha que no existe, y
`## <Tipo> #<id>: <Nombre> · cambios` para una que existe. `<Tipo>` es el
singular del panel (Personaje, Nación, Hoja de trama…).

**Campos.**

- Los de una línea: `- <Rótulo>: <valor>`.
- Los de texto largo: un encabezado `### <Rótulo>` y el texto debajo.
- Las opciones de catálogo se escriben tal cual aparecen en el catálogo. Si
  hace falta una opción nueva, se marca: `- Ocupación: Cartógrafo (opción nueva)`.
- `Estado` (borrador, publicado u oculto) es solo una sugerencia: decide el
  autor al aplicar.

**🔒 al final** de un campo, una conexión o una fecha (o de su encabezado
`###`) propone **aplicarlo oculto al público**: queda en la ficha, pero solo lo
ve el autor.

**Trozos ocultos.** Dentro de un texto largo, `[[oculto]]…[[/oculto]]` oculta solo
esa parte: el público lee "???" en su lugar. Sirve para lo que aún no ha salido
en la historia de un texto que ya se conoce en parte.

**Identidad oculta.** En un personaje, `Nombre` es el alias que conocen los
lectores y `Nombre real` el verdadero, que va oculto hasta que el autor lo revela.

**Conexiones.** `- <Título del bloque>: <Nombre de la otra ficha> (<Campo>: <valor>; …)`.
El título es el del bloque en el panel desde ESTA ficha (los lista
`pnpm --silent lore campos <tipo>`). La otra ficha puede existir o ser nueva en la
misma propuesta. Si el nombre es ambiguo, se añade su id: `Lloyd #45`.

**Fechas.** `- <Fecha>: <valor>` con el rótulo del panel (Nacimiento, Fundación…)
y el valor como lo escribe la lectura absoluta de la wiki: `Año 1203`,
`Mes 3, año 1203`, `20 de Mes 3, año 1203`, `Del año 10 al año 15`, y
`(aprox.)` al final si es aproximada. `★` al final la marca como importante
para la cronología.

**Notas de autor.** El texto se añade a las notas privadas de la ficha.

## Cambios en una ficha que existe

Solo se escribe lo que cambia:

```markdown
## Personaje #33: Alhaitham · cambios
- Ocupación (detalle): Gran Escriba del Consejo

### Miedos
Texto nuevo: sustituye al que hubiera.

### Historia (añadir)
Este párrafo se añade al final de la historia actual, sin tocar lo que ya hay.

### Conexiones
- Relaciones: Kael Varn (Relación: Rival)
- quitar Objetos en propiedad: Clorofilo Refulgente
```

- `(añadir)` tras el rótulo de un texto largo: se añade al final en lugar de
  sustituir.
- `- <Rótulo>: (vaciar)` deja el campo vacío.
- `- quitar <Título del bloque>: <Nombre>` quita una conexión.

## Lo que no es una ficha

En `taller.md`, lo que todavía no tiene sitio (una idea, una escena, una duda
sin resolver) va como:

```markdown
## Suelto: La traición de la Orden
Texto libre.
```

La bandeja no lo aplica sola: el autor decide si va a una hoja de trama, a las
notas de una ficha o a la basura.

## Reglas para Claude al escribir

- Nada inventado: lo que no salga del autor o de la wiki, se pregunta. Si se
  deduce algo, se dice en las notas de autor ("deducido de…"). La excepción es
  cuando el autor pide nutrir un texto (lo regula la guía de estilo).
- Antes de proponer una ficha nueva, `buscar` que no exista ya con otro nombre.
- Respetar `lore/guia-de-estilo.md`.
- Lo que la guía pone oculto por defecto va con 🔒; en la duda, se pregunta.
  Decide el autor.
