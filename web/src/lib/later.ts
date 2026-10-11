import "server-only";
import { after } from "next/server";

// Runs slow side work (emails, receipt PDFs) after the response has been sent, so nobody waits on the
// mail server after clicking a button. Outside a request (maintenance scripts) it simply runs now.
export async function later(task: () => Promise<unknown>) {
  const run = () => task().catch((e) => console.error("Background task failed", e));
  try {
    after(run);
  } catch {
    await run();
  }
}
