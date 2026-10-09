import Link from "next/link";
import { eq } from "drizzle-orm";
import { AppHero, Notice } from "@/components/ui";
import { getDb, schema } from "@/db";
import { consumeAuthToken, grantBootstrapAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const metadata = { title: "Email confirmed" };

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
  return (
    <>
      <AppHero eyebrow="Account" title={userId ? "Email confirmed" : "Link not valid"} />
      <div className="app-main">
        <div className="container narrow--sm">
          {userId ? (
            <div className="panel panel--accent">
              <p>Thank you — your email address is confirmed.</p>
              <Link className="btn btn--primary" href="/portal">
                Continue your application
              </Link>
            </div>
          ) : (
            <>
              <Notice kind="warn">This confirmation link is invalid, has already been used, or has expired.</Notice>
              <p>
                <Link className="btn btn--primary" href="/check-email">
                  Get a new link
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
