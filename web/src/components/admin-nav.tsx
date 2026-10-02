"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Item = { href: string; label: string; count?: number; show: boolean } | "sep";

export function AdminNav({ items }: { items: Item[] }) {
  const path = usePathname();
  const search = useSearchParams();
  const active = (href: string) => {
    const [hp, hq] = href.split("?");
    if (hp === "/admin") return path === "/admin";
    if (!path.startsWith(hp)) return false;
    // Students / Individuals / All members share one page, told apart by ?category=
    const cat = search.get("category");
    if (hq) return new URLSearchParams(hq).get("category") === cat;
    return hp === "/admin/members" ? !cat : true;
  };
  return (
    <nav className="admin-nav" aria-label="Admin">
      {items.map((it, i) =>
        it === "sep" ? (
          <hr key={i} />
        ) : it.show ? (
          <Link key={it.href} href={it.href} aria-current={active(it.href) ? "page" : undefined}>
            {it.label}
            {!!it.count && <span className="count">{it.count}</span>}
          </Link>
        ) : null,
      )}
    </nav>
  );
}
