import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/db";
import { emailConfigured } from "@/lib/email";

// Local testing only: open an email (HTML) or its attachment from the outbox.
export async function GET(_req: Request, ctx: RouteContext<"/dev/outbox/[file]">) {
  if (process.env.NODE_ENV === "production" || emailConfigured()) return new Response("Not found", { status: 404 });
  const name = path.basename(decodeURIComponent((await ctx.params).file));
  const full = path.join(DATA_DIR, "outbox", name);
  if (!fs.existsSync(full)) return new Response("Not found", { status: 404 });
  const type = name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
  return new Response(new Uint8Array(fs.readFileSync(full)), { headers: { "Content-Type": type } });
}
