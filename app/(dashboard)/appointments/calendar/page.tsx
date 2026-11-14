"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FaCalendarDays,
  FaCalendarWeek,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaEnvelope,
  FaHospital,
  FaPhone,
  FaUser,
  FaVideo,
  FaXmark,
  FaArrowUpRightFromSquare,
  FaRegCalendarCheck,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import {
  getAppointmentPrimaryLabel,
  getAppointmentSecondaryReason,
  isProcedureServiceTitle,
} from "@/src/lib/appointment-context";
import {
  formatDisplayDate,
  formatRange,
  getWeekDates,
  type AppointmentRecord,
} from "@/src/lib/appointments";

export type AppointmentCategory =
  | "virtual_consult"
  | "clinic_consult"
  | "botox"
  | "fillers"
  | "mesolipo"
  | "skin_boosters"
  | "minor_procedure"
  | "weight_loss"
  | "other";

export type CategoryMeta = {
  key: AppointmentCategory;
  label: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorderLeft: string;
  cardBg: string;
};

export const CATEGORIES: Record<AppointmentCategory, CategoryMeta> = {
  virtual_consult: {
    key: "virtual_consult",
    label: "Virtual Consult",
    dotColor: "#0284c7", // sky-600
    badgeBg: "bg-sky-50",
    badgeText: "text-sky-800",
    badgeBorder: "border-sky-200",
    cardBorderLeft: "border-l-sky-500",
    cardBg: "bg-white hover:bg-sky-50/20",
  },
  clinic_consult: {
    key: "clinic_consult",
    label: "Clinic Consult",
    dotColor: "#059669", // emerald-600
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-800",
    badgeBorder: "border-emerald-200",
    cardBorderLeft: "border-l-emerald-500",
    cardBg: "bg-white hover:bg-emerald-50/20",
  },
  botox: {
    key: "botox",
    label: "Botox",
    dotColor: "#8b5cf6", // purple-500
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-800",
    badgeBorder: "border-purple-200",
    cardBorderLeft: "border-l-purple-500",
    cardBg: "bg-white hover:bg-purple-50/20",
  },
  fillers: {
    key: "fillers",
    label: "Fillers",
    dotColor: "#ec4899", // pink-500
    badgeBg: "bg-pink-50",
    badgeText: "text-pink-800",
    badgeBorder: "border-pink-200",
    cardBorderLeft: "border-l-pink-500",
    cardBg: "bg-white hover:bg-pink-50/20",
  },
  mesolipo: {
    key: "mesolipo",
    label: "Mesolipo",
    dotColor: "#f59e0b", // amber-500
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-200",
    cardBorderLeft: "border-l-amber-500",
    cardBg: "bg-white hover:bg-amber-50/20",
  },
  skin_boosters: {
    key: "skin_boosters",
    label: "Skin Boosters / GlowRx",
    dotColor: "#06b6d4", // cyan-500
    badgeBg: "bg-cyan-50",
    badgeText: "text-cyan-800",
    badgeBorder: "border-cyan-200",
    cardBorderLeft: "border-l-cyan-500",
    cardBg: "bg-white hover:bg-cyan-50/20",
  },
  minor_procedure: {
    key: "minor_procedure",
    label: "Scar & Minor Procedures",
    dotColor: "#6366f1", // indigo-500
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-800",
    badgeBorder: "border-indigo-200",
    cardBorderLeft: "border-l-indigo-500",
    cardBg: "bg-white hover:bg-indigo-50/20",
  },
  weight_loss: {
    key: "weight_loss",
    label: "GLP / Weight Loss",
    dotColor: "#84cc16", // lime-500
    badgeBg: "bg-lime-50",
    badgeText: "text-lime-900",
    badgeBorder: "border-lime-200",
    cardBorderLeft: "border-l-lime-500",
    cardBg: "bg-white hover:bg-lime-50/20",
  },
  other: {
    key: "other",
    label: "Other Procedures",
    dotColor: "#64748b", // slate-500
    badgeBg: "bg-slate-50",
    badgeText: "text-slate-800",
    badgeBorder: "border-slate-200",
    cardBorderLeft: "border-l-slate-400",
    cardBg: "bg-white hover:bg-slate-50/20",
  },
};

