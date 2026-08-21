import type { DbRole } from "@/src/lib/db/types";
import type { UserRole } from "@/src/lib/roles";

const PROTECTED_SUPER_ADMIN_EMAILS = new Set([
  "superadmin@gmail.com",
  "estebanjames67@gmail.com",
]);

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function isProtectedSuperAdminEmail(email: string | null | undefined) {
  return PROTECTED_SUPER_ADMIN_EMAILS.has(normalizeEmail(email));
}

export function resolveProtectedDbRole(
  role: DbRole | string | null | undefined,
  email: string | null | undefined,
): DbRole | string | undefined {
  if (isProtectedSuperAdminEmail(email)) return "super_admin";
  return role ?? undefined;
}

export function resolveProtectedUiRole(
  role: UserRole | null | undefined,
  email: string | null | undefined,
): UserRole | null {
  if (isProtectedSuperAdminEmail(email)) return "SUPER_ADMIN";
  return role ?? null;
}

export function assertEmailNotProtectedPatient(email: string) {
  if (isProtectedSuperAdminEmail(email)) {
    throw new Error("This email is reserved for the super admin account and cannot be used as a patient.");
  }
}
