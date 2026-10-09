import type { NextConfig } from "next";

// Clean URLs for the static marketing pages that live in public/*.html
const STATIC_PAGES = ["about", "leadership", "events", "membership", "contact", "privacy"];

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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Native/wasm packages must not be bundled
  serverExternalPackages: ["@electric-sql/pglite", "pdfkit", "postgres", "nodemailer"],
  // Files read from disk at runtime: pdfkit's font metrics and the database migrations
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/data/**", "./drizzle/**"],
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
      { source: "/index.html", destination: "/", permanent: true },
      ...STATIC_PAGES.map((p) => ({ source: `/${p}.html`, destination: `/${p}`, permanent: true })),
    ];
  },
};

export default nextConfig;