export function classifyAppointment(appt: AppointmentRecord): {
  category: AppointmentCategory;
  primaryLabel: string;
  secondaryLabel: string;
} {
  const primaryLabel = getAppointmentPrimaryLabel(appt.reason, appt.type);
  const secondaryLabel = getAppointmentSecondaryReason(appt.reason);
  const lower = `${primaryLabel} ${appt.reason ?? ""}`.toLowerCase();

  if (appt.type === "Online") {
    return { category: "virtual_consult", primaryLabel, secondaryLabel };
  }

  // Clinic Procedures & Consultations
  if (
    lower.includes("botox") ||
    lower.includes("jawtox") ||
    lower.includes("nefertiti") ||
    lower.includes("traptox") ||
    lower.includes("mesolift") ||
    lower.includes("alartox")
  ) {
    return { category: "botox", primaryLabel, secondaryLabel };
  }
  if (lower.includes("filler")) {
    return { category: "fillers", primaryLabel, secondaryLabel };
  }
  if (lower.includes("mesolipo") || lower.includes("lipo")) {
    return { category: "mesolipo", primaryLabel, secondaryLabel };
  }
  if (
    lower.includes("glow") ||
    lower.includes("pinkglow") ||
    lower.includes("redglow") ||
    lower.includes("crystalglow") ||
    lower.includes("skin booster")
  ) {
    return { category: "skin_boosters", primaryLabel, secondaryLabel };
  }
  if (lower.includes("glp") || lower.includes("weight") || lower.includes("metabolic")) {
    return { category: "weight_loss", primaryLabel, secondaryLabel };
  }
  if (
    lower.includes("sclero") ||
    lower.includes("wart") ||
    lower.includes("mole") ||
    lower.includes("cautery") ||
    lower.includes("scar") ||
    lower.includes("subcision")
  ) {
    return { category: "minor_procedure", primaryLabel, secondaryLabel };
  }
  if (isProcedureServiceTitle(primaryLabel)) {
    return { category: "other", primaryLabel, secondaryLabel };
  }

  return { category: "clinic_consult", primaryLabel, secondaryLabel };
}

function getCurrentWeekStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function getMonthCalendarDays(year: number, month: number): string[] {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  let startOffset = firstDay.getUTCDay() === 0 ? 6 : firstDay.getUTCDay() - 1;
  const startDate = new Date(firstDay);
  startDate.setUTCDate(startDate.getUTCDate() - startOffset);

  const days: string[] = [];
  const curr = new Date(startDate);
  while (curr <= lastDay || curr.getUTCDay() !== 1) {
    days.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return days;
}

function formatWeekRange(startDateStr: string): string {
  const dates = getWeekDates(startDateStr);
  const start = new Date(`${dates[0]}T00:00:00Z`);
  const end = new Date(`${dates[6]}T00:00:00Z`);
  const startMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(start);
  const endMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const year = end.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

function formatMonthYear(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 1));
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarViewPage() {
  const { doctors } = useDoctors();
  const { appointments, isLoading: appointmentsLoading } = useAppointments();

  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRecord | null>(null);

  // Week navigation state
  const [weekStart, setWeekStart] = useState<string>(() => getCurrentWeekStart());

  // Month navigation state
  const todayObj = new Date();
  const [currentYear, setCurrentYear] = useState<number>(todayObj.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(todayObj.getMonth()); // 0-indexed

  // Today string for comparison (YYYY-MM-DD in UTC/local)
  const todayStr = useMemo(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // Filtered doctor
  const selectedDoctor =
    doctors.find((d) => d.id === selectedDoctorId || d.slug === selectedDoctorId) || doctors[0] || null;

  // Filtered appointments list
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      if (selectedDoctorId && appt.doctorId && appt.doctorId !== selectedDoctorId) {
        return false;
      }
      if (selectedCategoryFilter !== "all") {
        const { category } = classifyAppointment(appt);
        if (category !== selectedCategoryFilter) return false;
      }
      return true;
    });
  }, [appointments, selectedDoctorId, selectedCategoryFilter]);

  // Appointments grouped by date
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, AppointmentRecord[]>();
    for (const appt of filteredAppointments) {
      const list = map.get(appt.date) ?? [];
      list.push(appt);
      map.set(appt.date, list);
    }
    // Sort appointments in each day by start time
    for (const list of map.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start));
    }
    return map;
  }, [filteredAppointments]);

  // Current dates in view
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const monthDates = useMemo(() => getMonthCalendarDays(currentYear, currentMonth), [currentYear, currentMonth]);

  // Total appointments in current view
  const currentViewTotalCount = useMemo(() => {
    const activeDates = viewMode === "week" ? weekDates : monthDates;
    let count = 0;
    for (const d of activeDates) {
      count += appointmentsByDate.get(d)?.length ?? 0;
    }
    return count;
  }, [viewMode, weekDates, monthDates, appointmentsByDate]);

  // Navigation handlers
  const handlePrevious = () => {
    if (viewMode === "week") {
      setWeekStart((prev) => shiftDate(prev, -7));
    } else {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((y) => y - 1);
      } else {
        setCurrentMonth((m) => m - 1);
      }
    }
  };

  const handleNext = () => {
    if (viewMode === "week") {
      setWeekStart((prev) => shiftDate(prev, 7));
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear((y) => y + 1);
      } else {
        setCurrentMonth((m) => m + 1);
      }
    }
  };

  const handleToday = () => {
    setWeekStart(getCurrentWeekStart());
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Workspace Header ── */}
      <header className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
                FamMed Family Clinic · Zamboanga City
              </p>
            </div>
            <h1 className="mt-1.5 text-2xl font-black text-neutral-900 sm:text-3xl">
              {selectedDoctor?.name ?? "Doc Kulot"} Workspace
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Bookings & upcoming schedule. Consultations and medical procedures with color coding in one glance.
            </p>
          </div>

          {/* View Switcher: Week / Month toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  viewMode === "week"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <FaCalendarWeek className="h-3 w-3" />
                Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  viewMode === "month"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <FaCalendarDays className="h-3 w-3" />
                Month
              </button>
            </div>

            <Link
              href="/appointments"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-800 transition hover:bg-neutral-50"
            >
              <FaRegCalendarCheck className="h-3 w-3" />
              Appointments List
            </Link>
          </div>
        </div>
      </header>

      {/* ── Category Legend Bar (Matches Dr. Kharyl's clean color pills) ── */}
      <section className="rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Color Legend:</span>
            {selectedCategoryFilter !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("all")}
                className="text-xs font-bold text-amber-700 underline hover:text-amber-800"
              >
                Reset filter (showing {CATEGORIES[selectedCategoryFilter as AppointmentCategory]?.label})
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* All */}
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              selectedCategoryFilter === "all"
                ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white"
            }`}
          >
            <span>All Categories</span>
          </button>

          {/* Available Pill */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Available</span>
          </div>

          {/* Dynamic Category Pills */}
          {Object.values(CATEGORIES).map((cat) => {
            const isSelected = selectedCategoryFilter === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategoryFilter(isSelected ? "all" : cat.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isSelected
                    ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                    : `${cat.badgeBorder} ${cat.badgeBg} ${cat.badgeText} hover:shadow-sm`
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.dotColor }} />
                <span>{cat.label}</span>
              </button>
            );
          })}

          {/* Past date */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50/60 px-3 py-1.5 text-xs font-semibold text-rose-800/70">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span>Past date</span>
          </div>

          {/* Blocked date */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50/60 px-3 py-1.5 text-xs font-semibold text-orange-800/70">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            <span>Closed date</span>
          </div>
        </div>
      </section>

      {/* ── Calendar Container ── */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
        {/* Navigation Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-neutral-900 sm:text-2xl">
              {viewMode === "week" ? formatWeekRange(weekStart) : formatMonthYear(currentYear, currentMonth)}
            </h2>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">
              {currentViewTotalCount} {currentViewTotalCount === 1 ? "Activity" : "Activities"}
            </span>
          </div>

          {/* Previous / Today / Next Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevious}
              className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 active:scale-95"
            >
              <FaChevronLeft className="h-3 w-3" />
              Previous
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-800 transition hover:bg-neutral-200 active:scale-95"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 active:scale-95"
            >
              Next
              <FaChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {appointmentsLoading ? (
          <div className="py-24 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-800" />
            <p className="mt-3 text-sm font-semibold text-neutral-500">Loading schedule activities...</p>
          </div>
        ) : viewMode === "week" ? (
          /* ═══════════════════════════════════════════════
             WEEK VIEW (Matches Dr. Kharyl Image 1)
             ═══════════════════════════════════════════════ */
          <div className="mt-6 overflow-x-auto">
            <div className="grid min-w-[980px] grid-cols-7 gap-3">
              {weekDates.map((dateStr, i) => {
                const dayDate = new Date(`${dateStr}T00:00:00Z`);
                const dayOfWeek = dayDate.getUTCDay(); // 0 is Sun, 1 is Mon
                const dayNum = dayDate.getUTCDate();
                const dayName = WEEKDAY_NAMES[i];
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                const isSunday = dayOfWeek === 0;

                const dayAppts = appointmentsByDate.get(dateStr) ?? [];

                return (
                  <div key={dateStr} className="flex flex-col">
                    {/* Day Column Header */}
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 transition ${
                        isToday
                          ? "border-amber-400 bg-amber-50/70"
                          : "border-neutral-100 bg-neutral-50/80"
                      }`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                        {dayName}
                      </span>
                      <div
                        className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                          isToday
                            ? "bg-rose-600 text-white shadow-sm"
                            : "text-neutral-800"
                        }`}
                      >
                        {dayNum}
                      </div>
                    </div>

                    {/* Day Content Area */}
                    <div className="mt-3 flex flex-1 flex-col gap-2.5 min-h-[460px] rounded-2xl border border-neutral-100 bg-neutral-50/30 p-2">
                      {/* Sunday Closed */}
                      {isSunday ? (
                        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-100/50 p-4 text-center">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                            Day Off
                          </p>
                          <p className="mt-1 text-xs text-neutral-400">Clinic Closed</p>
                        </div>
                      ) : dayAppts.length > 0 ? (
                        /* Appointments Cards */
                        dayAppts.map((appt) => {
                          const { category, primaryLabel } = classifyAppointment(appt);
                          const style = CATEGORIES[category] || CATEGORIES.other;
                          return (
                            <button
                              key={appt.id}
                              type="button"
                              onClick={() => setSelectedAppointment(appt)}
                              className={`group relative flex flex-col items-start rounded-2xl border border-neutral-200/90 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${style.cardBg} ${style.cardBorderLeft} border-l-4`}
                            >
                              {/* Time & Category Pill */}
                              <div className="flex w-full items-center justify-between gap-1">
                                <span className="text-xs font-black text-neutral-900">
                                  {appt.start.slice(0, 5)}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.badgeBg} ${style.badgeText} border ${style.badgeBorder}`}
                                >
                                  {style.label}
                                </span>
                              </div>

                              {/* Procedure / Service Name */}
                              <p className="mt-1.5 text-xs font-black text-neutral-900 line-clamp-2">
                                {primaryLabel}
                              </p>

                              {/* Patient Name */}
                              <p className="mt-1 text-[11px] font-semibold text-neutral-700 truncate w-full">
                                {appt.patientName}
                              </p>

                              {/* Status & Mode Footer */}
                              <div className="mt-2 flex w-full items-center justify-between border-t border-neutral-100 pt-1.5 text-[10px] text-neutral-500">
                                <span className="font-semibold capitalize text-neutral-600">
                                  {isPast ? "Past · " : ""}
                                  {appt.status}
                                </span>
                                <span className="inline-flex items-center gap-1 font-medium text-neutral-500">
                                  {appt.type === "Online" ? (
                                    <>
                                      <FaVideo className="h-2.5 w-2.5 text-sky-600" />
                                      Virtual
                                    </>
                                  ) : (
                                    <>
                                      <FaHospital className="h-2.5 w-2.5 text-emerald-600" />
                                      FamMed
                                    </>
                                  )}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      ) : isPast ? (
                        /* Past Date Pill (Matches Image 1) */
                        <div className="rounded-xl border border-rose-100/70 bg-rose-50/30 p-3.5 text-center">
                          <p className="text-[11px] font-black uppercase tracking-wider text-rose-900/40">
                            Past date
                          </p>
                        </div>
                      ) : (
                        /* Available Open Day */
                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 text-center shadow-xs">
                          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                            Available
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium text-emerald-700/80">
                            Open for bookings
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════
             MONTH VIEW (Matches Dr. Kharyl Image 2)
             ═══════════════════════════════════════════════ */
          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[980px]">
              {/* Day Name Column Headers */}
              <div className="grid grid-cols-7 border-b border-neutral-200 pb-3 text-center text-xs font-black uppercase tracking-wider text-neutral-500">
                {WEEKDAY_NAMES.map((name) => (
                  <div key={name}>{name}</div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div className="grid grid-cols-7 auto-rows-fr border-l border-t border-neutral-200">
                {monthDates.map((dateStr) => {
                  const cellDate = new Date(`${dateStr}T00:00:00Z`);
                  const dayNum = cellDate.getUTCDate();
                  const cellMonth = cellDate.getUTCMonth();
                  const dayOfWeek = cellDate.getUTCDay();
                  const isCurrentMonth = cellMonth === currentMonth;
                  const isToday = dateStr === todayStr;
                  const isPast = dateStr < todayStr;
                  const isSunday = dayOfWeek === 0;

                  const dayAppts = appointmentsByDate.get(dateStr) ?? [];

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[145px] border-b border-r border-neutral-200 p-2 flex flex-col transition ${
                        !isCurrentMonth
                          ? "bg-neutral-50/50 opacity-60"
                          : isToday
                          ? "bg-amber-50/20"
                          : "bg-white"
                      }`}
                    >
                      {/* Cell Header: Day number */}
                      <div className="flex items-center justify-between">
                        <span />
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                            isToday
                              ? "bg-rose-600 text-white"
                              : isCurrentMonth
                              ? "text-neutral-800"
                              : "text-neutral-400"
                          }`}
                        >
                          {dayNum}
                        </span>
                      </div>

                      {/* Cell Body: Appointments or Status Pill */}
                      <div className="mt-1.5 flex flex-1 flex-col gap-1.5">
                        {isSunday ? (
                          <div className="rounded-lg bg-neutral-100/60 py-1 text-center text-[10px] font-semibold text-neutral-400">
                            Closed
                          </div>
                        ) : dayAppts.length > 0 ? (
                          <>
                            {dayAppts.slice(0, 3).map((appt) => {
                              const { category, primaryLabel } = classifyAppointment(appt);
                              const style = CATEGORIES[category] || CATEGORIES.other;
                              return (
                                <button
                                  key={appt.id}
                                  type="button"
                                  onClick={() => setSelectedAppointment(appt)}
                                  className={`flex items-center justify-between gap-1 rounded-lg border px-1.5 py-1 text-left text-[11px] font-semibold transition hover:scale-[1.02] ${style.badgeBg} ${style.badgeBorder} ${style.badgeText}`}
                                >
                                  <span className="truncate">
                                    <strong>{appt.start.slice(0, 5)}</strong> {primaryLabel}
                                  </span>
                                  <span className="shrink-0 text-[9px] opacity-75">
                                    {appt.patientName.split(" ")[0]}
                                  </span>
                                </button>
                              );
                            })}
                            {dayAppts.length > 3 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWeekStart(shiftDate(dateStr, -(cellDate.getUTCDay() === 0 ? 6 : cellDate.getUTCDay() - 1)));
                                  setViewMode("week");
                                }}
                                className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-center text-[10px] font-bold text-neutral-600 hover:bg-neutral-200"
                              >
                                +{dayAppts.length - 3} more
                              </button>
                            )}
                          </>
                        ) : isPast ? (
                          <div className="my-auto rounded-lg border border-rose-100/60 bg-rose-50/30 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-rose-900/40">
                            Past date
                          </div>
                        ) : (
                          <div className="my-auto rounded-lg border border-emerald-100 bg-emerald-50/40 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-700/60">
                            Available
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Appointment Details Modal ── */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl sm:p-7">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedAppointment(null)}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800"
            >
              <FaXmark className="h-4 w-4" />
            </button>

            {(() => {
              const { category, primaryLabel, secondaryLabel } = classifyAppointment(selectedAppointment);
              const style = CATEGORIES[category] || CATEGORIES.other;

              return (
                <div className="space-y-4">
                  {/* Category Pill & Time */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.dotColor }} />
                      {style.label}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                      Queue #{selectedAppointment.queueNumber}
                    </span>
                  </div>

                  {/* Title & Patient */}
                  <div>
                    <h3 className="text-xl font-black text-neutral-900">{primaryLabel}</h3>
                    <p className="mt-1 text-sm font-semibold text-neutral-600 flex items-center gap-1.5">
                      <FaUser className="h-3 w-3 text-neutral-400" />
                      Patient: {selectedAppointment.patientName}
                    </p>
                  </div>

                  {/* Key Info Grid */}
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4 text-xs">
                    <div>
                      <p className="font-medium text-neutral-400 uppercase tracking-wider text-[10px]">Date</p>
                      <p className="mt-0.5 font-bold text-neutral-800">
                        {formatDisplayDate(selectedAppointment.date)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-400 uppercase tracking-wider text-[10px]">Time Slot</p>
                      <p className="mt-0.5 font-bold text-neutral-800">
                        {formatRange(selectedAppointment.start, selectedAppointment.end)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-400 uppercase tracking-wider text-[10px]">Mode</p>
                      <p className="mt-0.5 font-bold text-neutral-800 flex items-center gap-1">
                        {selectedAppointment.type === "Online" ? (
                          <>
                            <FaVideo className="h-3 w-3 text-sky-600" />
                            Virtual Consult
                          </>
                        ) : (
                          <>
                            <FaHospital className="h-3 w-3 text-emerald-600" />
                            FamMed Family Clinic
                          </>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-400 uppercase tracking-wider text-[10px]">Status</p>
                      <p className="mt-0.5 font-bold capitalize text-neutral-800">
                        {selectedAppointment.status}
                      </p>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="rounded-2xl border border-neutral-100 bg-white p-3 text-xs space-y-1.5">
                    {selectedAppointment.phone && (
                      <p className="flex items-center gap-2 text-neutral-700">
                        <FaPhone className="h-3 w-3 text-neutral-400" />
                        <span>{selectedAppointment.phone}</span>
                      </p>
                    )}
                    {selectedAppointment.email && (
                      <p className="flex items-center gap-2 text-neutral-700">
                        <FaEnvelope className="h-3 w-3 text-neutral-400" />
                        <span>{selectedAppointment.email}</span>
                      </p>
                    )}
                    {secondaryLabel && (
                      <p className="pt-1 text-neutral-600 border-t border-neutral-100">
                        <strong>Reason / Notes:</strong> {secondaryLabel}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
                    {selectedAppointment.meetingLink && selectedAppointment.type === "Online" && (
                      <a
                        href={selectedAppointment.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700"
                      >
                        <FaVideo className="h-3 w-3" />
                        Join Google Meet
                      </a>
                    )}
                    <Link
                      href={`/appointments?status=all`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-800 transition hover:bg-neutral-50"
                    >
                      <FaArrowUpRightFromSquare className="h-3 w-3" />
                      Manage in Appointments
                    </Link>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
