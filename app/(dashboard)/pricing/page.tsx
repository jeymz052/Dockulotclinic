"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  FOLLOW_UP_CLINIC_CONSULTATION_FEE,
  NEW_PATIENT_CLINIC_CONSULTATION_FEE,
  ONLINE_CONSULTATION_FEE,
  normalizeConfiguredClinicConsultationRate,
  normalizeConfiguredOnlineConsultationRate,
} from "@/src/lib/consultation-pricing";

type PricingCategory = "Consultation" | "Lab" | "Medicine" | "Procedure" | "Other";

type PricingItem = {
  id: string;
  code: string;
  name: string;
  category: PricingCategory;
  price: number;
  is_active: boolean;
};

type DoctorRate = {
  id: string;
  name?: string;
  full_name?: string;
  specialty: string;
  license_no: string;
  consultation_fee_clinic: number;
  consultation_fee_online: number;
  profiles?:
    | {
        full_name?: string;
      }
    | {
        full_name?: string;
      }[];
};

type Draft = {
  code: string;
  name: string;
  category: PricingCategory;
  price: number;
  is_active: boolean;
};

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  category: "Consultation",
  price: ONLINE_CONSULTATION_FEE,
  is_active: true,
};

const CATEGORIES: Array<PricingCategory | "All"> = ["All", "Consultation", "Lab", "Medicine", "Procedure", "Other"];

