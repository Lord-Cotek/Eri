import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";

const base = siteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Every surface that belongs to a particular man. The landing page and
      // the sign-in page are the only public ones.
      disallow: ["/subject", "/ally", "/devices", "/settings", "/covenant/", "/simulator", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
