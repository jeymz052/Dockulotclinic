"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getSafeAuthRedirect } from "@/src/lib/auth/redirect";
import { type PatientSignupFields, validatePatientSignupFields } from "@/src/lib/patient-registration";
import { getSupabaseBrowserClient } from "@/src/lib/supabase/client";

type AuthForm = PatientSignupFields;
type ConsentKey = "termsAccepted" | "cancellationAccepted";
type PolicyModal = "terms" | "cancellation" | null;

const INITIAL_FORM: AuthForm = {
  email: "",
  password: "",
  confirmPassword: "",
};

const INITIAL_CONSENTS: Record<ConsentKey, boolean> = {
  termsAccepted: false,
  cancellationAccepted: false,
};

const POLICY_CONTENT = {
  terms: {
    title: "Doc Kulot Terms and Conditions",
    sections: [
      {
        heading: "1. Appointment and Account Information",
        body:
          "By creating an account with Doc Kulot, you confirm that the personal details you provide are accurate, complete, and updated. You are responsible for keeping your login credentials secure and for any activity made through your account.",
      },
      {
        heading: "2. Use of Clinic Services",
        body:
          "Clinic appointments, online booking, and related services must be used only for lawful and legitimate medical scheduling purposes. Submitting false information, impersonating another person, or abusing the booking system may result in account restriction or cancellation of services.",
      },
      {
        heading: "3. Medical and Administrative Limitations",
        body:
          "Booking an appointment through the website does not replace emergency care or professional medical advice. Doc Kulot may reschedule, adjust, or decline appointments when necessary because of doctor availability, emergencies, or incomplete patient information.",
      },
      {
        heading: "4. Privacy and Records",
        body:
          "Your information may be used for appointment coordination, patient verification, billing, reminders, and clinic operations in accordance with applicable privacy obligations. By registering, you allow the clinic to securely process the information needed to provide its services.",
      },
      {
        heading: "5. Acceptance of Policies",
        body:
          "By proceeding with account registration, you acknowledge that you have read and accepted these terms together with the clinic cancellation policy. Doc Kulot may update these terms from time to time, and continued use of the platform means you accept the latest version.",
      },
    ],
  },
  cancellation: {
    title: "Doc Kulot Cancellation Policy",
    sections: [
      {
        heading: "1. Notice of Cancellation",
        body:
          "Patients are encouraged to cancel or reschedule as early as possible if they can no longer attend their appointment. Advance notice helps the clinic offer the slot to other patients and manage doctor schedules more effectively.",
      },
      {
        heading: "2. Late Cancellation and No-Show",
        body:
          "Repeated late cancellations or failure to attend a scheduled appointment without notice may affect future booking privileges. Doc Kulot may flag or review accounts that repeatedly reserve slots without completing appointments.",
      },
      {
        heading: "3. Online Booking and Payment-Related Appointments",
        body:
          "For appointments connected to online reservations or payments, cancellation handling may depend on the status of the booking, payment provider rules, and clinic review. Administrative processing may still be required before a cancellation or adjustment is finalized.",
      },
      {
        heading: "4. Clinic-Initiated Changes",
        body:
          "Doc Kulot may reschedule or cancel appointments when required due to doctor emergencies, unforeseen schedule changes, technical issues, or patient safety concerns. When possible, the clinic will notify affected patients using the contact details on file.",
      },
      {
        heading: "5. Patient Responsibility",
        body:
          "Patients are responsible for checking their selected date, time, consultation type, and contact information before confirming a booking. If you need assistance, please contact the clinic promptly so the staff can help update your schedule.",
      },
    ],
  },
} as const;

function getAuthEmailErrorMessage(message: string) {
  if (/email rate limit exceeded|rate limit/i.test(message)) {
    return "Supabase's built-in email sender is rate-limited right now. Wait a few minutes before retrying. If you have already requested several auth emails this hour, you may need to wait up to an hour.";
  }
  return message;
}

