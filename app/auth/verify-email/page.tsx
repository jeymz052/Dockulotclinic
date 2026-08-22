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
    const message = params.get("message")?.trim();
    if (message) {
      setFeedback(message);
    }
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/55">
            Verify account
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-black">
            Check your email
          </h1>
          <p className="text-sm leading-6 text-black/70">
            We sent a verification link to your email address. If it expired or you did not receive it,
            resend a fresh one below.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <label className="block text-left">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
              Email address
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black placeholder:text-black/35 outline-none transition focus:border-black/30 focus:ring-2 focus:ring-black/10"
            />
          </label>

          <button
            type="button"
            onClick={resendVerificationEmail}
            disabled={isPending || isCoolingDown || !emailLooksValid}
            className="flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-black/40"
          >
            {isCoolingDown ? "Verification Email Sent" : isPending ? "Sending..." : "Resend verification email"}
          </button>

          {feedback ? (
            <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-center text-xs leading-5 text-black/75">
              {feedback}
            </div>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-center text-xs leading-5 text-black/65">
              Use the same email you used during sign up. After verifying, you can sign in from the login page.
            </div>
          )}

          <Link
            href={loginHref}
            className="block text-center text-xs font-semibold text-black/65 underline underline-offset-4 transition hover:text-black"
          >
            Go to login
          </Link>
        </div>
      </section>
    </main>
  );
}
