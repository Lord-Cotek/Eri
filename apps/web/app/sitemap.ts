import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";

const base = siteUrl();

/** Only the two public surfaces. Everything else belongs to somebody. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${base}/signin`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