function peso(value: number) {
  return `PHP ${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function doctorDisplayName(doctor: DoctorRate | null) {
  if (!doctor) return "Doctor";
  if (doctor.full_name?.trim()) return doctor.full_name.trim();
  if (doctor.name?.trim()) return doctor.name.trim();
  if (Array.isArray(doctor.profiles)) return doctor.profiles[0]?.full_name?.trim() || "Doctor";
  return doctor.profiles?.full_name?.trim() || "Doctor";
}

function sanitizeDraft(draft: Draft): Draft {
  return {
    ...draft,
    code: draft.code.trim().toUpperCase(),
    name: draft.name.trim(),
    price: Math.max(0, Number(draft.price) || 0),
  };
}

function createExampleLabel(rate: number) {
  return `Per online consult = ${peso(rate)}`;
}

export default function PricingPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const [items, setItems] = useState<PricingItem[]>([]);
  const [rates, setRates] = useState<DoctorRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [rateDraft, setRateDraft] = useState<{ clinic: number; online: number }>({
    clinic: NEW_PATIENT_CLINIC_CONSULTATION_FEE,
    online: ONLINE_CONSULTATION_FEE,
  });
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PricingCategory | "All">("All");
  const [showInactive, setShowInactive] = useState(true);
  const [isSaving, startTransition] = useTransition();

  const canEdit = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const primaryDoctor = rates[0] ?? null;
  const totalItems = items.length;
  const activeItems = items.filter((item) => item.is_active).length;
  const consultationItems = items.filter((item) => item.category === "Consultation");
  const onlineRate = primaryDoctor?.consultation_fee_online ?? rateDraft.online;
  const clinicRate = primaryDoctor?.consultation_fee_clinic ?? rateDraft.clinic;

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [pricingRes, doctorsRes] = await Promise.all([
          fetch("/api/v2/pricing?active=false", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch("/api/v2/doctors", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (!pricingRes.ok) throw new Error("Failed to load pricing.");
        if (!doctorsRes.ok) throw new Error("Failed to load consultation fees.");

        const pricingPayload = (await pricingRes.json()) as { pricing: PricingItem[] };
        const doctorsPayload = (await doctorsRes.json()) as { doctors: DoctorRate[] };

        if (active) {
          setItems(pricingPayload.pricing);
          setRates(doctorsPayload.doctors);
          const firstDoctor = doctorsPayload.doctors[0] ?? null;
          const clinic = normalizeConfiguredClinicConsultationRate(Number(firstDoctor?.consultation_fee_clinic ?? 0));
          const online = normalizeConfiguredOnlineConsultationRate(Number(firstDoctor?.consultation_fee_online ?? 0));
          setRateDraft({ clinic, online });
          setError(null);
        }
      } catch (nextError) {
        if (active) setError(nextError instanceof Error ? nextError.message : "Failed to load pricing.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  const groupedByCategory = useMemo(() => {
    const query = search.trim().toLowerCase();

    return CATEGORIES.filter((category): category is PricingCategory => category !== "All")
      .map((category) => ({
        category,
        items: items.filter((item) => {
          const matchesCategory = categoryFilter === "All" ? item.category === category : item.category === categoryFilter && item.category === category;
          const matchesSearch =
            query.length === 0
            || item.name.toLowerCase().includes(query)
            || item.code.toLowerCase().includes(query);
          const matchesStatus = showInactive ? true : item.is_active;

          return matchesCategory && matchesSearch && matchesStatus;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [categoryFilter, items, search, showInactive]);

  function showTimedFeedback(message: string, tone: "success" | "error") {
    setFeedback({ message, tone });
    window.setTimeout(() => setFeedback(null), 3500);
  }

  function addItem() {
    if (!accessToken) return;
    const payload = sanitizeDraft(newDraft);

    if (!payload.code || !payload.name) {
      showTimedFeedback("Code and name are required.", "error");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/v2/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        showTimedFeedback(body.message ?? "Failed to add pricing item.", "error");
        return;
      }

      const { pricing } = (await res.json()) as { pricing: PricingItem };
      setItems((current) => [pricing, ...current]);
      setNewDraft(EMPTY_DRAFT);
      showTimedFeedback("Pricing item added.", "success");
    });
  }

  function beginEdit(item: PricingItem) {
    setEditingId(item.id);
    setEditDraft({
      code: item.code,
      name: item.name,
      category: item.category,
      price: item.price,
      is_active: item.is_active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }

  function saveEdit() {
    if (!accessToken || !editingId) return;
    const payload = sanitizeDraft(editDraft);

    if (!payload.code || !payload.name) {
      showTimedFeedback("Code and name are required.", "error");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/v2/pricing/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        showTimedFeedback(body.message ?? "Failed to update pricing item.", "error");
        return;
      }

      const { pricing } = (await res.json()) as { pricing: PricingItem };
      setItems((current) => current.map((item) => (item.id === pricing.id ? pricing : item)));
      cancelEdit();
      showTimedFeedback("Pricing item updated.", "success");
    });
  }

  function deletePricing(item: PricingItem) {
    if (!accessToken) return;
    const confirmed = window.confirm(`Delete pricing item "${item.name}"? This cannot be undone.`);
    if (!confirmed) return;

    startTransition(async () => {
      const res = await fetch(`/api/v2/pricing/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        showTimedFeedback(body.message ?? "Failed to delete pricing item.", "error");
        return;
      }

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showTimedFeedback("Pricing item deleted.", "success");
    });
  }

  function saveConsultationRates() {
    if (!accessToken || !primaryDoctor) return;
    startTransition(async () => {
      const res = await fetch(`/api/v2/doctors/${primaryDoctor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          consultation_fee_clinic: Math.max(0, Number(rateDraft.clinic) || 0),
          consultation_fee_online: Math.max(0, Number(rateDraft.online) || 0),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        showTimedFeedback(body.message ?? "Failed to update consultation rates.", "error");
        return;
      }

      const { doctor } = (await res.json()) as { doctor: DoctorRate };
      setRates((current) => current.map((item) => (item.id === doctor.id ? { ...item, ...doctor } : item)));
      showTimedFeedback("Consultation rates updated.", "success");
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,245,245,0.16),transparent_28%),linear-gradient(135deg,#f8f8f7_0%,#ffffff_70%)] p-6 shadow-[0_24px_70px_rgba(17,17,17,0.12)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow-700">Pricing Management</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Manage consultation fees and service pricing</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Admin staff can add, edit, and delete pricing records here, while keeping the two required consultation fees clear:
              online consultation rates and clinic consultation fees.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <HeroStat label="Consultation items" value={`${consultationItems.length}`} accent="sky" />
            <HeroStat label="Active catalog items" value={`${activeItems} of ${totalItems}`} accent="cyan" />
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
            feedback.tone === "success"
              ? "border-yellow-200 bg-yellow-50 text-yellow-700"
              : "border-yellow-200 bg-yellow-50 text-yellow-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">{error}</div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          Read-only view. Only clinic staff can update pricing and consultation fees.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Required Fees</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Consultation rate controls</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                These rates power the consultation charges across booking and billing. Clinic follow-up visits use a fixed PHP 300 rate, while the clinic base fee and online consultation rate are managed here.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
              Primary doctor fee source
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <RateCard
              label="Online Consultation Rate"
              value={peso(onlineRate)}
              note={createExampleLabel(onlineRate)}
              accent="sky"
            />
            <RateCard
              label="Clinic Consultation Fee"
              value={peso(clinicRate)}
              note={`New patient clinic consult = ${peso(clinicRate)}`}
              accent="cyan"
            />
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-yellow-100 bg-yellow-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-700">Fixed Follow-Up Rule</p>
            <p className="mt-2 text-sm text-yellow-800">
              Only New patients who already had a prior clinic consultation are charged {peso(FOLLOW_UP_CLINIC_CONSULTATION_FEE)}. Regular and old-record patients are not auto-classified into the follow-up rate.
            </p>
          </div>

          <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Assigned Doctor</p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">{doctorDisplayName(primaryDoctor)}</h3>
              <p className="mt-1 text-sm text-slate-500">{primaryDoctor?.specialty ?? "Family Medicine and Aesthetic Medicine"}</p>
              <p className="mt-4 text-sm text-slate-500">
                The booking and billing flows already read these values separately, so editing them here updates the pricing source used across the system.
              </p>
            </div>

            {canEdit && primaryDoctor ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <Field
                  label="Online consultation fee"
                  hint="Used for online consultations."
                  value={rateDraft.online}
                  onChange={(value) => setRateDraft((current) => ({ ...current, online: value }))}
                />
                <Field
                  label="New patient clinic fee"
                  hint="Used for first-time clinic consultations."
                  value={rateDraft.clinic}
                  onChange={(value) => setRateDraft((current) => ({ ...current, clinic: value }))}
                />
                <button
                  type="button"
                  onClick={saveConsultationRates}
                  disabled={isSaving}
                  className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-yellow-200 disabled:text-yellow-700"
                >
                  {isSaving ? "Saving rates..." : "Save consultation rates"}
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Catalog Snapshot</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Pricing overview</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Consultation items stay visible here for quick review, while the full service catalog appears below.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Consultation items</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{consultationItems.length}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {consultationItems.length > 0 ? (
              consultationItems.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-[1.25rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-yellow-700">{peso(item.price)}</p>
                    <p className={`mt-1 text-xs ${item.is_active ? "text-amber-400" : "text-slate-400"}`}>
                      {item.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                No consultation pricing items yet.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-yellow-100 bg-yellow-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-700">Requirement Check</p>
            <ul className="mt-3 space-y-2 text-sm text-yellow-800">
              <li>Online consultation rates can be updated from this page.</li>
              <li>Clinic consultation fees can be updated from this page.</li>
              <li>Pricing records can be added, edited, and deleted from the catalog below.</li>
            </ul>
          </div>
        </section>
      </div>

      {canEdit ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Add Pricing</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Create a new service price</h2>
            </div>
            <p className="text-sm text-slate-500">Use clear codes such as `CONS-ONLINE-1HR` or `LAB-CBC`.</p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.2fr_0.8fr_0.8fr_auto]">
            <TextInput
              label="Code"
              placeholder="CONS-ONLINE-1HR"
              value={newDraft.code}
              onChange={(value) => setNewDraft((current) => ({ ...current, code: value }))}
            />
            <TextInput
              label="Name"
              placeholder="Online consultation - 1 hour"
              value={newDraft.name}
              onChange={(value) => setNewDraft((current) => ({ ...current, name: value }))}
            />
            <SelectInput
              label="Category"
              value={newDraft.category}
              onChange={(value) => setNewDraft((current) => ({ ...current, category: value as PricingCategory }))}
            />
            <Field
              label="Price"
              hint="PHP"
              value={newDraft.price}
              onChange={(value) => setNewDraft((current) => ({ ...current, price: value }))}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={addItem}
                disabled={isSaving}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving ? "Saving..." : "Add pricing"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Pricing Catalog</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Browse and maintain service pricing</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Search by code or name, filter by category, and keep inactive prices visible when you need historical context.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput
              label="Search"
              placeholder="Search code or service"
              value={search}
              onChange={setSearch}
            />
            <SelectInput
              label="Category"
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value as PricingCategory | "All")}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-400 focus:ring-amber-300"
              />
              Show inactive pricing
            </label>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4">
            <div className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100" />
            <div className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100" />
          </div>
        ) : groupedByCategory.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 px-6 py-14 text-center">
            <p className="text-base font-semibold text-slate-700">No pricing items match the current filters.</p>
            <p className="mt-2 text-sm text-slate-500">Try a different category, clear the search, or include inactive items.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {groupedByCategory.map(({ category, items: categoryItems }) => (
              <div key={category} className="overflow-hidden rounded-[1.75rem] border border-slate-200">
                <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{category}</h3>
                    <p className="text-xs text-slate-500">{categoryItems.length} item(s)</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 bg-white text-slate-600">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold">Code</th>
                        <th className="px-5 py-3 text-left font-semibold">Service</th>
                        <th className="px-5 py-3 text-left font-semibold">Category</th>
                        <th className="px-5 py-3 text-right font-semibold">Price</th>
                        <th className="px-5 py-3 text-left font-semibold">Status</th>
                        {canEdit ? <th className="px-5 py-3 text-right font-semibold">Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {categoryItems.map((item) => {
                        const editing = editingId === item.id;

                        return (
                          <tr key={item.id} className="border-t border-slate-100 align-top">
                            <td className="px-5 py-4">
                              {editing ? (
                                <input
                                  value={editDraft.code}
                                  onChange={(event) => setEditDraft((current) => ({ ...current, code: event.target.value }))}
                                  className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
                                />
                              ) : (
                                <code className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.code}</code>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {editing ? (
                                <input
                                  value={editDraft.name}
                                  onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))}
                                  className="w-full min-w-[220px] rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
                                />
                              ) : (
                                <div>
                                  <p className="font-semibold text-slate-900">{item.name}</p>
                                  <p className="mt-1 text-xs text-slate-500">{item.category} service</p>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {editing ? (
                                <select
                                  value={editDraft.category}
                                  onChange={(event) =>
                                    setEditDraft((current) => ({ ...current, category: event.target.value as PricingCategory }))
                                  }
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
                                >
                                  {CATEGORIES.filter((categoryOption) => categoryOption !== "All").map((categoryOption) => (
                                    <option key={categoryOption} value={categoryOption}>
                                      {categoryOption}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  {item.category}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right font-semibold text-slate-900">
                              {editing ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={editDraft.price}
                                  onChange={(event) => setEditDraft((current) => ({ ...current, price: Number(event.target.value) || 0 }))}
                                  className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
                                />
                              ) : (
                                peso(item.price)
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {editing ? (
                                <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={editDraft.is_active}
                                    onChange={(event) =>
                                      setEditDraft((current) => ({ ...current, is_active: event.target.checked }))
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-amber-400 focus:ring-amber-300"
                                  />
                                  Active
                                </label>
                              ) : (
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    item.is_active ? "bg-yellow-50 text-yellow-700" : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {item.is_active ? "Active" : "Inactive"}
                                </span>
                              )}
                            </td>
                            {canEdit ? (
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  {editing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={saveEdit}
                                        disabled={isSaving}
                                        className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:bg-yellow-200 disabled:text-yellow-700"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => beginEdit(item)}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deletePricing(item)}
                                        className="rounded-xl border border-yellow-200 px-3 py-2 text-xs font-medium text-yellow-700 transition hover:bg-yellow-50"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "sky" | "cyan";
}) {
  const tone =
    accent === "sky"
      ? "border-yellow-200 bg-white/90 text-yellow-700"
      : "border-yellow-200 bg-white/90 text-yellow-700";

  return (
    <div className={`rounded-[1.5rem] border px-4 py-4 shadow-sm backdrop-blur ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}

function RateCard({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: "sky" | "cyan";
}) {
  const accentStyles =
    accent === "sky"
      ? "border-yellow-100 bg-yellow-50 text-yellow-700"
      : "border-yellow-100 bg-yellow-50 text-yellow-700";

  return (
    <div className={`rounded-[1.5rem] border p-5 ${accentStyles}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-sm opacity-80">{note}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
      />
    </label>
  );
}

function TextInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PricingCategory | "All";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
      >
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
  );
}
