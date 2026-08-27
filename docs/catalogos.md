# Los catálogos

Las listas que alimentan todos los desplegables de la wiki, y por qué están así.

## El problema que resuelve

Los desplegables ya guardaban sus opciones en una tabla (`catalogos`), pero la
fuente de verdad era un archivo de código y sincronizarla exigía correr un seed
**en modo espejo estricto**: lo que no estuviera en el archivo se borraba de la
base. Añadir una opción pedía editar código, desplegar y abrir una terminal.

Además había tres desplegables declarados en el admin que **no existían en la
base**: `capitulo_tipo`, `capitulo_tipo_temporal` y `cancion_fuente`. Al abrirlos
decían "Sin opciones" y no había forma de elegir nada.

Y el cargador genérico **descartaba la columna `grupo`**. Eso tenía una
consecuencia visible: en la ficha de Magia salían las variantes de todas las
escuelas mezcladas, porque la dependencia vive justo en el grupo.

## Cómo funciona ahora

**La tabla manda.** `catalogos` es la fuente de verdad y se edita desde
`/admin/catalogos`. `lib/catalogos.ts` pasa a ser la semilla: siembra lo que
falta, corrige el orden y **no borra nada**.

**Se puede escribir un valor nuevo en el propio desplegable.** Se guarda en el
catálogo y queda disponible para todas las fichas, así que la comodidad del
texto libre no ensucia los filtros.

**Renombrar arrastra el dato.** Cambiar "Raro" por "Poco habitual" actualiza
todas las fichas que lo usaban. Sin ese arrastre, renombrar dejaría el
desplegable en blanco en cada ficha afectada. Es lo que hace `USOS_DE_CATALOGO`
en `lib/admin/catalogosMeta.ts`: dice en qué `[tabla, columna]` vive cada
catálogo.

**Borrar vacía el campo y lo dice.** Las fichas afectadas quedan incompletas y el
panel avisa de cuántas son. Es preferible a dejar un valor que el desplegable ya
no reconoce y muestra en blanco sin explicar por qué.

## Los dos papeles del `grupo`

| Papel | Qué hace | Ejemplos |
|---|---|---|
| **Dependencia** | Solo se ofrecen las opciones del grupo elegido en otro campo. | La variante de un artefacto depende de su tipo; el subtipo de una relación, de su tipo. |
| **Agrupación** | Todas las opciones son elegibles; el grupo las ordena en el desplegable y sirve de filtro en la web. | Las familias de organización; las de la cronología. |

Lo decide quien renderiza, con `grupoActivo`: `undefined` significa "enséñalo
todo, agrupado"; un valor concreto, "solo ese grupo"; y `null`, "depende de un
campo que aún está vacío", en cuyo caso el desplegable se queda a propósito sin
opciones en vez de ofrecerlas todas mezcladas.

## Catálogos compartidos

Un mismo catálogo puede alimentar varias fichas, y esa es justo la gracia: hace
que "Raro" signifique lo mismo en un mineral que en un artefacto, y que los
colores y filtros se puedan cruzar.

| Catálogo | Lo usan |
|---|---|
| `rareza` | Minerales, artefactos, razas, drops de bestias |
| `estado_vital` | Personajes, lords demonio, árbol genealógico |
| `dieta` | Razas, bestias |
| `clima`, `terreno` | Naciones, regiones |
| `era` | Lords demonio, cronología |
| `libro`, `tipo_temporal` | Capítulos, arcos |
| `estado_narrativo` | Actos, hojas de trama, hilos narrativos |
| `rango_aventurero` | Personajes, rango mínimo de misiones |

## Los elementos son aparte

El catálogo elemental **no vive en `catalogos`** sino en su propia tabla
`elementos`, porque es más que una etiqueta: tiene color, icono y ficha, y las
fichas se vinculan a él por `entidad_elemento`. Gracias a eso el elemento sabe
quién lo usa sin que haya que editarlo desde su lado, y la afinidad de una raza o
un mineral puede ser más de una.

Los 14 elementos están repartidos en cinco familias (Elementales, Antiguos,
Oscuros, Sacros, Sin elemento). La familia agrupa el desplegable, filtra en la
web y decide **qué variantes ofrece cada escuela de magia**: "Antigua" da Lumino
y Umbra; "Elemental", los siete elementales.

"Magia Oscura" y "Umbra" son cosas distintas del lore y conviven a propósito.

## Añadir un catálogo

```ts
// lib/catalogos.ts
export const CATALOGOS = {
  mineral_estado: ["Abundante", "En explotación", "Escaso", "Agotado"],
};
```

```ts
// lib/admin/fields.ts — el desplegable en la ficha
f("estado", "Disponibilidad", "combobox", "Datos clave", { catalogCampo: "mineral_estado" }),
```

```ts
// lib/admin/catalogosMeta.ts — para que renombrar arrastre el dato
mineral_estado: [["minerales", "estado"]],
```

Y para uno agrupado, en `CATALOGOS_AGRUPADOS`, con `dependeDe` en el campo si el
grupo es una dependencia y no solo una agrupación visual.

## Comprobar que cuadra con la base

```bash
node --env-file=.env.local scripts/verificar-catalogos.mjs
```

Comprueba tres cosas que si no solo se notarían en tiempo de ejecución, y tarde:
que las columnas declaradas existan, que ningún desplegable del admin se quede
sin opciones, y que ninguna ficha guarde un valor que su catálogo ya no reconoce.
Sale con código 1 si algo no cuadra.

## Archivos

| Archivo | Qué es |
|---|---|
| `lib/catalogos.ts` | **La semilla.** Las listas y los pares inversos de relación. Client-safe. |
| `lib/elementos.ts` | La semilla del catálogo elemental, con familias, color e icono. |
| `lib/admin/catalogosMeta.ts` | Nombres legibles y **dónde se usa cada catálogo**. Client-safe. |
| `lib/actions/catalogos.ts` | Crear, renombrar, reordenar y borrar. Todos con `assertAdmin`. |
| `components/admin/CatalogosEditor.tsx` | La pantalla de `/admin/catalogos`. |
| `components/admin/fields.tsx` | `Select` (con grupos y añadir al vuelo) y `MultiSelect`. |
