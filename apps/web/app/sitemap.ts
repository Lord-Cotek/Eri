import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Only the two public surfaces. Everything else belongs to somebody. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/signin`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
