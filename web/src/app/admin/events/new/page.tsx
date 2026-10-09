import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { EventForm } from "../event-form";

export default async function NewEventPage() {
  await requireAdmin("events");
  return (
    <>
      <p>
        <Link href="/admin/events">← Events</Link>
      </p>
      <h2 style={{ fontSize: "1.5rem" }}>New event</h2>
      <section className="panel">
        <EventForm />
      </section>
    </>
  );
}
