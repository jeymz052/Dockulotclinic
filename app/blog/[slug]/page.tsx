import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleTemplate from "@/src/components/blog/ArticleTemplate";
import { getPublishedContentPostBySlug } from "@/src/lib/services/content-posts";
import { absoluteUrl } from "@/src/lib/site-metadata";

export const revalidate = 60; // Cache for 1 minute

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPublishedContentPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description =
    post.excerpt || "Read this Doc Kulot health article for patient education and clinic guidance.";
  const image = post.thumbnail_url
    ? post.thumbnail_url.startsWith("http")
      ? post.thumbnail_url
      : absoluteUrl(post.thumbnail_url)
    : undefined;

  return {
    title: post.title,
    description,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.published_at ?? post.created_at,
      modifiedTime: post.updated_at,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const post = await getPublishedContentPostBySlug(slug);
  if (!post) return notFound();

  return <ArticleTemplate post={post} />;
}
