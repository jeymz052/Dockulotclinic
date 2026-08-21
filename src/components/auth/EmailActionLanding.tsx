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
}: EmailActionLandingProps) {
  const [actionUrl, setActionUrl] = useState<string | null>(null);

  useEffect(() => {
    setActionUrl(readActionUrl());
  }, []);

  const primaryHref = actionUrl ?? fallbackHref;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-8">
      <Image
        src="/images/dockulotbgs.png"
        alt="Doc Kulot consultation background"
        fill
        priority
        quality={100}
        sizes="100vw"
        className="object-cover object-center opacity-75"
      />
      <div className="absolute inset-0 bg-black/65" />

      <section className="relative z-10 w-full max-w-md rounded-[28px] border border-white/15 bg-black/80 p-6 text-white shadow-2xl backdrop-blur-md sm:p-7">
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">{badge}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
          <p className="text-sm leading-6 text-white/75">{description}</p>
        </div>

        <div className="mt-6 space-y-3">
          <a
            href={primaryHref}
            target="_self"
            rel="noreferrer"
            className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99] ${
              actionUrl
                ? "bg-white text-black hover:bg-neutral-200"
                : "bg-white/85 text-black/70"
            }`}
          >
            {buttonLabel}
          </a>

          <p className="text-center text-xs leading-5 text-white/65">{note}</p>

          {!actionUrl ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs leading-5 text-white/70">
              We could not find the secure verification link on this page. Open the email again, or go back to the login page and request a new link.
            </div>
          ) : null}

          <a
            href={fallbackHref}
            className="block text-center text-xs font-semibold text-white/70 underline underline-offset-4 transition hover:text-white"
          >
            {fallbackLabel}
          </a>
        </div>
      </section>
    </main>
  );
}
