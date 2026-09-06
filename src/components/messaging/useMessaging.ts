"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";

// ─── Shared types ─────────────────────────────────────────────────────────────
export type ProfileSummary = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  last_seen_at: string | null;
};

export type Conversation = {
  id: string;
  patient_id: string;
  clinic_user_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_clinic: number;
  unread_patient: number;
  created_at: string;
  patient: ProfileSummary;
  clinic_user: ProfileSummary;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_type: "image" | "file" | "link" | null;
  attachment_name: string | null;
  attachment_size: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender: ProfileSummary;
};

export type PendingAttachment = {
  file: File;
  previewUrl: string | null;
  type: "image" | "file";
  uploading: boolean;
  uploaded?: { url: string; name: string; size: number; type: "image" | "file" };
};

// ─── Typed API helper ─────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  token: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string;
    };
    throw new Error(err.message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ─── useMessaging hook ────────────────────────────────────────────────────────
export function useMessaging(
  myId: string,
  myRole: string,
  accessToken: string | null,
  initialConvId?: string | null
) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConvId || null);

  useEffect(() => {
    if (initialConvId) {
      setActiveConvId(initialConvId);
    }
  }, [initialConvId]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presenceInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = getSupabaseBrowserClient();

  // ── Authenticate Supabase Realtime with the user's JWT ─────────────────────
  useEffect(() => {
    if (!accessToken) return;
    try {
      void supabase.realtime.setAuth(accessToken);
    } catch {
      // Ignored if already authenticated
    }
  }, [accessToken, supabase]);

  // ── Presence heartbeat (every 25s) ─────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    const ping = () => {
      void fetch("/api/messages/presence", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    };
    ping();
    presenceInterval.current = setInterval(ping, 25_000);
    return () => {
      if (presenceInterval.current) clearInterval(presenceInterval.current);
    };
  }, [accessToken]);

  // ── Load conversations ─────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>(
        "/api/messages/conversations",
        accessToken
      );
      setConversations(data.conversations);
      // Auto select initial or first conversation if none selected
      setActiveConvId((curr) => {
        if (curr) return curr;
        if (initialConvId) return initialConvId;
        return data.conversations[0]?.id || null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoadingConvs(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // ── Periodic background sync for conversation list (every 5s) ──────────────
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      void loadConversations();
    }, 5000);
    return () => clearInterval(interval);
  }, [accessToken, loadConversations]);

  // ── Realtime: conversation list updates ────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("conversations-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_conversations" },
        () => {
          void loadConversations();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, loadConversations]);

  // ── Load messages for active conversation ──────────────────────────────────
  const openConversation = useCallback(
    async (convId: string) => {
      if (!accessToken) return;
      setActiveConvId(convId);
      setLoadingMsgs(true);
      try {
        const data = await apiFetch<{ conversation: Conversation; messages: Message[] }>(
          `/api/messages/conversations/${convId}`,
          accessToken
        );
        setMessages(data.messages);

        // Mark as read
        void fetch(`/api/messages/conversations/${convId}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read" }),
        });

        // Zero out local unread badge
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, unread_clinic: 0, unread_patient: 0 } : c
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load messages");
      } finally {
        setLoadingMsgs(false);
      }
    },
    [accessToken]
  );

  // Auto-open active conversation on initial load if activeConvId is set
  useEffect(() => {
    if (activeConvId && messages.length === 0) {
      void openConversation(activeConvId);
    }
  }, [activeConvId, openConversation, messages.length]);

  // ── Realtime: new messages in active conversation (WebSocket) ──────────────
  useEffect(() => {
    if (!activeConvId || !accessToken) return;

    const channel = supabase
      .channel(`messages-${activeConvId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConvId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newMsg = payload.new as unknown as Message;

          // Re-fetch the latest message to get joined sender profile
          void apiFetch<{ conversation: Conversation; messages: Message[] }>(
            `/api/messages/conversations/${activeConvId}?limit=5`,
            accessToken
          )
            .then((data) => {
              const latest = data.messages[data.messages.length - 1];
              if (latest) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === latest.id)) return prev;
                  return [...prev, latest];
                });
              }
            })
            .catch(() => {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            });

          // Auto mark as read if we're the recipient
          if (newMsg.sender_id !== myId) {
            void fetch(`/api/messages/conversations/${activeConvId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ action: "mark_read" }),
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeConvId, supabase, myId, accessToken]);

  // ── Seamless auto-sync for active thread (every 2.5s) ───────────────────────
  // Guarantees real-time reflection even if WebSocket is reconnecting
  useEffect(() => {
    if (!activeConvId || !accessToken) return;

    const interval = setInterval(async () => {
      try {
        const data = await apiFetch<{ conversation: Conversation; messages: Message[] }>(
          `/api/messages/conversations/${activeConvId}?limit=50`,
          accessToken
        );
        setMessages((prev) => {
          if (
            prev.length !== data.messages.length ||
            (data.messages.length > 0 &&
              prev[prev.length - 1]?.id !== data.messages[data.messages.length - 1]?.id)
          ) {
            return data.messages;
          }
          return prev;
        });
      } catch {
        // Background sync failed silently
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeConvId, accessToken]);

  // ── Send message: instant optimistic update + server persist ───────────────
  const sendMessage = useCallback(
    async (params: {
      convId: string;
      body?: string;
      attachment?: { url: string; name: string; size: number; type: "image" | "file" };
    }) => {
      if (!accessToken) throw new Error("Not authenticated");

      const res = await fetch(`/api/messages/conversations/${params.convId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send",
          message: {
            body: params.body ?? null,
            attachment_url: params.attachment?.url ?? null,
            attachment_type: params.attachment?.type ?? null,
            attachment_name: params.attachment?.name ?? null,
            attachment_size: params.attachment?.size ?? null,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const data = (await res.json()) as { message: Message };

      // Instantly append to active messages without waiting for reload or websocket
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });

        // Instantly update the sidebar conversation preview and timestamp
        setConversations((prev) =>
          prev.map((c) =>
            c.id === params.convId
              ? {
                  ...c,
                  last_message_at: data.message.created_at,
                  last_message_preview:
                    data.message.body ||
                    (data.message.attachment_type === "image" ? "📷 Photo" : "📎 Attachment"),
                }
              : c
          )
        );
      }
    },
    [accessToken]
  );

  // ── Create or open conversation ────────────────────────────────────────────
  const startConversation = useCallback(
    async (
      target?: string | { patientId?: string; appointmentId?: string; patientEmail?: string }
    ) => {
      if (!accessToken) throw new Error("Not authenticated");
      const bodyPayload =
        typeof target === "string"
          ? { patient_id: target }
          : target
            ? {
                patient_id: target.patientId,
                appointment_id: target.appointmentId,
                patient_email: target.patientEmail,
              }
            : {};

      const data = await apiFetch<{ conversation: Conversation }>(
        "/api/messages/conversations",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify(bodyPayload),
        }
      );
      await loadConversations();
      await openConversation(data.conversation.id);
      return data.conversation;
    },
    [accessToken, loadConversations, openConversation]
  );

  // ── Total unread count for sidebar badge ──────────────────────────────────
  const totalUnread = conversations.reduce((sum, c) => {
    const isPatient = c.patient_id === myId;
    return sum + (isPatient ? c.unread_patient : c.unread_clinic);
  }, 0);

  return {
    conversations,
    activeConvId,
    messages,
    loadingConvs,
    loadingMsgs,
    error,
    totalUnread,
    openConversation,
    sendMessage,
    startConversation,
    reload: loadConversations,
    myId,
    myRole,
  };
}
