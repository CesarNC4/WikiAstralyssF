import { pgTable, serial, integer, varchar, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Arista genérica ficha↔ficha.
 *
 * Las relaciones con campos propios (la rareza de un drop, el rango dentro de
 * una organización) siguen teniendo su tabla tipada y su clave foránea. Esta
 * tabla cubre el resto: las que solo necesitan saber de qué tipo de vínculo se
 * trata y una nota. A cambio de no poder llevar clave foránea —el destino es
 * polimórfico— permite añadir una relación nueva escribiendo una entrada en
 * `lib/relaciones/registro.ts`, sin migrar la base.
 *
 * Los huérfanos se limpian por código (ver `lib/relaciones/purga.ts`), igual
 * que ya se hacía con `entidad_media`.
 */
export const vinculo = pgTable(
  "vinculo",
  {
    id: serial("id").primaryKey(),
    /** Key de entidad del lado que se declaró como origen en el registro. */
    origenTipo: varchar("origen_tipo").notNull(),
    origenId: integer("origen_id").notNull(),
    destinoTipo: varchar("destino_tipo").notNull(),
    destinoId: integer("destino_id").notNull(),
    /** Qué clase de vínculo es: "sede", "menciona", "montura"… */
    relacion: varchar("relacion"),
    /** Matiz elegido dentro de esa relación: "Sede", "Montura", "Rival"… */
    tipo: varchar("tipo"),
    nota: varchar("nota"),
    orden: integer("orden").notNull().default(0),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("vinculo_origen_idx").on(t.origenTipo, t.origenId),
    index("vinculo_destino_idx").on(t.destinoTipo, t.destinoId),
    index("vinculo_relacion_idx").on(t.relacion),
  ],
);
