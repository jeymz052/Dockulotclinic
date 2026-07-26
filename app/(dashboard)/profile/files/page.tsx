"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaArrowUpRightFromSquare, FaFileMedical, FaFolderOpen } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

type PatientFile = {
  id: string;
  appointment_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string;
};

export default function PatientFilesPage() {
  const { accessToken } = useRole();
  const [files, setFiles] = useState<PatientFile[]>([]);
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

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-yellow-100 bg-linear-to-br from-amber-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-700">Patient Portal</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black">Uploaded Medical Files</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          View files the clinic has released to your portal, including supporting documents and visit attachments.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/consultations/history" className="rounded-full border border-yellow-200 bg-white px-4 py-2.5 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50">
          Consultation History
        </Link>
        <Link href="/prescriptions" className="rounded-full border border-yellow-200 bg-white px-4 py-2.5 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50">
          Prescriptions
        </Link>
      </div>

      {error ? <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">{error}</div> : null}

      <section className="grid gap-4">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
        ) : files.length ? (
          files.map((file) => (
            <article key={file.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-black">
                    <FaFileMedical className="text-amber-400" />
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
                  className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-400"
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
              <FaFolderOpen className="text-xl text-amber-400" />
            </div>
            <p className="mt-4 font-semibold text-slate-900">No medical files available yet</p>
            <p className="mt-2">Files will appear here once clinic staff uploads and releases them to your portal.</p>
          </div>
        )}
      </section>
    </div>
  );
}
