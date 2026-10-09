import crypto from "node:crypto";
import { runDailyJob } from "@/lib/daily-job";

// Called once a day by the host's scheduler (Authorization: Bearer CRON_SECRET).
// ?testAlert=1 also sends a test alert email, to check alerts reach the admins.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runDailyJob({ testAlert: new URL(req.url).searchParams.get("testAlert") === "1" });
  return Response.json({ ok: result.problems.length === 0, ...result });
}
