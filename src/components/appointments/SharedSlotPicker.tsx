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
  const selectedSlot = slotStatuses.find((slot) => slot.start === selectedStart) ?? null;

  return (
    <div className="overflow-hidden rounded-4xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbff_100%)] p-5 shadow-[0_20px_60px_rgba(133,77,14,0.08)] transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yellow-500">Time Selection</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-semibold text-yellow-700 shadow-sm">
          <span>{availableSlots.length} open</span>
          <span className="h-1 w-1 rounded-full bg-yellow-300" />
          <span>{blockedSlots.length} blocked</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SlotMetric
          label="Available"
          value={String(availableSlots.length)}
          tone="emerald"
        />
        <SlotMetric
          label="Blocked"
          value={String(blockedSlots.length)}
          tone="slate"
        />
        <SlotMetric
          label="Queue"
          value={selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "--"}
          tone="teal"
        />
      </div>

      {loading ? (
        <div className="mt-4 rounded-3xl border border-yellow-100 bg-yellow-50/70 px-4 py-5 text-sm text-yellow-800">
          Refreshing slot availability...
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {slotStatuses.map((slot) => {
          const isSelected = selectedStart === slot.start;
          const available = slot.availableForType;

          return (
            <button
              key={`${slot.start}-${slot.end}`}
              type="button"
              disabled={!available || disabled || loading}
              onClick={() => onSelect(slot.start)}
              className={`group rounded-[1.4rem] border px-4 py-4 text-left transition-all duration-200 ${
                isSelected
                  ? "border-yellow-300 bg-[linear-gradient(180deg,#fffbeb_0%,#fde68a_100%)] shadow-[0_16px_35px_rgba(133,77,14,0.18)]"
                  : available
                    ? "border-yellow-100 bg-white hover:-translate-y-0.5 hover:border-yellow-300 hover:bg-yellow-50/40 hover:shadow-[0_14px_28px_rgba(133,77,14,0.12)]"
                    : "cursor-not-allowed border-slate-200 bg-slate-50/80 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold ${
                    isSelected ? "text-yellow-700" : available ? "text-slate-900" : "text-slate-400"
                  }`}>
                    {formatRange(slot.start, slot.end)}
                  </p>
                  <p className={`mt-1 text-[11px] font-medium ${
                    isSelected ? "text-yellow-700" : available ? "text-slate-500" : "text-slate-400"
                  }`}>
                    {slot.activeType ?? "Open"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  available
                    ? isSelected
                      ? "bg-white/80 text-yellow-700"
                      : "bg-yellow-50 text-yellow-700"
                    : "bg-slate-200 text-slate-500"
                }`}>
                  {available ? "Available" : "Blocked"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className={`text-[11px] ${
                  available ? "text-slate-500" : "text-yellow-500"
                }`}>
                  {available ? `Queue #${slot.nextQueueNumber}` : slot.reason}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span
                      key={dot}
                      className={`h-1.5 w-4 rounded-full transition-all ${
                        dot <= slot.bookedCount
                          ? slot.bookedCount >= 5
                            ? "bg-yellow-400"
                            : "bg-yellow-300"
                          : isSelected
                            ? "bg-white/80"
                            : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${
                isSelected ? "bg-white/70" : "bg-slate-100"
              }`}>
                <div
                  className={`h-full rounded-full transition-all ${
                    slot.bookedCount === 0
                      ? "w-1/12 bg-yellow-200"
                      : slot.bookedCount === 1
                        ? "w-1/5 bg-yellow-300"
                        : slot.bookedCount === 2
                          ? "w-2/5 bg-yellow-400"
                          : slot.bookedCount === 3
                            ? "w-3/5 bg-yellow-300"
                            : slot.bookedCount === 4
                              ? "w-4/5 bg-yellow-400"
                              : "w-full bg-yellow-400"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "slate" | "teal";
}) {
  const toneMap = {
    emerald: "border-yellow-100 bg-yellow-50/80 text-yellow-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    teal: "border-yellow-100 bg-yellow-50/80 text-yellow-700",
  };

  return (
    <div className={`rounded-[1.35rem] border px-4 py-3 shadow-sm ${toneMap[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
