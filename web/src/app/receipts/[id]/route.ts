import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/config";
import { loadMembership, ownsBundle } from "@/lib/queries";
import { receiptPdf } from "@/lib/receipt-pdf";
import { getSettings } from "@/lib/settings";

export async function GET(_req: Request, ctx: RouteContext<"/receipts/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const db = await getDb();
  const [r] = await db.select().from(schema.receipts).where(eq(schema.receipts.id, id));
  if (!r) return new Response("Not found", { status: 404 });
  if (!can(user.role, "view")) {
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, r.orderId));
    const bundle = o ? await loadMembership(o.membershipId) : null;
    if (!bundle || !ownsBundle(bundle, user)) return new Response("Not found", { status: 404 });
  }
  const { website } = await getSettings();
  const pdf = await receiptPdf(r.data, website);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="DAMA Receipt ${r.receiptNo.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
