import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/config";
import { contentTypeFor, readFile } from "@/lib/storage";
import { loadMembership, ownsBundle } from "@/lib/queries";

// Private uploads: admins, or the member who uploaded the file.
export async function GET(_req: Request, ctx: RouteContext<"/files/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  const user = await getCurrentUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  if (!can(user.role, "view")) {
    const db = await getDb();
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.proofKey, key));
    const [student] = await db.select().from(schema.memberships).where(eq(schema.memberships.studentProofKey, key));
    let membershipId = student?.id;
    if (payment) {
      const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, payment.orderId));
      membershipId = o?.membershipId;
    }
    const bundle = membershipId ? await loadMembership(membershipId) : null;
    if (!bundle || !ownsBundle(bundle, user)) return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(key);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": contentTypeFor(key), "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
