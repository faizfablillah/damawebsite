import { AppHero, Notice } from "@/components/ui";
import { ActionForm, Field, Submit } from "@/components/form";
import { resetPasswordAction } from "../actions";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <>
      <AppHero eyebrow="Account" title="Choose a new password" />
      <div className="app-main">
        <div className="container narrow--sm">
          {!token ? (
            <Notice kind="warn">This link is missing its security code. Please use the link from your email.</Notice>
          ) : (
            <div className="panel">
              <ActionForm action={resetPasswordAction}>
                <input type="hidden" name="token" value={token} />
                <Field name="password" label="New password" type="password" required autoComplete="new-password" hint="At least 8 characters." />
                <Field name="confirmPassword" label="Confirm new password" type="password" required autoComplete="new-password" />
                <div>
                  <Submit pendingText="Saving…">Save new password</Submit>
                </div>
              </ActionForm>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
