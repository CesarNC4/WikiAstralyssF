import { EntityIndex } from "@/components/entity/EntityIndex";
import { listEntityCards } from "@/lib/queries/cards";
import { ENTITIES, type EntityKey } from "@/lib/entities";

/** Server component: carga las cards y delega el render/filtrado al cliente. */
export async function EntityIndexPage({ entityKey }: { entityKey: EntityKey }) {
  const meta = ENTITIES[entityKey];
  const cards = await listEntityCards(entityKey).catch(() => []);
  return <EntityIndex meta={meta} cards={cards} />;
}
