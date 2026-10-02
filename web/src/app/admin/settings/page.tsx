import { ActionForm, Field, Select, Submit } from "@/components/form";
import { requireAdmin } from "@/lib/auth";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { settingsAction } from "../actions";

const plain = (sen: number) => money(sen).replace(/,/g, "");

export default async function SettingsPage() {
  await requireAdmin("settings");
  const s = await getSettings();
  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Settings</h2>
      <ActionForm action={settingsAction} className="form">
        <section className="panel">
          <h2>Membership fees (RM per year)</h2>
          <p className="muted-sm">Changes apply to new applications and renewals. Existing orders keep the price they were created with.</p>
          <div className="form-grid">
            <Field name="EDU" label="Educational (Student) — EDU" required defaultValue={plain(s.prices.EDU)} />
            <Select
              name="individualPricing"
              label="Individual pricing in use"
              defaultValue={s.individualPricing}
              options={[
                { value: "early_bird", label: "Early bird (IND-EB)" },
                { value: "standard", label: "Standard (IND-STD)" },
              ]}
            />
            <Field name="IND_EB" label="Individual — early bird (IND-EB)" required defaultValue={plain(s.prices.IND_EB)} />
            <Field name="IND_STD" label="Individual — standard (IND-STD)" required defaultValue={plain(s.prices.IND_STD)} />
            <Field name="COR_S" label="Corporate — Small Enterprise (5 seats)" required defaultValue={plain(s.prices.COR_S)} />
            <Field name="COR_M" label="Corporate — Medium Enterprise (10 seats)" required defaultValue={plain(s.prices.COR_M)} />
            <Field name="COR_L" label="Corporate — Large Enterprise (15 seats)" required defaultValue={plain(s.prices.COR_L)} />
            <Field name="COR_P" label="Corporate — Enterprise Plus (20 seats)" required defaultValue={plain(s.prices.COR_P)} />
          </div>
        </section>
        <section className="panel">
          <h2>Bank transfer details</h2>
          <p className="muted-sm">Shown to members on the payment page.</p>
          <div className="form-grid">
            <Field name="bankName" label="Bank" required defaultValue={s.bank.bankName} />
            <Field name="accountNumber" label="Account number" required defaultValue={s.bank.accountNumber} />
            <Field name="accountName" label="Account name" required defaultValue={s.bank.accountName} className="full" />
            <Field name="duitNowNote" label="Extra payment note (optional)" defaultValue={s.bank.duitNowNote} className="full" hint="e.g. DuitNow QR instructions." />
          </div>
        </section>
        <section className="panel">
          <h2>Renewals</h2>
          <div className="form-grid">
            <Field name="graceDays" label="Grace period (days after expiry)" type="number" required defaultValue={String(s.graceDays)} min="0" max="120" />
            <Field name="reminderDays" label="Reminder emails (days before expiry)" required defaultValue={s.reminderDays.join(", ")} hint="Comma-separated, e.g. 30, 14, 7" />
            <Field name="website" label="Website address on receipts" defaultValue={s.website} className="full" />
          </div>
        </section>
        <div>
          <Submit pendingText="Saving…">Save settings</Submit>
        </div>
      </ActionForm>
    </>
  );
}
