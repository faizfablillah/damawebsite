import type { NextConfig } from "next";

// Clean URLs for the static marketing pages that live in public/*.html
const STATIC_PAGES = ["about", "leadership", "events", "membership", "contact", "privacy"];

const nextConfig: NextConfig = {
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
