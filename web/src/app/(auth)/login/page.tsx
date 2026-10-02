import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHero, Notice } from "@/components/ui";
import { ActionForm, Field, Submit } from "@/components/form";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "../actions";

export const metadata = { title: "Member login" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  if (await getCurrentUser()) redirect(next || "/portal");
  return (
    <>
      <AppHero eyebrow="Members" title="Log in to your account" />
      <div className="app-main">
        <div className="container narrow--sm">
          {sp.signedOut && <Notice kind="success">You've been logged out.</Notice>}
          <div className="panel">
            <ActionForm action={loginAction}>
              <input type="hidden" name="next" value={next} />
              <Field name="email" label="Email address" type="email" required autoComplete="email" />
              <Field name="password" label="Password" type="password" required autoComplete="current-password" />
              <div className="form-actions">
                <Submit pendingText="Logging in…">Log in</Submit>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
            </ActionForm>
          </div>
          <p className="text-center muted">
            New to DAMA? <Link href="/join">Become a member</Link>
          </p>
        </div>
      </div>
    </>
  );
}
