"use client";

import { useState } from "react";
import type { PendingAttachment } from "./useMessaging";

type Props = {
  onSend: (params: {
    body?: string;
    attachment?: { url: string; name: string; size: number; type: "image" | "file" };
  }) => Promise<void>;
  disabled?: boolean;
  accessToken: string | null;
  textValue?: string;
  onTextChange?: (value: string) => void;
};

export function MessageInput({
  onSend,
  disabled,
  accessToken,
  textValue,
  onTextChange,
}: Props) {
  const [internalText, setInternalText] = useState("");
  const text = textValue !== undefined ? textValue : internalText;
  const setText = (val: string) => {
    if (onTextChange) {
      onTextChange(val);
    } else {
      setInternalText(val);
    }
  };
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const handleFileSelect = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    const optimistic: PendingAttachment = {
      file,
      previewUrl,
      type: isImage ? "image" : "file",
      uploading: true,
    };
    setPending(optimistic);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/messages/upload", {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = (await res.json()) as {
        url: string;
        name: string;
        size: number;
        type: "image" | "file";
      };

      setPending((prev) =>
        prev ? { ...prev, uploading: false, uploaded: data } : null
      );
    } catch {
      setPending(null);
    }
  };

  const removePending = () => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !pending?.uploaded) return;
    if (sending) return;

    setSending(true);
    try {
      await onSend({
        body: trimmed || undefined,
        attachment: pending?.uploaded ?? undefined,
      });
      setText("");
      setPending(null);
      setInputKey((k) => k + 1);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const canSend = (text.trim().length > 0 || Boolean(pending?.uploaded)) && !sending;

  return (
    <div className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3">
      {/* Attachment preview */}
      {pending && (
        <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
          {pending.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pending.previewUrl}
              alt="Preview"
              className="h-12 w-12 rounded-xl object-cover border border-neutral-200"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-200 text-xl text-neutral-700">
              📄
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-neutral-800">{pending.file.name}</p>
            <p className="text-[11px] text-neutral-400">
              {pending.uploading ? (
                <span className="animate-pulse font-medium text-neutral-600">Uploading…</span>
              ) : (
                "Ready to send ✓"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={removePending}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600 transition hover:bg-black hover:text-white"
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <label
          className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-black ${
            pending || disabled ? "pointer-events-none opacity-40" : ""
          }`}
          aria-label="Attach file"
        >
          <input
            key={inputKey}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelect(file);
            }}
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </label>

        {/* Textarea */}
        <div className="relative flex-1">
          <textarea
            key={`ta-${inputKey}`}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Shift+Enter for new line)"
            disabled={disabled}
            rows={1}
            className="block w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm leading-relaxed text-neutral-900 placeholder-neutral-400 transition focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-50"
            style={{ maxHeight: 140, overflowY: "auto" }}
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend || disabled}
          aria-label="Send message"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
            canSend
              ? "bg-black text-white shadow hover:bg-neutral-800 hover:scale-105 active:scale-95"
              : "bg-neutral-100 text-neutral-300"
          }`}
        >
          {sending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>

      <p className="mt-2 text-center text-[10px] text-neutral-400">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
