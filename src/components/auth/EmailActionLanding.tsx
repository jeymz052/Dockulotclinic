"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type EmailActionLandingProps = {
  badge: string;
  title: string;
  description: string;
  buttonLabel: string;
  note: string;
  fallbackHref: string;
  fallbackLabel: string;
  autoProceed?: boolean;
};

function readActionUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryUrl = searchParams.get("confirmation_url")?.trim();
  if (queryUrl) {
    return queryUrl;
  }

  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!fragment.trim()) {
    return null;
  }

  return fragment.trim();
}

export function EmailActionLanding({
  badge,
  title,
  description,
  buttonLabel,
  note,
  fallbackHref,
  fallbackLabel,
  autoProceed = false,
}: EmailActionLandingProps) {
  const [actionUrl] = useState<string | null>(readActionUrl);

  useEffect(() => {
    if (!autoProceed || !actionUrl) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.location.replace(actionUrl);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [actionUrl, autoProceed]);

  const primaryHref = actionUrl ?? fallbackHref;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-100 px-4 py-8">
      <Image
        src="/images/glowrxloginbg - Copy.png"
        alt="Doc Kulot consultation background"
        fill
        priority
        quality={100}
        sizes="100vw"
        className="object-cover object-center opacity-55"
      />
      <div className="absolute inset-0 bg-white/55" />

      <section className="relative z-10 w-full max-w-md rounded-[28px] border border-black/10 bg-white/95 p-6 text-black shadow-2xl backdrop-blur-md sm:p-7">
        <div className="flex justify-center">
          <Image
            src="/images/dockulotslogonobg.png"
            alt="Doc Kulot Logo"
            width={669}
            height={373}
            priority
            quality={100}
            style={{ width: "230px", height: "auto" }}
            className="-mt-6 -mb-2 object-contain drop-shadow-lg"
          />
        </div>

        <div className="mt-2 space-y-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/55">{badge}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-black">{title}</h1>
          <p className="text-sm leading-6 text-black/70">{description}</p>
        </div>

        <div className="mt-6 space-y-3">
          {autoProceed && actionUrl ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 bg-black/3 px-4 py-3 text-sm font-semibold text-black">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-black"
                aria-hidden="true"
              />
              <span>Verifying your email now...</span>
            </div>
          ) : (
            <a
              href={primaryHref}
              target="_self"
              rel="noreferrer"
              className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99] ${
                actionUrl
                  ? "bg-black text-white hover:bg-neutral-800"
                  : "bg-black/85 text-white/80"
              }`}
            >
              {buttonLabel}
            </a>
          )}

          <p className="text-center text-xs leading-5 text-black/65">{note}</p>

          {!actionUrl ? (
            <div className="rounded-2xl border border-black/10 bg-black/3 px-4 py-3 text-center text-xs leading-5 text-black/70">
              We could not find the secure verification link on this page. Open the email again, or go back to the login page and request a new link.
            </div>
          ) : null}

          <a
            href={fallbackHref}
            className="block text-center text-xs font-semibold text-black/65 underline underline-offset-4 transition hover:text-black"
          >
            {fallbackLabel}
          </a>
        </div>
      </section>
    </main>
  );
}
