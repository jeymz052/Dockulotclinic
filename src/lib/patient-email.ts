export const CLINIC_PLACEHOLDER_EMAIL_DOMAIN = "imported.dockulot.test";

export function normalizeClinicEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function buildClinicPlaceholderEmail(seed: string, index = 1) {
  const key =
    (seed || `row-${index}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `row-${index}`;
  return `${key}-${index}@${CLINIC_PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isClinicPlaceholderEmail(value: string | null | undefined) {
  return normalizeClinicEmail(value).endsWith(`@${CLINIC_PLACEHOLDER_EMAIL_DOMAIN}`);
}

export function displayClinicEmail(value: string | null | undefined) {
  const email = normalizeClinicEmail(value);
  return isClinicPlaceholderEmail(email) ? "" : email;
}
