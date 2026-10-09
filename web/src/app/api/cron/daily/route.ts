import crypto from "node:crypto";
import { runDailyTasks } from "@/lib/membership";

// Called once a day by the host's scheduler (Authorization: Bearer CRON_SECRET).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runDailyTasks();
  return Response.json({ ok: true, ...result });
}
