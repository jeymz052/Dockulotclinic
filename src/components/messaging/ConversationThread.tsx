"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "./useMessaging";
import { MessageBubble } from "./MessageBubble";

type Props = {
  messages: Message[];
  myId: string;
  loading: boolean;
};

export function ConversationThread({ messages, myId, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [hasNewIncoming, setHasNewIncoming] = useState(false);
  const prevCountRef = useRef(messages.length);
  const isNearBottomRef = useRef(true);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    setShowScrollBottom(false);
    setHasNewIncoming(false);
  };

  // Track scroll position to know if user is backreading
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < 120;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
    if (nearBottom) {
      setHasNewIncoming(false);
    }
  };

  // Handle auto-scrolling on new messages
  useEffect(() => {
    const isNew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;

    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const sentByMe = lastMsg?.sender_id === myId;

    const frameId = requestAnimationFrame(() => {
      if (sentByMe || isNearBottomRef.current) {
        scrollToBottom(isNew ? "smooth" : "auto");
      } else if (isNew) {
        setHasNewIncoming(true);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [messages, myId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <span className="text-xs font-medium text-neutral-400">Loading conversation…</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center bg-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 text-3xl shadow-sm">
          💬
        </div>
        <p className="text-xs font-semibold text-neutral-700">
          No messages yet in this conversation
        </p>
        <p className="text-[11px] text-neutral-400">
          Send a message below to begin the conversation.
        </p>
      </div>
    );
  }

  // Group messages by date for date dividers
  const grouped: Array<{ date: string; msgs: Message[] }> = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== dateKey) {
      grouped.push({ date: dateKey, msgs: [msg] });
    } else {
      last.msgs.push(msg);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white">
      {/* Scrollable message thread with visible custom scrollbar */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pr-5 sm:pr-7 space-y-4 [scrollbar-width:thin] [scrollbar-color:#d4d4d4_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400"
      >
        {/* Backread helper at top if many messages */}
        {messages.length >= 25 && (
          <div className="text-center py-2">
            <span className="text-[11px] text-neutral-400 font-medium">
              ↑ Beginning of recent conversation history
            </span>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date} className="space-y-1.5">
            {/* Date divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-200" />
              <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 shadow-sm">
                {date}
              </span>
              <div className="h-px flex-1 bg-neutral-200" />
            </div>

            {msgs.map((msg, idx) => {
              const prevMsg = idx > 0 ? msgs[idx - 1] : null;
              const isFirst = !prevMsg || prevMsg.sender_id !== msg.sender_id;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.sender_id === myId}
                  showAvatar={isFirst}
                />
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Floating "Jump to Latest" backread button */}
      {showScrollBottom && (
        <div className="absolute bottom-4 right-6 z-20">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 shadow-lg transition hover:bg-neutral-50 hover:shadow-xl active:scale-95"
          >
            {hasNewIncoming ? (
              <>
                <span className="flex h-2 w-2 rounded-full bg-black animate-ping" />
                <span>New messages ↓</span>
              </>
            ) : (
              <>
                <span>↓ Jump to latest</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
