import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { marked } from "marked";

// News posts are Markdown files in content/news (see the README there). They are written by the
// project maintainer, so their HTML is trusted.

export type NewsImage = { src: string; alt: string };
export type NewsPost = {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  dateLabel: string;
  tag: string;
  place: string | null;
  summary: string;
  images: NewsImage[];
  membersOnly: boolean;
  html: string;
};

const DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "content", "news");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parse(file: string): NewsPost {
  const raw = fs.readFileSync(path.join(DIR, file), "utf8").replace(/\r\n/g, "\n");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`News post ${file} has no front matter`);
  const meta: Record<string, string> = {};
  const images: NewsImage[] = [];
  let inImages = false;
  for (const line of m[1].split("\n")) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (inImages && item) {
      const [src, alt = ""] = item[1].split("|").map((x) => x.trim());
      images.push({ src, alt });
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    inImages = kv[1] === "images";
    if (!inImages) meta[kv[1]] = kv[2].replace(/\s+#.*$/, "").trim();
  }
  const date = meta.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error(`News post ${file} needs date: YYYY-MM-DD`);
  const [y, mo, d] = date.split("-").map(Number);
  return {
    slug: file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, ""),
    title: meta.title ?? file,
    date,
    dateLabel: meta.dateLabel || `${d} ${MONTHS[mo - 1]} ${y}`,
    tag: meta.tag || "News",
    place: meta.place || null,
    summary: meta.summary ?? "",
    images,
    membersOnly: meta.membersOnly === "true",
    html: marked.parse(m[2].trim(), { async: false }),
  };
}

export const allNews = cache((): NewsPost[] => {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f))
    .map(parse)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
});

export const newsBySlug = (slug: string) => allNews().find((p) => p.slug === slug) ?? null;

// Old /events#anchor links from the earlier static Events page → their news post
export const OLD_EVENT_ANCHORS: Record<string, string> = {
  "mmu-mou": "mmu-mou",
  "launchpad-1": "data-launchpad-series-1",
  "afed-mou": "afed-digital-mou",
  "um-mou": "universiti-malaya-mou",
  "official-launch": "official-launch",
};
