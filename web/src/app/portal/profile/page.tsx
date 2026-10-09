import Link from "next/link";
import { AppHero } from "@/components/ui";
import { ActionForm, Field, Select, Submit } from "@/components/form";
import { requireUser } from "@/lib/auth";
import { STATES } from "@/lib/config";
import { changePasswordAction, updateProfileAction } from "../actions";

export const metadata = { title: "My details" };

export default async function ProfilePage() {
  const user = await requireUser("/portal/profile");
  return (
    <>
      <AppHero eyebrow="Member portal" title="My details" />
      <div className="app-main">
        <div className="container narrow">
          <p>
            <Link href="/portal">← Back to member portal</Link>
          </p>
          <section className="panel">
            <h2>Contact details</h2>
            <ActionForm action={updateProfileAction}>
              <div className="form-grid">
                <Field name="name" label="Full name" required defaultValue={user.name} className="full" />
                <div className="field">
                  <span className="label">Email address</span>
                  <input type="email" value={user.email} disabled className="input" />
                  <span className="hint">To change your email, contact info@dama.org.my.</span>
                </div>
                <Field name="phone" label="Contact number" type="tel" required defaultValue={user.phone} />
                <Field name="jobTitle" label="Job title" defaultValue={user.jobTitle ?? ""} />
                <Field name="organisation" label="Organisation" defaultValue={user.organisation ?? ""} />
                <Field name="address" label="Correspondence address" required defaultValue={user.address ?? ""} className="full" />
                <Select name="stateCode" label="State" required options={STATES.map((s) => ({ value: s.code, label: s.name }))} defaultValue={user.stateCode ?? ""} />
              </div>
              <div>
                <Submit pendingText="Saving…">Save details</Submit>
              </div>
            </ActionForm>
          </section>
          <section className="panel">
            <h2>Change password</h2>
            <ActionForm action={changePasswordAction} resetOnSuccess>
              <div className="form-grid">
                <Field name="currentPassword" label="Current password" type="password" required autoComplete="current-password" className="full" />
                <Field name="password" label="New password" type="password" required autoComplete="new-password" hint="At least 8 characters." />
                <Field name="confirmPassword" label="Confirm new password" type="password" required autoComplete="new-password" />
              </div>
              <div>
                <Submit className="btn btn--outline" pendingText="Saving…">
                  Change password
                </Submit>
              </div>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
