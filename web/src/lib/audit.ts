import "server-only";
import { getDb, schema, type Tx } from "@/db";

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
  tx?: Tx,
) {
  const db = tx ?? (await getDb());
  await db.insert(schema.auditLog).values({ actorId, action, entityType, entityId, details });
}
