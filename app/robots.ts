import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/login",
        "/register",
        "/unauthorized",
        "/appointments",
        "/consultations",
        "/contents",
        "/creator-content",
        "/dashboard",
        "/faq-content",
        "/help",
        "/inquiries",
        "/patients",
        "/payments",
        "/portal",
        "/prescriptions",
        "/pricing",
        "/profile",
        "/reports",
        "/schedules",
        "/security",
        "/settings",
        "/users",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
