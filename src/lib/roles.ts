export type UserRole =
  | "SUPER_ADMIN"
  | "SECRETARY"
  | "DOCTOR"
  | "PATIENT";

export type RoleProfile = {
  role: UserRole;
  label: string;
  shortLabel: string;
  description: string;
};

export const ROLE_PROFILES: RoleProfile[] = [
  {
    role: "SUPER_ADMIN",
    label: "Admin",
    shortLabel: "AD",
    description: "Full control, permissions, and system configuration",
  },
  {
    role: "SECRETARY",
    label: "Staff",
    shortLabel: "ST",
    description: "Appointments, patients, walk-ins, and POS billing",
  },
  {
    role: "DOCTOR",
    label: "Doctor",
    shortLabel: "DR",
    description: "Clinical workflows plus full admin access and system configuration",
  },
  {
    role: "PATIENT",
    label: "Patient",
    shortLabel: "PT",
    description: "Register, book, and pay for online consultations",
  },
];

export const DEFAULT_ROLE: UserRole = "PATIENT";

export function getRoleProfile(role: UserRole) {
  return ROLE_PROFILES.find((profile) => profile.role === role) ?? ROLE_PROFILES[1];
}

type RouteAccessRule = {
  prefixes: string[];
  allowedRoles: UserRole[];
};

const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  {
    prefixes: ["/dashboard"],
    allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  },
  {
    prefixes: ["/profile"],
    allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  },
  {
    prefixes: ["/portal"],
    allowedRoles: ["PATIENT"],
  },
  {
    prefixes: ["/users"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR"],
  },
  {
    prefixes: ["/appointments"],
    allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  },
  {
    prefixes: ["/payments/pos"],
    allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  },
  {
    prefixes: ["/payments"],
    allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR", "PATIENT"],
  },
  {
    prefixes: ["/patients/add"],
     allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  },
  {
    prefixes: ["/patients/records"],
    allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  },
  {
    prefixes: ["/patients"],
    allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  },
  {
    prefixes: ["/consultations"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR", "PATIENT"],
  },
  {
    prefixes: ["/consultations/history"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR", "PATIENT"],
  },
  {
    prefixes: ["/schedules"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR"],
  },
  {
    prefixes: ["/reports", "/help", "/pricing"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR"],
  },
  {
    prefixes: ["/security"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR"],
  },
  {
    prefixes: ["/inquiries", "/faq-content"],
    allowedRoles: ["SUPER_ADMIN", "SECRETARY", "DOCTOR"],
  },
  {
    prefixes: ["/prescriptions"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR", "PATIENT"],
  },
  {
    prefixes: ["/contents", "/creator-content"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR"],
  },
  {
    prefixes: ["/settings"],
    allowedRoles: ["SUPER_ADMIN", "DOCTOR"],
  },
];

export function canAccessPath(role: UserRole, pathname: string) {
  const matchingRule = ROUTE_ACCESS_RULES.find((rule) =>
    rule.prefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ),
  );

  return matchingRule ? matchingRule.allowedRoles.includes(role) : true;
}
