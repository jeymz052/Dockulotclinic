"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaArrowUpRightFromSquare, FaFileMedical, FaFolderOpen } from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getAppointmentPrimaryLabel, isProcedureServiceTitle } from "@/src/lib/appointment-context";
import { resolveAftercareGuideForService } from "@/src/lib/healthcare-content";
import ProcedureConsentRegister from "@/src/components/appointments/ProcedureConsentRegister";

type PatientFile = {
  id: string;
  appointment_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string;
};

type ProcedureConsent = {
  id: string;
  appointment_id: string | null;
  procedure_name: string;
  consent_form_url: string;
  aftercare_acknowledged: boolean;
  aftercare_guide_title: string | null;
  aftercare_image_url: string | null;
  signed_at: string;
};

export default function PatientFilesPage() {
  const { accessToken, role } = useRole();
  const { appointments, isLoading: isAppointmentsLoading } = useAppointments();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [consents, setConsents] = useState<ProcedureConsent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/v2/patient-files", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await res.json().catch(() => ({}))) as { files?: PatientFile[]; message?: string };
        if (!res.ok) throw new Error(payload.message ?? "Unable to load medical files.");
        if (active) {
          setFiles(payload.files ?? []);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load medical files.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadConsents() {
      try {
        const res = await fetch("/api/v2/procedure-consents", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await res.json().catch(() => ({}))) as { consents?: ProcedureConsent[] };
        if (active && res.ok) {
          setConsents(payload.consents ?? []);
        }
      } catch {
        if (active) setConsents([]);
      }
    }

    void loadConsents();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const aftercareItems = appointments
    .filter((appointment) => appointment.status === "Completed")
    .map((appointment) => {
      const service = getAppointmentPrimaryLabel(appointment.reason, appointment.type);
      if (!isProcedureServiceTitle(service)) return null;
      const guide = resolveAftercareGuideForService(service);
      if (!guide) return null;
      return { appointment, service, guide };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (role !== "PATIENT") return <ProcedureConsentRegister />;

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-neutral-100 bg-linear-to-br from-neutral-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-700">Patient Portal</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black">Uploaded Medical Files</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          View files the clinic has released to your portal, including supporting documents and visit attachments.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/consultations/history" className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
          Consultation History
        </Link>
        <Link href="/prescriptions" className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
          Prescriptions
        </Link>
      </div>

      {error ? <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{error}</div> : null}

      {isAppointmentsLoading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
      ) : aftercareItems.length ? (
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700">Post Procedure Care</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Aftercare Guides</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {aftercareItems.map(({ appointment, service, guide }) => (
              <article key={`${appointment.id}-${guide.title}`} className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
                <div className="grid gap-0 sm:grid-cols-[140px_1fr]">
                  <img src={guide.image} alt={guide.title} className="h-44 w-full object-cover sm:h-full" />
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">{service}</p>
                    <h3 className="mt-1 text-base font-black text-slate-950">{guide.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Completed {new Date(`${appointment.date}T00:00:00`).toLocaleDateString("en-US")}
                    </p>
                    <a
                      href={guide.image}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      Open Guide
                      <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {consents.length ? (
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700">Procedure Consent</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Signed Consent Records</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {consents.map((consent) => (
              <article key={consent.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-black">{consent.procedure_name}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Signed {new Date(consent.signed_at).toLocaleString("en-US")}
                  {consent.aftercare_acknowledged ? " - Aftercare acknowledged" : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={consent.consent_form_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100">
                    Consent Form
                    <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
                  </a>
                  {consent.aftercare_image_url ? (
                    <a href={consent.aftercare_image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black">
                      Aftercare
                      <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
        ) : files.length ? (
          files.map((file) => (
            <article key={file.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-black">
                    <FaFileMedical className="text-neutral-400" />
                    {file.file_name}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {file.file_type || "Medical document"} • Uploaded {new Date(file.created_at).toLocaleString("en-US")}
                  </p>
                </div>
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Open File
                  <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white">
              <FaFolderOpen className="text-xl text-neutral-400" />
            </div>
            <p className="mt-4 font-semibold text-slate-900">No medical files available yet</p>
            <p className="mt-2">Files will appear here once clinic staff uploads and releases them to your portal.</p>
          </div>
        )}
      </section>
    </div>
  );
}

