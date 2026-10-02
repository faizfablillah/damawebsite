import { redirect } from "next/navigation";
import { AppHero } from "@/components/ui";
import { ActionForm, Submit } from "@/components/form";
import { getCurrentUser } from "@/lib/auth";
import { resendVerificationAction } from "../actions";

export const metadata = { title: "Confirm your email" };

export default async function CheckEmailPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect("/portal");
  return (
    <>
      <AppHero eyebrow="Almost there" title="Confirm your email address" />
      <div className="app-main">
        <div className="container narrow--sm">
          <div className="panel panel--accent">
            <p>
              We've sent a confirmation link to <strong>{user.email}</strong>. Open it to continue your membership application.
            </p>
            <p className="muted-sm">Can't find it? Check your spam or junk folder. The link expires in 72 hours.</p>
            <ActionForm action={resendVerificationAction}>
              <div>
                <Submit className="btn btn--outline btn--sm" pendingText="Sending…">
                  Send a new link
                </Submit>
              </div>
            </ActionForm>
          </div>
        </div>
      </div>
    </>
  );
}
