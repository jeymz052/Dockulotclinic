"use client";

import Image from "next/image";
import type { Message } from "./useMessaging";

type Props = {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidUrl(str: string) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/** Renders a link preview card if the body is a lone URL */
function LinkCard({ url, isMine }: { url: string; isMine: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition underline-offset-2 hover:underline ${
        isMine
          ? "border border-neutral-700 bg-neutral-800 text-neutral-100"
          : "border border-neutral-200 bg-white text-neutral-900 shadow-sm"
      }`}
    >
      <span className="text-sm">🔗</span>
      <span className="truncate max-w-[220px]">{url}</span>
    </a>
  );
}

export function MessageBubble({ message, isMine, showAvatar }: Props) {
  const isLoneUrl =
    message.body &&
    !message.body.includes(" ") &&
    isValidUrl(message.body);

  return (
    <div
      className={`flex items-end gap-2.5 mb-1.5 transition-all ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      {/* Left Avatar for Incoming Messages */}
      {!isMine && (
        showAvatar ? (
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 shadow-sm">
            {message.sender.avatar_url ? (
              <Image
                src={message.sender.avatar_url}
                alt={message.sender.full_name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-bold bg-neutral-200 text-neutral-700">
                {message.sender.full_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ) : (
          <div className="w-7 shrink-0" />
        )
      )}

      {/* Bubble Container */}
      <div
        className={`group relative max-w-[72%] sm:max-w-[68%] flex flex-col ${
          isMine ? "items-end" : "items-start"
        }`}
      >
        {/* Image attachment */}
        {message.attachment_type === "image" && message.attachment_url && (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`relative mb-1 block overflow-hidden rounded-2xl border border-neutral-200 shadow-sm transition-opacity hover:opacity-95 ${
              isMine ? "rounded-br-sm" : "rounded-bl-sm"
            }`}
            style={{ maxWidth: 280 }}
          >
            <Image
              src={message.attachment_url}
              alt={message.attachment_name ?? "Attachment"}
              width={280}
              height={200}
              className="object-cover"
              style={{ maxHeight: 220, objectFit: "cover" }}
            />
          </a>
        )}

        {/* File attachment */}
        {message.attachment_type === "file" && message.attachment_url && (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`mb-1 flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs transition ${
              isMine
                ? "border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800"
                : "border-neutral-200 bg-white text-neutral-800 shadow-sm hover:bg-neutral-50"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isMine ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              📄
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold" style={{ maxWidth: 180 }}>
                {message.attachment_name ?? "File"}
              </p>
              {message.attachment_size && (
                <p className={`text-[10px] ${isMine ? "text-neutral-400" : "text-neutral-500"}`}>
                  {formatFileSize(message.attachment_size)}
                </p>
              )}
            </div>
          </a>
        )}

        {/* Text body */}
        {message.body && (
          <div
            className={`rounded-2xl px-4 py-2 text-sm leading-relaxed transition-all shadow-sm ${
              isMine
                ? "rounded-br-sm bg-neutral-900 text-white"
                : "rounded-bl-sm bg-neutral-100 text-neutral-900 border border-neutral-200/80"
            }`}
          >
            {isLoneUrl ? (
              <LinkCard url={message.body} isMine={isMine} />
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
            )}
          </div>
        )}

        {/* Timestamp & read receipts */}
        <span
          className={`mt-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-75 ${
            isMine ? "text-right text-neutral-400 pr-1" : "text-neutral-400 pl-1"
          }`}
        >
          {formatTime(message.created_at)}
          {isMine && (
            <span className="ml-1 font-mono text-[9px] text-neutral-400">
              {message.is_read ? "✓✓" : "✓"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
