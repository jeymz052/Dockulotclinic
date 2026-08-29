"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { IconType } from "react-icons";
import {
  FaCalendarCheck,
  FaCalendarDays,
  FaCalendarPlus,
  FaChartLine,
  FaChevronRight,
  FaCircleCheck,
  FaClock,
  FaClockRotateLeft,
  FaCloud,
  FaCircleQuestion,
  FaCreditCard,
  FaFileLines,
  FaGear,
  FaHouse,
  FaListUl,
  FaRegMessage,
  FaStethoscope,
  FaUsers,
  FaVideo,
  FaMapLocationDot,
  FaWandMagicSparkles,
  FaInbox,
  FaRegUser,
  FaUserLock,
  FaUserPlus,
} from "react-icons/fa6";
import {
  BOOKING_CLINIC_LOCATIONS,
  STANDARD_BOOKING_END,
  STANDARD_BOOKING_START,
  VIRTUAL_CONSULT_END,
  VIRTUAL_CONSULT_START,
  isFirstOrThirdSunday,
  isVirtualConsultBookingDate,
} from "@/src/lib/clinic-schedule";
import type { UserRole } from "@/src/lib/roles";

type NavSubItem = {
  label: string;
  href: string;
  icon: IconType;
};

type NavItem = {
  label: string;
  href: string;
  icon: IconType;
  subItems?: NavSubItem[];
};

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    { label: "Users Management", href: "/users", icon: FaUsers },
    { label: "Patient Records", href: "/patients/records", icon: FaFileLines },
    {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments", icon: FaCalendarPlus },
        { label: "Manage Appointments", href: "/appointments/my", icon: FaListUl },
        { label: "Calendar View", href: "/appointments/calendar", icon: FaCalendarDays },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
    },
    { label: "POS Billing", href: "/payments/pos", icon: FaFileLines },
    { label: "Medical Documents", href: "/profile/files", icon: FaFileLines },
    {
      label: "Consultations",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Visit Workspace", href: "/consultations", icon: FaVideo },
        { label: "Consultation History", href: "/consultations/history", icon: FaClockRotateLeft },
      ],
    },
    {
      label: "Schedules",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "Doctor Schedules", href: "/schedules", icon: FaStethoscope },
        { label: "Blocked Dates", href: "/schedules/slots", icon: FaClock },
      ],
    },
    { label: "Reports", href: "/reports", icon: FaChartLine },
    { label: "Inquiries", href: "/inquiries", icon: FaInbox },
    { label: "Website Content", href: "/contents", icon: FaWandMagicSparkles },
    { label: "FAQ Content", href: "/faq-content", icon: FaCircleQuestion },
    { label: "Content Creation", href: "/creator-content", icon: FaVideo },
    { label: "Settings", href: "/settings", icon: FaGear },
    { label: "Help Center", href: "/help", icon: FaCircleQuestion },
  ],
  SECRETARY: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    { label: "Patient Records", href: "/patients/records", icon: FaFileLines },
    { label: "Walk-In Patients", href: "/patients/add", icon: FaUserPlus },
    {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments", icon: FaCalendarPlus },
        { label: "Queue List", href: "/appointments/my", icon: FaListUl },
        { label: "Calendar View", href: "/appointments/calendar", icon: FaCalendarDays },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
    },
    { label: "POS Billing", href: "/payments/pos", icon: FaFileLines },
    { label: "Medical Documents", href: "/profile/files", icon: FaFileLines },
    { label: "Inquiries", href: "/inquiries", icon: FaInbox },
    { label: "Website Content", href: "/contents", icon: FaWandMagicSparkles },
    { label: "FAQ Content", href: "/faq-content", icon: FaCircleQuestion },
  ],
  DOCTOR: [
    { label: "Dashboard", href: "/dashboard", icon: FaHouse },
    { label: "Users Management", href: "/users", icon: FaUsers },
    {
      label: "Appointments",
      href: "/appointments/my",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Manage Appointments", href: "/appointments/my", icon: FaCalendarCheck },
        { label: "Calendar View", href: "/appointments/calendar", icon: FaCalendarDays },
      ],
    },
    { label: "Patient Records", href: "/patients/records", icon: FaFileLines },
    {
      label: "Consultations",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Visit Workspace", href: "/consultations", icon: FaVideo },
        { label: "Consultation History", href: "/consultations/history", icon: FaClockRotateLeft },
      ],
    },
    {
      label: "Schedules",
      href: "/schedules",
      icon: FaStethoscope,
      subItems: [
        { label: "My Schedule", href: "/schedules", icon: FaStethoscope },
        { label: "Blocked Dates", href: "/schedules/slots", icon: FaClock },
      ],
    },
    {
      label: "Payments",
      href: "/payments",
      icon: FaCreditCard,
    },
    { label: "POS Billing", href: "/payments/pos", icon: FaFileLines },
    { label: "Medical Documents", href: "/profile/files", icon: FaFileLines },
    { label: "Reports", href: "/reports", icon: FaChartLine },
    { label: "Inquiries", href: "/inquiries", icon: FaInbox },
    { label: "Website Content", href: "/contents", icon: FaWandMagicSparkles },
    { label: "FAQ Content", href: "/faq-content", icon: FaCircleQuestion },
    { label: "Content Creation", href: "/creator-content", icon: FaVideo },
    { label: "Settings", href: "/settings", icon: FaGear },
  ],
  PATIENT: [
    {
      label: "Patient Portal",
      href: "/portal",
      icon: FaUserLock,
      subItems: [
        { label: "Portal Overview", href: "/portal", icon: FaHouse },
        { label: "Medical Documents", href: "/profile/files", icon: FaFileLines },
        { label: "Consultation History", href: "/consultations/history", icon: FaClockRotateLeft },
        { label: "Follow-up Messages", href: "/profile/inquiries", icon: FaInbox },
      ],
    },
   {
      label: "Appointments",
      href: "/appointments",
      icon: FaCalendarCheck,
      subItems: [
        { label: "Book Appointment", href: "/appointments", icon: FaCalendarPlus },
        { label: "My Appointments", href: "/appointments/my", icon: FaCalendarCheck },
        { label: "Calendar View", href: "/appointments/calendar", icon: FaCalendarDays },
      ],
    },
    {
      label: "Online Payments",
      href: "/payments",
      icon: FaCreditCard,
      subItems: [
        { label: "Pay Online", href: "/payments", icon: FaCreditCard },
        { label: "Payment History", href: "/payments/history", icon: FaClockRotateLeft },
      ],
    },
    {
      label: "Virtual Consults",
      href: "/consultations",
      icon: FaRegMessage,
      subItems: [
        { label: "Consultation Lobby", href: "/consultations", icon: FaVideo },
      ],
    },
    {
      label: "Account & Help",
      href: "/profile",
      icon: FaGear,
      subItems: [
        { label: "Profile", href: "/profile", icon: FaRegUser },
        { label: "Help Center", href: "/profile/help", icon: FaCircleQuestion },
      ],
    },
  ],
};

