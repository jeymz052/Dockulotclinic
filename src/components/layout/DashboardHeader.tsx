"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowRightFromBracket,
  FaBars,
  FaBell,
  FaCircleCheck,
  FaChevronDown,
  FaClock,
  FaGear,
  FaInbox,
  FaRegUser,
  FaTriangleExclamation,
  FaWandSparkles,
} from "react-icons/fa6";
import { canAccessPath, getRoleProfile, type UserRole } from "@/src/lib/roles";

type ProfileShape = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type NotificationItem = {
  id: string;
  channels: Array<"email" | "sms">;
  template: string;
  status: "queued" | "sent" | "failed";
  created_at: string;
  send_at: string;
  sent_at: string | null;
  subject: string;
  body: string;
  is_read: boolean;
  href?: string | null;
};

type NotificationFeedResponse = {
  notifications: NotificationItem[];
  count: number;
};

type DashboardHeaderProps = {
  role: UserRole;
  profile: ProfileShape | null;
  accessToken: string | null;
  onOpenSidebar: () => void;
  onLogout: () => Promise<void>;
};

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/appointments": "Appointments",
  "/appointments/calendar": "Appointment Calendar",
  "/appointments/my": "My Appointments",
  "/patients": "Patients",
  "/patients/add": "Add Walk-In Patient",
  "/patients/records": "Patient Records",
  "/consultations": "Consultations",
  "/consultations/history": "Consultation History",
  "/payments": "Payments",
  "/payments/history": "Payment History",
  "/payments/pos": "POS Billing",
  "/pricing": "Pricing",
  "/reports": "Reports",
  "/schedules": "Schedules",
  "/schedules/slots": "Blocked Dates",
  "/settings": "Settings",
  "/profile": "Profile",
  "/profile/settings": "My Settings",
  "/profile/help": "Help Center",
  "/help": "Help Center",
  "/users": "Users",
};

function getInitials(name: string | null | undefined) {
  const value = name?.trim();
  if (!value) return "CU";
  const parts = value.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CU";
}

function getCompactName(name: string | null | undefined) {
  const value = name?.trim();
  if (!value) return "User";
  const [first, second] = value.split(/\s+/);
  if (!first) return "User";
  return second ? `${first} ${second[0]?.toUpperCase() ?? ""}.` : first;
}

