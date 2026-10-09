import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

const PAGES = ["", "/about", "/leadership", "/events", "/membership", "/contact", "/join", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${APP_URL}${p}`, changeFrequency: "monthly", priority: p === "" ? 1 : 0.7 }));
}
