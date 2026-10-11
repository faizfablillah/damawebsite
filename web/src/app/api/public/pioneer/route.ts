import { connection } from "next/server";
import { PIONEER_SPOTS, pioneerStatus } from "@/lib/pioneer";

// Pioneer offer state for the static Membership page (assets/js/main.js): open, spots left
export async function GET() {
  await connection();
  const { open, spotsLeft } = await pioneerStatus();
  return Response.json({ open, spotsLeft, spots: PIONEER_SPOTS }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
