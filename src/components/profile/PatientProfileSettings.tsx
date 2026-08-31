"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import {
  FaCheck,
  FaCircleExclamation,
  FaEye,
  FaEyeSlash,
  FaKey,
  FaPen,
  FaRegUser,
  FaXmark,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import { roleToUiRole } from "@/src/lib/auth/role-mappings";
import { getRoleProfile } from "@/src/lib/roles";

export default function PatientProfileSettings() {
  const { role: contextRole, profile, user, accessToken, refreshProfile } = useRole();
  const fullName =
    profile?.full_name ?? user?.user_metadata?.full_name ?? "User";
  const email = profile?.email ?? user?.email ?? "No email saved";
  const resolvedRole =
    roleToUiRole(profile?.role) ?? contextRole ?? "PATIENT";
  const roleLabel = getRoleProfile(resolvedRole).label;

  const [form, setForm] = useState({ fullName, phone: profile?.phone ?? "" });
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setFeedback({
        type: "error",
        message: "You need to be signed in to update your profile.",
      });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/v2/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: form.fullName,
          phone: form.phone,
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to save your profile.");
      }
      await refreshProfile();
      setFeedback({
        type: "success",
        message: "Profile updated successfully.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save your profile.";
      setFeedback({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setPasswordFeedback({
        type: "error",
        message: "You need to be signed in to update your password.",
      });
      return;
    }
    if (passwordForm.password.length < 8) {
      setPasswordFeedback({
        type: "error",
        message: "Password must be at least 8 characters.",
      });
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setPasswordFeedback({
        type: "error",
        message: "Passwords do not match.",
      });
      return;
    }
    setIsSavingPassword(true);
    setPasswordFeedback(null);
    try {
      const response = await fetch("/api/v2/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ new_password: passwordForm.password }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to update your password.");
      }
      setPasswordForm({ password: "", confirmPassword: "" });
      setPasswordFeedback({
        type: "success",
        message: "Password updated successfully.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update your password.";
      setPasswordFeedback({ type: "error", message });
    } finally {
      setIsSavingPassword(false);
    }
  }

  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="profile-page-root">
      <style>{`
        .profile-page-root {
          min-height: 100vh;
          background: #f8f8f8;
          padding: 2rem 1rem 4rem;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .profile-container {
          max-width: 780px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* ── Hero Header ── */
        .profile-hero {
          background: #000;
          border-radius: 2rem;
          padding: 2.5rem 2rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .profile-hero::before {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 220px; height: 220px;
          background: rgba(255,255,255,0.04);
          border-radius: 50%;
        }
        .profile-hero::after {
          content: '';
          position: absolute;
          bottom: -40px; left: 30%;
          width: 160px; height: 160px;
          background: rgba(255,255,255,0.03);
          border-radius: 50%;
        }
        .profile-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #fff;
          color: #000;
          font-size: 1.6rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          letter-spacing: -0.03em;
          z-index: 1;
        }
        .profile-hero-info {
          z-index: 1;
        }
        .profile-hero-name {
          font-size: 1.6rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.03em;
          margin: 0 0 0.25rem;
        }
        .profile-hero-email {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.55);
          margin: 0 0 0.6rem;
        }
        .profile-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 999px;
          padding: 0.25rem 0.75rem;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.75);
        }

        /* ── Cards ── */
        .profile-card {
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 1.5rem;
          padding: 2rem;
        }
        .card-header {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          margin-bottom: 1.75rem;
        }
        .card-icon {
          width: 42px;
          height: 42px;
          background: #f4f4f4;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #111;
          font-size: 0.95rem;
          flex-shrink: 0;
        }
        .card-title {
          font-size: 1rem;
          font-weight: 700;
          color: #111;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .card-subtitle {
          font-size: 0.8rem;
          color: #888;
          margin: 0.15rem 0 0;
        }

        /* ── Divider ── */
        .card-divider {
          border: none;
          border-top: 1px solid #f0f0f0;
          margin: 1.75rem 0;
        }

        /* ── Form Fields ── */
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          margin-bottom: 1.25rem;
        }
        .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 560px) {
          .field-row { grid-template-columns: 1fr; }
        }
        .field-label {
          display: block;
          margin-bottom: 0.4rem;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #666;
        }
        .field-input {
          width: 100%;
          border: 1.5px solid #e8e8e8;
          border-radius: 0.875rem;
          background: #fafafa;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #111;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          box-sizing: border-box;
        }
        .field-input:focus {
          border-color: #111;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.06);
        }
        .field-input:disabled {
          color: #aaa;
          background: #f5f5f5;
          cursor: not-allowed;
        }
        .field-input-wrapper {
          position: relative;
        }
        .field-input-wrapper .field-input {
          padding-right: 2.8rem;
        }
        .toggle-pw-btn {
          position: absolute;
          right: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #999;
          padding: 0;
          display: flex;
          align-items: center;
          font-size: 0.875rem;
          transition: color 0.15s;
        }
        .toggle-pw-btn:hover { color: #111; }

        /* ── Buttons ── */
        .btn-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1.25rem;
        }
        .btn-primary {
          background: #000;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 0.65rem 1.4rem;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          transition: opacity 0.15s, transform 0.12s;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.82; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn-ghost {
          background: transparent;
          color: #555;
          border: 1.5px solid #e0e0e0;
          border-radius: 999px;
          padding: 0.65rem 1.4rem;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          transition: border-color 0.15s, background 0.15s;
        }
        .btn-ghost:hover { background: #f4f4f4; border-color: #ccc; }

        /* ── Feedback ── */
        .feedback-bar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.7rem 1rem;
          border-radius: 0.875rem;
          font-size: 0.82rem;
          font-weight: 500;
          margin-top: 1rem;
        }
        .feedback-success {
          background: #f0faf0;
          border: 1px solid #c3e6cb;
          color: #1a6b2f;
        }
        .feedback-error {
          background: #fff5f5;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }

        /* ── Info note ── */
        .info-note {
          background: #f9f9f9;
          border: 1px solid #ebebeb;
          border-radius: 0.875rem;
          padding: 0.75rem 1rem;
          font-size: 0.78rem;
          color: #888;
          line-height: 1.5;
        }

        /* ── Section label ── */
        .section-label {
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #bbb;
          margin-bottom: 0.5rem;
        }
      `}</style>

      <div className="profile-container">
        {/* ── Hero ── */}
        <div className="profile-hero">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-hero-info">
            <h1 className="profile-hero-name">{fullName}</h1>
            <p className="profile-hero-email">{email}</p>
            <span className="profile-hero-badge">
              <FaRegUser style={{ fontSize: "0.65rem" }} />
              {roleLabel}
            </span>
          </div>
        </div>

        {/* ── Profile Information + Change Password (single card) ── */}
        <div className="profile-card">
          {/* Profile Section */}
          <div className="card-header">
            <div className="card-icon">
              <FaPen />
            </div>
            <div>
              <h2 className="card-title">Profile Information</h2>
              <p className="card-subtitle">
                Update your personal details and sign-in password.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <div className="field-row">
                <label>
                  <span className="field-label">Full Name</span>
                  <input
                    className="field-input"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, fullName: e.target.value }))
                    }
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </label>
                <label>
                  <span className="field-label">Phone Number</span>
                  <input
                    className="field-input"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="e.g. 09XXXXXXXXX"
                    autoComplete="tel"
                  />
                </label>
              </div>
              <label>
                <span className="field-label">Email Address</span>
                <input
                  className="field-input"
                  value={email}
                  disabled
                  autoComplete="email"
                />
              </label>
              <p className="info-note">
                Your email is locked as it is your sign-in identity. Contact
                the clinic if it needs to be changed.
              </p>
            </div>

            {feedback && (
              <FeedbackBar tone={feedback.type} message={feedback.message} />
            )}

            <div className="btn-row">
              <button type="submit" disabled={isSaving} className="btn-primary">
                <FaCheck style={{ fontSize: "0.75rem" }} />
                {isSaving ? "Saving…" : "Save Profile"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setForm({
                    fullName:
                      profile?.full_name ??
                      user?.user_metadata?.full_name ??
                      "",
                    phone: profile?.phone ?? "",
                  });
                  setFeedback(null);
                }}
              >
                <FaXmark style={{ fontSize: "0.75rem" }} />
                Reset
              </button>
            </div>
          </form>

          <hr className="card-divider" />

          {/* Change Password Section */}
          <div className="card-header" style={{ marginBottom: "1.25rem" }}>
            <div className="card-icon">
              <FaKey />
            </div>
            <div>
              <h2 className="card-title">Change Password</h2>
              <p className="card-subtitle">
                Must be at least 8 characters long.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div className="field-group">
              <div className="field-row">
                <label>
                  <span className="field-label">New Password</span>
                  <div className="field-input-wrapper">
                    <input
                      className="field-input"
                      type={showPassword ? "text" : "password"}
                      value={passwordForm.password}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          password: e.target.value,
                        }))
                      }
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="toggle-pw-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </label>
                <label>
                  <span className="field-label">Confirm Password</span>
                  <div className="field-input-wrapper">
                    <input
                      className="field-input"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          confirmPassword: e.target.value,
                        }))
                      }
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="toggle-pw-btn"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </label>
              </div>
            </div>

            {passwordFeedback && (
              <FeedbackBar
                tone={passwordFeedback.type}
                message={passwordFeedback.message}
              />
            )}

            <div className="btn-row">
              <button
                type="submit"
                disabled={isSavingPassword}
                className="btn-primary"
              >
                <FaKey style={{ fontSize: "0.7rem" }} />
                {isSavingPassword ? "Updating…" : "Update Password"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setPasswordForm({ password: "", confirmPassword: "" });
                  setPasswordFeedback(null);
                }}
              >
                <FaXmark style={{ fontSize: "0.75rem" }} />
                Clear
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function FeedbackBar({
  tone,
  message,
}: {
  tone: "success" | "error";
  message: string;
}) {
  return (
    <div
      className={`feedback-bar ${tone === "success" ? "feedback-success" : "feedback-error"}`}
    >
      {tone === "success" ? (
        <FaCheck style={{ flexShrink: 0 }} />
      ) : (
        <FaCircleExclamation style={{ flexShrink: 0 }} />
      )}
      {message}
    </div>
  );
}
