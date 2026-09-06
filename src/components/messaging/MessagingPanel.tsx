"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { MessageInput } from "./MessageInput";
import { AppointmentReferenceCard, type AppointmentReference } from "./AppointmentReferenceCard";
import { PatientDetailsSidebar, type PatientContextData } from "./PatientDetailsSidebar";
import { useMessaging } from "./useMessaging";
import type { Conversation } from "./useMessaging";

type Props = {
  myId: string;
  myRole: string;
  myName: string;
  myAvatar?: string | null;
  accessToken: string | null;
  initialConvId?: string | null;
  initialAppointmentId?: string | null;
  initialPatientEmail?: string | null;
};

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 90_000;
}

type PatientContact = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  patient_number?: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
};

function PatientDirectoryModal({
  accessToken,
  onClose,
  onStart,
}: {
  accessToken: string | null;
  onClose: () => void;
  onStart: (patientId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(
    async (q: string) => {
      if (!accessToken) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/contacts?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        setPatients(data.contacts || []);
      } catch (err) {
        console.error("Failed to load patient contacts", err);
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPatients(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, fetchPatients]);

  const handleSelect = async (patientId: string) => {
    setStartingId(patientId);
    setError(null);
    try {
      await onStart(patientId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open conversation");
      setStartingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-neutral-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-lg text-white shadow">
              👥
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Select Patient</h3>
              <p className="text-xs text-neutral-500">Search clinic patient directory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-black transition"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="border-b border-neutral-200 p-4 bg-neutral-50/50">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400"
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
              autoFocus
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-3 text-xs text-neutral-400 hover:text-black"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Patient List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide min-h-60 max-h-80">
          {loading ? (
            <div className="space-y-2 p-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 p-2">
                  <div className="h-10 w-10 rounded-full bg-neutral-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/2 rounded bg-neutral-100" />
                    <div className="h-2.5 w-1/3 rounded bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : patients.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-3xl text-neutral-300">🔍</div>
              <p className="mt-2 text-xs font-medium text-neutral-500">
                {query ? `No patients matching "${query}"` : "No clinic patients found"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {patients.map((p) => {
                const online = isOnline(p.last_seen_at || null);
                const isSelected = startingId === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={Boolean(startingId)}
                    onClick={() => void handleSelect(p.id)}
                    className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-neutral-100 disabled:opacity-60"
                  >
                    <div className="relative shrink-0">
                      <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-900 text-sm font-bold text-white shadow-sm">
                        {p.avatar_url ? (
                          <Image src={p.avatar_url} alt={p.full_name} fill className="object-cover" />
                        ) : (
                          p.full_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                          online ? "bg-emerald-500" : "bg-neutral-300"
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {p.full_name}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {p.patient_number ? `${p.patient_number} • ` : ""}
                        {p.email || p.phone || "Patient Record"}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="text-xs font-semibold text-neutral-900">Opening…</span>
                      ) : (
                        <span className="rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">
                          Chat
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-6 py-3 text-right bg-neutral-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function MessagingPanel({
  myId,
  myRole,
  myName,
  myAvatar,
  accessToken,
  initialConvId,
  initialAppointmentId,
  initialPatientEmail,
}: Props) {
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
  } = useMessaging(myId, myRole, accessToken, initialConvId);

  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [showNewModal, setShowNewModal] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [appointmentReference, setAppointmentReference] = useState<AppointmentReference | null>(null);
  const [showAppointmentCard, setShowAppointmentCard] = useState(true);
  const autoOpenedAppointmentRef = useRef(false);

  // ── Load appointment reference context if appointmentId is present ─────────
  useEffect(() => {
    if (!initialAppointmentId || !accessToken) return;

    let isMounted = true;
    async function loadAppointmentRef() {
      try {
        const res = await fetch(
          `/api/messages/appointment-reference?id=${encodeURIComponent(initialAppointmentId!)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { reference?: AppointmentReference };
        if (isMounted && data.reference) {
          setAppointmentReference(data.reference);
          setShowAppointmentCard(true);
        }
      } catch (err) {
        console.error("Failed to load appointment reference", err);
      }
    }

    void loadAppointmentRef();

    return () => {
      isMounted = false;
    };
  }, [initialAppointmentId, accessToken]);

  // ── Auto-open or create conversation when navigated via appointment shortcut ──
  useEffect(() => {
    if (!initialAppointmentId || !accessToken || autoOpenedAppointmentRef.current) return;
    if (initialConvId) return;

    autoOpenedAppointmentRef.current = true;
    let cancelled = false;

    async function initAppointmentChat() {
      try {
        const conv = await startConversation({
          appointmentId: initialAppointmentId || undefined,
          patientEmail: initialPatientEmail || undefined,
        });
        if (!cancelled && conv) {
          setMobileView("thread");
        }
      } catch (err) {
        console.error("Failed to auto-open appointment conversation", err);
      }
    }

    void initAppointmentChat();

    return () => {
      cancelled = true;
    };
  }, [initialAppointmentId, initialPatientEmail, accessToken, initialConvId, startConversation]);

  const activeConv: Conversation | undefined = conversations.find(
    (c) => c.id === activeConvId
  );

  const isPatient = myRole === "PATIENT";
  const other = activeConv
    ? isPatient
      ? activeConv.clinic_user
      : activeConv.patient
    : null;

  const [showPatientSidebar, setShowPatientSidebar] = useState(false);
  const [patientContextData, setPatientContextData] = useState<PatientContextData | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // ── Fetch patient context & bookings whenever active conversation changes ──
  useEffect(() => {
    if (!activeConv || isPatient || !accessToken) {
      setPatientContextData(null);
      return;
    }

    let active = true;
    async function loadContext() {
      setLoadingContext(true);
      try {
        const query = new URLSearchParams({
          patientId: activeConv!.patient_id,
        });
        if (initialAppointmentId) {
          query.set("appointmentId", initialAppointmentId);
        }
        const res = await fetch(`/api/messages/patient-context?${query.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as PatientContextData;
        if (active) {
          setPatientContextData(data);
        }
      } catch (err) {
        console.error("Failed to load patient context", err);
      } finally {
        if (active) setLoadingContext(false);
      }
    }

    void loadContext();

    return () => {
      active = false;
    };
  }, [activeConv?.id, activeConv?.patient_id, isPatient, accessToken, initialAppointmentId]);

  const handleSelect = useCallback(
    async (id: string) => {
      await openConversation(id);
      setMobileView("thread");
    },
    [openConversation]
  );

  const handleSend = useCallback(
    async (params: {
      body?: string;
      attachment?: { url: string; name: string; size: number; type: "image" | "file" };
    }) => {
      if (!activeConvId) return;
      await sendMessage({ convId: activeConvId, ...params });
      setDraftText("");
    },
    [activeConvId, sendMessage]
  );

  const handleStart = useCallback(
    async (patientId?: string) => {
      await startConversation(patientId);
      setMobileView("thread");
    },
    [startConversation]
  );

  return (
    <div className="flex h-[calc(100vh-165px)] min-h-[640px] max-h-[960px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
      {/* ─── Conversation sidebar ─────────────────────────────────────────── */}
      <div
        className={`flex w-full flex-col border-r border-neutral-200 md:w-72 lg:w-80 shrink-0 ${
          mobileView === "thread" ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 tracking-tight">Messages</h2>
              {totalUnread > 0 ? (
                <p className="text-xs font-semibold text-black">{totalUnread} unread</p>
              ) : (
                <p className="text-xs text-neutral-400">All caught up ✓</p>
              )}
            </div>
          </div>

          {/* New conversation button — clinic staff only */}
          {!isPatient && (
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 transition hover:border-black hover:bg-black hover:text-white"
              aria-label="New conversation"
              title="New conversation"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {/* My identity strip */}
        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-900 text-xs font-bold text-white shadow-sm">
            {myAvatar ? (
              <Image src={myAvatar} alt={myName} fill className="object-cover" />
            ) : (
              myName.charAt(0).toUpperCase()
            )}
          </div>
          <span className="truncate text-xs font-medium text-neutral-700">{myName}</span>
          <span className="ml-auto shrink-0 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
            🟢 Online
          </span>
        </div>

        {/* Conversation list */}
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          myId={myId}
          isPatient={isPatient}
          loading={loadingConvs}
          onSelect={(id) => void handleSelect(id)}
          onNew={isPatient ? () => void handleStart() : () => setShowNewModal(true)}
        />
      </div>

      {/* ─── Chat pane & Patient Details ──────────────────────────────────── */}
      <div
        className={`relative flex flex-1 overflow-hidden bg-white ${
          mobileView === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {activeConv && other ? (
            <>
              {/* Chat header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-5 shadow-sm">
                {/* Back button (mobile) */}
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 md:hidden"
                  aria-label="Back to conversations"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 shadow-sm">
                    {other.avatar_url ? (
                      <Image src={other.avatar_url} alt={other.full_name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-sm font-bold text-white">
                        {other.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                      isOnline(other.last_seen_at) ? "bg-emerald-500" : "bg-neutral-300"
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                    {other.full_name}
                  </p>
                  <p className="truncate text-[11px] text-neutral-400 mt-0.5">
                    {isOnline(other.last_seen_at)
                      ? "🟢 Online now"
                      : other.last_seen_at
                        ? `Last seen ${new Date(other.last_seen_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}`
                        : "Offline"}
                  </p>
                </div>

                {/* Patient & Booking Details Toggle Button for Staff/Doctor */}
                {!isPatient && (
                  <button
                    type="button"
                    onClick={() => setShowPatientSidebar((prev) => !prev)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition shadow-sm ${
                      showPatientSidebar
                        ? "border-black bg-black text-white"
                        : "border-neutral-200 bg-white text-neutral-800 hover:border-black hover:bg-neutral-50"
                    }`}
                    title={showPatientSidebar ? "Hide patient & booking details" : "View patient & booking details"}
                  >
                    <span>📋</span>
                    <span>Patient & Bookings</span>
                    {patientContextData?.appointments && patientContextData.appointments.length > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          showPatientSidebar ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-800"
                        }`}
                      >
                        {patientContextData.appointments.length}
                      </span>
                    )}
                  </button>
                )}

                {/* Attachment info badge */}
                <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-medium text-neutral-600 shadow-sm lg:flex">
                  <span>📎</span> Photos · Files · Links
                </div>
              </div>

              {/* Virtual consultation reference context card */}
              {showAppointmentCard && appointmentReference && (
                <AppointmentReferenceCard
                  reference={appointmentReference}
                  onInsertFollowUp={(text) => setDraftText(text)}
                  onDismiss={() => setShowAppointmentCard(false)}
                />
              )}

              {/* Message thread */}
              <div className="flex flex-1 flex-col overflow-hidden bg-white">
                <ConversationThread
                  messages={messages}
                  myId={myId}
                  loading={loadingMsgs}
                />
              </div>

              {/* Message input */}
              <MessageInput
                onSend={(p) => handleSend(p)}
                accessToken={accessToken}
                textValue={draftText}
                onTextChange={setDraftText}
              />
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center bg-white">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-neutral-200 bg-neutral-100 text-5xl text-neutral-800 shadow-sm">
                  {initialAppointmentId ? "🩺" : "💬"}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-neutral-900">
                  {initialAppointmentId ? "Loading Consultation Chat…" : "Doc Kulot Messenger"}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-500">
                  {initialAppointmentId
                    ? "Connecting your consultation details to the patient's messaging thread…"
                    : isPatient
                    ? "Send a message to the clinic — Doc Kulot will reply in real time."
                    : "Select a conversation on the left, or start a new chat with a patient."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-[11px] text-neutral-500">
                {["💬 Real-time delivery", "📸 Share photos", "📄 Send files", "🔗 Share links", "🟢 Online status"].map((f) => (
                  <span key={f} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-medium shadow-sm">
                    {f}
                  </span>
                ))}
              </div>
              {isPatient ? (
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  className="mt-2 rounded-2xl bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-neutral-800 active:scale-95"
                >
                  💬 Message Doc Kulot Now
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="mt-2 rounded-2xl bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-neutral-800 active:scale-95"
                >
                  + New Conversation
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── Right Patient Details & Booking Sidebar ──────────────────────── */}
        {activeConv && !isPatient && showPatientSidebar && (
          <>
            <div
              className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px] md:hidden"
              onClick={() => setShowPatientSidebar(false)}
            />
            <PatientDetailsSidebar
              data={patientContextData}
              loading={loadingContext}
              onClose={() => setShowPatientSidebar(false)}
              onInsertTemplate={(tmpl) => setDraftText(tmpl)}
            />
          </>
        )}
      </div>

      {/* Patient Directory Modal for Staff/Doctor */}
      {showNewModal && (
        <PatientDirectoryModal
          accessToken={accessToken}
          onClose={() => setShowNewModal(false)}
          onStart={(id) => handleStart(id)}
        />
      )}
    </div>
  );
}
