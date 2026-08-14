export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;
export const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed", "Separated"] as const;

export type PatientGender = (typeof GENDER_OPTIONS)[number];
export type PatientCivilStatus = (typeof CIVIL_STATUS_OPTIONS)[number];

export type PatientRegistrationFields = {
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffixName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  address: string;
  religion: string;
  occupation: string;
  guardianName: string;
};

export type PatientSignupFields = PatientRegistrationFields & {
  password: string;
};

export function patientRecordToRegistrationFields(fields: PatientRegistrationFields) {
  return normalizePatientRegistrationFields(fields);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME_RE = /^[A-Za-z][A-Za-z\s'.-]{1,79}$/;
const NAME_PART_RE = /^[A-Za-z][A-Za-z\s'.-]{0,79}$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const GENERIC_INTL_PHONE_RE = /^\+\d{8,15}$/;
const PH_MOBILE_RE = /^(?:\+639\d{9}|09\d{9}|9\d{9})$/;

function normalizePhone(raw: string) {
  return raw.replace(/[\s()-]/g, "");
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isFutureDate(value: string) {
  const today = new Date();
  const currentDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const parsed = new Date(`${value}T00:00:00Z`);
  return parsed.getTime() > currentDay.getTime();
}

export function formatPatientFullName(fields: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffixName?: string | null;
  fullName?: string | null;
}) {
  const firstName = fields.firstName?.trim() ?? "";
  const middleName = fields.middleName?.trim() ?? "";
  const lastName = fields.lastName?.trim() ?? "";
  const suffixName = fields.suffixName?.trim() ?? "";
  const composed = [firstName, middleName, lastName, suffixName].filter(Boolean).join(" ").trim();
  return composed || fields.fullName?.trim() || "";
}

export function splitPatientFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return {
      firstName: parts[0] ?? "",
      middleName: "",
      lastName: "",
      suffixName: "",
    };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    middleName: "",
    lastName: parts[parts.length - 1],
    suffixName: "",
  };
}

export function calculatePatientAge(dateOfBirth: string) {
  if (!isValidDateOnly(dateOfBirth)) return null;
  const today = new Date();
  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function normalizePatientRegistrationFields(
  fields: PatientRegistrationFields,
): PatientRegistrationFields {
  const legacyParts = splitPatientFullName(fields.fullName ?? "");
  const firstName = fields.firstName.trim() || legacyParts.firstName;
  const middleName = fields.middleName.trim() || legacyParts.middleName;
  const lastName = fields.lastName.trim() || legacyParts.lastName;
  const suffixName = fields.suffixName.trim() || legacyParts.suffixName;
  return {
    fullName: formatPatientFullName({
      firstName,
      middleName,
      lastName,
      suffixName,
      fullName: fields.fullName,
    }),
    firstName,
    middleName,
    lastName,
    suffixName,
    email: fields.email.trim().toLowerCase(),
    phone: fields.phone.trim(),
    dateOfBirth: fields.dateOfBirth.trim(),
    gender: fields.gender.trim(),
    civilStatus: fields.civilStatus.trim(),
    address: fields.address.trim(),
    religion: fields.religion.trim(),
    occupation: fields.occupation.trim(),
    guardianName: fields.guardianName.trim(),
  };
}

export function validatePatientRegistrationFields(
  fields: PatientRegistrationFields,
  options: { requireGuardianForMinors?: boolean } = {},
) {
  const normalized = normalizePatientRegistrationFields(fields);

  if (normalized.fullName.length < 2) {
    return "Full name must be at least 2 characters.";
  }
  if (!FULL_NAME_RE.test(normalized.fullName)) {
    return "Full name may only contain letters, spaces, apostrophes, dots, and hyphens.";
  }
  if (!NAME_PART_RE.test(normalized.firstName)) {
    return "First name may only contain letters, spaces, apostrophes, dots, and hyphens.";
  }
  if (!NAME_PART_RE.test(normalized.lastName)) {
    return "Family name may only contain letters, spaces, apostrophes, dots, and hyphens.";
  }
  if (normalized.middleName && !NAME_PART_RE.test(normalized.middleName)) {
    return "Middle name may only contain letters, spaces, apostrophes, dots, and hyphens.";
  }
  if (normalized.suffixName && !/^[A-Za-z0-9][A-Za-z0-9\s'.-]{0,19}$/.test(normalized.suffixName)) {
    return "Suffix name may only contain letters, numbers, spaces, apostrophes, dots, and hyphens.";
  }
  if (!EMAIL_RE.test(normalized.email)) {
    return "Please enter a valid email address.";
  }
  const normalizedPhone = normalizePhone(normalized.phone);
  if (!PH_MOBILE_RE.test(normalizedPhone) && !GENERIC_INTL_PHONE_RE.test(normalizedPhone)) {
    return "Enter a valid phone number (PH: +639XXXXXXXXX or 09XXXXXXXXX, or other country format with + and country code).";
  }
  if (!isValidDateOnly(normalized.dateOfBirth)) {
    return "Date of birth is required.";
  }
  if (isFutureDate(normalized.dateOfBirth)) {
    return "Date of birth cannot be in the future.";
  }
  if (!GENDER_OPTIONS.includes(normalized.gender as PatientGender)) {
    return "Please select a valid gender.";
  }
  if (normalized.civilStatus && !CIVIL_STATUS_OPTIONS.includes(normalized.civilStatus as PatientCivilStatus)) {
    return "Please select a valid civil status.";
  }
  if (normalized.address.length < 8) {
    return "Address must be at least 8 characters.";
  }
  const age = calculatePatientAge(normalized.dateOfBirth);
  if (options.requireGuardianForMinors !== false && age != null && age < 18 && normalized.guardianName.length < 2) {
    return "Guardian name is required for pediatric patients.";
  }
  return null;
}

export function validatePatientSignupFields(fields: PatientSignupFields) {
  const registrationError = validatePatientRegistrationFields(fields);
  if (registrationError) return registrationError;

  if (fields.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!PASSWORD_RE.test(fields.password)) {
    return "Password must include uppercase, lowercase, number, and special character.";
  }

  return null;
}
