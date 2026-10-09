import { ActionForm, Checkbox, Field, Select, Submit, TextArea } from "@/components/form";
import { requireAdmin } from "@/lib/auth";
import { recipients } from "@/lib/announce";
import { announceAction } from "./actions";

// Free email plans send about 100 emails a day; larger lists need batches or a newsletter tool
const DAILY_LIMIT = 100;

export default async function AnnouncePage() {
  await requireAdmin("announce");
  const [members, everyone] = await Promise.all([recipients("members"), recipients("everyone")]);
  return (
    <>
      <h2 style={{ fontSize: "1.5rem" }}>Announce</h2>
      <p className="muted-sm">
        Email an announcement: a partnership, a member offer, a call for volunteers. To email one event&apos;s attendees, use that event&apos;s page under
        Events instead.
      </p>
      <section className="panel">
        <ActionForm action={announceAction} resetOnSuccess>
          <Select
            name="audience"
            label="Send to"
            required
            defaultValue="members"
            options={[
              { value: "members", label: `Active members (${members.length})` },
              { value: "everyone", label: `Everyone with an account who agreed to updates (${everyone.length})` },
            ]}
          />
          <Field name="subject" label="Subject" required />
          <TextArea name="message" label="Message" required hint="Plain text. Leave a blank line between paragraphs." />
          {Math.max(members.length, everyone.length) > DAILY_LIMIT && (
            <p className="muted-sm">Note: the email service sends about {DAILY_LIMIT} emails a day. Larger lists may be cut off, so check with Faiz before sending.</p>
          )}
          <Checkbox name="confirm" required>
            Send this email now
          </Checkbox>
          <div>
            <Submit pendingText="Sending…">Send announcement</Submit>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
