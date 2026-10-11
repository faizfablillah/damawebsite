import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AppHero, Notice } from "@/components/ui";
import { getDb, schema } from "@/db";
import { consumeAuthToken, getCurrentUser, grantBootstrapAdmin, safeNext } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const userId = token ? await consumeAuthToken(token, "verify_email") : null;
  if (userId) {
    const db = await getDb();
    const [user] = await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId)).returning();
    await audit(userId, "user.email_verified", "user", userId);
    await grantBootstrapAdmin(user);
  }
  // Straight on to where they were heading (their application, or an event), with a note on portal pages.
  // A link clicked twice by someone already confirmed goes the same way instead of showing an error.
  if (userId || (await getCurrentUser())?.emailVerifiedAt) {
    const next = safeNext(sp.next) ?? "/portal";
    redirect(next.startsWith("/portal") ? `${next}${next.includes("?") ? "&" : "?"}confirmed=1` : next);
  }
  return (
    <>
      <AppHero eyebrow="Account" title="Link not valid" />
      <div className="app-main">
        <div className="container narrow--sm">
          <Notice kind="warn">This confirmation link is invalid, has already been used, or has expired.</Notice>
          <p>
            <Link className="btn btn--primary" href="/check-email">
              Get a new link
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
