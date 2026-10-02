import Link from "next/link";
import { AppHero } from "@/components/ui";
import { ActionForm, Field, Submit } from "@/components/form";
import { forgotPasswordAction } from "../actions";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AppHero eyebrow="Account" title="Reset your password" />
      <div className="app-main">
        <div className="container narrow--sm">
          <div className="panel">
            <ActionForm action={forgotPasswordAction}>
              <p style={{ margin: 0 }}>Enter the email address you registered with and we'll send you a link to choose a new password.</p>
              <Field name="email" label="Email address" type="email" required autoComplete="email" />
              <div className="form-actions">
                <Submit pendingText="Sending…">Send reset link</Submit>
                <Link href="/login">Back to login</Link>
              </div>
            </ActionForm>
          </div>
        </div>
      </div>
    </>
  );
}