function formatRelativeDate(input: string) {
  const value = new Date(input);
  const diffMinutes = Math.round((Date.now() - value.getTime()) / 60000);

  if (Math.abs(diffMinutes) < 1) return "Just now";
  if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)} hr ago`;

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function mapTemplateToLabel(template: string) {
  switch (template) {
    case "welcome":
      return "Registration";
    case "appointment_booked":
    case "appointment_staff_booked":
      return "Appointment Booking";
    case "appointment_staff_confirmed":
      return "Appointment Confirmed";
    case "appointment_staff_rescheduled":
      return "Appointment Rescheduled";
    case "appointment_confirmed":
      return "Appointment Confirmed";
    case "appointment_payment_success":
    case "appointment_paid_and_confirmed":
      return "Payment Success";
    case "online_meeting_link":
      return "Online Meeting Link";
    case "appointment_payment_failed":
      return "Payment Issue";
    case "appointment_reminder_24h":
      return "24-Hour Reminder";
    case "appointment_reminder_6h":
      return "Upcoming Reminder";
    case "appointment_staff_checked_in":
      return "Patient Check-In";
    case "appointment_staff_in_progress":
      return "Consultation Started";
    case "appointment_staff_completed":
      return "Consultation Completed";
    case "appointment_staff_payment_failed":
      return "Payment Issue";
    case "billing_issued":
      return "Billing Notice";
    case "appointment_cancelled":
    case "appointment_staff_cancelled":
      return "Appointment Update";
    default:
      return "Notification";
  }
}

function formatChannels(channels: Array<"email" | "sms">) {
  if (channels.length === 0) return "in-app";
  return channels.join(" + ");
}

function formatStatusLabel(status: NotificationItem["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "failed":
      return "Needs attention";
    case "sent":
    default:
      return "Sent";
  }
}

function getNotificationIcon(template: string, status: NotificationItem["status"]) {
  if (status === "failed") return FaTriangleExclamation;

  switch (template) {
    case "online_meeting_link":
      return FaWandSparkles;
    case "appointment_payment_success":
    case "appointment_paid_and_confirmed":
    case "appointment_confirmed":
    case "appointment_staff_confirmed":
      return FaCircleCheck;
    case "appointment_reminder_24h":
    case "appointment_reminder_6h":
      return FaClock;
    default:
      return FaInbox;
  }
}

function getNotificationTone(item: NotificationItem) {
  if (item.status === "failed") {
    return {
      card:
        "border-transparent bg-transparent hover:bg-neutral-50",
      label: "text-neutral-700",
      iconWrap: "border-black/10 bg-white text-black",
      action: "text-neutral-700 hover:text-neutral-900",
      status: "text-neutral-700",
    };
  }

  if (!item.is_read) {
    return {
      card:
        "border-transparent bg-transparent hover:bg-neutral-50",
      label: "text-neutral-700",
      iconWrap: "border-black/10 bg-white text-black",
      action: "text-neutral-700 hover:text-neutral-900",
      status: "text-neutral-700",
    };
  }

  return {
    card:
      "border-transparent bg-transparent hover:bg-neutral-50",
    label: "text-neutral-600",
    iconWrap: "border-black/10 bg-white text-black",
    action: "text-neutral-700 hover:text-neutral-900",
    status: "text-neutral-500",
  };
}

export function DashboardHeader({
  role,
  profile,
  accessToken,
  onOpenSidebar,
  onLogout,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [notifPulse, setNotifPulse] = useState(false);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedNotificationsRef = useRef(false);
  const notificationCountRef = useRef(0);
  const notifPulseTimerRef = useRef<number | null>(null);

  const pageTitle = PAGE_TITLES[pathname] ?? "Workspace";
  const roleLabel = getRoleProfile(role).label.toUpperCase();
  const displayName = profile?.full_name ?? "Doc Kulot User";
  const compactName = getCompactName(displayName);
  const displayEmail = profile?.email ?? "";
  const initials = getInitials(displayName);
  const canSeeSettings = canAccessPath(role, "/settings");
  const settingsHref = canSeeSettings ? "/settings" : "/profile/settings";
  const notifCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);
  const hasNotifications = items.length > 0;

  async function markNotificationAsRead(notificationId: string) {
    if (!accessToken) return;

    try {
      const response = await fetch("/api/v2/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ notification_id: notificationId }),
      });

      if (!response.ok) throw new Error("Failed to mark notification as read");

      // Update local state
      setItems((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item,
        ),
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.is_read) {
      await markNotificationAsRead(item.id);
    }
    setIsNotifOpen(false);
    setNotifPulse(false);
    if (item.href) {
      router.push(item.href);
    }
  }

  async function markAllRead() {
    if (!accessToken) return;
    try {
      const response = await fetch("/api/v2/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!response.ok) throw new Error("Failed to mark all notifications as read");
      setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  }

  function triggerNotificationAlert() {
    if (notifPulseTimerRef.current != null) {
      window.clearTimeout(notifPulseTimerRef.current);
    }

    setNotifPulse(true);
    notifPulseTimerRef.current = window.setTimeout(() => {
      setNotifPulse(false);
      notifPulseTimerRef.current = null;
    }, 2200);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([120, 60, 120]);
    }
  }

  const loadNotifications = useCallback(
    async ({ showLoading }: { showLoading: boolean }) => {
      if (!accessToken) return;

      if (showLoading) {
        setIsNotifLoading(true);
      }

      try {
        const response = await fetch("/api/v2/notifications", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error("Failed to load notifications.");

        const payload = (await response.json()) as NotificationFeedResponse;
        const nextItems = payload.notifications;
        const previousIds = notificationIdsRef.current;
        const newItemCount = hasLoadedNotificationsRef.current
          ? nextItems.filter((item) => !previousIds.has(item.id)).length
          : 0;
        const nextCount = typeof payload.count === "number" ? payload.count : nextItems.length;
        const countIncreased = hasLoadedNotificationsRef.current && nextCount > notificationCountRef.current;

        notificationIdsRef.current = new Set(nextItems.map((item) => item.id));
        hasLoadedNotificationsRef.current = true;
        notificationCountRef.current = nextCount;
        setItems(nextItems);

        if (countIncreased || newItemCount > 0) {
          triggerNotificationAlert();
        }
      } catch {
        setItems([]);
      } finally {
        if (showLoading) {
          setIsNotifLoading(false);
        }
      }
    },
    [accessToken],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(target)) {
        setIsNotifOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    notificationIdsRef.current = new Set();
    hasLoadedNotificationsRef.current = false;
    notificationCountRef.current = 0;

    void loadNotifications({ showLoading: true });

    const pollId = window.setInterval(() => {
      void loadNotifications({ showLoading: false });
    }, 10000);

    return () => {
      window.clearInterval(pollId);
      if (notifPulseTimerRef.current != null) {
        window.clearTimeout(notifPulseTimerRef.current);
      }
    };
  }, [accessToken, loadNotifications]);

  useEffect(() => {
    if (!accessToken || !isNotifOpen) return;

    void loadNotifications({ showLoading: true });
  }, [accessToken, isNotifOpen, loadNotifications]);

  async function handleLogoutClick() {
    setIsMenuOpen(false);
    await onLogout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8f8f7_72%)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50 lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
          >
            <FaBars className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-black/50 sm:block">Doc Kulot Workspace</p>
            <h1 className="truncate text-base font-bold text-neutral-900 sm:text-xl">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-300 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-400 hover:text-neutral-900 sm:h-12 sm:w-12 ${
                notifPulse ? "ring-4 ring-neutral-200 ring-offset-2 ring-offset-white animate-pulse" : ""
              }`}
              aria-label="Notifications"
              onClick={() => {
                setIsNotifOpen((current) => !current);
                setIsMenuOpen(false);
                setNotifPulse(false);
              }}
            >
              <FaBell className="h-4 w-4 text-black/80" />
              {notifCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-bold text-white sm:right-2 sm:top-2">
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              ) : null}
            </button>

            {isNotifOpen ? (
              <button
                type="button"
                className="fixed inset-0 z-30 bg-neutral-900/20 backdrop-blur-[1px] sm:hidden"
                aria-label="Close notifications"
                onClick={() => setIsNotifOpen(false)}
              />
            ) : null}

            {isNotifOpen ? (
              <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.3rem)] z-40 w-auto overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white shadow-[0_18px_56px_rgba(15,23,42,0.14)] sm:absolute sm:right-0 sm:inset-x-auto sm:top-auto sm:mt-3 sm:w-[min(22rem,calc(100vw-2rem))]">
                <div className="border-b border-neutral-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                          <FaBell className="h-3.5 w-3.5 text-black/80" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-neutral-900">Notifications</p>
                          <p className="text-[11px] text-black/50">{notifCount === 0 ? "All caught up" : `${notifCount} unread`}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            void markAllRead();
                          }}
                          disabled={!hasNotifications}
                        >
                          Mark all read
                        </button>
                        <button
                          type="button"
                          className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={async () => {
                            if (!accessToken) return;
                            try {
                              const res = await fetch("/api/v2/notifications", {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${accessToken}`,
                                },
                                body: JSON.stringify({ action: "delete_all" }),
                              });
                              if (!res.ok) throw new Error("Failed to delete notifications");
                              setItems([]);
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          disabled={!hasNotifications}
                        >
                          Clear all
                        </button>
                    </div>
                  </div>
                </div>

                <div
                  className="max-h-[calc(100svh-9.5rem)] overflow-y-auto bg-white px-3 py-1.5 sm:max-h-[26rem] [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {isNotifLoading ? (
                    <div className="space-y-1 py-1.5">
                      {[0, 1, 2, 3].map((key) => (
                        <div key={key} className="flex items-start gap-2.5 rounded-xl px-1 py-2">
                          <div className="h-8 w-8 animate-pulse rounded-lg bg-neutral-100" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="h-2.5 w-20 animate-pulse rounded-full bg-neutral-100" />
                            <div className="h-3.5 w-36 animate-pulse rounded-full bg-neutral-100" />
                            <div className="h-3 w-44 animate-pulse rounded-full bg-neutral-100" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : items.length > 0 ? (
                    <div>
                      {items.map((item) => {
                        const tone = getNotificationTone(item);
                        const Icon = getNotificationIcon(item.template, item.status);

                        return (
                          <div
                            key={item.id}
                            className={`group flex gap-2.5 border-b border-neutral-100 py-2.5 last:border-b-0 ${tone.card}`}
                          >
                                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone.iconWrap}`}>
                                  <Icon className="h-3 w-3" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.label}`}>
                                            {mapTemplateToLabel(item.template)}
                                          </span>
                                          {!item.is_read ? (
                                            <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white">
                                              New
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="mt-0.5 truncate text-[12.5px] font-semibold text-neutral-900">{item.subject}</p>
                                        <p className="mt-0.5 truncate text-[11px] text-black/55">{item.body}</p>
                                      </div>

                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-black/55">
                                          {formatChannels(item.channels)}
                                        </span>
                                        <span className={`text-[10px] font-semibold ${tone.status}`}>
                                          {formatStatusLabel(item.status)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-black/55">
                                      <span>{formatRelativeDate(item.created_at)}</span>
                                      <span className="text-neutral-300">•</span>
                                      <span>{item.channels.length > 0 ? "Delivered" : "In-app only"}</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] font-semibold">
                                      {!item.is_read && (
                                        <button
                                          type="button"
                                          className={`transition ${tone.action}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void markNotificationAsRead(item.id);
                                          }}
                                        >
                                          Mark read
                                        </button>
                                      )}
                                      {item.href ? (
                                        <button
                                          type="button"
                                          className="text-neutral-900 transition hover:text-neutral-600"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void openNotification(item);
                                          }}
                                        >
                                          Open
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-2 py-8 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600">
                          <FaInbox className="h-5 w-5 text-black" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-neutral-900">No notifications yet</p>
                      <p className="mt-1 text-xs leading-5 text-black/55">New activity will show up here.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              className="flex min-w-0 max-w-48 items-center gap-2 rounded-[1.4rem] border-2 border-neutral-300 bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:border-neutral-400 hover:shadow-md sm:max-w-none sm:gap-3 sm:rounded-[1.75rem] sm:px-3 sm:py-2 sm:pr-4"
              onClick={() => {
                setIsMenuOpen((current) => !current);
                setIsNotifOpen(false);
              }}
              aria-label="Open account menu"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-neutral-300 bg-black text-xs font-bold text-white sm:h-11 sm:w-11 sm:border-4 sm:text-sm">
                {initials}
              </div>

              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-extrabold uppercase tracking-[0.04em] text-neutral-900">
                  {displayName}
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.18em] text-black/55">{roleLabel}</p>
              </div>

              <div className="min-w-0 sm:hidden">
                <p className="max-w-19 truncate text-[11px] font-extrabold uppercase tracking-[0.03em] text-neutral-900">
                  {compactName}
                </p>
              </div>

              <FaChevronDown className={`h-3 w-3 shrink-0 text-black/70 transition ${isMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isMenuOpen ? (
              <div className="absolute right-0 mt-3 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
                <div className="border-b border-neutral-100 bg-neutral-50/80 px-5 py-4">
                  <p className="truncate text-sm font-bold uppercase tracking-[0.04em] text-neutral-900">{displayName}</p>
                  <p className="truncate text-xs text-black/55">{displayEmail}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-black/45">{roleLabel}</p>
                </div>

                <div className="p-2">
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <FaRegUser className="h-4 w-4 text-black/80" />
                    <span>Profile</span>
                  </Link>

                  <Link
                    href={settingsHref}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <FaGear className="h-4 w-4 text-black/80" />
                    <span>Settings</span>
                  </Link>
                </div>

                <div className="border-t border-neutral-100 p-2">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                    onClick={handleLogoutClick}
                  >
                    <FaArrowRightFromBracket className="h-4 w-4 text-black/80" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
