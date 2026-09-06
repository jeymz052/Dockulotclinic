"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useMessaging } from "./useMessaging";
import { ConversationThread } from "./ConversationThread";
import { MessageInput } from "./MessageInput";
import type { Conversation } from "./useMessaging";

type Props = {
  myId: string;
  myRole: string;
  myName: string;
  myAvatar?: string | null;
  accessToken: string | null;
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

export function FloatingMessageWidget({
  myId,
  myRole,
  myName,
  myAvatar,
  accessToken,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const {
    conversations,
    activeConvId,
    messages,
    loadingConvs,
    loadingMsgs,
    totalUnread,
    openConversation,
    sendMessage,
    startConversation,
  } = useMessaging(myId, myRole, accessToken);

  const isPatient = myRole === "PATIENT";

  const activeConv: Conversation | undefined = conversations.find(
    (c) => c.id === activeConvId
  );

  const other = activeConv
    ? isPatient
      ? activeConv.clinic_user
      : activeConv.patient
    : null;

  // Filter conversations by search term
  const filteredConversations = conversations.filter((c) => {
    if (!search.trim()) return true;
    const isMePatient = c.patient_id === myId;
    const otherUser = isMePatient ? c.clinic_user : c.patient;
    const q = search.toLowerCase();
    return (
      otherUser?.full_name?.toLowerCase().includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q)
    );
  });

  const handleOpenFullPage = (convId?: string) => {
    setIsOpen(false);
    if (convId) {
      router.push(`/messages?convId=${convId}`);
    } else {
      router.push("/messages");
    }
  };

  const handleSend = useCallback(
    async (params: {
      body?: string;
      attachment?: { url: string; name: string; size: number; type: "image" | "file" };
    }) => {
      if (!activeConvId) return;
      await sendMessage({ convId: activeConvId, ...params });
    },
    [activeConvId, sendMessage]
  );

  return (
    <>
      {/* ─── Floating Popup Card ─────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-24 right-5 sm:right-7 z-50 flex h-[520px] max-h-[82vh] w-[340px] sm:w-[380px] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl transition-all duration-200">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 py-3.5 shadow-sm">
            {activeConvId && other ? (
              /* Active Chat Header */
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => openConversation("")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-black transition"
                  title="Back to conversation list"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div className="relative shrink-0">
                  <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-900 text-xs font-bold text-white">
                    {other.avatar_url ? (
                      <Image src={other.avatar_url} alt={other.full_name} fill className="object-cover" />
                    ) : (
                      other.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white ${
                      isOnline(other.last_seen_at) ? "bg-emerald-500" : "bg-neutral-300"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-neutral-900">{other.full_name}</p>
                  <p className="text-[10px] text-neutral-400">
                    {isOnline(other.last_seen_at) ? "🟢 Online" : "Offline"}
                  </p>
                </div>
              </div>
            ) : (
              /* Conversation List Header */
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white text-xs shadow-sm">
                  💬
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-neutral-900">Messages</h3>
                  <p className="text-[10px] text-neutral-400">
                    {totalUnread > 0 ? `${totalUnread} unread` : "All conversations"}
                  </p>
                </div>
              </div>
            )}

            {/* Actions: Open Full Page & Close */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleOpenFullPage(activeConvId || undefined)}
                className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:border-black hover:bg-black hover:text-white"
                title="Open messaging section like usual flow"
              >
                <span>Full page</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-black transition"
                title="Close floating chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body Content */}
          {activeConvId && other ? (
            /* Active Thread View inside popup */
            <div className="flex flex-1 flex-col overflow-hidden bg-white">
              <ConversationThread
                messages={messages}
                myId={myId}
                loading={loadingMsgs}
              />
              <MessageInput
                onSend={(p) => handleSend(p)}
                accessToken={accessToken}
              />
            </div>
          ) : (
            /* Conversation List View inside popup */
            <div className="flex flex-1 flex-col overflow-hidden bg-white">
              {/* Search Bar */}
              <div className="border-b border-neutral-200 p-2.5 bg-neutral-50/50">
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search conversations…"
                    className="w-full rounded-xl border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-900 placeholder-neutral-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <svg
                    className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400"
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
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100/80 [scrollbar-width:thin] [scrollbar-color:#d4d4d4_transparent]">
                {loadingConvs ? (
                  <div className="space-y-3 p-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex animate-pulse items-center gap-3 p-2">
                        <div className="h-9 w-9 rounded-full bg-neutral-100 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-1/2 rounded bg-neutral-100" />
                          <div className="h-2.5 w-3/4 rounded bg-neutral-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                    <div className="text-3xl text-neutral-300">💬</div>
                    <p className="mt-2 text-xs font-semibold text-neutral-700">
                      {search ? "No matching conversations" : "No conversations yet"}
                    </p>
                    {isPatient && (
                      <button
                        type="button"
                        onClick={() => void startConversation()}
                        className="mt-3 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                      >
                        Message Doc Kulot
                      </button>
                    )}
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isMePatient = conv.patient_id === myId;
                    const otherUser = isMePatient ? conv.clinic_user : conv.patient;
                    const unread = isMePatient ? conv.unread_patient : conv.unread_clinic;
                    const online = isOnline(otherUser?.last_seen_at || null);

                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => void openConversation(conv.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50/80"
                      >
                        <div className="relative shrink-0">
                          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-900 text-xs font-bold text-white shadow-sm">
                            {otherUser?.avatar_url ? (
                              <Image
                                src={otherUser.avatar_url}
                                alt={otherUser.full_name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              otherUser?.full_name?.charAt(0).toUpperCase() || "?"
                            )}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                              online ? "bg-emerald-500" : "bg-neutral-300"
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-bold text-neutral-900">
                              {otherUser?.full_name || "Unknown"}
                            </p>
                            <span className="shrink-0 text-[9px] text-neutral-400">
                              {formatRelativeTime(conv.last_message_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p
                              className={`truncate text-[11px] ${
                                unread > 0 ? "font-bold text-black" : "text-neutral-500"
                              }`}
                            >
                              {conv.last_message_preview || "No messages yet"}
                            </p>
                            {unread > 0 && (
                              <span className="shrink-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] font-bold text-white">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Bottom bar inside list */}
              <div className="border-t border-neutral-200 p-2.5 bg-neutral-50/60 text-center">
                <button
                  type="button"
                  onClick={() => handleOpenFullPage()}
                  className="w-full rounded-xl bg-black py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>Open Full Messenger</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Floating Action Button (Lower Right Corner) ──────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group relative flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-200 active:scale-95 ${
            isOpen
              ? "bg-neutral-900 text-white hover:bg-black"
              : "bg-black text-white hover:bg-neutral-900 hover:scale-105"
          }`}
          aria-label={isOpen ? "Close messaging" : "Open messages"}
          title="Open messaging"
        >
          {isOpen ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="h-6 w-6 transition-transform group-hover:rotate-90"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6 transition-transform group-hover:scale-110"
            >
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          )}

          {/* Unread message indicator badge on FAB */}
          {!isOpen && totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-black text-white shadow-md animate-bounce">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
