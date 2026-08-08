"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaCircleCheck, FaCircleXmark } from "react-icons/fa6";
import BookAppointmentPage from "@/src/components/appointments/BookAppointmentPage";
import { useRole } from "@/src/components/layout/RoleProvider";

type FinalizeState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "success"; appointmentId: string | null }
  | { kind: "error"; message: string };

async function applyPendingOnlineConsultationDraft(
  accessToken: string,
  appointmentId: string,
  reservationId: string,
) {
  if (typeof window === "undefined") return;

  const raw = sessionStorage.getItem("pendingOnlineConsultationDraft");
  if (!raw) return;

  let draft: {
    reservationId?: string;
    concern?: string;
    symptoms?: string;
    files?: Array<{ file_name: string; file_type: string; file_url: string }>;
  };
  try {
    draft = JSON.parse(raw) as typeof draft;
  } catch {
    return;
  }
  if (draft.reservationId && draft.reservationId !== reservationId) return;

  const res = await fetch("/api/v2/online-consultations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      appointment_id: appointmentId,
      concern: draft.concern ?? "",
      symptoms: draft.symptoms ?? "",
      files: draft.files ?? [],
    }),
  });

  if (!res.ok) return;

  sessionStorage.removeItem("pendingOnlineConsultationDraft");
  localStorage.removeItem("bookingReservation");
}

/**
 * /appointments is the booking flow for patients, secretaries, and admins.
 * Doctors don't book — they manage — so we redirect them to /appointments/my
 * (which renders AppointmentListPage for non-patient roles).
 */
export default function AppointmentsPage() {
  const router = useRouter();
  const { role, isLoading, accessToken } = useRole();
  const [finalize, setFinalize] = useState<FinalizeState>({ kind: "idle" });

  // When the patient comes back from PayMongo with ?reservation_paid=<id>, we
  // proactively call /api/v2/payments/reconcile to finalize the booking. This
  // guarantees the appointment is created the moment the patient lands here —
  // even if PayMongo's webhook never reached our server (which is the normal
  // case during local development without a public tunnel). The reconcile
  // endpoint is idempotent, so if the webhook later succeeds it's a no-op.
  useEffect(() => {
    if (typeof window === "undefined" || !accessToken) return;

    const params = new URLSearchParams(window.location.search);
    const reservationId = params.get("reservation_paid");
    if (!reservationId) return;

    let cancelled = false;
    setFinalize({ kind: "running" });

    (async () => {
      try {
        const res = await fetch("/api/v2/payments/reconcile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ reservation_id: reservationId }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          data?: { appointment?: { id?: string } | null };
          message?: string;
        };
        if (cancelled) return;

        if (!res.ok) {
          setFinalize({
            kind: "error",
            message: payload.message ?? "Could not finalize the booking. Contact the clinic so they can reconcile your payment.",
          });
          return;
        }

        const appointmentId = payload.data?.appointment?.id ?? null;
        if (appointmentId) {
          await applyPendingOnlineConsultationDraft(accessToken, appointmentId, reservationId);
        }

        // Tidy up local storage and the URL so a refresh doesn't re-trigger.
        try {
          localStorage.removeItem("bookingDraft");
        } catch {
          // ignore
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("reservation_paid");
        window.history.replaceState({}, "", url.toString());

        setFinalize({
          kind: "success",
          appointmentId,
        });
      } catch (e) {
        if (cancelled) return;
        setFinalize({
          kind: "error",
          message: e instanceof Error ? e.message : "Network error while finalizing your booking.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!isLoading && role === "DOCTOR") {
      router.replace("/appointments/my");
    }
  }, [isLoading, role, router]);

  if (isLoading || role === "DOCTOR") {
    return <div className="h-40 rounded-4xl border border-neutral-100 bg-white animate-pulse shadow-sm" />;
  }

  const isStaff = role === "SUPER_ADMIN" || role === "SECRETARY";
  const manageHref = "/appointments/my";
  const manageLabel = isStaff ? "Manage Appointments" : "My Appointments";

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-100 bg-[radial-gradient(circle_at_top_left,rgba(17,17,17,0.16),transparent_34%),linear-gradient(135deg,#f8f8f7_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.10)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-700">Appointments</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Book and manage visits in one place</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A calmer booking flow for patients and front-desk staff, with shortcuts to payments and records.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Shortcut href={manageHref} label={manageLabel} />
            <Shortcut href="/patients/records" label="Patient Records" />
            <Shortcut href="/payments" label="Payments" />
          </div>
        </div>
      </section>

      {finalize.kind === "running" ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
          <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" aria-hidden="true" />
          <span>Finalizing your booking — confirming the payment with PayMongo…</span>
        </div>
      ) : null}
      {finalize.kind === "success" ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
          <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <div>
            <p className="font-semibold">Booking confirmed!</p>
            <p className="mt-0.5">
              Your online consultation has been recorded.{" "}
              <Link href={manageHref} className="font-semibold underline underline-offset-2 hover:text-neutral-800">
                View your appointments →
              </Link>
            </p>
          </div>
        </div>
      ) : null}
      {finalize.kind === "error" ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800">
          <FaCircleXmark className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <div>
            <p className="font-semibold">We couldn&apos;t finalize the booking automatically</p>
            <p className="mt-0.5">{finalize.message}</p>
          </div>
        </div>
      ) : null}

      <BookAppointmentPage />
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-neutral-100 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50"
    >
      {label}
    </Link>
  );
}

