import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarIcon, PinIcon } from "@/components/cards";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/config";
import { memberStatus } from "@/lib/events";
import { allNews, newsBySlug } from "@/lib/news";

export function generateStaticParams() {
  return allNews().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/news/[slug]">) {
  const p = newsBySlug((await params).slug);
  if (!p || p.draft) return { title: "News" };
  return { title: p.title, description: p.summary, openGraph: { title: p.title, description: p.summary, images: p.images[0] ? [p.images[0].src] : [] } };
}

export default async function NewsPostPage({ params }: PageProps<"/news/[slug]">) {
  const p = newsBySlug((await params).slug);
  if (!p) notFound();
  const viewer = p.draft || p.membersOnly ? await getCurrentUser() : null;
  if (p.draft && !can(viewer?.role, "backoffice")) notFound();
  // Members-only posts (e.g. member offers) show their body to members and admins only
  let canRead = true;
  if (p.membersOnly) canRead = !!viewer && (can(viewer.role, "backoffice") || (await memberStatus(viewer)).member);
  return (
    <>
      <section className="app-hero">
        <div className="waves waves--right" aria-hidden="true" />
        <div className="container">
          <p className="eyebrow">{p.draft ? `Draft preview · ${p.tag}` : p.membersOnly ? `${p.tag} · Members only` : p.tag}</p>
          <h1>{p.title}</h1>
          <p>{p.summary}</p>
        </div>
      </section>
      <div className="app-main">
        <div className="container narrow">
          <p className="event__meta" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span>
              <CalendarIcon /> {p.dateLabel}
            </span>
            {p.place && (
              <span>
                <PinIcon /> {p.place}
              </span>
            )}
          </p>
          {canRead ? (
            <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
          ) : (
            <div className="panel panel--accent">
              <p>This post is for DAMA members.</p>
              <div className="form-actions">
                <Link className="btn btn--primary btn--sm" href={`/login?next=${encodeURIComponent(`/news/${p.slug}`)}`}>
                  Member login
                </Link>
                <Link href="/join">Join DAMA</Link>
              </div>
            </div>
          )}
          {p.images.length > 0 && (
            <div className="gallery" style={{ marginTop: 24 }}>
              {p.images.map((img) => (
                <a key={img.src} href={img.src} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static images, already sized */}
                  <img src={img.src} alt={img.alt} loading="lazy" />
                </a>
              ))}
            </div>
          )}
          <p style={{ marginTop: 32 }}>
            <Link href="/news">← All news</Link>
          </p>
        </div>
      </div>
    </>
  );
}
