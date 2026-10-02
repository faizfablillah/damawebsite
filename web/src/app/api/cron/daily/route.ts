import { runDailyTasks } from "@/lib/membership";

// Called once a day by the host's scheduler (Authorization: Bearer CRON_SECRET).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runDailyTasks();
  return Response.json({ ok: true, ...result });
}
