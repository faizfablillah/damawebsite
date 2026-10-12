"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { track } from "@vercel/analytics";

// Staff and file pages are never counted; member portal pages only count the sign-up steps below
const SKIP = /^\/(admin|dev|files|receipts|api)(\/|$)/;
const PORTAL = /^\/portal(\/|$)/;
const ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const KEEP_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "tier"];

// Drop tokens, emails and record IDs from the address before it leaves the browser
function clean(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (SKIP.test(url.pathname)) return null;
  if (event.type === "pageview" && PORTAL.test(url.pathname)) return null;
  url.pathname = url.pathname.replace(ID, "[id]");
  const params = new URLSearchParams();
  for (const k of KEEP_PARAMS) {
    const v = url.searchParams.get(k);
    if (v) params.set(k, v);
  }
  url.search = params.toString();
  url.hash = "";
  return { ...event, url: url.toString() };
}

// Sign-up steps, recognised by the page each step lands on
function stepFor(path: string, q: URLSearchParams): string | null {
  if (path === "/check-email") return "Account created";
  if (path.startsWith("/portal/pay/") && q.has("new")) return "Application submitted";
  if (path === "/portal" && q.has("lead")) return "Corporate lead";
  if (path === "/portal" && q.has("submitted")) return "Payment submitted";
  if (path.startsWith("/events/") && q.has("registered")) return "Event registered";
  if (path.startsWith("/portal/events/") && q.has("new")) return "Event registered";
  if (path.startsWith("/portal/events/") && q.has("submitted")) return "Event payment submitted";
  return null;
}

export function SiteAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    const step = stepFor(pathname, new URLSearchParams(window.location.search));
    if (step) track(step);
  }, [pathname]);
  return <Analytics beforeSend={clean} />;
}
