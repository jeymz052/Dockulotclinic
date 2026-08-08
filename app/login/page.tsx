"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getSafeAuthRedirect } from "@/src/lib/auth/redirect";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";

const MAX_SIGNIN_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const RESET_COOLDOWN_SECONDS = 60;
const VERIFY_RESEND_COOLDOWN_SECONDS = 60;

function getAuthEmailErrorMessage(message: string) {
  if (/email rate limit exceeded|rate limit/i.test(message)) {
    return "Supabase's built-in email sender is rate-limited right now. Wait a few minutes before retrying. If you have already requested several auth emails this hour, you may need to wait up to an hour.";
  }
  return message;
}

function isSuccessFeedback(message: string | null) {
  return message ? /account created|email verified|password updated|reset link has been sent|check your email/i.test(message) : false;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [signInAttempts, setSignInAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [resetCooldownUntil, setResetCooldownUntil] = useState<number | null>(null);
  const [verifyCooldownUntil, setVerifyCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/dashboard";
    }
    return getSafeAuthRedirect(new URLSearchParams(window.location.search).get("next"));
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message");
    if (!message) return;
    const timer = window.setTimeout(() => {
      setFeedback(message);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const nextExpiry = [resetCooldownUntil, verifyCooldownUntil]
      .filter((value): value is number => value != null)
      .find((value) => value > nowTs);
    if (!nextExpiry) return;

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resetCooldownUntil, verifyCooldownUntil, nowTs]);

  const isResetCoolingDown = resetCooldownUntil != null && resetCooldownUntil > nowTs;
  const isVerifyCoolingDown = verifyCooldownUntil != null && verifyCooldownUntil > nowTs;

  function getNormalizedEmailForVerification() {
    const candidate = email.trim().toLowerCase();
    if (!candidate || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      setFeedback("Enter your email address first so we can resend the verification link.");
      return null;
    }
    return candidate;
  }

  function resendVerificationEmail() {
    const now = Date.now();
    if (verifyCooldownUntil && verifyCooldownUntil > now) {
      const secsLeft = Math.max(1, Math.ceil((verifyCooldownUntil - now) / 1000));
      setFeedback(`Please wait ${secsLeft} second(s) before requesting another verification email.`);
      return;
    }

    const normalizedEmail = getNormalizedEmailForVerification();
    if (!normalizedEmail) return;

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
            `/login?next=${encodeURIComponent(nextPath)}`,
          )}&verified=1`,
        },
      });

      if (error) {
        setFeedback(getAuthEmailErrorMessage(error.message));
        return;
      }

      setVerifyCooldownUntil(Date.now() + VERIFY_RESEND_COOLDOWN_SECONDS * 1000);
      setFeedback("A fresh verification email has been sent. Open the confirmation link before signing in.");
    });
  }

  function submitReset(event: React.FormEvent) {
    event.preventDefault();
    setResetFeedback(null);
    const now = Date.now();
    if (resetCooldownUntil && resetCooldownUntil > now) {
      const secsLeft = Math.max(1, Math.ceil((resetCooldownUntil - now) / 1000));
      setResetFeedback(`Please wait ${secsLeft} second(s) before requesting another reset email.`);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const normalizedEmail = resetEmail.trim().toLowerCase();
        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          setResetFeedback("Enter a valid email address.");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) {
          setResetFeedback(getAuthEmailErrorMessage(error.message));
          return;
        }
        setResetCooldownUntil(Date.now() + RESET_COOLDOWN_SECONDS * 1000);
        setResetFeedback("If an account exists for that email, a password reset link has been sent.");
      } catch (error) {
        setResetFeedback(
          error instanceof Error ? getAuthEmailErrorMessage(error.message) : "Failed to send reset email.",
        );
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFeedback("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setFeedback("Password must be at least 8 characters.");
      return;
    }

    if (lockUntil && lockUntil > now) {
      const minsLeft = Math.max(1, Math.ceil((lockUntil - now) / 60000));
      setFeedback(`Too many attempts. Try again in ${minsLeft} minute(s).`);
      return;
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const response = await fetch("/api/v2/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        const message = payload?.message ?? "Invalid credentials.";
        if (/verify your email|email.*confirm|confirm.*email|not confirmed/i.test(message)) {
          setFeedback("Please verify your email before signing in.");
          return;
        }
        if (/inactive/i.test(message)) {
          setFeedback(message);
          return;
        }

        const nextAttempts = signInAttempts + 1;
        setSignInAttempts(nextAttempts);
        const attemptsLeft = Math.max(0, MAX_SIGNIN_ATTEMPTS - nextAttempts);
        if (nextAttempts >= MAX_SIGNIN_ATTEMPTS) {
          setLockUntil(Date.now() + LOCK_MINUTES * 60_000);
          setFeedback(
            `Too many failed logins. Account login is temporarily locked for ${LOCK_MINUTES} minutes.`,
          );
          return;
        }

        setFeedback(`Invalid credentials. ${attemptsLeft} attempt(s) remaining before temporary lock.`);
        return;
      }

      const payload = (await response.json()) as {
        session?: { access_token?: string; refresh_token?: string };
      };
      if (!payload.session?.access_token || !payload.session.refresh_token) {
        setFeedback("Unable to create a secure session. Please try again.");
        return;
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (setSessionError) {
        setFeedback(setSessionError.message);
        return;
      }

      if (payload.session.access_token) {
        await fetch("/api/v2/security/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${payload.session.access_token}`,
          },
          body: JSON.stringify({ event: "login" }),
        }).catch(() => null);
      }

      setSignInAttempts(0);
      setLockUntil(null);
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <main className="relative min-h-screen flex items-center justify-end bg-black overflow-hidden px-4 md:px-10 lg:px-20">
      <Image
        src="/images/dockulotbgs.png"
        alt="Doc Kulot consultation background"
        fill
        priority
        unoptimized
        quality={100}
        className="object-cover object-left md:object-center"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/60" />

      <section className="relative z-10 w-full max-w-[390px] rounded-2xl border border-black/10 bg-white/95 p-5 shadow-xl backdrop-blur-sm overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-center mb-2 overflow-hidden">
            <Image
              src="/images/dockulotslogonobg.png"
              alt="Doc Kulot Logo"
              width={669}
              height={373}
              priority
              quality={100}
              style={{ width: "230px", height: "auto" }}
              className="object-contain drop-shadow-lg mt-0 mb-2"
            />
          </div>

          <div className="text-center mb-2" style={{ fontFamily: "Inter, Segoe UI, Arial, sans-serif" }}>
            <p className="text-lg font-extrabold text-black">Welcome Back!</p>
            <p className="text-[11px] text-black/60 mt-0.5">Sign in to continue your journey</p>
          </div>

          <form className="space-y-2" onSubmit={handleSubmit}>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-0.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black placeholder:text-black/35 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password">
              <div className="relative mt-0.5">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 pr-11 text-sm text-black placeholder:text-black/35 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
                  placeholder="••••••••"
                  minLength={8}
                  title="Use at least 8 characters with uppercase, lowercase, number, and special character."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-black/60 hover:text-black"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                      <path d="M3.53 2.47a.75.75 0 10-1.06 1.06l2.31 2.31C2.8 7.33 1.55 9.24 1.09 10.04a1.97 1.97 0 000 1.92C2 13.57 5.3 18.5 12 18.5c2.36 0 4.38-.61 6.08-1.57l2.39 2.39a.75.75 0 101.06-1.06L3.53 2.47zM12 6.5c4.84 0 7.47 3.57 8.6 5.5a.47.47 0 010 .5c-.41.7-1.08 1.73-2.05 2.69l-2.28-2.28a4.5 4.5 0 00-6.18-6.18L7.9 4.54A11.33 11.33 0 0112 6.5zm2.75 6.72l-3.97-3.97a3 3 0 003.97 3.97zm-5.57-2.39l3.18 3.18a3 3 0 01-3.18-3.18z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                      <path d="M12 5.75c-6.7 0-10 4.93-10.91 6.54a1.97 1.97 0 000 1.92C2 15.83 5.3 20.75 12 20.75s10-4.92 10.91-6.54a1.97 1.97 0 000-1.92C22 10.68 18.7 5.75 12 5.75zm0 12.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zm0-10.5a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                  )}
                </button>
              </div>
            </Field>

            <div className="mt-1 flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 text-[10px] text-black/70">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 bg-white accent-black"
                />
                Remember Me
              </label>
              <button
                type="button"
                className="text-[10px] font-semibold text-black/75 hover:text-black hover:underline"
                onClick={() => {
                  setShowReset(true);
                  setResetEmail(email);
                  setResetFeedback(null);
                  setResetCooldownUntil(null);
                }}
              >
                Forgot password?
              </button>
            </div>

            {feedback ? (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  isSuccessFeedback(feedback)
                    ? "border border-gold-200 bg-gold-50 text-gold-800"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {feedback}
              </div>
            ) : null}

            {feedback && /verify your email/i.test(feedback) ? (
              <button
                type="button"
                onClick={resendVerificationEmail}
                disabled={isPending || isVerifyCoolingDown}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black transition hover:border-gold-300 hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerifyCoolingDown ? "Verification Email Sent" : "Resend Verification Email"}
              </button>
            ) : null}

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-black px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg shadow-black/20 transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-500 disabled:text-neutral-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6L16.5 12L10.5 18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12H16.5" />
              </svg>
              {isPending ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <div className="mt-2 text-center">
            <p className="text-[11px] text-slate-600">
              Don&apos;t have an account?{" "}
              <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-black/80 hover:text-black hover:underline">
                Sign Up
              </Link>
            </p>
            <div className="mt-2.5 space-y-1 text-center">
              <p className="text-[10px] text-black/55">© 2026 Doc Kulot | All rights reserved | Powered by Doc Kulot</p>
              <p className="text-[10px] text-black/55">Having trouble?</p>
              <div className="flex items-center justify-center gap-4 text-[11px]">
                <button type="button" className="text-black/70 hover:text-black hover:underline">
                  Contact Support
                </button>
                <button type="button" className="text-black/70 hover:text-black hover:underline">
                  Help Center
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showReset ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-black/80 p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold">Reset password</p>
                <p className="mt-1 text-xs text-white/75">We&apos;ll send a reset link to your email.</p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => setShowReset(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={submitReset}>
              <Field label="Email">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/60 outline-none transition focus:ring-2 focus:ring-white/30 focus:border-white/70"
                  placeholder="name@example.com"
                  required
                />
              </Field>

              {resetFeedback ? (
                <div
                  className={`rounded-xl px-4 py-3 text-xs ${
                    isSuccessFeedback(resetFeedback)
                      ? "border border-white/20 bg-white/10 text-white/90"
                      : "border border-red-400/40 bg-red-500/10 text-red-200"
                  }`}
                >
                  {resetFeedback}
                </div>
              ) : null}

              {isResetCoolingDown ? (
                <p className="text-[11px] text-white/70">For demo SMTP, wait about a minute before requesting another reset email.</p>
              ) : null}

              <button
                type="submit"
                disabled={isPending || isResetCoolingDown}
                className="w-full rounded-lg bg-white px-3 py-2.5 font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-neutral-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-300"
              >
                {isPending ? "Sending..." : isResetCoolingDown ? "Please wait..." : "Send reset link"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-black/70 mb-0.5 tracking-wide">
      {label}
      {children}
    </label>
  );
}
