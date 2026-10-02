import type { Metadata } from "next";
import Script from "next/script";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./app.css";

export const metadata: Metadata = {
  title: { default: "Membership | DAMA Kuala Lumpur & Selangor", template: "%s | DAMA Kuala Lumpur & Selangor" },
  description: "Join DAMA Kuala Lumpur & Selangor and manage your membership.",
  icons: { icon: "/assets/img/logo-480.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#071b41" />
        <link rel="stylesheet" href="/assets/css/styles.css" precedence="default" />
      </head>
      <body className="app-shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <Script src="/assets/js/main.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
