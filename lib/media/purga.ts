import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets } from "@/db/schema/media";
import { borrarDeCloudinary } from "@/lib/cloudinary";

/** postgres-js devuelve el array de filas directamente; otros drivers, `{ rows }`. */
function filas<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as T[];
}

/**
 * Borra de Cloudinary y de `media_assets` todo asset que ya no referencie nadie.
 *
 * Es recolección de basura, no borrado dirigido, y ahí está la gracia: da igual
 * cómo desapareciera la referencia (cambiaste la imagen de una ficha, quitaste
 * una de la galería, borraste la entidad entera). Todos los caminos acaban aquí,
 * así que no hay que acordarse de purgar en cada sitio que borra algo.
 *
 * Un asset cuenta como referenciado si aparece en `entidad_media` o en alguna
 * columna `imagen_asset_id` / `banner_asset_id`. Esas columnas se buscan en
 * `information_schema` y NO en el schema de Drizzle: varias tablas las tienen en
 * la base pero no las declaran en Drizzle (se escriben con SQL crudo desde
 * `guardarEntidad`), así que fiarse del schema borraría imágenes en uso.
 *
 * No es `"use server"` a propósito: lo llaman las acciones de guardado, que ya
 * han comprobado que quien pide es el admin. Exportarlo como Server Action
 * añadiría un endpoint de red y una segunda consulta de sesión por guardado.
 *
 * Devuelve cuántos assets se purgaron.
 */
export async function purgarMediosHuerfanos(): Promise<number> {
  const columnas = filas<{ table_name: string; column_name: string }>(
    await db.execute(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and column_name in ('imagen_asset_id', 'banner_asset_id')
    `),
  );

  // Si no aparece ninguna, la introspección ha fallado. Abortamos: sin esas
  // columnas daríamos por huérfana la imagen principal de todas las fichas.
  if (columnas.length === 0) return 0;

  const fuentes = [sql`select asset_id as id from entidad_media where asset_id is not null`];
  for (const c of columnas) {
    const col = sql.identifier(c.column_name);
    fuentes.push(
      sql`select ${col} as id from ${sql.identifier(c.table_name)} where ${col} is not null`,
    );
  }

  const huerfanos = filas<{ id: number; publicId: string | null }>(
    await db.execute(sql`
      with referenciados as (${sql.join(fuentes, sql` union `)})
      select a.id, a.public_id as "publicId"
      from media_assets a
      where not exists (select 1 from referenciados r where r.id = a.id)
    `),
  );

  let purgados = 0;
  for (const h of huerfanos) {
    // Si Cloudinary falla, dejamos la fila en pie: el siguiente barrido lo
    // reintenta, en vez de perder para siempre la pista del archivo.
    if (h.publicId && !(await borrarDeCloudinary(h.publicId))) continue;
    await db.delete(mediaAssets).where(eq(mediaAssets.id, h.id));
    purgados++;
  }
  return purgados;
}

/**
 * Igual que `purgarMediosHuerfanos` pero sin propagar errores nunca: la limpieza
 * es mantenimiento, y jamás debe tumbar el guardado que la disparó.
 */
export async function purgarEnSegundoPlano(): Promise<void> {
  try {
    const n = await purgarMediosHuerfanos();
    if (n > 0) console.info(`[media] purgados ${n} asset(s) huérfano(s).`);
  } catch (e) {
    console.error("[media] purga de huérfanos", e);
  }
}
