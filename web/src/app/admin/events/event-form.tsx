import { ActionForm, Field, Select, Submit, TextArea } from "@/components/form";
import type { Event } from "@/db/schema";
import { EVENT_CATEGORIES } from "@/lib/config";
import { money, toKLInput } from "@/lib/format";
import { saveEventAction } from "./actions";

const rmValue = (sen: number | null | undefined) => (sen === null || sen === undefined ? "" : money(sen).replace(/,/g, ""));

export function EventForm({ e }: { e?: Event }) {
  return (
    <ActionForm action={saveEventAction.bind(null, e?.id ?? null)}>
      <div className="form-grid">
        <Field name="title" label="Title" required defaultValue={e?.title} className="full" />
        <Select
          name="category"
          label="Type"
          options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          defaultValue={e?.category ?? ""}
          placeholder="Choose…"
        />
        <Select
          name="audience"
          label="Who can attend"
          required
          options={[
            { value: "public", label: "Everyone (members get the member price)" },
            { value: "members", label: "Members only" },
          ]}
          defaultValue={e?.audience ?? "public"}
        />
        <TextArea name="summary" label="Short summary" required defaultValue={e?.summary} className="full" hint="One or two sentences, shown on event cards and link previews." />
        <TextArea
          name="body"
          label="Full description"
          defaultValue={e?.body}
          className="full"
          hint="Agenda, speakers, who it's for. Leave a blank line between paragraphs."
        />
        <Field name="startsAt" label="Starts (Malaysia time)" type="datetime-local" required defaultValue={toKLInput(e?.startsAt)} />
        <Field name="endsAt" label="Ends" type="datetime-local" defaultValue={toKLInput(e?.endsAt)} />
        <Field name="venue" label="Venue" defaultValue={e?.venue ?? ""} hint="e.g. Menara X, Kuala Lumpur. Leave empty for online-only events." />
        <Field
          name="onlineUrl"
          label="Online link (Zoom / Teams)"
          defaultValue={e?.onlineUrl ?? ""}
          hint="Shown only to people with a confirmed place, and in their emails."
        />
        <Field name="memberPrice" label="Member price (RM)" defaultValue={rmValue(e?.memberPrice ?? 0)} hint="0 = free for members." />
        <Field
          name="nonMemberPrice"
          label="Non-member price (RM)"
          defaultValue={rmValue(e?.nonMemberPrice ?? 0)}
          hint="Ignored for members-only events. 0 = free."
        />
        <Field name="capacity" label="Places" type="number" min="1" defaultValue={e?.capacity?.toString() ?? ""} hint="Leave empty for no limit." />
        <Field
          name="registrationClosesAt"
          label="Registration closes"
          type="datetime-local"
          defaultValue={toKLInput(e?.registrationClosesAt)}
          hint="Optional. Default: when the event starts."
        />
        <Field name="image" label="Cover image" type="file" accept="image/jpeg,image/png,image/webp" className="full" hint={e?.imageKey ? "Upload a new image to replace the current one." : "Optional. Landscape, at least 1200 px wide, up to 4 MB."} />
        <TextArea
          name="materials"
          label="Slides & recordings (members only)"
          defaultValue={e?.materials ?? ""}
          className="full"
          hint="Links to slides or recordings, usually added after the event. Shown to members and confirmed attendees only."
        />
        <Select
          name="status"
          label="Status"
          required
          options={[
            { value: "draft", label: "Draft (only admins can see it)" },
            { value: "published", label: "Published (open for registration)" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          defaultValue={e?.status ?? "draft"}
        />
      </div>
      <div className="form-actions">
        <Submit pendingText="Saving…">{e ? "Save event" : "Create event"}</Submit>
      </div>
    </ActionForm>
  );
}
