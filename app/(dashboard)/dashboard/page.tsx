"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/src/components/dashboard/Dashboard";
import { useRole } from "@/src/components/layout/RoleProvider";

export default function DashboardPage() {
  const router = useRouter();
  const { role, isLoading } = useRole();

  useEffect(() => {
    if (!isLoading && role === "PATIENT") {
      router.replace("/portal");
    }
  }, [isLoading, role, router]);

  if (isLoading || role === "PATIENT") {
    return <div className="h-40 rounded-4xl border border-neutral-100 bg-white animate-pulse shadow-sm" />;
  }

  return <Dashboard />;
}
