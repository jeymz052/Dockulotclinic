import { clinicServices } from "@/src/lib/healthcare-content";
import type { AppointmentType } from "@/src/lib/appointments";

const SERVICE_PREFIX = "Service:";
const REASON_PREFIX = "Reason:";
const CONSULT_PREFIX = "Consult:";
const ADDON_PREFIX = "Addon:";

export type ClinicConsultKind = "FirstConsult" | "FollowUp";

export type AppointmentContext = {
  service: string;
  reason: string;
  consultKind?: ClinicConsultKind;
  addons: string[];
};

export function getServiceOptionsForType(type: AppointmentType) {
  const services = clinicServices.filter((service) => {
    const modes = service.modes ?? ["Clinic", "Online"];
    return modes.includes(type);
  });

  return services.map((service) => service.title);
}

export function isProcedureServiceTitle(service: string | null | undefined) {
  const normalized = (service ?? "").trim();
  if (!normalized) return false;
  return clinicServices.some((item) => item.appointmentOnly && item.title === normalized);
}

export function getDefaultServiceForType(type: AppointmentType) {
  if (type === "Online") {
    return getServiceOptionsForType(type)[0] ?? "Telemedicine Services";
  }
  return getServiceOptionsForType(type)[0] ?? "General Consultation";
}

function formatConsultKind(kind: ClinicConsultKind) {
  return kind === "FollowUp" ? "Follow-up clinic consult" : "First clinic consult";
}

function parseConsultKind(value: string): ClinicConsultKind | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("follow")) return "FollowUp";
  if (normalized.includes("first")) return "FirstConsult";
  return undefined;
}

export function encodeAppointmentContext(
  service: string,
  reason: string,
  consultKind?: ClinicConsultKind,
  addons: string[] = [],
) {
  const normalizedService = service.trim();
  const normalizedReason = reason.trim();
  const lines: string[] = [];

  if (normalizedService) {
    lines.push(`${SERVICE_PREFIX} ${normalizedService}`);
  }
  if (consultKind) {
    lines.push(`${CONSULT_PREFIX} ${formatConsultKind(consultKind)}`);
  }
  for (const addon of addons.map((item) => item.trim()).filter(Boolean)) {
    lines.push(`${ADDON_PREFIX} ${addon}`);
  }
  if (normalizedReason) {
    lines.push(`${REASON_PREFIX} ${normalizedReason}`);
  }

  return lines.join("\n");
}

export function parseAppointmentContext(rawReason: string | null | undefined): AppointmentContext {
  const fallback = (rawReason ?? "").trim();
  if (!fallback) {
    return { service: "", reason: "", addons: [] };
  }

  const lines = fallback.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const serviceLine = lines.find((line) => line.startsWith(SERVICE_PREFIX));
  const reasonLine = lines.find((line) => line.startsWith(REASON_PREFIX));
  const consultLine = lines.find((line) => line.startsWith(CONSULT_PREFIX));
  const addonLines = lines.filter((line) => line.startsWith(ADDON_PREFIX));

  if (!serviceLine && !reasonLine && !consultLine && addonLines.length === 0) {
    return { service: "", reason: fallback, addons: [] };
  }

  const service = serviceLine ? serviceLine.slice(SERVICE_PREFIX.length).trim() : "";
  const reason = reasonLine ? reasonLine.slice(REASON_PREFIX.length).trim() : "";
  const consultKind = consultLine ? parseConsultKind(consultLine.slice(CONSULT_PREFIX.length)) : undefined;
  const addons = addonLines.map((line) => line.slice(ADDON_PREFIX.length).trim()).filter(Boolean);

  return { service, reason, consultKind, addons };
}

export function getAppointmentPrimaryLabel(rawReason: string | null | undefined, fallbackType?: AppointmentType) {
  const parsed = parseAppointmentContext(rawReason);
  if (parsed.service) return parsed.service;
  if (parsed.reason) return parsed.reason;
  if (fallbackType === "Online") return "Virtual Consult";
  if (fallbackType === "Clinic") return "General Consultation";
  return "Consultation";
}

export function getAppointmentSecondaryReason(rawReason: string | null | undefined) {
  return parseAppointmentContext(rawReason).reason;
}

export function getAppointmentConsultKind(rawReason: string | null | undefined) {
  return parseAppointmentContext(rawReason).consultKind;
}

export function getAppointmentAddOns(rawReason: string | null | undefined) {
  return parseAppointmentContext(rawReason).addons;
}

export function hasAppointmentAddOn(rawReason: string | null | undefined, addon: string) {
  return getAppointmentAddOns(rawReason).some(
    (item) => item.toLowerCase() === addon.trim().toLowerCase(),
  );
}
