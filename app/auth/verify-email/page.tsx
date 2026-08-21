"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getSafeAuthRedirect } from "@/src/lib/auth/redirect";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildLoginRedirect(nextPath: string) {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/dashboard";
    }
    return getSafeAuthRedirect(new URLSearchParams(window.location.search).get("next"));
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email")?.trim().toLowerCase() ?? "");
  }, []);

  useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= nowTs) return;

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownUntil, nowTs]);

  const normalizedEmail = email.trim().toLowerCase();
  const emailLooksValid = isValidEmail(normalizedEmail);
  const isCoolingDown = cooldownUntil != null && cooldownUntil > nowTs;
  const loginHref = buildLoginRedirect(nextPath);

  function resendVerificationEmail() {
    if (!emailLooksValid) {
      setFeedback("Enter the email you used when you signed up.");
      return;
    }

    if (isCoolingDown) {
      const secsLeft = Math.max(1, Math.ceil((cooldownUntil! - nowTs) / 1000));
      setFeedback(`Please wait ${secsLeft} second(s) before requesting another verification email.`);
      return;
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
            loginHref,
          )}&verified=1`,
        },
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setFeedback("A new verification email has been sent. Open it and confirm your account.");
    });
  }

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
            Verify account
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Check your email
          </h1>
          <p className="text-sm leading-6 text-white/75">
            We sent a verification link to your email address. If it expired or you did not receive it,
            resend a fresh one below.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <label className="block text-left">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Email address
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/15"
            />
          </label>

          <button
            type="button"
            onClick={resendVerificationEmail}
            disabled={isPending || isCoolingDown || !emailLooksValid}
            className="flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/50"
          >
            {isCoolingDown ? "Verification Email Sent" : isPending ? "Sending..." : "Resend verification email"}
          </button>

          {feedback ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs leading-5 text-white/75">
              {feedback}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs leading-5 text-white/65">
              Use the same email you used during sign up. After verifying, you can sign in from the login page.
            </div>
          )}

          <Link
            href={loginHref}
            className="block text-center text-xs font-semibold text-white/70 underline underline-offset-4 transition hover:text-white"
          >
            Go to login
          </Link>
        </div>
      </section>
    </main>
  );
}
