import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Every surface that belongs to a particular man. The landing page and
      // the sign-in page are the only public ones.
      disallow: ["/subject", "/ally", "/devices", "/settings", "/covenant/", "/simulator", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
