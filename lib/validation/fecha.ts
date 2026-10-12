import { z } from "zod";

/** Forma de una fecha del lore al cruzar la red (ver `lib/fechas/tipos.ts`). */
const Extremo = z.object({
  anio: z.number().int(),
  segmentoId: z.number().int().nullable(),
  dia: z.number().int().min(1).nullable(),
});

export const FechaSchema = z.object({
  ini: Extremo,
  fin: Extremo.nullable(),
  aproximada: z.boolean(),
});
