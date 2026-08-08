import type { Metadata } from "next";
import { getPublishedFaqs } from "@/src/lib/services/faqs";
import type { PublicFaq } from "@/src/lib/services/faqs";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Find answers to common Doc Kulot questions about appointments, clinic services, online consultation, payments, prescriptions, patient portal, videos, and inquiries.",
  alternates: {
    canonical: "/faq",
  },
};

export default async function FaqPage() {
  const faqs = await getPublishedFaqs();
  const faqGroups = groupFaqsByCategory(faqs);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-700">FAQ System</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">Frequently asked questions</h1>
        <p className="mt-4 max-w-3xl leading-8 text-slate-600">
          Browse all published clinic FAQs by category, from appointments and services to online consultation,
          prescriptions, patient portal help, and creator content.
        </p>

        <div className="mt-10 rounded-[2.25rem] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f7_100%)] p-5 shadow-[0_25px_60px_-40px_rgba(17,17,17,0.22)] sm:p-6">
          <div className="flex flex-wrap gap-2">
            {faqGroups.map((group) => (
              <span
                key={group.category}
                className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-neutral-800 shadow-sm"
              >
                {group.category}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {faqGroups.map((group) => (
              <section
                key={group.category}
                className="rounded-[1.85rem] border border-neutral-200 bg-white/95 p-5 shadow-[0_18px_40px_-32px_rgba(17,17,17,0.18)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-700">FAQ Category</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-black">{group.category}</h2>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-neutral-700">
                    {group.items.length} question{group.items.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {group.items.map((faq) => (
                    <details key={`${faq.category}-${faq.question}`} className="group rounded-[1.4rem] border border-neutral-200 bg-neutral-50/80 px-4 py-4 transition hover:border-neutral-300 hover:bg-white">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-left">
                        <span className="text-base font-bold leading-7 text-black">{faq.question}</span>
                        <span className="mt-1 text-lg font-black leading-none text-neutral-900 transition group-open:rotate-45">+</span>
                      </summary>
                      <p className="mt-4 border-t border-neutral-200 pt-4 leading-7 text-neutral-600">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function groupFaqsByCategory(faqs: PublicFaq[]) {
  const map = new Map<string, PublicFaq[]>();

  for (const faq of faqs) {
    const items = map.get(faq.category) ?? [];
    items.push(faq);
    map.set(faq.category, items);
  }

  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    items,
  }));
}
