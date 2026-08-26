# El sistema de relaciones

Cómo se conecta todo en Astralys, y por qué está montado así.

## El problema que resuelve

Cada arista del mundo —"este personaje pertenece a esta organización"— estaba
descrita **siete veces** en el código, y siempre en una sola dirección:

1. el schema de Drizzle
2. `db/relations.ts` (para la API relacional)
3. `lib/admin/relacionesTables.ts` (qué tabla, quién es el dueño)
4. `lib/admin/relaciones.ts` (cómo se ve el editor)
5. una consulta a mano en `lib/queries/fichas.ts` o `mundoRelaciones.ts`
6. el componente de la ficha pública
7. `lib/queries/atlas.ts`

El resultado era una wiki conectada a medias de forma irregular: la ficha de
organización sí listaba sus personajes, la de nación no listaba sus
organizaciones desde el lado del personaje, y el Atlas —que se presenta como "el
grafo de relaciones del mundo"— tenía cinco tipos de nodo y **no incluía
personajes**, la sección más poblada del sitio.

Y sobre todo: **sólo se podía escribir desde un lado**. Para vincular treinta
personajes a una organización había que abrir treinta fichas de personaje, una
por una.

## Cómo funciona ahora

Cada relación se declara **una vez** en `lib/relaciones/registro.ts`, con nombre
para sus dos extremos. De esa declaración salen solos:

- el editor en la ficha A,
- el editor espejo en la ficha B,
- los bloques de las dos fichas públicas,
- las aristas del Atlas y del mini-grafo de cada ficha.

**55 declaraciones producen 206 bloques.** Añadir una relación es escribir una
entrada; aparece en las dos fichas sin tocar ninguna página.

## Los tres medios de guardado

| Medio | Cuándo | Dónde vive |
|---|---|---|
| `tabla` | La relación tiene campos propios: la rareza de un drop, el rango dentro de una organización. | Su tabla N:M, con claves foráneas reales. |
| `vinculo` | Sólo necesita saber de qué tipo es el vínculo y una nota. | La tabla genérica `vinculo`. **No requiere migración** para añadir relaciones nuevas. |
| `referencia` | Una columna de clave foránea: la raza de la que deriva otra, la moneda de un mineral. | La propia tabla de la entidad. |

El destino de `vinculo` es polimórfico y por eso no puede llevar clave foránea;
la integridad se mantiene por código con `purgarVinculosHuerfanos()`, igual que
ya se hacía con `entidad_media`.

## Reglas que importan

**Guardado por diferencias.** Cada alta, baja o cambio es una operación sobre esa
fila concreta, nunca una reescritura del bloque entero. Es obligatorio: el otro
extremo puede estar editándose a la vez, y el modelo anterior —borrar todo lo del
dueño y reinsertar— habría hecho que guardar una ficha borrase en silencio los
vínculos creados desde la otra.

**Las operaciones van por id de fila.** Los vínculos duplicados están permitidos
a propósito (un personaje puede pertenecer dos veces a la misma organización, en
épocas distintas), así que la pareja origen-destino no identifica una fila.

**Recíprocas con término inverso.** Marcar A como "Vasalla" de B deja a B como
"Soberana" de A. Los tipos simétricos ("Aliada", "Rival") se copian tal cual: lo
que no aparece en el mapa de inversos se mantiene, que es justo lo correcto.

**Editar el reverso escribe en la otra ficha.** En las referencias simples, añadir
una sub-raza desde la ficha madre escribe `raza_padre_id` en la ficha hija.

**Una relación reflexiva N:M da un solo bloque**, porque el reflejo ya muestra los
dos sentidos. Una referencia reflexiva da **dos**: "de quién deriva" y "qué deriva
de esto" son listas distintas.

## Archivos

| Archivo | Qué es |
|---|---|
| `lib/relaciones/tipos.ts` | Tipos del registro. Client-safe. |
| `lib/relaciones/registro.ts` | **Las 55 declaraciones.** Client-safe: aquí se añade una relación nueva. |
| `lib/relaciones/tablas.ts` | Mapeo a tablas y columnas de Drizzle. Server-only. |
| `lib/relaciones/consultas.ts` | Lectura y escritura genéricas, reflejo recíproco, clonado y purga. |
| `lib/relaciones/omisiones.ts` | Bloques que una ficha pública ya pinta a mano, para no duplicarlos. |
| `lib/actions/vinculos.ts` | Endpoints del admin. Todos con `assertAdmin`. |
| `components/admin/vinculos/` | Panel lateral, editor de bloque y buscador de fichas. |
| `components/fichas/Conexiones.tsx` | Una línea por ficha pública: bloques + mini-grafo. |

## Añadir una relación

```ts
// lib/relaciones/registro.ts
{
  id: "personaje_bestia",
  medio: "vinculo",
  relacion: "personaje_bestia",
  a: { entidad: "personajes", titulo: "Bestias", icon: "PawPrint", orden: 37 },
  b: { entidad: "bestias", titulo: "Personajes", icon: "Users", orden: 24 },
  campos: [
    { name: "tipo", label: "Vínculo", tipo: "select", opciones: ["Montura", "Familiar", "Némesis"], destacado: true },
    { name: "nota", label: "Nota", tipo: "text" },
  ],
}
```

Con eso el personaje gana un bloque "Bestias", la bestia gana uno "Personajes",
ambos aparecen en las fichas públicas y las aristas entran en el Atlas.

Si la relación necesita campos propios, crea su tabla con sus claves foráneas y
regístrala también en `lib/relaciones/tablas.ts`.

## Comprobar que el registro cuadra con la base

```bash
node --env-file=.env.local scripts/verificar-relaciones.mjs
```

Comprueba contra `information_schema` que cada tabla, columna, campo y referencia
declarados existen de verdad. Sale con código 1 si algo no cuadra, así que sirve
en un hook o en integración continua. Un error de tecleo en un nombre de columna
sólo se notaría en tiempo de ejecución sin esto.
