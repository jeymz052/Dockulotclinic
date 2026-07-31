import { clinicServices } from "@/src/lib/healthcare-content";
import type { AppointmentType } from "@/src/lib/appointments";

const SERVICE_PREFIX = "Service:";
const REASON_PREFIX = "Reason:";

export type AppointmentContext = {
  service: string;
  reason: string;
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

export function encodeAppointmentContext(service: string, reason: string) {
  const normalizedService = service.trim();
  const normalizedReason = reason.trim();

  if (!normalizedService) {
    return normalizedReason;
  }

  if (!normalizedReason) {
    return `${SERVICE_PREFIX} ${normalizedService}`;
  }

  return `${SERVICE_PREFIX} ${normalizedService}\n${REASON_PREFIX} ${normalizedReason}`;
}

export function parseAppointmentContext(rawReason: string | null | undefined): AppointmentContext {
  const fallback = (rawReason ?? "").trim();
  if (!fallback) {
    return { service: "", reason: "" };
  }

  const lines = fallback.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const serviceLine = lines.find((line) => line.startsWith(SERVICE_PREFIX));
  const reasonLine = lines.find((line) => line.startsWith(REASON_PREFIX));

  if (!serviceLine && !reasonLine) {
    return { service: "", reason: fallback };
  }

  const service = serviceLine ? serviceLine.slice(SERVICE_PREFIX.length).trim() : "";
  const reason = reasonLine ? reasonLine.slice(REASON_PREFIX.length).trim() : "";

  return { service, reason };
}

export function getAppointmentPrimaryLabel(rawReason: string | null | undefined, fallbackType?: AppointmentType) {
  const parsed = parseAppointmentContext(rawReason);
  if (parsed.service) return parsed.service;
  if (parsed.reason) return parsed.reason;
  if (fallbackType === "Online") return "Online Consultation";
  if (fallbackType === "Clinic") return "General Consultation";
  return "Consultation";
}

export function getAppointmentSecondaryReason(rawReason: string | null | undefined) {
  return parseAppointmentContext(rawReason).reason;
}
