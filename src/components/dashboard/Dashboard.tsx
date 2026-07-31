"use client";

import { useRole } from "@/src/components/layout/RoleProvider";
import AdminDashboard from "@/src/components/dashboard/AdminDashboard";
import DoctorDashboard from "@/src/components/dashboard/DoctorDashboard";
import PatientDashboard from "@/src/components/dashboard/PatientDashboard";
import SecretaryDashboard from "@/src/components/dashboard/SecretaryDashboard";

export default function Dashboard() {
  const { role, isLoading } = useRole();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-neutral-100 animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (role === "PATIENT") return <PatientDashboard />;
  if (role === "DOCTOR") return <DoctorDashboard />;
  if (role === "SECRETARY") return <SecretaryDashboard />;
  return <AdminDashboard />;
}
