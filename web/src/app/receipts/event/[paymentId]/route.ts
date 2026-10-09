import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/config";
import { receiptPdf } from "@/lib/receipt-pdf";
import { getSettings } from "@/lib/settings";

// Event receipts: the attendee, or admins who can see records or payments
export async function GET(_req: Request, ctx: RouteContext<"/receipts/event/[paymentId]">) {
  const { paymentId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const db = await getDb();
  const [row] = await db
    .select({ p: schema.eventPayments, userId: schema.eventRegistrations.userId })
    .from(schema.eventPayments)
    .innerJoin(schema.eventRegistrations, eq(schema.eventPayments.registrationId, schema.eventRegistrations.id))
    .where(eq(schema.eventPayments.id, paymentId));
  if (!row?.p.receipt || !row.p.receiptNo) return new Response("Not found", { status: 404 });
  if (row.userId !== user.id && !can(user.role, "view") && !can(user.role, "events")) return new Response("Not found", { status: 404 });
  const { website } = await getSettings();
  const pdf = await receiptPdf(row.p.receipt, website);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="DAMA Receipt ${row.p.receiptNo.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