function isSuccessFeedback(message: string | null) {
  return message ? /account created|check your email|email verified|password updated|sent/i.test(message) : false;
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<AuthForm>(INITIAL_FORM);
  const [consents, setConsents] = useState(INITIAL_CONSENTS);
  const [activeModal, setActiveModal] = useState<PolicyModal>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AuthForm | ConsentKey, string>>>({});
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/dashboard";
    }
    return getSafeAuthRedirect(new URLSearchParams(window.location.search).get("next"));
  });

  useEffect(() => {
    try {
      const rawDraft = localStorage.getItem("bookingDraft");
      if (!rawDraft) return;

      const parsed = JSON.parse(rawDraft) as { formData?: Partial<{ email: string }> };
      queueMicrotask(() => {
        setFormData((current) => ({
          ...current,
          email: current.email || parsed.formData?.email || "",
        }));
      });
    } catch {
      // Ignore invalid local drafts; the registration form still works.
    }
  }, []);

  function updateField<K extends keyof AuthForm>(field: K, value: AuthForm[K]) {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(null);
  }

  function updateConsent(field: ConsentKey, value: boolean) {
    setConsents((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(null);
  }

  function validateSignupFields(values: AuthForm) {
    const errors: Partial<Record<keyof AuthForm | ConsentKey, string>> = {};
    const signupError = validatePatientSignupFields(values);
    if (signupError) {
      if (/email/i.test(signupError)) {
        errors.email = signupError;
      } else if (/match/i.test(signupError)) {
        errors.confirmPassword = signupError;
      } else {
        errors.password = signupError;
      }
    }
    if (!consents.termsAccepted) {
      errors.termsAccepted = "You must agree to the terms and conditions.";
    }
    if (!consents.cancellationAccepted) {
      errors.cancellationAccepted = "You must agree to the cancellation policy.";
    }

    return errors;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const signupFieldErrors = validateSignupFields(formData);
    if (Object.keys(signupFieldErrors).length > 0) {
      setFieldErrors(signupFieldErrors);
      setFeedback("Please fix the highlighted fields.");
      return;
    }

    setFieldErrors({});

    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
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

      if (!data.user?.id) {
        setFeedback("Account created, but we could not finish setting up the account.");
        return;
      }

      await supabase.auth.signOut();

      router.push(
        `/auth/verify-email?email=${encodeURIComponent(formData.email.trim().toLowerCase())}&next=${encodeURIComponent(nextPath)}`,
      );
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
            <p className="text-lg font-extrabold text-black">Create Account</p>
          </div>

          <form className="space-y-2" onSubmit={handleSubmit}>
            <Field label="Email">
              <input
                type="email"
                value={formData.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-0.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black placeholder:text-black/35 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
              {fieldErrors.email ? <FieldError message={fieldErrors.email} /> : null}
            </Field>

            <Field label="Password">
              <div className="relative mt-0.5">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(event) => updateField("password", event.target.value)}
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
              {fieldErrors.password ? <FieldError message={fieldErrors.password} /> : null}
            </Field>

            <Field label="Confirm Password">
              <div className="relative mt-0.5">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 pr-11 text-sm text-black placeholder:text-black/35 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
                  placeholder="Re-enter your password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-black/60 hover:text-black"
                  aria-label={showPassword ? "Hide confirm password" : "Show confirm password"}
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
              {fieldErrors.confirmPassword ? <FieldError message={fieldErrors.confirmPassword} /> : null}
            </Field>

            <div className="space-y-1.5 pt-0.5">
              <label className="flex items-start gap-2 text-[11px] font-medium leading-snug text-black/70">
                <input
                  type="checkbox"
                  checked={consents.termsAccepted}
                  onChange={(event) => updateConsent("termsAccepted", event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-black/20 bg-white accent-black"
                  required
                />
                <span>
                  I agree with Doc Kulot{" "}
                  <button
                    type="button"
                    onClick={() => setActiveModal("terms")}
                    className="font-semibold text-black/80 underline underline-offset-2 hover:text-black"
                  >
                    terms and conditions
                  </button>
                </span>
              </label>
              {fieldErrors.termsAccepted ? <FieldError message={fieldErrors.termsAccepted} /> : null}

              <label className="flex items-start gap-2 text-[11px] font-medium leading-snug text-black/70">
                <input
                  type="checkbox"
                  checked={consents.cancellationAccepted}
                  onChange={(event) => updateConsent("cancellationAccepted", event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-black/20 bg-white accent-black"
                  required
                />
                <span>
                  I agree with{" "}
                  <button
                    type="button"
                    onClick={() => setActiveModal("cancellation")}
                    className="font-semibold text-black/80 underline underline-offset-2 hover:text-black"
                  >
                    cancellation policy
                  </button>
                </span>
              </label>
              {fieldErrors.cancellationAccepted ? <FieldError message={fieldErrors.cancellationAccepted} /> : null}
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

            <button
              type="submit"
              disabled={isPending}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-black px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg shadow-black/20 transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-500 disabled:text-neutral-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v6m3-3h-6" />
              </svg>
              {isPending ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-1.5 text-center">
            <p className="text-xs text-black/65">
              Already have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="text-black/80 font-semibold hover:text-black hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </section>

      {activeModal ? (
        <PolicyModalCard
          title={POLICY_CONTENT[activeModal].title}
          sections={POLICY_CONTENT[activeModal].sections}
          onClose={() => setActiveModal(null)}
        />
      ) : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5 tracking-wide">
      {label}
      {children}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-[10px] font-semibold text-red-600">{message}</p>;
}

function PolicyModalCard({
  title,
  sections,
  onClose,
}: {
  title: string;
  sections: readonly { heading: string; body: string }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white p-5 shadow-2xl shadow-black/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-700">Policy Details</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-black/65">Please review this policy before continuing with registration.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black/75 transition hover:border-gold-300 hover:bg-gold-50 hover:text-black"
          >
            Close
          </button>
        </div>

        <div className="mt-4 h-px w-full bg-linear-to-r from-transparent via-gold-200 to-transparent" />

        <div className="policy-scroll mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {sections.map((section) => (
            <div
              key={section.heading}
              className="rounded-2xl border border-black/10 bg-white p-3.5"
            >
              <h3 className="text-sm font-semibold text-black">{section.heading}</h3>
              <p className="mt-1.5 text-xs leading-5 text-black/70">{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
