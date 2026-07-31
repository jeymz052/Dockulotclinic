"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";

type Step = "verifying" | "set-password" | "done" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("verifying");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash,
        );

        const code = queryParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!active) return;
          if (error) {
            setStep("error");
            setFeedback("Reset link is invalid or expired.");
            return;
          }
        } else {
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!active) return;
            if (error) {
              setStep("error");
              setFeedback("Reset link is invalid or expired.");
              return;
            }
          } else {
            const tokenHash = queryParams.get("token_hash");
            const type = queryParams.get("type");
            if (tokenHash && type === "recovery") {
              const { error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: "recovery",
              });
              if (!active) return;
              if (error) {
                setStep("error");
                setFeedback("Reset link is invalid or expired.");
                return;
              }
            }
          }
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!active) return;
        if (!sessionData.session) {
          setStep("error");
          setFeedback("Reset link is invalid or expired.");
          return;
        }

        setStep("set-password");
      } catch (e) {
        if (!active) return;
        setStep("error");
        setFeedback(e instanceof Error ? e.message : "Failed to verify reset link.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
      setFeedback("Password must include uppercase, lowercase, number, and special character.");
      return;
    }
    if (password !== confirm) {
      setFeedback("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFeedback(error.message);
        return;
      }

      setStep("done");
      setFeedback("Password updated. Redirecting to login...");
      setTimeout(() => {
        router.replace("/login?message=" + encodeURIComponent("Password updated. Please sign in."));
      }, 900);
    });
  }

  return (
    <main className="relative min-h-screen flex items-center justify-end bg-black overflow-hidden pr-8 md:pr-20 lg:pr-32">
      <Image
          src="/images/dockulotbgs.png"
        alt="Doc Kulot consultation background"
        fill
        priority
        quality={100}
        className="object-cover object-left md:object-center"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/15" />

      <section className="relative z-10 w-full max-w-xs rounded-2xl border-2 border-white/20 bg-transparent p-5 shadow-xl backdrop-blur-[2px] overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-center -mb-4 overflow-hidden">
            <Image
              src="/images/dockulotslogonobg.png"
              alt="Doc Kulot Logo"
              width={669}
              height={373}
              priority
              quality={100}
              style={{ width: "280px", height: "auto" }}
              className="object-contain drop-shadow-lg -mt-6 -mb-6"
            />
          </div>

          <div className="mb-3 text-center" style={{ fontFamily: "Inter, Segoe UI, Arial, sans-serif" }}>
            <p className="text-xl font-extrabold text-white drop-shadow">Reset Password</p>
            <p className="mt-0.5 text-xs text-white/80">
              {step === "verifying"
                ? "Verifying reset link..."
                : step === "set-password"
                  ? "Set a new password for your account."
                  : step === "done"
                    ? "Password updated."
                    : "Unable to reset password."}
            </p>
          </div>

          {step === "set-password" ? (
            <form className="space-y-3" onSubmit={submit}>
              <Field label="New password">
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 pr-11 text-white placeholder:text-white/60 outline-none transition focus:border-white/70 focus:ring-2 focus:ring-white/30"
                    placeholder="........"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-white/80 hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <PasswordEyeIcon visible={showPassword} />
                  </button>
                </div>
              </Field>

              <Field label="Confirm password">
                <div className="relative mt-1">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 pr-11 text-white placeholder:text-white/60 outline-none transition focus:border-white/70 focus:ring-2 focus:ring-white/30"
                    placeholder="........"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-white/80 hover:text-white"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    <PasswordEyeIcon visible={showConfirmPassword} />
                  </button>
                </div>
              </Field>

              {feedback ? (
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    "border border-white/20 bg-white/10 text-white/90"
                  }`}
                >
                  {feedback}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-neutral-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-300"
              >
                {isPending ? "Updating..." : "Update password"}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {feedback ? (
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    step === "done"
                      ? "border border-white/20 bg-white/10 text-white/90"
                      : "border border-white/15 bg-white/10 text-white/90"
                  }`}
                >
                  {feedback}
                </div>
              ) : null}

              {step === "error" ? (
                <button
                  type="button"
                  onClick={() => router.replace("/login")}
                  className="w-full rounded-lg bg-white px-3 py-2.5 font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-neutral-200"
                >
                  Back to login
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-1 block text-sm font-semibold tracking-wide text-white">
      {label}
      {children}
    </label>
  );
}

function PasswordEyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M3.53 2.47a.75.75 0 10-1.06 1.06l2.31 2.31C2.8 7.33 1.55 9.24 1.09 10.04a1.97 1.97 0 000 1.92C2 13.57 5.3 18.5 12 18.5c2.36 0 4.38-.61 6.08-1.57l2.39 2.39a.75.75 0 101.06-1.06L3.53 2.47zM12 6.5c4.84 0 7.47 3.57 8.6 5.5a.47.47 0 010 .5c-.41.7-1.08 1.73-2.05 2.69l-2.28-2.28a4.5 4.5 0 00-6.18-6.18L7.9 4.54A11.33 11.33 0 0112 6.5zm2.75 6.72l-3.97-3.97a3 3 0 003.97 3.97zm-5.57-2.39l3.18 3.18a3 3 0 01-3.18-3.18z" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 5.75c-6.7 0-10 4.93-10.91 6.54a1.97 1.97 0 000 1.92C2 15.83 5.3 20.75 12 20.75s10-4.92 10.91-6.54a1.97 1.97 0 000-1.92C22 10.68 18.7 5.75 12 5.75zm0 12.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zm0-10.5a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}