type SidebarProps = {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
};

type ExpandedMenus = Record<string, boolean>;

type ClinicWeather = {
  clinicId: string;
  condition: string;
  temperatureC: number;
};

type WeatherStatus = "idle" | "loading" | "ready" | "error";

const CLINIC_TIME_ZONE = "Asia/Manila";

function formatClinicDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function getClinicTimeMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return value("hour") * 60 + value("minute");
}

function getTimeMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);

  return hour * 60 + minute;
}

function formatTimeLabel(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getTimedStatus(nowMinutes: number, start: string, end: string, availableToday: boolean) {
  if (!availableToday) return "Closed Today";

  const startMinutes = getTimeMinutes(start);
  const endMinutes = getTimeMinutes(end);

  if (nowMinutes >= startMinutes && nowMinutes < endMinutes) return "Open Now";
  if (nowMinutes < startMinutes) return "Opens Today";

  return "Closed Now";
}

function getTodayClinicStatus(date: Date) {
  const clinicDateKey = formatClinicDateKey(date);
  const day = new Date(`${clinicDateKey}T00:00:00Z`).getUTCDay();
  const clinic =
    day >= 1 && day <= 6
      ? BOOKING_CLINIC_LOCATIONS[0]
      : day === 0 && isFirstOrThirdSunday(clinicDateKey)
        ? BOOKING_CLINIC_LOCATIONS[1]
        : null;
  const nowMinutes = getClinicTimeMinutes(date);

  if (!clinic) {
    return {
      clinicId: null,
      clinicName: "No in-person clinic",
      scheduleLabel: "Next clinic follows the saved Doc Kulot schedule",
      statusLabel: getTimedStatus(nowMinutes, STANDARD_BOOKING_START, STANDARD_BOOKING_END, false),
    };
  }

  return {
    clinicId: clinic.value,
    clinicName: clinic.label,
    scheduleLabel: clinic.schedule,
    statusLabel: getTimedStatus(nowMinutes, STANDARD_BOOKING_START, STANDARD_BOOKING_END, true),
  };
}

function getTodayVirtualConsultStatus(date: Date) {
  const clinicDateKey = formatClinicDateKey(date);
  const nowMinutes = getClinicTimeMinutes(date);

  return getTimedStatus(
    nowMinutes,
    VIRTUAL_CONSULT_START,
    VIRTUAL_CONSULT_END,
    isVirtualConsultBookingDate(clinicDateKey),
  );
}

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const navItems = NAV_BY_ROLE[role];
  const pathname = usePathname();
  const today = new Date();
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(today);
  const todayClinic = getTodayClinicStatus(today);
  const virtualConsultStatus = getTodayVirtualConsultStatus(today);
  const clinicHours = `${formatTimeLabel(STANDARD_BOOKING_START)} - ${formatTimeLabel(
    STANDARD_BOOKING_END,
  )}`;
  const virtualConsultHours = `${formatTimeLabel(VIRTUAL_CONSULT_START)} - ${formatTimeLabel(
    VIRTUAL_CONSULT_END,
  )}`;
  const [expanded, setExpanded] = useState<ExpandedMenus>(
    Object.fromEntries(navItems.map((item) => [item.label, false])),
  );
  const [weather, setWeather] = useState<ClinicWeather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherStatus>(
    todayClinic.clinicId ? "loading" : "idle",
  );

  useEffect(() => {
    const clinicId = todayClinic.clinicId;

    if (!clinicId) {
      setWeather(null);
      setWeatherStatus("idle");
      return;
    }

    const weatherClinicId = clinicId;
    let ignore = false;

    async function loadWeather() {
      setWeatherStatus("loading");

      try {
        const response = await fetch(`/api/weather?clinic=${encodeURIComponent(weatherClinicId)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Weather unavailable");
        }

        const data = (await response.json()) as ClinicWeather;

        if (!ignore) {
          setWeather(data);
          setWeatherStatus("ready");
        }
      } catch {
        if (!ignore) {
          setWeather(null);
          setWeatherStatus("error");
        }
      }
    }

    void loadWeather();

    return () => {
      ignore = true;
    };
  }, [todayClinic.clinicId]);

  const toggleExpand = (label: string) => {
    setExpanded((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-neutral-900/60 backdrop-blur-sm lg:hidden ${
          isOpen ? "block" : "hidden"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-0 z-40 flex h-svh max-h-svh w-[min(17rem,86vw)] flex-col overflow-hidden border-r border-neutral-200 bg-white shadow-2xl transition-transform duration-300 lg:h-screen lg:max-h-screen lg:w-56 lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-2">
          <div className="flex items-center justify-between">
            <Image
              src="/images/dockulotslogonobg.png"
              alt="Doc Kulot Logo"
              width={669}
              height={373}
              priority
              quality={100}
              style={{ width: "160px", height: "auto" }}
              className="object-contain -my-2 sm:w-45"
            />
            <button
              className="rounded-md p-2 text-black/70 transition hover:bg-black/5 lg:hidden"
              onClick={onClose}
              type="button"
              aria-label="Close sidebar"
            >
              x
            </button>
          </div>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="flex flex-col gap-2.5">
            {navItems.map((item) => {
              const itemActive = isActive(item.href);

              return (
                <div key={item.label} className="min-h-0">
                   <div
                     className={`group flex items-center rounded-xl px-2 py-2 transition-colors duration-150 ${
                       itemActive ? "bg-white border-l-2 border-gold-400" : "hover:bg-black/5"
                     }`}
                   >
                     <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-2">
                       <item.icon
                         className={`h-4 w-4 shrink-0 ${
                           itemActive ? "text-gold-600" : "text-black/60 group-hover:text-black"
                         }`}
                         aria-hidden="true"
                       />
                       <span
                         className={`truncate text-[15px] leading-4 ${
                           itemActive
                             ? "font-semibold text-gold-700"
                             : "font-medium text-black/75 group-hover:text-black"
                         }`}
                       >
                        {item.label}
                      </span>
                    </Link>

                    {item.subItems ? (
                      <button
                        type="button"
                        className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-black/60 transition hover:bg-black/5 hover:text-black"
                        onClick={() => toggleExpand(item.label)}
                        aria-label={`Toggle ${item.label} submenu`}
                      >
                        <FaChevronRight
                          className={`h-2.5 w-2.5 transition-transform duration-200 ${
                            expanded[item.label] ? "rotate-90" : "rotate-0"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                  </div>

                  {item.subItems && expanded[item.label] ? (
                    <div className="ml-6 mt-1 space-y-1 border-l border-neutral-200 pl-2">
                      {item.subItems.map((subItem) => {
                        const subItemActive = isActive(subItem.href);

                        return (
                          <Link
                            key={subItem.label}
                            href={subItem.href}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium leading-4 transition ${
                           subItemActive
                                 ? "bg-white text-gold-700"
                                 : "text-black/65 hover:bg-black/5 hover:text-black"
                            }`}
                          >
                                 <subItem.icon
                                   className={`h-3.5 w-3.5 shrink-0 ${
                                     subItemActive ? "text-gold-600" : "text-black/60"
                                   }`}
                                   aria-hidden="true"
                                 />
                            <span className="truncate">{subItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-neutral-200 bg-white px-3 py-3">
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-lg">
            {/* Status Header */}
            <div className="flex flex-col items-center justify-center gap-1 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/70">
                  Available Today
                </span>
                <FaCircleCheck className="h-3.5 w-3.5 text-black" aria-hidden="true" />
              </div>
            </div>

            {/* In-person clinic */}
            <div className="mt-2 rounded-xl border border-black/10 px-3 py-1.5">
              <div className="flex items-start justify-center gap-2 text-center text-xs font-semibold text-black/75">
                <FaMapLocationDot className="mt-0.5 h-3 w-3 shrink-0 text-black" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[15px] leading-tight text-neutral-900">{todayClinic.clinicName}</p>
                  <p className="mt-0.5 text-[9px] font-medium leading-tight text-neutral-500">
                    {todayClinic.statusLabel} - {clinicHours}
                  </p>
                  {todayClinic.clinicId ? (
                    <p className="mt-1 inline-flex items-center justify-center gap-1 text-[10px] font-semibold text-neutral-700">
                      <FaCloud className="h-3 w-3 shrink-0 text-black" aria-hidden="true" />
                      {weatherStatus === "ready" && weather
                        ? `${weather.temperatureC}\u00b0C ${weather.condition}`
                        : weatherStatus === "loading"
                          ? "Weather loading"
                          : "Weather unavailable"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Virtual consult */}
            <div className="mt-1.5 rounded-xl border border-black/10 bg-white px-3 py-1.5">
              <div className="flex items-center justify-center gap-2 text-black/75">
                <FaVideo className="h-3 w-3 shrink-0 text-black" aria-hidden="true" />
                <span className="text-xs font-semibold">Virtual Consult</span>
              </div>
              <p className="mt-0.5 text-center text-[9px] font-medium text-neutral-600/75">
                {virtualConsultStatus} - {virtualConsultHours}
              </p>
            </div>

            <p className="mt-1 text-center text-[9px] text-neutral-600/75">{todayLabel}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
