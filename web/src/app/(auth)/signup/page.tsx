import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHero } from "@/components/ui";
import { ActionForm, Checkbox, Field, Select, Submit } from "@/components/form";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { PDPA_CONSENT_TEXT, STATES } from "@/lib/config";
import { signupAction } from "../actions";

export const metadata = { title: "Create your account" };

const TIER_COPY: Record<string, { title: string; note?: string }> = {
  student: { title: "Student membership", note: "Student pricing requires a valid .edu or .edu.my email address." },
  individual: { title: "Individual membership" },
  corporate: { title: "Corporate membership", note: "Create the account for your organisation's contact person. You'll add company details next." },
};

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const tier = typeof sp.tier === "string" && sp.tier in TIER_COPY ? sp.tier : "";
  // Where to go after confirming the email (e.g. back to an event)
  const next = safeNext(sp.next) ?? "";
  if (await getCurrentUser()) redirect(next || (tier ? `/portal/apply?tier=${tier}` : "/portal"));
  const copy = TIER_COPY[tier];
  return (
    <>
      <AppHero eyebrow={copy ? copy.title : "Membership"} title="Create your account">
        Step 1 of 3 — your account. Next you'll complete the application and upload your payment.
      </AppHero>
      <div className="app-main">
        <div className="container narrow">
          {sp.seat && (
            <div className="notice notice--info">
              Your organisation added you to its corporate membership. Sign up with the <strong>same email address</strong> to see your seat.
            </div>
          )}
          <div className="panel">
            <ActionForm action={signupAction}>
              <input type="hidden" name="tier" value={tier} />
              <input type="hidden" name="next" value={next} />
              <div className="form-grid">
                <Field name="name" label="Full name" required autoComplete="name" className="full" />
                <Field
                  name="email"
                  label="Email address"
                  type="email"
                  required
                  autoComplete="email"
                  hint={copy?.note ?? "We'll send a confirmation link to this address."}
                />
                <Field name="phone" label="Contact number" type="tel" required autoComplete="tel" placeholder="e.g. 012-345 6789" />
                <Field name="jobTitle" label={tier === "student" ? "Course / programme" : "Job title"} autoComplete="organization-title" />
                <Field name="organisation" label={tier === "student" ? "University / college" : "Organisation"} autoComplete="organization" />
                <Field name="address" label="Correspondence address" required autoComplete="street-address" className="full" />
                <Select
                  name="stateCode"
                  label="State"
                  required
                  options={STATES.map((s) => ({ value: s.code, label: s.name }))}
                  hint="Used in your Member ID."
                />
                <div className="spacer" />
                <Field name="password" label="Password" type="password" required autoComplete="new-password" hint="At least 8 characters." />
                <Field name="confirmPassword" label="Confirm password" type="password" required autoComplete="new-password" />
              </div>
              <div className="consent">
                <strong>Consent &amp; Acknowledgement (PDPA Compliance)</strong>
                <p style={{ margin: "8px 0 0" }}>{PDPA_CONSENT_TEXT.intro}</p>
                <ul>
                  {PDPA_CONSENT_TEXT.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                <p>{PDPA_CONSENT_TEXT.outro}</p>
                <p>
                  Read our <a href="/privacy" target="_blank">Privacy Policy</a>.
                </p>
                <Checkbox name="consent" required>
                  {PDPA_CONSENT_TEXT.checkbox}
                </Checkbox>
              </div>
              <div className="form-actions">
                <Submit pendingText="Creating account…">Create account</Submit>
                <span className="muted-sm">
                  Already have an account? <Link href="/login">Log in</Link>
                </span>
              </div>
            </ActionForm>
          </div>
        </div>
      </div>
    </>
  );
}
