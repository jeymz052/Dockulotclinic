export const SITE_URL = "https://www.dockulot.com";

export const SITE_NAME = "Doc Kulot";

export const SITE_TITLE =
  "Doc Kulot | Dr. Fatimah Al-Zahra T. Ditti";

export const SITE_DESCRIPTION =
  "Official website of Doc Kulot, Dr. Fatimah Al-Zahra T. Ditti, for family medicine, telemedicine, women's health, aesthetic care, clinic appointments, health articles, videos, and live sessions in Zamboanga City.";

export const SITE_KEYWORDS = [
  "Doc Kulot",
  "dockulot",
  "Dr. Fatimah Al-Zahra T. Ditti",
  "Fatimah Al-Zahra Ditti",
  "Doc Kulot Zamboanga City",
  "family medicine Zamboanga City",
  "aesthetic medicine Zamboanga City",
  "telemedicine Philippines",
  "Injector Queen",
];

export const SITE_IMAGE = "/images/dockulotbgs.png";

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}
