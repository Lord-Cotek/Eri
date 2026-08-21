import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";

const base = siteUrl();

/**
 * Only the public surfaces. Everything else belongs to somebody.
 *
 * The privacy policy is here deliberately: both app stores require it to be
 * reachable without an account, and a store reviewer should not have to be told
 * where it is.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/signin`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
