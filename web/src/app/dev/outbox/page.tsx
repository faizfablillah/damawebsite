import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { AppHero } from "@/components/ui";
import { DATA_DIR } from "@/db";

export const metadata = { title: "Local inbox" };

// Local testing only: shows the emails that would have been sent (when SMTP isn't configured).
export default async function OutboxPage() {
  if (process.env.NODE_ENV === "production" || process.env.SMTP_HOST) notFound();
  const dir = path.join(DATA_DIR, "outbox");
  const items = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse()
        .map((f) => {
          const mail = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { to: string; subject: string; text: string; attachments: string[] };
          const base = f.replace(/\.json$/, "");
          const link = mail.text.match(/http:\/\/localhost:\d+\S+/)?.[0];
          return { base, ...mail, link, time: new Date(Number(base.split("-")[0])) };
        })
    : [];
  return (
    <>
      <AppHero eyebrow="Local testing only" title="Inbox">
        Emails are not really sent on this computer. Every email the system would send appears here, newest first.
      </AppHero>
      <div className="app-main">
        <div className="container">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Link in email</th>
                  <th>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.base}>
                    <td>{m.time.toLocaleTimeString("en-MY")}</td>
                    <td>{m.to}</td>
                    <td>
                      <a href={`/dev/outbox/${encodeURIComponent(m.base)}.html`} target="_blank">
                        {m.subject}
                      </a>
                    </td>
                    <td>{m.link ? <a href={m.link.replace(/^http:\/\/localhost:\d+/, "")}>Open link</a> : "—"}</td>
                    <td>
                      {m.attachments.map((a) => (
                        <a key={a} href={`/dev/outbox/${encodeURIComponent(`${m.base}-${a}`)}`} target="_blank" style={{ display: "block" }}>
                          {a}
                        </a>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <div className="empty">No emails yet. Sign up to receive your first one.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
