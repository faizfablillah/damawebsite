import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

// Public pages can be indexed; member and admin areas are kept out of search results
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/portal", "/files/", "/receipts/", "/api/", "/dev/", "/check-email", "/verify-email", "/reset-password"] },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
