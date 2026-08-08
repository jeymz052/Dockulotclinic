import type { MetadataRoute } from "next";
import { samplePosts } from "@/src/data/samplePosts";
import { getPublishedContentPosts } from "@/src/lib/services/content-posts";
import { absoluteUrl } from "@/src/lib/site-metadata";

const PUBLIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/about", priority: 0.9, changeFrequency: "monthly" },
  { path: "/services", priority: 0.9, changeFrequency: "monthly" },
  { path: "/online-services", priority: 0.8, changeFrequency: "monthly" },
  { path: "/booking", priority: 0.9, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
  { path: "/videos", priority: 0.7, changeFrequency: "weekly" },
  { path: "/live", priority: 0.7, changeFrequency: "weekly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let posts = samplePosts;

  try {
    const publishedPosts = await getPublishedContentPosts(100);
    if (publishedPosts.length) {
      posts = publishedPosts;
    }
  } catch {
    posts = samplePosts;
  }

  const postRoutes = posts
    .filter((post) => post.slug)
    .map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.updated_at ? new Date(post.updated_at) : now,
      changeFrequency: "monthly" as const,
      priority: post.is_featured ? 0.7 : 0.6,
    }));

  return [...routes, ...postRoutes];
}
