"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  FaCircleCheck,
  FaFloppyDisk,
  FaPlus,
  FaRotate,
  FaTrash,
  FaTriangleExclamation,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  BOOKING_PRICING_DEFINITIONS,
  formatPeso,
  type BookingPricingDefinition,
  type PricingCategory,
  type PricingItem,
} from "@/src/lib/booking-pricing";

type Draft = {
  code: string;
  name: string;
  category: PricingCategory;
  price: number;
  is_active: boolean;
};

const CATEGORIES: Array<PricingCategory | "All"> = ["All", "Consultation", "Lab", "Medicine", "Procedure", "Other"];

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  category: "Other",
  price: 0,
  is_active: true,
};

function sanitizeDraft(draft: Draft): Draft {
  return {
    ...draft,
    code: draft.code.trim().toUpperCase(),
    name: draft.name.trim(),
    price: Math.max(0, Number(draft.price) || 0),
  };
}

function normalizePrice(value: number) {
  return Math.max(0, Number(value) || 0);
}

function groupDefinitions() {
  return [
    {
      title: "Clinic Visit",
      description: "These prices appear when booking a regular in-person clinic visit.",
      items: BOOKING_PRICING_DEFINITIONS.filter((item) => item.group === "Clinic Visit"),
    },
    {
      title: "Medical Procedure",
      description: "These prices appear in procedure booking cards and payment review.",
      items: BOOKING_PRICING_DEFINITIONS.filter((item) => item.group === "Medical Procedure"),
    },
    {
      title: "Virtual Consult",
      description: "This price is charged before a virtual consult is confirmed.",
      items: BOOKING_PRICING_DEFINITIONS.filter((item) => item.group === "Virtual Consult"),
    },
  ];
}

