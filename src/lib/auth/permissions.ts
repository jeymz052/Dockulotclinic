import type { UserRole } from "@/src/lib/roles";

type PermissionAction =
  | "appointments.read"
  | "appointments.create"
  | "appointments.manage"
  | "patients.read"
  | "patients.manage"
  | "consultations.read"
  | "consultations.manage"
  | "schedules.read"
  | "schedules.manage"
  | "settings.read"
  | "users.manage"
  | "payments.pos"
  | "landing.manage"
  | "messages.read"
  | "messages.send";

const PERMISSION_MAP: Record<PermissionAction, UserRole[]> = {
  "appointments.read": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  "appointments.create": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  "appointments.manage": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  "patients.read": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  "patients.manage": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  "consultations.read": ["SUPER_ADMIN", "DOCTOR", "PATIENT"],
  "consultations.manage": ["SUPER_ADMIN", "DOCTOR"],
  "schedules.read": ["SUPER_ADMIN", "DOCTOR"],
  "schedules.manage": ["SUPER_ADMIN", "DOCTOR"],
  "settings.read": ["SUPER_ADMIN", "DOCTOR"],
  "users.manage": ["SUPER_ADMIN", "DOCTOR"],
  "payments.pos": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  // Landing-page CMS — owners only. Doctor is included because the
  // single-doctor practice owner edits their own marketing copy.
  "landing.manage": ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  // Messaging — all authenticated roles can read and send
  "messages.read": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  "messages.send": ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
};

export function hasPermission(role: UserRole, action: PermissionAction) {
  return PERMISSION_MAP[action].includes(role);
}
