import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-4xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Access Restricted</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">You do not have access to this page.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          The page exists, but your current account role is not allowed to open it. If you were trying to access
          clinic POS billing, please sign in with a staff account such as Super Admin, Secretary, or Doctor.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-semibold text-white transition hover:bg-yellow-400"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/payments"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Payments
          </Link>
        </div>
      </div>
    </main>
  );
}
