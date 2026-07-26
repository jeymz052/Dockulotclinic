import Link from "next/link";
import type { ReactNode } from "react";
import {
  FaArrowRight,
  FaCalendarCheck,
  FaCreditCard,
  FaFileInvoiceDollar,
  FaFolderOpen,
  FaHeartPulse,
  FaInbox,
  FaListUl,
  FaShieldHalved,
  FaStethoscope,
  FaUsers,
  FaVideo,
} from "react-icons/fa6";

const STAFF_TOPICS = [
  {
    question: "How do I book or approve appointments?",
    answer:
      "Open Appointments to book a new visit, review pending clinic requests, approve bookings, check the schedule, and move patients through the queue.",
  },
  {
    question: "Where do I manage billing and POS?",
    answer:
      "Use Payments for the payment history and POS Billing for invoice creation, payment recording, receipts, and sales tracking.",
  },
  {
    question: "How do I manage inventory and suppliers?",
    answer:
      "Open Inventory to view products, update stock levels, record movement, monitor expiry dates, and edit supplier records in the suppliers tab.",
  },
  {
    question: "Where do inquiries and FAQs live?",
    answer:
      "Use Inquiries for patient messages and follow-ups. FAQ Content is where the public clinic FAQs are created and updated.",
  },
  {
    question: "How do I update the website content?",
    answer:
      "Open Website Content to edit the landing page sections. The public blogs, videos, and live posts are created in Content Creator.",
  },
  {
    question: "How do I review reports and logs?",
    answer:
      "Use Reports for clinic, sales, POS, inventory, content, and traffic analytics. Use Security for activity logs and backup export.",
  },
];

const STAFF_SHORTCUTS = [
  { href: "/appointments/my", label: "Appointments", icon: <FaCalendarCheck className="h-4 w-4" /> },
  { href: "/payments/pos", label: "POS Billing", icon: <FaFileInvoiceDollar className="h-4 w-4" /> },
  { href: "/inventory", label: "Inventory", icon: <FaFolderOpen className="h-4 w-4" /> },
  { href: "/reports", label: "Reports", icon: <FaListUl className="h-4 w-4" /> },
  { href: "/contents", label: "Website Content", icon: <FaHeartPulse className="h-4 w-4" /> },
  { href: "/security", label: "Security", icon: <FaShieldHalved className="h-4 w-4" /> },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[2.5rem] border border-yellow-100 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.24),transparent_34%),linear-gradient(135deg,#f8fcff_0%,#ecf8ff_48%,#dff2ff_100%)] p-6 shadow-[0_24px_70px_rgba(14,116,194,0.10)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow-700">Help Center</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
              Doc Kulot clinic help for staff workflows
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Find quick answers for appointments, POS, inventory, inquiries, content, reports, and security without leaving the clinic dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {STAFF_SHORTCUTS.map((item) => (
              <Shortcut key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-yellow-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatCard title="Appointments" value="Booking, queue, approval" />
          <StatCard title="POS Billing" value="Invoices, payments, receipts" />
          <StatCard title="Inventory" value="Products, suppliers, expiry" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-yellow-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
              <FaStethoscope className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-700">Quick Modules</p>
              <h2 className="text-xl font-black tracking-tight text-black">Where to go for each task</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {MODULE_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[1.4rem] border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fcff_100%)] p-4 transition hover:-translate-y-0.5 hover:border-yellow-200 hover:shadow-[0_14px_34px_rgba(14,116,194,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-700">{card.kicker}</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight text-black">{card.title}</h3>
                  </div>
                  <span className="rounded-full bg-yellow-50 p-2 text-yellow-700 transition group-hover:bg-yellow-100">
                    {card.icon}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-yellow-700">
                  Open module
                  <FaArrowRight className="h-3.5 w-3.5" />
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-yellow-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
              <FaInbox className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-700">Common Questions</p>
              <h2 className="text-xl font-black tracking-tight text-black">Answers for front-desk and clinic staff</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {STAFF_TOPICS.map((faq) => (
              <details key={faq.question} className="group rounded-[1.35rem] border border-yellow-100 bg-yellow-50/45">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 text-left font-semibold text-slate-900">
                  <span>{faq.question}</span>
                  <span className="shrink-0 text-yellow-700 transition group-open:rotate-45">+</span>
                </summary>
                <p className="border-t border-yellow-100 px-4 py-4 text-sm leading-6 text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-yellow-100 bg-[linear-gradient(135deg,#ffffff_0%,#eff8ff_100%)] p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-yellow-700">Need a hand?</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-black">Use the clinic tools, then reach out if something still needs review.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              If a task still feels blocked, open the relevant module first. For anything that needs manual review, use the Contact page or the inquiry queue so the team can help.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-3 text-sm font-bold text-white transition hover:bg-yellow-400"
            >
              Contact clinic
              <FaArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/inquiries"
              className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white px-5 py-3 text-sm font-bold text-yellow-700 transition hover:bg-yellow-50"
            >
              Open inquiries
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Shortcut({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2.5 text-sm font-semibold text-yellow-700 shadow-sm transition hover:-translate-y-0.5 hover:border-yellow-200 hover:bg-white"
    >
      {icon}
      {label}
    </Link>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-yellow-100 bg-yellow-50/50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

const MODULE_CARDS = [
  {
    href: "/appointments",
    kicker: "Appointments",
    title: "Booking and queue",
    description: "Book, approve, and manage clinic or online appointments, then move patients through the queue and calendar.",
    icon: <FaCalendarCheck className="h-4 w-4" />,
  },
  {
    href: "/payments",
    kicker: "Billing",
    title: "Payments and receipts",
    description: "Review payment history, confirm online consult payments, and print receipts from the payment area.",
    icon: <FaCreditCard className="h-4 w-4" />,
  },
  {
    href: "/payments/pos",
    kicker: "POS",
    title: "Invoices and sales",
    description: "Create invoices, record payments, and track clinic services or product sales in the POS terminal.",
    icon: <FaFileInvoiceDollar className="h-4 w-4" />,
  },
  {
    href: "/inventory",
    kicker: "Inventory",
    title: "Products and suppliers",
    description: "Track stock, low inventory, expiry dates, movements, and supplier details in one place.",
    icon: <FaFolderOpen className="h-4 w-4" />,
  },
  {
    href: "/inquiries",
    kicker: "Inquiries",
    title: "Patient messages",
    description: "Handle contact inquiries and follow-up messages from patients without leaving the dashboard.",
    icon: <FaInbox className="h-4 w-4" />,
  },
  {
    href: "/security",
    kicker: "Security",
    title: "Logs and backups",
    description: "View activity logs, export backups, and review access control and login activity.",
    icon: <FaShieldHalved className="h-4 w-4" />,
  },
] as const;
