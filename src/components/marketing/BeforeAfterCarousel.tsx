import Image from "next/image";
import type { BeforeAfterItem } from "@/src/lib/healthcare-content";

type BeforeAfterCarouselProps = {
  items: BeforeAfterItem[];
  compact?: boolean;
};

export function BeforeAfterCarousel({ items, compact = false }: BeforeAfterCarouselProps) {
  if (items.length === 0) return null;

  const duration = compact ? 24 : 34;

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#f8f8f5] py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-3xl font-semibold text-black sm:text-4xl">
              GlowRx Results
            </h3>
            <p className="mt-1 font-serif text-sm italic text-neutral-600 sm:text-base">
              Medical weight-loss progress and aesthetic transformations
            </p>
          </div>

          <div className="mt-1 shrink-0 border border-neutral-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase text-neutral-700">
            Results Board
          </div>
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex w-max gap-4 px-4 sm:px-6 lg:px-8"
          style={{ animation: `beforeAfterMarquee ${duration}s linear infinite` }}
        >
          {[0, 1].map((groupIndex) => (
            <div key={`result-group-${groupIndex}`} className="flex gap-4">
              {items.map((item, index) => (
                <ResultCard
                  key={`${item.title}-${groupIndex}-${index}`}
                  item={item}
                  caseNumber={index + 1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes beforeAfterMarquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}

function ResultCard({
  item,
  caseNumber,
}: {
  item: BeforeAfterItem;
  caseNumber: number;
}) {
  const hasSplitImages = Boolean(item.beforeImage && item.afterImage);

  return (
    <article className="w-[82vw] shrink-0 bg-white p-4 shadow-[0_22px_70px_rgba(0,0,0,0.08)] sm:w-[34rem] lg:w-[38rem] xl:w-[42rem]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-500">{item.program}</p>
          <h4 className="mt-1 truncate font-serif text-2xl font-semibold text-black">{item.title}</h4>
          <p className="mt-1 line-clamp-1 text-sm text-neutral-600">{item.caption}</p>
        </div>
        <div className="shrink-0 border border-neutral-300 px-3 py-1 text-[10px] font-semibold uppercase text-neutral-600">
          Case {String(caseNumber).padStart(2, "0")}
        </div>
      </div>

      <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100 sm:aspect-[5/4]">
        {hasSplitImages ? (
          <div className="grid h-full grid-cols-2">
            <ImagePanel
              src={item.beforeImage ?? ""}
              alt={`${item.title} before`}
              label="Before"
            />
            <ImagePanel
              src={item.afterImage ?? ""}
              alt={`${item.title} after`}
              label="After"
            />
          </div>
        ) : (
          <div className="relative h-full">
            <Image
              src={item.image ?? ""}
              alt={item.title}
              fill
              unoptimized
              className="object-contain object-center"
            />
          </div>
        )}
      </div>
    </article>
  );
}

function ImagePanel({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: "Before" | "After";
}) {
  return (
    <div className="relative bg-neutral-100">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className="object-contain object-center"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 py-3">
        <span className="inline-flex bg-black/78 px-2.5 py-1 text-[10px] font-black uppercase text-white">
          {label}
        </span>
      </div>
    </div>
  );
}
