import type { NextConfig } from "next";

// Clean URLs for the static marketing pages that live in public/*.html
const STATIC_PAGES = ["about", "leadership", "membership", "contact", "privacy"];

// Everything is served from this site: no third-party scripts, fonts, frames or form targets.
// Inline scripts are allowed because Next.js and the static pages use them; dev mode also needs eval.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// The main address (e.g. dama.org.my), set as CANONICAL_HOST in Vercel once its DNS works.
// Visitors on the other addresses are sent there; /api is left alone so scheduled jobs never get a redirect.
const CANONICAL_HOST = process.env.CANONICAL_HOST;
const OTHER_HOSTS = ["www.dama.org.my", "dama-malaysia.vercel.app"].filter((h) => h !== CANONICAL_HOST);
const hostRedirects = CANONICAL_HOST
  ? OTHER_HOSTS.flatMap((host) => [
      { source: "/", has: [{ type: "host" as const, value: host }], destination: `https://${CANONICAL_HOST}/`, permanent: true },
      { source: "/:path((?!api/).+)", has: [{ type: "host" as const, value: host }], destination: `https://${CANONICAL_HOST}/:path`, permanent: true },
    ])
  : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Native/wasm packages must not be bundled
  serverExternalPackages: ["@electric-sql/pglite", "pdfkit", "postgres", "nodemailer"],
  // Files read from disk at runtime: pdfkit's font metrics and the database migrations
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/data/**", "./drizzle/**", "./content/**"],
  },
  experimental: {
    serverActions: {
      // Payment proofs and student documents are capped at 4 MB (plus multipart overhead)
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      ...STATIC_PAGES.map((p) => ({ source: `/${p}`, destination: `/${p}.html` })),
    ];
  },
  async redirects() {
    return [
      ...hostRedirects,
      { source: "/index.html", destination: "/", permanent: true },
      // The static Events page became the dynamic /events page (old write-ups are now news posts)
      { source: "/events.html", destination: "/events", permanent: true },
      ...STATIC_PAGES.map((p) => ({ source: `/${p}.html`, destination: `/${p}`, permanent: true })),
    ];
  },
};

export default nextConfig;