export default function PricingSettingsPanel() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [draftByCode, setDraftByCode] = useState<Record<string, Draft>>({});
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PricingCategory | "All">("All");
  const [showInactive, setShowInactive] = useState(true);
  const [isSaving, startTransition] = useTransition();

  const canEdit = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const bookingCodes = useMemo<Set<string>>(
    () => new Set(BOOKING_PRICING_DEFINITIONS.map((definition) => definition.code)),
    [],
  );
  const bookingGroups = useMemo(groupDefinitions, []);
  const bookingItems = items.filter((item) => bookingCodes.has(item.code));
  const missingBookingRows = BOOKING_PRICING_DEFINITIONS.filter(
    (definition) => !items.some((item) => item.code === definition.code),
  );
  const activeBookingRows = bookingItems.filter((item) => item.is_active).length;
  const catalogItems = items.filter((item) => !bookingCodes.has(item.code));
  const filteredCatalogItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return catalogItems.filter((item) => {
      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
      const matchesSearch =
        query.length === 0
        || item.name.toLowerCase().includes(query)
        || item.code.toLowerCase().includes(query);
      const matchesStatus = showInactive || item.is_active;

      return matchesCategory && matchesSearch && matchesStatus;
    });
  }, [catalogItems, categoryFilter, search, showInactive]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v2/pricing?active=false", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load pricing.");
        const payload = (await res.json()) as { pricing: PricingItem[] };
        if (active) {
          setItems(payload.pricing.map((item) => ({ ...item, price: Number(item.price) })));
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

  useEffect(() => {
    setDraftByCode(() => {
      const next: Record<string, Draft> = {};
      for (const definition of BOOKING_PRICING_DEFINITIONS) {
        const item = items.find((entry) => entry.code === definition.code);
        next[definition.code] = {
          code: definition.code,
          name: item?.name ?? definition.name,
          category: item?.category ?? definition.category,
          price: normalizePrice(item?.price ?? definition.defaultPrice),
          is_active: true,
        };
      }
      return next;
    });
  }, [items]);

  function showTimedFeedback(message: string, tone: "success" | "error") {
    setFeedback({ message, tone });
    window.setTimeout(() => setFeedback(null), 3500);
  }

  async function createPricing(payload: Draft) {
    if (!accessToken) throw new Error("Missing session.");
    const res = await fetch("/api/v2/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { pricing?: PricingItem; message?: string };
    if (!res.ok || !body.pricing) throw new Error(body.message ?? "Failed to create pricing item.");
    setItems((current) => [{ ...body.pricing!, price: Number(body.pricing!.price) }, ...current]);
    return body.pricing;
  }

  async function updatePricing(id: string, payload: Partial<Draft>) {
    if (!accessToken) throw new Error("Missing session.");
    const res = await fetch(`/api/v2/pricing/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { pricing?: PricingItem; message?: string };
    if (!res.ok || !body.pricing) throw new Error(body.message ?? "Failed to update pricing item.");
    setItems((current) =>
      current.map((item) => (item.id === body.pricing!.id ? { ...body.pricing!, price: Number(body.pricing!.price) } : item)),
    );
    return body.pricing;
  }

  function saveBookingPrice(definition: BookingPricingDefinition) {
    if (!canEdit) return;
    const draft = sanitizeDraft(draftByCode[definition.code] ?? {
      code: definition.code,
      name: definition.name,
      category: definition.category,
      price: definition.defaultPrice,
      is_active: true,
    });
    const existing = items.find((item) => item.code === definition.code);

    startTransition(async () => {
      try {
        if (existing) {
          await updatePricing(existing.id, {
            name: draft.name,
            category: draft.category,
            price: draft.price,
            is_active: true,
          });
        } else {
          await createPricing({ ...draft, is_active: true });
        }
        showTimedFeedback(`${definition.name} saved. Booking will use ${formatPeso(draft.price)}.`, "success");
      } catch (saveError) {
        showTimedFeedback(saveError instanceof Error ? saveError.message : "Failed to save booking price.", "error");
      }
    });
  }

  function addAllMissingBookingRows() {
    if (!canEdit || missingBookingRows.length === 0) return;

    startTransition(async () => {
      try {
        for (const definition of missingBookingRows) {
          await createPricing({
            code: definition.code,
            name: definition.name,
            category: definition.category,
            price: definition.defaultPrice,
            is_active: true,
          });
        }
        showTimedFeedback("Missing booking price rows were created.", "success");
      } catch (saveError) {
        showTimedFeedback(saveError instanceof Error ? saveError.message : "Failed to create missing booking rows.", "error");
      }
    });
  }

  function addCatalogItem() {
    if (!canEdit) return;
    const payload = sanitizeDraft(newDraft);

    if (!payload.code || !payload.name) {
      showTimedFeedback("Code and name are required.", "error");
      return;
    }
    if (bookingCodes.has(payload.code)) {
      showTimedFeedback("That code is reserved for booking prices. Edit it in the Booking Prices section.", "error");
      return;
    }

    startTransition(async () => {
      try {
        await createPricing(payload);
        setNewDraft(EMPTY_DRAFT);
        showTimedFeedback("Catalog item added.", "success");
      } catch (saveError) {
        showTimedFeedback(saveError instanceof Error ? saveError.message : "Failed to add catalog item.", "error");
      }
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

  function saveCatalogEdit() {
    if (!editingId) return;
    const payload = sanitizeDraft(editDraft);
    if (!payload.code || !payload.name) {
      showTimedFeedback("Code and name are required.", "error");
      return;
    }

    startTransition(async () => {
      try {
        await updatePricing(editingId, payload);
        cancelEdit();
        showTimedFeedback("Catalog item updated.", "success");
      } catch (saveError) {
        showTimedFeedback(saveError instanceof Error ? saveError.message : "Failed to update catalog item.", "error");
      }
    });
  }

  function deletePricing(item: PricingItem) {
    if (!accessToken || bookingCodes.has(item.code)) return;
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
      showTimedFeedback("Catalog item deleted.", "success");
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Pricing Source of Truth</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Booking service prices</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Clinic visit, medical procedure, and virtual consult prices are managed here and read by the booking flow.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            <Stat label="Booking rows" value={`${bookingItems.length}/${BOOKING_PRICING_DEFINITIONS.length}`} />
            <Stat label="Active rows" value={`${activeBookingRows}`} />
            <Stat label="Catalog items" value={`${catalogItems.length}`} />
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
            feedback.tone === "success"
              ? "border-neutral-200 bg-neutral-50 text-neutral-700"
              : "border-neutral-200 bg-neutral-50 text-neutral-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{error}</div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          Read-only view. Only clinic staff can update booking prices.
        </div>
      ) : null}

      {missingBookingRows.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FaTriangleExclamation className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-neutral-900">{missingBookingRows.length} booking price row(s) missing</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                Booking can use safe defaults, but creating these rows makes the pricing table the database source of truth.
              </p>
            </div>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={addAllMissingBookingRows}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <FaPlus className="h-3 w-3" aria-hidden="true" />
              Create Missing Rows
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-5">
        {bookingGroups.map((group) => (
          <section key={group.title} className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{group.title}</p>
                <h3 className="mt-1 text-xl font-black text-neutral-950">{group.title} Prices</h3>
                <p className="mt-1 text-sm leading-6 text-neutral-600">{group.description}</p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.14em] text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Booking Code</th>
                    <th className="px-4 py-3 font-bold">Service</th>
                    <th className="px-4 py-3 font-bold">Price</th>
                    <th className="px-4 py-3 font-bold">Where Used</th>
                    <th className="px-4 py-3 text-right font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {group.items.map((definition) => {
                    const item = items.find((entry) => entry.code === definition.code);
                    const draft = draftByCode[definition.code] ?? {
                      code: definition.code,
                      name: definition.name,
                      category: definition.category,
                      price: definition.defaultPrice,
                      is_active: true,
                    };

                    return (
                      <tr key={definition.code} className="align-top">
                        <td className="px-4 py-4">
                          <code className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-700">
                            {definition.code}
                          </code>
                          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                            {item ? (
                              <>
                                <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                                Source row ready
                              </>
                            ) : (
                              <>
                                <FaTriangleExclamation className="h-3 w-3" aria-hidden="true" />
                                Using default until created
                              </>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {canEdit ? (
                            <input
                              value={draft.name}
                              onChange={(event) =>
                                setDraftByCode((current) => ({
                                  ...current,
                                  [definition.code]: { ...draft, name: event.target.value },
                                }))
                              }
                              className="w-full min-w-[220px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                            />
                          ) : (
                            <p className="font-bold text-neutral-900">{draft.name}</p>
                          )}
                          <p className="mt-1 text-xs leading-5 text-neutral-500">{definition.note}</p>
                        </td>
                        <td className="px-4 py-4">
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.price}
                              onChange={(event) =>
                                setDraftByCode((current) => ({
                                  ...current,
                                  [definition.code]: { ...draft, price: Number(event.target.value) || 0 },
                                }))
                              }
                              className="w-36 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-right text-sm font-bold outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                            />
                          ) : (
                            <p className="font-bold text-neutral-900">{formatPeso(draft.price)}</p>
                          )}
                          <p className="mt-1 text-xs text-neutral-500">{formatPeso(draft.price)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="max-w-xs text-sm leading-6 text-neutral-700">{definition.bookingUse}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => saveBookingPrice(definition)}
                              disabled={isSaving}
                              className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                            >
                              <FaFloppyDisk className="h-3 w-3" aria-hidden="true" />
                              {item ? "Save" : "Create"}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      {canEdit ? (
        <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Additional Catalog</p>
              <h3 className="mt-1 text-xl font-black text-neutral-950">Add POS or billing price</h3>
            </div>
            <p className="text-sm text-neutral-500">Booking-reserved codes are edited above.</p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.2fr_0.8fr_0.8fr_auto]">
            <TextInput
              label="Code"
              placeholder="LAB-CBC"
              value={newDraft.code}
              onChange={(value) => setNewDraft((current) => ({ ...current, code: value }))}
            />
            <TextInput
              label="Name"
              placeholder="CBC Laboratory"
              value={newDraft.name}
              onChange={(value) => setNewDraft((current) => ({ ...current, name: value }))}
            />
            <SelectInput
              label="Category"
              value={newDraft.category}
              onChange={(value) => setNewDraft((current) => ({ ...current, category: value as PricingCategory }))}
            />
            <NumberInput
              label="Price"
              value={newDraft.price}
              onChange={(value) => setNewDraft((current) => ({ ...current, price: value }))}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={addCatalogItem}
                disabled={isSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                <FaPlus className="h-3 w-3" aria-hidden="true" />
                Add
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Catalog</p>
            <h3 className="mt-1 text-xl font-black text-neutral-950">Other pricing records</h3>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              Labs, medicines, products, and POS add-ons live here. Booking source prices stay locked to the section above.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput label="Search" placeholder="Search code or service" value={search} onChange={setSearch} />
            <SelectInput
              label="Category"
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value as PricingCategory | "All")}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-300"
              />
              Show inactive
            </label>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4">
            <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
          </div>
        ) : filteredCatalogItems.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 px-6 py-12 text-center">
            <p className="text-sm font-bold text-neutral-700">No other pricing records match the current filters.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.14em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Code</th>
                  <th className="px-4 py-3 font-bold">Service</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 text-right font-bold">Price</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  {canEdit ? <th className="px-4 py-3 text-right font-bold">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredCatalogItems.map((item) => {
                  const editing = editingId === item.id;

                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-4">
                        {editing ? (
                          <input
                            value={editDraft.code}
                            onChange={(event) => setEditDraft((current) => ({ ...current, code: event.target.value }))}
                            className="w-36 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                          />
                        ) : (
                          <code className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-700">{item.code}</code>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editing ? (
                          <input
                            value={editDraft.name}
                            onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))}
                            className="w-full min-w-[220px] rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                          />
                        ) : (
                          <p className="font-bold text-neutral-900">{item.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editing ? (
                          <select
                            value={editDraft.category}
                            onChange={(event) =>
                              setEditDraft((current) => ({ ...current, category: event.target.value as PricingCategory }))
                            }
                            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                          >
                            {CATEGORIES.filter((category) => category !== "All").map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                            {item.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-neutral-900">
                        {editing ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editDraft.price}
                            onChange={(event) => setEditDraft((current) => ({ ...current, price: Number(event.target.value) || 0 }))}
                            className="w-32 rounded-xl border border-neutral-200 px-3 py-2 text-right text-sm outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                          />
                        ) : (
                          formatPeso(item.price)
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editing ? (
                          <label className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700">
                            <input
                              type="checkbox"
                              checked={editDraft.is_active}
                              onChange={(event) =>
                                setEditDraft((current) => ({ ...current, is_active: event.target.checked }))
                              }
                              className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-300"
                            />
                            Active
                          </label>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.is_active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
                            }`}
                          >
                            {item.is_active ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                      {canEdit ? (
                        <td className="px-4 py-4 text-right">
                          {editing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={saveCatalogEdit}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3 py-2 text-xs font-bold text-white disabled:bg-neutral-300"
                              >
                                <FaFloppyDisk className="h-3 w-3" aria-hidden="true" />
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => beginEdit(item)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                              >
                                <FaRotate className="h-3 w-3" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePricing(item)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                              >
                                <FaTrash className="h-3 w-3" aria-hidden="true" />
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-black text-neutral-950">{value}</p>
    </div>
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
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
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
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
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
