import BlogIndex from "@/src/components/blog/BlogIndex";
import PublicHeader from "@/src/components/layout/PublicHeader";
import { contentCategories } from "@/src/lib/healthcare-content";
import { getPublishedContentPosts } from "@/src/lib/services/content-posts";

export default async function BlogPage() {
  const posts = await getPublishedContentPosts(24);

  return (
    <main className="min-h-screen bg-neutral-50 text-black">
      <PublicHeader />

      <section className="mx-auto max-w-7xl px-4 pt-20 pb-10 sm:px-6 sm:pt-24 sm:pb-14">
        <div className="mb-8 border-b border-neutral-200 pb-4 text-sm font-semibold text-neutral-500">
          <span className="text-neutral-700">Blog</span>
        </div>
        <BlogIndex posts={posts} categories={contentCategories} mode="page" />
      </section>
    </main>
  );
}
