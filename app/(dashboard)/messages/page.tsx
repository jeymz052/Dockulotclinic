"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRole } from "@/src/components/layout/RoleProvider";
import { MessagingPanel } from "@/src/components/messaging/MessagingPanel";

function MessagesContent() {
  const { user, profile, role, accessToken, isLoading } = useRole();
  const searchParams = useSearchParams();
  const convId = searchParams.get("convId");
  const appointmentId = searchParams.get("appointmentId");
  const patientEmail = searchParams.get("patientEmail");

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <p className="text-xs font-medium text-neutral-400">Loading messenger…</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-sm text-neutral-500">Please sign in to access messages.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Sleek compact header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Messenger
          </h1>
          <p className="text-xs text-neutral-500">
            {role === "PATIENT"
              ? "Live communication with Doc Kulot & clinic staff"
              : "Live communication with clinic patients"}
          </p>
        </div>
      </div>

      <MessagingPanel
        myId={user.id}
        myRole={role}
        myName={profile.full_name}
        myAvatar={profile.avatar_url ?? null}
        accessToken={accessToken}
        initialConvId={convId}
        initialAppointmentId={appointmentId}
        initialPatientEmail={patientEmail}
      />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-400">Loading messenger…</div>}>
      <MessagesContent />
    </Suspense>
  );
}
