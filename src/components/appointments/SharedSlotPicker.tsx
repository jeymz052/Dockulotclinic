"use client";

import { formatRange, type SlotStatus } from "@/src/lib/appointments";

type SharedSlotPickerProps = {
  slotStatuses: SlotStatus[];
  selectedStart: string;
  onSelect: (start: string) => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
};

export function SharedSlotPicker({
  slotStatuses,
  selectedStart,
  onSelect,
  disabled = false,
  loading = false,
  title = "Time slot",
}: SharedSlotPickerProps) {
  const availableSlots = slotStatuses.filter((slot) => slot.availableForType);
  const blockedSlots = slotStatuses.filter((slot) => !slot.availableForType);

  return (
    <div className="overflow-hidden rounded-4xl border border-neutral-100 bg-white p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">Time Selection</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700 shadow-sm">
          <span>{availableSlots.length} open</span>
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          <span>{blockedSlots.length} blocked</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SlotMetric
          label="Available"
          value={String(availableSlots.length)}
          tone="green"
        />
        <SlotMetric
          label="Blocked"
          value={String(blockedSlots.length)}
          tone="red"
        />
        <SlotMetric
          label="Capacity"
          value="1 patient"
          tone="orange"
        />
      </div>

      {loading ? (
        <div className="mt-4 rounded-3xl border border-neutral-100 bg-neutral-50/70 px-4 py-5 text-sm text-neutral-800">
          Refreshing slot availability...
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
        {slotStatuses.map((slot) => {
          const isSelected = selectedStart === slot.start;
          const available = slot.availableForType;
          const colors = slotColorClasses(slot.activeType);
          const statusLabel = available ? "Available" : slot.reason;

          return (
            <button
              key={`${slot.start}-${slot.end}`}
              type="button"
              disabled={!available || disabled || loading}
              onClick={() => onSelect(slot.start)}
              className={`group min-h-32 rounded-2xl border p-4 text-left transition-all duration-200 ${
                isSelected
                  ? `${colors.selected} shadow-[0_14px_30px_rgba(15,23,42,0.12)]`
                  : available
                    ? `${colors.available} hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]`
                    : "cursor-not-allowed border-neutral-200 bg-neutral-50/90 text-neutral-400"
              }`}
            >
              <div className="flex h-full flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`whitespace-nowrap text-base font-black ${
                    isSelected ? colors.selectedText : available ? colors.text : "text-slate-400"
                  }`}>
                      {formatRange(slot.start, slot.end)}
                    </p>
                    <p className={`mt-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                    isSelected ? colors.selectedMutedText : available ? colors.mutedText : "text-slate-400"
                  }`}>
                      {formatSlotActiveType(slot.activeType)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                    available
                      ? isSelected
                        ? colors.selectedBadge
                        : colors.badge
                      : "bg-white text-neutral-500"
                  }`}>
                    {available ? "Open" : "Closed"}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <span className={`text-xs font-semibold ${
                    available ? colors.mutedText : "text-neutral-500"
                  }`}>
                    {statusLabel}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    slot.bookedCount > 0
                      ? "bg-red-100 text-red-700"
                      : available
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-white text-neutral-500"
                  }`}>
                    {slot.bookedCount > 0 ? "Booked" : "1 slot"}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function slotColorClasses(activeType: SlotStatus["activeType"]) {
  if (activeType === "Online") {
    return {
      selected: "border-sky-300 bg-sky-50 ring-2 ring-sky-100",
      available: "border-sky-100 bg-white hover:border-sky-200 hover:bg-sky-50/50",
      text: "text-sky-950",
      mutedText: "text-sky-700",
      selectedText: "text-sky-950",
      selectedMutedText: "text-sky-700",
      badge: "bg-sky-50 text-sky-700",
      selectedBadge: "bg-white text-sky-700",
      dot: "bg-sky-300",
      fullDot: "bg-sky-600",
      emptyBar: "bg-sky-100",
      bar: "bg-sky-300",
      strongBar: "bg-sky-600",
    };
  }

  if (activeType === "Clinic") {
    return {
      selected: "border-orange-300 bg-orange-50 ring-2 ring-orange-100",
      available: "border-orange-100 bg-white hover:border-orange-200 hover:bg-orange-50/50",
      text: "text-orange-950",
      mutedText: "text-orange-700",
      selectedText: "text-orange-950",
      selectedMutedText: "text-orange-700",
      badge: "bg-orange-50 text-orange-700",
      selectedBadge: "bg-white text-orange-700",
      dot: "bg-orange-300",
      fullDot: "bg-orange-600",
      emptyBar: "bg-orange-100",
      bar: "bg-orange-300",
      strongBar: "bg-orange-600",
    };
  }

  return {
    selected: "border-green-600 bg-green-50 ring-2 ring-green-200",
    available: "border-green-200 bg-white hover:border-green-500 hover:bg-green-50/70",
    text: "text-green-950",
    mutedText: "text-green-700",
    selectedText: "text-green-950",
    selectedMutedText: "text-green-700",
    badge: "bg-green-100 text-green-800",
    selectedBadge: "bg-white text-green-700",
    dot: "bg-green-400",
    fullDot: "bg-green-600",
    emptyBar: "bg-green-100",
    bar: "bg-green-400",
    strongBar: "bg-green-600",
  };
}

function formatSlotActiveType(activeType: SlotStatus["activeType"]) {
  if (activeType === "Online") return "Virtual Consult";
  return activeType ?? "Open";
}

function SlotMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "orange";
}) {
  const toneMap = {
    green: "border-green-200 bg-green-50/80 text-green-700",
    red: "border-red-200 bg-red-50/80 text-red-700",
    orange: "border-orange-100 bg-orange-50/80 text-orange-700",
  };

  return (
    <div className={`rounded-[1.35rem] border px-4 py-3 shadow-sm ${toneMap[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
