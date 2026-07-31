"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { Sidebar } from "./Sidebar";
import { useRole } from "./RoleProvider";
import { canAccessPath } from "@/src/lib/roles";

type LayoutProps = {
  children: React.ReactNode;
};

// The root <RoleProvider> in app/layout.tsx already wraps the entire app, so
// this dashboard layout consumes that single shared context instead of
// nesting another provider. A second provider would mount its own auth
// listener, fetch /api/v2/me twice, and double the noise of every
// onAuthStateChange event.
export default function Layout({ children }: LayoutProps) {
  return <DashboardShell>{children}</DashboardShell>;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { role, user, profile, accessToken, isLoading, signOut } = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const hasAccess = canAccessPath(role, pathname);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!hasAccess) {
      router.replace("/unauthorized");
    }
  }, [hasAccess, isLoading, router, user]);

  async function handleLogout() {
    if (accessToken) {
      await fetch("/api/v2/security/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ event: "logout" }),
      }).catch(() => null);
    }
    await signOut();
    router.replace("/login");
  }

  // Show the full-page loading gate during the very first auth/profile
  // resolution. `isLoading` stays false after that initial pass, so this
  // won't flash on routine token refreshes and won't wipe in-progress forms.
  if (isLoading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-neutral-50">
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 text-sm text-neutral-600 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(17,17,17,0.05),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8f8f7_36%,#fafafa_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-black/5 to-transparent" />
      <Sidebar role={role} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="min-w-0 lg:pl-56">
        <DashboardHeader
          role={role}
          profile={profile}
          accessToken={accessToken}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onLogout={handleLogout}
        />

        <main className="responsive-content mx-auto w-full min-w-0 max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
