"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Conversation } from "./useMessaging";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  myId: string;
  isPatient?: boolean;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew?: () => void;
};

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 90_000;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConversationList({
  conversations,
  activeId,
  myId,
  isPatient = false,
  loading,
  onSelect,
  onNew,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((conv) => {
      const isMePatient = conv.patient_id === myId;
      const other = isMePatient ? conv.clinic_user : conv.patient;
      const name = other?.full_name?.toLowerCase() || "";
      const preview = conv.last_message_preview?.toLowerCase() || "";
      return name.includes(q) || preview.includes(q);
    });
  }, [conversations, search, myId]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Search Bar */}
      <div className="border-b border-neutral-200 p-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPatient ? "Search messages..." : "Search patient or message..."}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder-neutral-400 transition focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-xs text-neutral-400 hover:text-black"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="flex flex-col gap-2 p-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl p-3">
              <div className="h-11 w-11 shrink-0 rounded-full bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-neutral-100" />
                <div className="h-2.5 w-1/2 rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          {search ? (
            <>
              <p className="text-xs text-neutral-500">No conversations matching &quot;{search}&quot;</p>
              {onNew && !isPatient && (
                <button
                  type="button"
                  onClick={onNew}
                  className="rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-100"
                >
                  Search clinic patient directory
                </button>
              )}
            </>
          ) : isPatient ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-2xl text-white shadow-md">
                👩‍⚕️
              </div>
              <h4 className="text-sm font-bold text-neutral-900">Doc Kulot</h4>
              <p className="mt-1 text-xs text-neutral-500">Family Medicine & Aesthetic Specialist</p>
              <button
                type="button"
                onClick={onNew}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-neutral-800 active:scale-95"
              >
                💬 Message Doc Kulot
              </button>
            </div>
          ) : (
            <>
              <div className="text-3xl text-neutral-300">💬</div>
              <p className="text-xs font-medium text-neutral-500">No conversations yet</p>
              {onNew && (
                <button
                  type="button"
                  onClick={onNew}
                  className="mt-1 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-neutral-800"
                >
                  Start a conversation
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filtered.map((conv) => {
            const isMePatient = conv.patient_id === myId;
            const other = isMePatient ? conv.clinic_user : conv.patient;
            const unread = isMePatient ? conv.unread_patient : conv.unread_clinic;
            const online = isOnline(other?.last_seen_at || null);
            const isActive = conv.id === activeId;

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelect(conv.id)}
                className={`group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all duration-150 border-b border-neutral-100/70 ${
                  isActive
                    ? "border-r-2 border-r-black bg-neutral-100/90 font-semibold"
                    : "hover:bg-neutral-50/80"
                }`}
              >
                {/* Avatar with online dot */}
                <div className="relative shrink-0">
                  <div className="relative h-11 w-11 overflow-hidden rounded-full border border-neutral-200 shadow-sm bg-neutral-100">
                    {other?.avatar_url ? (
                      <Image
                        src={other.avatar_url}
                        alt={other.full_name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-sm font-bold text-white">
                        {other?.full_name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  {/* Online indicator */}
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                      online ? "bg-emerald-500" : "bg-neutral-300"
                    }`}
                  />
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`truncate text-sm ${
                        isActive ? "font-bold text-black" : "font-semibold text-neutral-800"
                      }`}
                    >
                      {other?.full_name || "Unknown"}
                    </p>
                    <span className="shrink-0 text-[10px] text-neutral-400">
                      {formatRelativeTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p
                      className={`truncate text-xs ${
                        unread > 0 ? "font-bold text-black" : "text-neutral-500"
                      }`}
                    >
                      {conv.last_message_preview || "No messages yet"}
                    </p>
                    {unread > 0 && (
                      <span className="shrink-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold text-white shadow-sm">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
