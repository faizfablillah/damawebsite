import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHero, Notice } from "@/components/ui";
import { ActionForm, Checkbox, Checkboxes, Field, Select, Submit, TextArea } from "@/components/form";
import { requireVerifiedUser } from "@/lib/auth";
import { COMM_PREFERENCES, CORPORATE_INTERESTS, CORPORATE_TIERS, isAcademicEmail, KEY_DATA_AREAS, ORG_SIZES, PDPA_CONSENT_TEXT, STATES, TIERS } from "@/lib/config";
import { rm } from "@/lib/format";
import { getSettings, priceFor } from "@/lib/settings";
import { ACCEPT_ATTR } from "@/lib/storage";
import { membershipsForUser } from "@/lib/queries";
import { applyAction } from "../actions";

export const metadata = { title: "Membership application" };

const stateOptions = STATES.map((s) => ({ value: s.code, label: s.name }));

export default async function ApplyPage({ searchParams }: PageProps<"/portal/apply">) {
  const user = await requireVerifiedUser("/portal/apply");
  const sp = await searchParams;
  const kind = sp.tier === "student" || sp.tier === "corporate" ? sp.tier : sp.tier === "individual" ? "individual" : null;
  if (!kind) redirect("/join");
  const settings = await getSettings();

  if (kind !== "corporate") {
    const { bundles } = await membershipsForUser(user);
    const existing = bundles.find((b) => b.membership.category !== "C" && ["pending", "active", "grace", "suspended"].includes(b.membership.status));
    if (existing) redirect("/portal");
  }

  const price = kind === "corporate" ? null : priceFor(kind === "student" ? "EDU" : "IND", settings);
  const studentBlocked = kind === "student" && !isAcademicEmail(user.email);

  return (
    <>
      <AppHero eyebrow="Step 2 of 3" title={kind === "corporate" ? "Corporate membership application" : `${kind === "student" ? "Student" : "Individual"} membership application`}>
        {kind === "corporate"
          ? "Tell us about your organisation. After submitting you'll see our bank details to complete payment — or ask our PIC to contact you first."
          : `Annual fee: ${rm(price!.unitPrice)}. After this step you'll see our bank details and upload your transfer receipt.`}
      </AppHero>
      <div className="app-main">
        <div className="container narrow">
          {studentBlocked ? (
            <div className="panel">
              <Notice kind="error">
                A .edu or .edu.my email is required for Student membership. Your account email is <strong>{user.email}</strong>.
              </Notice>
              <p>You can create a new account with your student email, or choose another tier.</p>
              <div className="form-actions">
                <Link className="btn btn--primary btn--sm" href="/portal/apply?tier=individual">
                  Apply as Individual
                </Link>
                <Link className="btn btn--outline btn--sm" href="/portal">
                  Back to portal
                </Link>
              </div>
            </div>
          ) : kind === "corporate" ? (
            <div className="panel">
              <ActionForm action={applyAction}>
                <input type="hidden" name="kind" value="corporate" />
                <div className="field">
                  <span className="label">
                    Corporate tier <span className="req">*</span>
                  </span>
                  <div className="tier-options">
                    {CORPORATE_TIERS.map((t, i) => (
                      <label className="tier-option" key={t}>
                        <input type="radio" name="tier" value={t} defaultChecked={i === 0} />
                        <strong>{TIERS[t].label}</strong>
                        <div className="price">{rm(priceFor(t, settings).unitPrice)}</div>
                        <small>Up to {TIERS[t].seats} seats · per year</small>
                      </label>
                    ))}
                  </div>
                </div>
                <h3 style={{ margin: "8px 0 0" }}>Company information</h3>
                <div className="form-grid">
                  <Field name="orgName" label="Organisation name" required hint="Your company's full registered name." className="full" />
                  <Field name="ssmNo" label="Company registration no." required hint="As per SSM / official registration certificate." />
                  <Field name="industry" label="Industry" required />
                  <Select name="orgSize" label="Organisation size" required options={ORG_SIZES.map((s) => ({ value: s, label: s }))} />
                  <Select name="stateCode" label="State (registered office)" required options={stateOptions} defaultValue={user.stateCode ?? undefined} hint="Used in your Member ID." />
                  <Field name="address" label="Registered office address" required className="full" />
                </div>
                <h3 style={{ margin: "8px 0 0" }}>Key contact person</h3>
                <div className="form-grid">
                  <Field name="contactName" label="Full name" required defaultValue={user.name} />
                  <Field name="contactJobTitle" label="Job title" required defaultValue={user.jobTitle ?? undefined} />
                  <Field name="contactEmail" label="Business email" type="email" required defaultValue={user.email} hint="Membership confirmation and receipts are sent here." />
                  <Field name="contactPhone" label="Contact number" type="tel" required defaultValue={user.phone} placeholder="e.g. 60123456789" />
                </div>
                <Checkboxes name="areas" label="Areas of interest" options={CORPORATE_INTERESTS} />
                <Checkboxes name="topics" label="Data topics your organisation is interested in" options={KEY_DATA_AREAS} />
                <TextArea name="remarks" label="Message / special requirements" />
                <Checkbox name="wantsCall">I'd like a DAMA Corporate Membership PIC to contact me before I pay.</Checkbox>
                <div className="consent">
                  <Checkbox name="declaration" required>
                    I confirm that the above information is accurate and that I am authorised to register this organisation.
                  </Checkbox>
                  <p className="muted-sm" style={{ margin: "4px 0 0" }}>
                    Your PDPA consent was recorded when you created your account. {PDPA_CONSENT_TEXT.outro}
                  </p>
                </div>
                <div className="form-actions">
                  <Submit pendingText="Submitting…">Submit application</Submit>
                  <Link href="/portal">Cancel</Link>
                </div>
              </ActionForm>
            </div>
          ) : (
            <div className="panel">
              <ActionForm action={applyAction}>
                <input type="hidden" name="kind" value={kind} />
                {kind === "student" && (
                  <>
                    <div className="form-grid">
                      <Field name="institution" label="University / college" required defaultValue={user.organisation ?? undefined} />
                      <Field name="graduationYear" label="Expected graduation year" type="number" required min="2020" max="2040" />
                    </div>
                    <Field
                      name="studentProof"
                      label="Proof of student status"
                      type="file"
                      required
                      accept={ACCEPT_ATTR}
                      hint="Upload your student card or offer letter (PDF, JPG or PNG, up to 4 MB). Proof of student status is strictly required."
                    />
                  </>
                )}
                <Select name="stateCode" label="State of your correspondence address" required options={stateOptions} defaultValue={user.stateCode ?? undefined} hint="Used in your Member ID. It stays the same even if you move later." />
                <TextArea name="background" label={kind === "student" ? "Academic background (optional)" : "Professional background (optional)"} hint="A short summary helps us plan relevant events." />
                <Checkboxes name="topics" label="Topics of interest" options={KEY_DATA_AREAS} />
                <Checkboxes name="preferences" label="I'd like to receive" options={COMM_PREFERENCES} defaults={COMM_PREFERENCES} />
                <div className="consent">
                  <Checkbox name="confirmTier" required>
                    I'm applying for <strong>{kind === "student" ? "Educational (Student)" : "Individual"} membership</strong> at <strong>{rm(price!.unitPrice)}</strong> per year
                    {kind === "student" ? ", and I'm currently enrolled at a recognised academic institution." : ", and I work in data management or a closely related field."}
                  </Checkbox>
                </div>
                <div className="form-actions">
                  <Submit pendingText="Submitting…">Continue to payment</Submit>
                  <Link href="/portal">Cancel</Link>
                </div>
              </ActionForm>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
