# Taller del autor — especificación

> Documento de trabajo, cerrado con el autor el 2026-10-11 tras varias rondas de
> preguntas. Fija **qué** se quiere. Todavía no hay plan de implementación.
> Las capturas de StoryCamp son **solo referencia de diseño**: no se importa
> ningún dato de StoryCamp.

## Índice

1. [Vocabulario](#1-vocabulario)
2. [El taller: ubicación y menú](#2-el-taller-ubicación-y-menú)
3. [Capítulos](#3-capítulos)
4. [Actos](#4-actos)
5. [Escribe](#5-escribe)
6. [Organizar capítulos](#6-organizar-capítulos)
7. [Estructura](#7-estructura)
8. [Arcos, hojas e hilos](#8-arcos-hojas-de-trama-e-hilos)
9. [Estadísticas y papelera](#9-estadísticas-y-papelera)
10. [Universo: personajes](#10-universo-personajes)
11. [Mapa de relaciones y Atlas](#11-mapa-de-relaciones-y-atlas)
12. [Comparador de alturas](#12-comparador-de-alturas-público)
13. [Fechas, eras y calendario](#13-fechas-eras-y-calendario)
14. [Cronología](#14-cronología)
15. [Datos existentes y migración](#15-datos-existentes-y-migración)

---

## 1. Vocabulario

| StoryCamp | Astralys |
|---|---|
| "Capítulo" de la lista *Escribe* ("Despertar de Aqua") | **Acto** |
| Carpeta de *Organizar capítulos* ("PROLOGO", "CAPITULO 1…") | **Capítulo** |
| Columnas del tablero (*Presentación / Nudo / Desenlace*) | **Fases** de una **plantilla de estructura** |

Un capítulo contiene varios actos. "Acto" se refiere siempre a la entidad
`actos`, nunca a una fase de la estructura.

## 2. El taller: ubicación y menú

- Vive en **`/admin/taller`**, a **pantalla completa**, con su propio menú lateral
  en lugar del sidebar del admin. Usa el mismo login de autor.
- **Solo escritorio.** En móvil no tiene que funcionar.
- Capítulos, actos, arcos, hojas de trama e hilos **salen del admin genérico**
  (`/admin/[entidad]`) y se editan **solo** desde el taller.

| Sección | Contenido |
|---|---|
| Escribe | Lista de actos y editor de actos (§5) |
| Capítulos | Organizar libro > capítulo > acto (§6) |
| Estructura | Plantillas y tablero de fases (§7) |
| Trama | Arcos, hojas de trama e hilos (§8) |
| Universo | Personajes, mapa de relaciones y calendario (§10, §11, §13) |
| Estadísticas | §9 |
| Papelera | §9 |

Exportar, Feedback y Ajustes de StoryCamp **no** entran. De las pestañas de
Universo de StoryCamp solo entran Personajes (con el mapa de relaciones) y
Calendario/Cronología.

## 3. Capítulos

### Numeración
- **Automática por posición**, y el contador **se reinicia en cada libro**.
- Los tipos que no cuentan (Prólogo, Interludio, Epílogo…) se marcan en el
  **catálogo `capitulo_tipo`** con una casilla "numerado sí/no".

### Plantilla obligatoria
- Todo capítulo tiene **una plantilla de estructura** (§7).
- Al crearlo viene preseleccionada la plantilla marcada como **predeterminada**,
  y se puede cambiar.

### Datos que se calculan a partir de sus actos

| Dato | Regla |
|---|---|
| Descripción | **Intro propia** + los **resúmenes de sus actos** en orden, añadidos automáticamente debajo |
| Personajes | **Solo calculados**: la unión de POV y personajes de sus actos. Desaparece el vínculo manual `capitulo_personaje` |
| Locaciones | Calculadas: la unión de las de sus actos |
| Canciones | **Manuales + calculadas**: las del propio capítulo (un opening, por ejemplo) más las de sus actos |
| Fechas de lore | **Rango**: el inicio del primer acto hasta el fin del último |

### Edición
- **Edición rápida** en un panel de Organizar (se abre al pulsar la carpeta).
- Y además una **pantalla propia** en el taller, con sus datos arriba y sus actos
  debajo.
- Campos: tipo, libro, plantilla, intro, narrador (texto o ficha), tipo de
  narrador, marco narrativo, paralelo a otro capítulo, Discord, notas privadas y
  estado de publicación.

## 4. Actos

### Contenido
- **No guarda prosa.** El texto de la historia no vive en la wiki; el acto tiene
  solo metadatos.
- **Numeración automática** por posición dentro del capítulo, **en romanos**
  (Acto I, II…). El nombre queda solo como título ("Despertar de Aqua").
- Campos:
  - nombre, resumen, estado narrativo y notas privadas del autor;
  - **fecha de inicio y de fin** estructuradas (§13);
  - **fase** de la estructura, **obligatoria y elegida al crear el acto**;
  - **POV**: uno o varios personajes con ficha;
  - **personajes que aparecen**;
  - **lugares**: varias naciones, regiones o locaciones, de cualquier nivel;
  - **arco(s) de trama**;
  - **hojas de trama e hilos**: verlos y crearlos desde el acto, incluidos los
    hilos que abre o cierra;
  - **canciones**;
  - **eventos de la cronología**;
  - **enlace de Discord** propio;
  - estado de publicación.

### Publicación
- El capítulo y el acto tienen **cada uno su estado**. Un capítulo publicado
  puede tener actos en borrador, y esos actos no se ven.
- Si el capítulo **no** está publicado, ninguno de sus actos se ve, ni siquiera
  su ficha propia.

### Ficha pública
- Ruta **`/capitulos/[id]/actos/[id]`**.
- Muestra el resumen, el POV y los personajes, los lugares y las fechas.
- Entra en la búsqueda ⌘K, el sitemap, el feed RSS y el grafo/Atlas.

## 5. Escribe

Es la lista de actos con su editor, como las capturas 1 y 2 de StoryCamp.

Filtros: libro y capítulo, POV y personaje, fase y estado narrativo, estado de
publicación, y un buscador.

## 6. Organizar capítulos

- Árbol de tres niveles: **libro > capítulo > acto**.
- El libro **sigue siendo un valor del catálogo `libro`**. Su orden es el del
  catálogo y no se reordena desde Organizar.
- Se puede:
  - **reordenar capítulos dentro de su libro**, lo que cambia su numeración;
  - **mover actos entre capítulos** y reordenarlos. Un acto que llega a un
    capítulo con otra plantilla cae en la **primera fase**.
- **No** se arrastran capítulos entre libros: el libro se cambia en el editor del
  capítulo.

## 7. Estructura

### Plantillas
- **Solo propias**: las crea el autor y ninguna viene de serie. Una de ellas se
  marca como **predeterminada**.
- Cada fase tiene **nombre, abreviatura** (la insignia de la tarjeta, como A1),
  **color** y **descripción o guía**.
- **No se puede borrar una fase en uso**: primero hay que vaciarla.

### Asignación
- **Cada capítulo tiene una plantilla** y **todo acto tiene fase**. No existe
  columna "Sin fase".
- Las fases se asignan **libremente**: el orden del acto en el capítulo no importa.
- Al **cambiar la plantilla** de un capítulo, todos sus actos pasan a la
  **primera fase** de la nueva plantilla.

### Tablero
- **Un capítulo a la vez**: una columna por fase de su plantilla, y los actos se
  arrastran entre columnas.

## 8. Arcos, hojas de trama e hilos

- **Conservan sus datos actuales**: solo cambian de sitio y ganan una pantalla
  propia en el taller.
- Las hojas y los hilos siguen siendo solo del panel, porque guardan giros y notas
  de autor.
- Novedad: el acto puede pertenecer a **varios arcos**.

## 9. Estadísticas y papelera

**Estadísticas:**
- **Avance de publicación**: capítulos y actos en borrador, publicados y ocultos,
  por libro.
- **Personajes**: apariciones, POV y quién lleva más tiempo sin salir.
- **Lugares y trama**: lugares más usados e hilos abiertos y cerrados.

**Papelera:** propia del taller, para capítulos, actos y trama.

## 10. Universo: personajes

- Una cuadrícula con **todos los personajes**.
- Filtros: **raza, nación u organización**, **estado vital** y **buscador por
  nombre**. No se añade campo de importancia (Principal/Secundario).
- Al pulsar un personaje se abre **su editor del admin** que ya existe
  (`/admin/personajes/[id]/editar`).

## 11. Mapa de relaciones y Atlas

### Alcance
- El mapa nuevo **sustituye al Atlas actual** (`/atlas`).
- Incluye **todas las entidades del registro de relaciones**: personajes,
  organizaciones, familias, naciones, regiones, locaciones, razas, bestias,
  demonios, artefactos, magia, minerales, capítulos…
- **Posiciones automáticas** por simulación de fuerzas. No se guardan
  posiciones, ni hay "sin colocar" ni "eliminar mapa".

### Atlas público
- **3D real navegable en escritorio**: se gira, se acerca y se recorre.
- **2D en móvil.**
- Cada nodo es una **esfera de color por tipo de entidad, con su nombre**.

### Mapa del taller
- **2D y editable.**
- Se pulsan dos nodos para unirlos, con cualquier par de entidades: se ofrecen
  las relaciones que el registro declara para esos dos tipos.
- Se pulsa una línea para editarla o borrarla.
- Controles: filtro por **tipo de entidad**, filtro por **categoría de
  relación**, y **buscar y centrar un nodo**.

### Categorías de relación
- Solo para las relaciones **personaje–personaje** (los 26 tipos de
  `tipo_relacion`). El resto de aristas mantiene su color actual.
- Cada categoría tiene **nombre, color, icono y estilo de línea** (continua,
  discontinua o punteada).
- Se editan en **`/admin/catalogos`**, donde cada tipo de relación se asigna a
  una categoría.

### Mini-mapa en las fichas
- Lo tienen **todas las fichas**, sustituyendo al mini-grafo actual.
- Es el mismo mapa **centrado en la ficha**, con solo sus conexiones directas,
  y **siempre en 2D**.

## 12. Comparador de alturas (público)

- Página pública en **Explorar**.
- Entran **personajes, bestias y demonios**.
- Para elegir a quién comparar se combinan **filtros** (raza, nación,
  organización) y **selección libre**.
- Figuras:
  - personajes: **silueta humana genérica**;
  - criaturas: **lista fija de formas** dibujadas en el código (humanoide,
    cuadrúpedo, alado, serpentino, amorfo…), elegida en la ficha.
- El color de cada figura es **automático y distinto** (de una paleta).
- **Escala real**, con zoom.
- **Conmutador alto / largo**: vista de alturas de pie o de longitudes de perfil.
- Las medidas se muestran **en metros**.
- **No aparece** quien no tenga altura o la tenga oculta al público.
- Campos nuevos en bestias y demonios: **altura y longitud** en metros, y
  **forma de silueta**.

## 13. Fechas, eras y calendario

### Eje absoluto
- Un único eje de años enteros con **año 0 = el inicio de la trama principal**
  (fijo). Antes, negativos; después, positivos. **El año 0 existe** (-1, 0, 1).
- Todas las fechas se guardan en este eje: así se ordenan y se comparan.

### Eras
- Cada era tiene **nombre, abreviatura y año de inicio** en el eje absoluto, y
  termina donde empieza la siguiente.
- Dentro de una era, el **año 1 es su primer año**.
- La **primera era no tiene inicio**: se extiende sin límite hacia atrás y sus
  años se cuentan **hacia atrás desde su fin** ("500 antes del fin de la E.P.").
- El catálogo `era` actual (Primordial, de los Dioses, Antigua, Actual) pasa a ser
  esta tabla de eras.

### Cómo lo ve el público
- **Conmutador del lector**: por defecto, la fecha en eras; con un interruptor,
  el eje absoluto. La elección se recuerda en su navegador.

### Precisión de una fecha
- Una fecha es un **punto o un rango**, y cada extremo tiene **su propia
  precisión**: año, año + mes, o año + mes + día. Ejemplo: "desde el 3 de Mes 2
  del año -100 hasta Mes 5 del año -98".
- Marca opcional de **aproximada** ("hacia…").
- Una fecha puede caer en un **día fuera de mes**.

### Calendario (uno para todo el mundo)
- **Meses**: nombre y número de días de cada uno.
- **Semana**: número de días y **nombre de cada día**.
- **Días fuera de mes**: bloques con nombre, número de días y posición (por
  ejemplo, "Noches de Ceniza", 3 días, entre Mes 6 y Mes 7). Puede haber varios y
  **cuentan para el ciclo semanal**.
- **No hay años bisiestos.**

Dónde vive:
- **Configuración** en el taller, en Universo > Calendario: meses, semana, días
  fuera de mes y eras.
- **Vista de calendario en el taller**: se elige un año y se ven sus meses con
  los sucesos. Desde ahí se pueden crear eventos.
- **Vista de calendario pública**, como submenú de la cronología: se alterna
  entre la línea temporal y el calendario por año.
- En la vista de un año, lo que no tiene mes (o abarca varios años) sale en una
  **franja "todo el año"** arriba.

### Qué fichas tienen fecha (global, sin huecos)

| Entidad | Fechas |
|---|---|
| Eventos de la cronología | Fecha (punto o rango) |
| Actos | Inicio y fin. El capítulo calcula su rango a partir de ellos |
| Misiones | Fecha (rango). Sin campo de duración aparte |
| Páginas de lore | Fecha |
| Lords demonio | Aparición |
| Personajes | **Nacimiento y muerte** |
| Naciones, organizaciones, familias, gremio | Fundación y disolución o caída |
| Regiones y locaciones | Fundación o descubrimiento, y destrucción |
| Artefactos | Creación y destrucción o pérdida |
| Razas y bestias | Origen o aparición, y extinción |

Cada fecha de ficha tiene una casilla de **importancia** ("mostrar en la
cronología destacada"), véase §14.

### Edad de los personajes
- Se **calcula a partir del nacimiento** según un **momento de lectura**.
- El momento por defecto es el **año 0**. Se puede cambiar a mano, y también se
  fija solo:
  - al abrir un **capítulo**: el inicio del capítulo;
  - al abrir un **acto**: el inicio del acto.
- Si el personaje murió antes de ese momento, se muestra la edad a la que murió.
- El momento de lectura **solo afecta a las edades**: no oculta spoilers.
- Si no hay fecha de nacimiento, se usa un **texto de edad manual** ("Milenaria",
  "Desconocida").

## 14. Cronología

- La cronología pública muestra los **eventos creados a mano** y además los
  **sucesos derivados de las fichas**:
  - nacimientos y muertes;
  - fundaciones y caídas;
  - capítulos y actos;
  - todo lo demás con fecha (artefactos, razas, bestias, misiones, demonios,
    lore).
- Filtros: **por tipo de suceso**, **por era** y **por entidad**.
- Por defecto solo se ven los sucesos **importantes**: los eventos con
  importancia y las fechas de ficha marcadas como importantes.
- Los eventos de la cronología se pueden ligar a un **capítulo y, opcionalmente,
  a un acto**.

## 15. Datos existentes y migración

La consulta de solo lectura a la base del 2026-10-11 encontró:

| Dato | Estado |
|---|---|
| `timeline_eventos` | 39 eventos con `fecha_lore` limpia ("-10000 a -6000", "-1799", "0"). `era` y `anio_lore` vacíos. "Inicio de la Historia" = 0 |
| Capítulos y actos | 2 capítulos ("Año -1", "Año 0") y 5 actos con inicio y fin ("Año -1", "Año 0") |
| Misiones | 1 con "19 días": es una duración, no una fecha |
| Lords demonio | 1, "-500 años" (`anio_lore` = -500) |
| Personajes | 210; solo uno tiene `edad` ("30") |
| Organizaciones | 6 con `fundacion` en texto ("Año -1000", "Año -1000 aproximadamente.", "Desconocido") |
| `capitulo_personaje` | **0 filas**: eliminarlo no pierde nada |
| `relaciones` | 2 filas |

Decisiones:
- **Conversión automática** de las fechas de texto con un script que **primero
  hace un ensayo** (enseña qué convertiría sin escribir) y **solo aplica con el
  visto bueno del autor**. Lo que no entienda ("Desconocido", "19 días") queda
  vacío y listado para revisarlo a mano.
- Los **2 capítulos existentes** se quedan como excepción temporal **sin
  plantilla** hasta que el autor la elija; el taller avisa mientras tanto.
- Los nombres de los actos pierden el prefijo "Acto I:" porque el número pasa a
  ser automático.
- `capitulo_personaje` se elimina (0 filas).
