import { AppHero } from "@/components/ui";
import { NewsCard } from "@/components/cards";
import { allNews } from "@/lib/news";

export const metadata = {
  title: "News",
  description: "Partnerships, announcements and highlights from DAMA Kuala Lumpur & Selangor.",
};

export default function NewsPage() {
  const posts = allNews();
  return (
    <>
      <AppHero eyebrow="News" title="News & announcements">
        Partnerships, announcements, member offers and highlights from our community.
      </AppHero>
      <div className="app-main">
        <div className="container">
          <div className="grid grid--3">
            {posts.map((p) => (
              <NewsCard key={p.slug} p={p} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
