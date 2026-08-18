import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Playfair_Display } from "next/font/google";
// Throws when required configuration is missing — including the crisis line.
// Imported here as well as in instrumentation.ts so that `next build`, which
// prerenders this layout, fails rather than shipping a broken deployment.
import { siteUrl } from "@/lib/env";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-playfair",
  display: "swap",
});

// IBM Plex Mono, not DM Mono. DM Mono has no glyphs for ẹ ọ Ẹ Ọ, so it cannot
// render this app's own name or Ẹlẹ́rìí's. The `latin-ext` subset carries the
// combining marks the Yoruba orthography needs.
const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const site = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Ẹ̀rí", template: "%s · Ẹ̀rí" },
  description:
    "An accountability covenant between two men. The image never leaves your phone, and you get the chance to speak first.",
  applicationName: "Ẹ̀rí",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/icons/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/icons/icon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/brand/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "Ẹ̀rí",
    title: "Ẹ̀rí",
    description: "The record stays on your phone. You get the chance to speak first.",
    url: site,
    images: [{ url: "/brand/social/og-image-1200x630.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ẹ̀rí",
    images: ["/brand/social/og-image-1200x630.png"],
  },
  // The subject's and ally's surfaces are private; robots.ts disallows them too.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
