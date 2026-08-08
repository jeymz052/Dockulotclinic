"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  FaClockRotateLeft,
  FaCloudArrowDown,
  FaFileShield,
  FaKey,
  FaShieldHalved,
  FaUserLock,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

type ActivityLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_table: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null; role?: string | null } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function humanizeAction(action: string) {
  return action
    .replace(/^auth\./, "Auth ")
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SecurityPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isDownloading, startDownload] = useTransition();

  const canExportBackups = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const stats = useMemo(() => {
    const loginEvents = logs.filter((log) => log.action.startsWith("auth.")).length;
    const backupEvents = logs.filter((log) => log.action === "backup.export").length;
    const patientEvents = logs.filter((log) => log.entity_table === "patients").length;
    return { loginEvents, backupEvents, patientEvents };
  }, [logs]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;
    setLoadingLogs(true);

    (async () => {
      try {
        const res = await fetch("/api/v2/activity-logs", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load activity logs.");
        const payload = (await res.json()) as { logs?: ActivityLog[] };
        if (active) setLogs(payload.logs ?? []);
      } catch (error) {
        if (active) {
          setFeedback({
            type: "error",
            message: error instanceof Error ? error.message : "Failed to load activity logs.",
          });
        }
      } finally {
        if (active) setLoadingLogs(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  function downloadBackup() {
    if (!accessToken) return;
    setFeedback(null);

    startDownload(async () => {
      try {
        const res = await fetch("/api/v2/backups", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "Failed to export backup.");
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `clinic-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setFeedback({ type: "success", message: "Backup export started." });
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to export backup.",
        });
      }
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-700">Security</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Access control and audit center</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Monitor protected activity, export operational backups, and review the controls used for patient data privacy.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadBackup}
            disabled={!canExportBackups || isDownloading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <FaCloudArrowDown className="h-4 w-4" aria-hidden="true" />
            {isDownloading ? "Preparing..." : "Export Backup"}
          </button>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border border-neutral-200 bg-neutral-50 text-neutral-700"
              : "border border-neutral-200 bg-neutral-50 text-neutral-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <ControlCard icon={<FaUserLock />} title="Roles" value="4" detail="Doctor, Admin, Staff, Patient" />
        <ControlCard icon={<FaKey />} title="Password" value="Strong" detail="Length, complexity, reset flow" />
        <ControlCard icon={<FaFileShield />} title="Patient Privacy" value={`${stats.patientEvents}`} detail="Patient-data audit events" />
        <ControlCard icon={<FaClockRotateLeft />} title="Auth Events" value={`${stats.loginEvents}`} detail="Login and logout records" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-50 text-neutral-700">
              <FaShieldHalved className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Role Access</h2>
              <p className="text-xs text-slate-500">Server APIs re-check roles before returning data.</p>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            {[
              ["Doctor", "Clinical workflow, schedules, consultations, reports, backup export"],
              ["Admin", "Full user, settings, security, and system configuration"],
              ["Staff", "Appointments, patients, POS billing, reports, logs"],
              ["Patient", "Own bookings, payments, prescriptions, files, and profile"],
            ].map(([label, detail]) => (
              <div key={label} className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[120px_1fr]">
                <p className="text-sm font-bold text-slate-900">{label}</p>
                <p className="text-sm text-slate-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Activity Logs</h2>
              <p className="text-xs text-slate-500">Latest security-relevant actions.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {loadingLogs ? "Loading" : `${logs.length} rows`}
            </span>
          </div>

          <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-slate-200">
            {loadingLogs ? (
              <div className="p-4 text-sm text-slate-500">Loading activity logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No activity logs yet.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{humanizeAction(log.action)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[log.entity_table, log.entity_id].filter(Boolean).join(" · ") || "System"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.profiles?.full_name ?? log.profiles?.email ?? "System"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ControlCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-50 text-neutral-700">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-black">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

