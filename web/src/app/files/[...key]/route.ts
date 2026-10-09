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
  // Database backups hold every record (including password hashes): super admins only
  if (key.startsWith("backups/") && !can(user.role, "admins")) return new Response("Not found", { status: 404 });
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
      headers: {
        "Content-Type": contentTypeFor(key),
        "Content-Disposition": "inline",
        // Images can't run anything; PDFs open in the browser's own isolated viewer (a sandbox would block it)
        ...(contentTypeFor(key) === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
