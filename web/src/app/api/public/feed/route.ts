import { connection } from "next/server";
import { eventImage, priceLabel } from "@/components/cards";
import { fmtEventWhen } from "@/lib/format";
import { publishedEvents } from "@/lib/events";
import { allNews } from "@/lib/news";

// Upcoming events and latest news for the static homepage (rendered by assets/js/main.js)
export async function GET() {
  await connection();
  const events = (await publishedEvents("upcoming", 3))
    .filter((e) => e.status === "published")
    .map((e) => ({
      title: e.title,
      url: `/events/${e.slug}`,
      when: fmtEventWhen(e.startsAt, e.endsAt),
      summary: e.summary,
      tag: e.audience === "members" ? "Members only" : (e.category ?? "Event"),
      price: priceLabel(e),
      image: eventImage(e),
    }));
  const news = allNews()
    .slice(0, 3)
    .map((p) => ({ title: p.title, url: `/news/${p.slug}`, when: p.dateLabel, summary: p.summary, tag: p.tag, image: p.images[0]?.src ?? null }));
  return Response.json({ events, news }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
