"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const COOKIE = "dama_flash";

// Confirmation banner set by admin and portal actions (see lib/flash.ts). Read once, then cleared;
// it stays tied to the page it arrived on and disappears when the user navigates elsewhere.
export function Flash() {
  const page = `${usePathname()}?${useSearchParams().toString()}`;
  const [flash, setFlash] = useState<{ page: string; msg: string } | null>(null);
  useEffect(() => {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
    if (!raw) return;
    document.cookie = `${COOKIE}=; Max-Age=0; path=/`;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the cookie only exists in the browser
      setFlash({ page, msg: decodeURIComponent(raw.slice(COOKIE.length + 1)) });
    } catch {
      // ignore a malformed cookie
    }
  }, [page]);
  if (!flash || flash.page !== page) return null;
  return (
    <div className="notice notice--success" role="status">
      {flash.msg}
    </div>
  );
}
