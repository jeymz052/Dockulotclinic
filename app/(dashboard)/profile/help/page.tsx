"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FaArrowRight, FaCreditCard, FaRegCalendarCheck, FaVideo, FaFilePrescription, FaFolderOpen, FaCircleQuestion } from "react-icons/fa6";

const PATIENT_TOPICS = [
  {
    question: "How do I book an appointment?",
    answer: "Open Appointments, choose clinic or online, pick a date and time, then confirm your details and submit the booking.",
  },
  {
    question: "How do I check if my appointment is confirmed?",
    answer: "Open My Appointments to see pending, confirmed, completed, or cancelled bookings, plus any schedule updates.",
  },
  {
    question: "How do I join my online consultation?",
    answer: "Open Consultations near your appointment time. When the doctor is ready, the meeting link appears in your session.",
  },
  {
    question: "Where can I view prescriptions and diagnosis?",
    answer: "Open Prescriptions or the Patient Portal to view doctor-released notes, download PDFs, and print copies for pharmacy use.",
  },
  {
    question: "Where can I see my files and billing history?",
    answer: "Use Medical Files for released uploads and Payments to review completed transactions and receipts.",
  },
];

const PATIENT_SHORTCUTS = [
  { href: "/appointments", label: "Book Appointment", icon: <FaRegCalendarCheck className="h-4 w-4" /> },
  { href: "/consultations", label: "Consultations", icon: <FaVideo className="h-4 w-4" /> },
  { href: "/prescriptions", label: "Prescriptions", icon: <FaFilePrescription className="h-4 w-4" /> },
  { href: "/profile/files", label: "Medical Files", icon: <FaFolderOpen className="h-4 w-4" /> },
  { href: "/payments", label: "Payments", icon: <FaCreditCard className="h-4 w-4" /> },
];

export default function PatientHelpPage() {
  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_34%),linear-gradient(135deg,#f8f8f7_0%,#f3f3f3_48%,#eaeaea_100%)] p-6 shadow-[0_24px_70px_rgba(17,17,17,0.10)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow-700">Patient Help Center</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
              Help for booking, consultations, and portal tasks
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Everything here is focused on the patient experience inside Doc Kulot, with clear shortcuts to the pages you use most.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {PATIENT_SHORTCUTS.map((item) => (
              <Shortcut key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-yellow-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatCard title="Appointments" value="Book, review, and track status" />
          <StatCard title="Portal" value="Prescriptions, notes, and files" />
          <StatCard title="Payments" value="History, receipts, and status" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-yellow-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
              <FaRegCalendarCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-700">Quick Actions</p>
              <h2 className="text-xl font-black tracking-tight text-black">Jump to the page you need</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {PATIENT_MODULES.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[1.4rem] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8f8f7_100%)] p-4 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_14px_34px_rgba(17,17,17,0.08)]"
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
                  Open page
                  <FaArrowRight className="h-3.5 w-3.5" />
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-yellow-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
              <FaCircleQuestion className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-700">Common Questions</p>
              <h2 className="text-xl font-black tracking-tight text-black">Straight answers for patients</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {PATIENT_TOPICS.map((faq) => (
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
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-yellow-700">Still stuck?</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-black">Use the clinic tools first, then contact the team if you need manual help.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              For booking issues, payment questions, prescription visibility, or profile details, open the matching page above or use the contact page so the clinic can help directly.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-black"
            >
              Contact clinic
              <FaArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/profile/inquiries"
              className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white px-5 py-3 text-sm font-bold text-yellow-700 transition hover:bg-yellow-50"
            >
              Follow-up inquiries
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

const PATIENT_MODULES = [
  {
    href: "/appointments",
    kicker: "Appointments",
    title: "Book and manage visits",
    description: "Choose clinic or online, pick a date and time, and check your booking status later in My Appointments.",
    icon: <FaRegCalendarCheck className="h-4 w-4" />,
  },
  {
    href: "/consultations",
    kicker: "Consultations",
    title: "Join online sessions",
    description: "Open consultations near your appointment time to see the meeting link and session details.",
    icon: <FaVideo className="h-4 w-4" />,
  },
  {
    href: "/prescriptions",
    kicker: "Prescriptions",
    title: "View, download, print",
    description: "Released prescriptions from the doctor appear here and can be downloaded as PDF or printed.",
    icon: <FaFilePrescription className="h-4 w-4" />,
  },
  {
    href: "/profile/files",
    kicker: "Medical files",
    title: "Access released files",
    description: "Open uploaded medical files and attachments that the clinic has made visible to your portal.",
    icon: <FaFolderOpen className="h-4 w-4" />,
  },
  {
    href: "/payments",
    kicker: "Payments",
    title: "Check billing history",
    description: "Review paid transactions, receipts, and your online consultation payment history.",
    icon: <FaCreditCard className="h-4 w-4" />,
  },
  {
    href: "/profile/settings",
    kicker: "Profile",
    title: "Keep details updated",
    description: "Update your contact details so reminders and clinic messages reach the correct account.",
    icon: <FaCircleQuestion className="h-4 w-4" />,
  },
] as const;
