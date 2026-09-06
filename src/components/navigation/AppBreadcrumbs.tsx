"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

const LABELS: Record<string, string> = {
  appointments: "Appointments",
  consultations: "Consultations",
  dashboard: "Dashboard",
  files: "Medical Documents",
  messages: "Messages",
  patients: "Patients",
  profile: "Profile",
  records: "Patient Records",
  settings: "Settings",
};

export function AppBreadcrumbs({ items }: { items?: BreadcrumbItem[] }) {
  const pathname = usePathname();
  const generated = pathname.split("/").filter(Boolean).map((part, index, parts) => ({
    label: LABELS[part] ?? decodeURIComponent(part).replace(/[-_]/g, " "),
    href: index === parts.length - 1 ? undefined : `/${parts.slice(0, index + 1).join("/")}`,
  }));
  const resolvedItems = items ?? generated;
  if (!resolvedItems.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
      {resolvedItems.map((item, index) => {
        const isLast = index === resolvedItems.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition hover:text-black">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-black" : ""}>{item.label}</span>
            )}
            {!isLast ? <span aria-hidden="true">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
