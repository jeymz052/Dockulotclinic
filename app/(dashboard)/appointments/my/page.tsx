"use client";

import AppointmentListPage from "@/src/components/appointments/AppointmentListPage";
import MyAppointmentsPage from "@/src/components/appointments/MyAppointmentsPage";
import { useRole } from "@/src/components/layout/RoleProvider";

/**
 * /appointments/my serves two audiences:
 *   - PATIENT  → MyAppointmentsPage (upcoming + history tabs)
 *   - SUPER_ADMIN / SECRETARY / DOCTOR → AppointmentListPage (manage all appointments)
 *
 * The sidebar entry is labelled "My Appointments" for patients and
 * "Manage Appointments" for staff/doctor — both point here.
 */
export default function AppointmentsMyRoute() {
  const { role, isLoading } = useRole();

  if (isLoading) {
    return <div className="h-40 rounded-4xl border border-neutral-100 bg-white animate-pulse shadow-sm" />;
  }

  if (role === "PATIENT") {
    return <MyAppointmentsPage />;
  }

  // Staff / doctor view — full management UI with edit + cancel actions.
  return <AppointmentListPage />;
}

