import type { BlogBlock } from "@/src/lib/content-post-blocks";

export default function BlogBlockRenderer({ blocks, title }: { blocks: BlogBlock[]; title: string }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={`${block.type}-${index}`} className="text-base leading-8 text-slate-700 sm:text-lg">
              {block.text}
            </p>
          );
        }

        if (block.type === "h2") {
          return (
            <h2 key={`${block.type}-${index}`} className="pt-4 text-2xl font-black tracking-tight text-yellow-800 sm:text-3xl">
              {block.text}
            </h2>
          );
        }

        if (block.type === "h3") {
          return (
            <h3 key={`${block.type}-${index}`} className="pt-2 text-xl font-bold text-slate-900 sm:text-2xl">
              {block.text}
            </h3>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={`${block.type}-${index}`}
              className="rounded-[1.5rem] border-l-4 border-amber-400 bg-yellow-50 px-6 py-5 text-lg italic leading-8 text-slate-700"
            >
              {block.text}
            </blockquote>
          );
        }

        if (block.type === "ul" || block.type === "ol") {
          const ListTag = block.type === "ol" ? "ol" : "ul";
          const listClassName =
            block.type === "ol"
              ? "list-decimal space-y-3 pl-6 text-base leading-8 text-slate-700 sm:text-lg"
              : "list-disc space-y-3 pl-6 text-base leading-8 text-slate-700 sm:text-lg";
          return (
            <ListTag key={`${block.type}-${index}`} className={listClassName}>
              {block.items?.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}
            </ListTag>
          );
        }

        if (block.type === "image" && block.url) {
          return (
            <figure key={`${block.type}-${index}`} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
              <img src={block.url} alt={block.alt || title} className="h-auto w-full object-cover" />
            </figure>
          );
        }

        if (block.type === "embed" && block.url) {
          return (
            <div key={`${block.type}-${index}`} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-black">
              <iframe
                title={`embed-${index}`}
                src={block.url}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          );
        }

        if (block.type === "divider") {
          return <hr key={`${block.type}-${index}`} className="border-slate-200" />;
        }

        if (block.type === "cta") {
          return (
            <div key={`${block.type}-${index}`} className="rounded-[1.75rem] bg-amber-700 px-6 py-8 text-center text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-100">Take the next step</p>
              <a
                href={block.buttonLink}
                className="mt-4 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-yellow-700 transition hover:bg-yellow-50"
              >
                {block.buttonText}
              </a>
            </div>
          );
        }

        if (block.type === "faq") {
          return (
            <details key={`${block.type}-${index}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4">
              <summary className="cursor-pointer text-lg font-bold text-slate-900">{block.question}</summary>
              <p className="mt-3 text-base leading-7 text-slate-700">{block.answer}</p>
            </details>
          );
        }

        return null;
      })}
    </>
  );
}
