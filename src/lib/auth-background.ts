"use client";

import { useEffect, useState } from "react";

// Default to the new configured auth background
export const DEFAULT_AUTH_BACKGROUND =
  "https://vhuzrqmytlahgkmqhzxi.supabase.co/storage/v1/object/public/landing-assets/auth-bg-1794410737431.png";

const AUTH_BG_STORAGE_KEY = "dockulot_auth_bg";

// In-memory module cache to persist instantly across client navigations (/login <-> /register)
let memoryAuthBg: string | null = null;

export function getCachedAuthBackground(): string {
  if (memoryAuthBg) return memoryAuthBg;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(AUTH_BG_STORAGE_KEY);
      if (stored) {
        memoryAuthBg = stored;
        return stored;
      }
    } catch {
      // ignore storage errors
    }
  }
  return DEFAULT_AUTH_BACKGROUND;
}

export function setCachedAuthBackground(url: string) {
  memoryAuthBg = url;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(AUTH_BG_STORAGE_KEY, url);
    } catch {
      // ignore storage errors
    }
  }
}

export function useAuthBackground() {
  const [bgUrl, setBgUrl] = useState<string>(() => getCachedAuthBackground());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/landing-content", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { content?: { auth_background_url?: string | null } };
        const fetchedBg = payload.content?.auth_background_url;
        if (active && fetchedBg && fetchedBg !== bgUrl) {
          setCachedAuthBackground(fetchedBg);
          setBgUrl(fetchedBg);
        }
      } catch {
        // Keep current cached bg
      }
    })();
    return () => {
      active = false;
    };
  }, [bgUrl]);

  return bgUrl;
}

