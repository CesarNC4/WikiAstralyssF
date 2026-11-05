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
- Los de texto largo: un encabezado `### <Rótulo>` y el texto debajo. El texto no puede
  llevar encabezados `##` ni `###`, que marcan dónde acaba: de `####` para abajo sí.
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
y el valor como lo escribe la wiki, por eras: `Año 1013 de la Era Post-Ishkoria`,
`la Cuarta Luna, año 1013 de la Era Post-Ishkoria`,
`12 de la Cuarta Luna, año 1013 de la Era Post-Ishkoria`,
`Del año 3 de la Era de Ishkoria al año 40 de la Era de Ishkoria`, y `(aprox.)` al
final si es aproximada. También vale el número del eje interno (`Año -34`), que es
como lo enseña `lore ficha` entre paréntesis. `★` al final la marca como importante
para la cronología.

Algunas conexiones llevan datos propios o admiten un nombre suelto:

- Los **miembros** de una organización, familia o gremio llevan también su rango y
  su facción: `- Miembros: Kael (Rol: Capitana; Rango: Capitán; Facción: Ala Norte)`.
  Vale igual desde el personaje: `- Organizaciones: ORDEN ABISAL (Rango: Capitán)`. Un
  rango o una facción que no existan se crean al aplicar.
- Quien **no tiene ficha** se marca así, en los bloques que lo admiten (miembros,
  relaciones): `- Miembros: Anciano del valle (sin ficha; Rango: Patriarca)`.
- En los bloques que aceptan **cualquier ficha** (Menciona, Participantes…), el nombre
  va detrás de su tipo: `- Menciona: personaje Alhaitham`.

**Notas de autor.** El texto se añade a las notas privadas de la ficha.

## Listas propias de una ficha

Filas con varios datos. Un encabezado `###` con el título y una línea por fila. Los
datos van entre paréntesis y `🔒` al final oculta la fila. El orden de lectura y lo que
admite cada una lo lista `pnpm --silent lore campos <tipo>`.

| Ficha | Lista |
|---|---|
| Personaje | Habilidades, Estadísticas |
| Organización, Gremio | Rangos, Facciones, Historial |
| Familia | Rangos, Facciones, Árbol genealógico |
| Página de lore | Secciones |
| Acto | Fragmentos |

```markdown
## Personaje: Kael Varn · nueva

### Habilidades
- Puño de Ceniza (Categoría: Técnica; Tipo: Elemental; Elemento: Pyro): Lo que hace. 🔒

### Estadísticas 🔒
- Fuerza: 7
- Ataque físico: 120
- C. a cuerpo: S

## Organización: ORDEN ABISAL · nueva

### Rangos
- Gran Maestre
- Capitán

### Facciones
- Ala Norte (Color: #5b8def)

### Historial
- Fundador (Rol: Líder; Periodo: Era vieja; Estado: Fallecido; Destacado: Fundó la orden; Notas: …) 🔒

## Familia: CASA VARN · nueva

### Árbol genealógico
- Aldric Varn (Generación: 0; Estado: Fallecido)
- Kael Varn (Generación: 1; Padre: Aldric Varn; Madre: Mira Varn; Destacado: Heredero) 🔒

## Página de lore: Un tema · nueva

### Sección: Un apartado (Tipo: Cita) 🔒
Una sección por encabezado, con su texto debajo.

## Acto: Despertar · nueva
- Capítulo: Prólogo

### Fragmentos
- Primer tramo (POV: Aqua; Enlace: https://…; Fecha: Año 3) 🔒
- (POV: Lloyd)
```

- **Habilidades:** si el nombre es una magia que existe, se enlaza; si no, se crea en
  borrador, igual que en el formulario. Lo que sigue a los dos puntos es la nota propia
  del personaje.
- **Estadísticas:** `🔒` va en el encabezado y las oculta todas. El poder de combate se
  calcula solo.
- **Rangos:** de arriba abajo, como en el formulario. Los que ya existían y no salen en
  la lista se quedan debajo. Rangos y facciones no admiten `🔒`.
- **Historial y árbol:** el nombre se enlaza a la ficha del personaje si hay una; si no,
  queda como nombre suelto. Padre y madre se buscan entre las personas de ese árbol.
- **Secciones:** `🔒` deja la sección como oculta. Las tablas van en Markdown (`| a | b |`).
- **Fragmentos:** el título es opcional. `🔒` oculta el POV y la fecha, y con ellos el POV
  que entra en el bloque del acto y la fecha del acto, que los delatarían.

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
- En una lista, `- quitar <Nombre>` quita esa fila. Una sección, con
  `- quitar Sección: <Título>` entre los campos de la cabecera.
- Una fila que ya existe (mismo nombre) se actualiza: lo que no se menciona se conserva.

## Lo que no es una ficha

En `taller.md`, lo que todavía no tiene sitio (una idea, una escena, una duda
sin resolver) va como:

```markdown
## Suelto: La traición de la Orden
Texto libre.
```

La bandeja no lo aplica sola: el autor decide si va a una hoja de trama, a las
notas de una ficha o a la basura.

## Al aplicarla

La bandeja (`/admin/propuestas`, docs/area-ia.md) enseña cada ficha frente a lo que hay y
deja elegir por dato: **Visible**, **Oculto**, **A notas**, **Descartar** o **Luego**, editando
el valor antes. Lo que no entiende no lo pierde: se queda en el archivo hasta que el autor
decida. Lo aplicado se quita del archivo, lo dejado para luego se queda bajo
`## <Tipo> #<id>: <Nombre> · cambios`, y un archivo sin nada pendiente se borra.

## Reglas para Claude al escribir

- Nada inventado: lo que no salga del autor o de la wiki, se pregunta. Si se
  deduce algo, se dice en las notas de autor ("deducido de…"). La excepción es
  cuando el autor pide nutrir un texto (lo regula la guía de estilo).
- Antes de proponer una ficha nueva, `buscar` que no exista ya con otro nombre.
- Respetar `lore/guia-de-estilo.md`.
- Lo que la guía pone oculto por defecto va con 🔒; en la duda, se pregunta.
  Decide el autor.
