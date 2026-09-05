/**
 * Pluggable email/SMS delivery. Replace these stubs with real providers:
 *   - Email: Resend, Postmark, SendGrid, SES
 *   - SMS:   Twilio, Semaphore (PH), Vonage
 *
 * The worker at /api/v2/notifications/drain calls these.
 */

import { CLINIC_TIME_ZONE } from "@/src/lib/timezone";
import { SITE_URL } from "@/src/lib/site-metadata";
import { resolveAppointmentLocationLabel } from "@/src/lib/clinic-schedule";

export type EmailInput = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
};

export type SmsInput = {
  to: string;
  body: string;
};

export async function sendEmail(input: EmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY not configured");
    }
    const attachmentCount = input.attachments?.length ?? 0;
    console.log(
      `[email:stub] to=${input.to} subject="${input.subject}" attachments=${attachmentCount}`,
    );
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Doc Kulot <no-reply@dockulot.clinic>",
      to: input.to,
      subject: input.subject,
      text: input.body,
      ...(input.html ? { html: input.html } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Email send failed: ${res.status} ${msg}`);
  }
}

export async function sendSms(input: SmsInput): Promise<void> {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  const sender = process.env.SEMAPHORE_SENDER_NAME;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SEMAPHORE_API_KEY not configured");
    }
    console.log(`[sms:stub] to=${input.to} body="${input.body.slice(0, 60)}"`);
    return;
  }

  const body = new URLSearchParams({
    apikey: apiKey,
    number: input.to,
    message: input.body,
    ...(sender ? { sendername: sender } : {}),
  });
  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Semaphore SMS send failed: ${res.status} ${msg}`);
  }
}

type TemplatePayload = Record<string, unknown>;

type RenderChannel = "email" | "sms";
type EmailPresentation = {
  eyebrow?: string;
  title?: string;
  note?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ref(value: unknown) {
  const text = asText(value);
  return text ? text.slice(0, 8).toUpperCase() : "";
}

function formatPeso(value: unknown) {
  const amount = asNumber(value);
  if (amount == null) return "";
  return `PHP ${amount.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function clinicTimeZoneLabel() {
  const configured =
    process.env.NEXT_PUBLIC_CLINIC_TIME_ZONE_LABEL?.trim()
    || process.env.CLINIC_TIME_ZONE_LABEL?.trim();
  if (configured) return configured;
  if (CLINIC_TIME_ZONE === "Asia/Manila") return "PHT";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: CLINIC_TIME_ZONE,
    timeZoneName: "shortGeneric",
  })
    .formatToParts(new Date(Date.UTC(2026, 0, 1, 12)))
    .find((part) => part.type === "timeZoneName")?.value ?? CLINIC_TIME_ZONE;
}

function formatNotificationTime(value: string) {
  const time = value.trim();
  if (!time) return "";

  const meridiemMatch = time.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)(?:\s+(.+))?$/i);
  if (meridiemMatch) {
    const [, hourText, minuteText = "00", periodText, existingZone] = meridiemMatch;
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute > 59) {
      return time;
    }
    const period = periodText.toUpperCase();
    const zone = existingZone?.trim() || clinicTimeZoneLabel();
    return `${hour}:${minuteText.padStart(2, "0")} ${period} ${zone}`;
  }

  const clockMatch = time.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!clockMatch) return time;

  const [, hourText, minuteText] = clockMatch;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || hour > 23 || !Number.isInteger(minute) || minute > 59) {
    return time;
  }

  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minuteText} ${period} ${clinicTimeZoneLabel()}`;
}

function formatScheduleLine(date: string, startTime: string) {
  const formattedTime = startTime ? formatNotificationTime(startTime) : "";
  return [date, formattedTime].filter(Boolean).join(" at ");
}

function appointmentLabel(type: string, service: string, purpose: string) {
  if (purpose === "procedure_downpayment") return `${service || "medical procedure"} reservation`;
  if (type === "Online") return "virtual consult";
  if (service) return service;
  return type === "Clinic" ? "clinic consultation" : "appointment";
}

function appointmentTypeLabel(type: string) {
  return type === "Online" ? "Virtual Consult" : type;
}

function resolveNotificationLocation(date: string, type: string) {
  return resolveAppointmentLocationLabel(date || undefined, type === "Online" ? "Online" : "Clinic");
}

function patientPortalHref() {
  return new URL("/login", SITE_URL).toString();
}

function dashboardHref() {
  return new URL("/dashboard", SITE_URL).toString();
}

function patientPortalCta(label = "Open patient portal") {
  return {
    ctaLabel: label,
    ctaHref: patientPortalHref(),
  };
}

function dashboardCta(label = "Open dashboard") {
  return {
    ctaLabel: label,
    ctaHref: dashboardHref(),
  };
}

function meetingCta(link: string | null | undefined, fallbackLabel = "Open patient portal") {
  return link
    ? {
        ctaLabel: "Join meeting",
        ctaHref: link,
      }
    : patientPortalCta(fallbackLabel);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function linkifyText(value: string) {
  const urlPattern = /https?:\/\/[^\s<]+/g;
  let lastIndex = 0;
  let output = "";

  for (const match of value.matchAll(urlPattern)) {
    const url = match[0];
    const index = match.index ?? 0;
    output += escapeHtml(value.slice(lastIndex, index));
    output += `<a href="${escapeHtml(url)}" style="color:#111111; text-decoration:underline; word-break:break-all;">${escapeHtml(url)}</a>`;
    lastIndex = index + url.length;
  }

  output += escapeHtml(value.slice(lastIndex));
  return output;
}

function renderBodyHtml(body: string) {
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      `<ul style="margin:0; padding:0 0 0 20px; color:#1b1b1b;">${listItems
        .map((item) => `<li style="margin:0 0 10px; line-height:1.7; color:#1b1b1b;">${linkifyText(item)}</li>`)
        .join("")}</ul>`,
    );
    listItems = [];
  };

  for (const line of lines) {
    if (!line) {
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^[-•]\s+(.*)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList();
    blocks.push(
      `<p style="margin:0 0 14px; line-height:1.75; color:#1b1b1b;">${linkifyText(line)}</p>`,
    );
  }

  flushList();

  return blocks.join("");
}

function renderEmailHtml(subject: string, body: string, presentation: EmailPresentation = {}) {
  const bodyHtml = renderBodyHtml(body);
  const logoUrl = `${SITE_URL}/images/dockulotslogonobg.png`;
  const eyebrow = presentation.eyebrow ?? "Doc Kulot Notification";
  const title = presentation.title ?? subject;
  const note = presentation.note ?? "You are receiving this automatically from Doc Kulot.";
  const cta = presentation.ctaLabel && presentation.ctaHref
    ? `<tr>
        <td style="padding:0 28px 24px; background:#ffffff; text-align:center;">
          <a
            href="${escapeHtml(presentation.ctaHref)}"
            style="display:inline-block; background:#111111; color:#ffffff; text-decoration:none; font-size:14px; font-weight:700; padding:14px 24px; border-radius:14px; min-width:220px;"
          >
            ${escapeHtml(presentation.ctaLabel)}
          </a>
        </td>
      </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:#0b0b0b; font-family:Arial, Helvetica, sans-serif; color:#f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0b0b; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px; background:#ffffff; border:1px solid #d6d6d6; border-radius:28px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.42);">
            <tr>
              <td style="padding:32px 28px 18px; text-align:center; background:#ffffff;">
                <img
                  src="${logoUrl}"
                  width="220"
                  alt="Doc Kulot"
                  style="display:block; margin:0 auto 10px; width:220px; max-width:100%; height:auto;"
                />
                <div style="font-size:12px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:#111111; margin-bottom:10px;">
                  ${escapeHtml(eyebrow)}
                </div>
                <h1 style="margin:0; font-size:28px; line-height:1.2; color:#111111; font-weight:800;">
                  ${escapeHtml(title)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 30px; background:#ffffff;">
                <div style="height:1px; background:#e8e8e8; margin-bottom:22px;"></div>
                <div style="font-size:15px; line-height:1.7; color:#1b1b1b;">
                  ${bodyHtml}
                </div>
              </td>
            </tr>
            ${cta}
            <tr>
              <td style="padding:0 28px 28px; background:#ffffff;">
                <div style="height:1px; background:#e8e8e8; margin-bottom:16px;"></div>
                <p style="margin:0; font-size:12px; line-height:1.6; color:#666666; text-align:center;">
                  ${escapeHtml(note)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function finalizeTemplate(subject: string, body: string, presentation?: EmailPresentation) {
  return {
    subject,
    body,
    html: renderEmailHtml(subject, body, presentation),
  };
}

export function renderTemplate(
  template: string,
  payload: TemplatePayload,
  channel: RenderChannel = "email",
): { subject: string; body: string; html?: string } {
  const appt = ref(payload.appointment_id);
  const reservationRef = ref(payload.reservation_id);
  const link = asText(payload.meeting_link);
  const type = asText(payload.appointment_type);
  const service = asText(payload.service);
  const purpose = asText(payload.payment_purpose);
  const verifyUrl = asText(payload.verification_link);
  const patientName = asText(payload.patient_name);
  const appointmentDate = asText(payload.appointment_date);
  const startTime = asText(payload.start_time);
  const prescriptionNo = asText(payload.prescription_no);
  const status = asText(payload.status);
  const amount = formatPeso(payload.amount);
  const scheduleLine = formatScheduleLine(appointmentDate, startTime);
  const patientLine = patientName ? ` for ${patientName}` : "";
  const label = appointmentLabel(type, service, purpose);
  const displayType = appointmentTypeLabel(type);
  const locationLabel = resolveNotificationLocation(appointmentDate, type);
  const locationContext = type === "Online" ? "virtual consult" : locationLabel;
  const locationUpdate = type === "Online" ? "Virtual Consult update" : `${locationLabel} update`;

  switch (template) {
    case "verify_email":
      return finalizeTemplate(
        "Verify your Doc Kulot account",
        verifyUrl
          ? `Please verify your email before signing in.\n\nOpen this confirmation link to activate your account:\n${verifyUrl}`
          : "Please verify your email before signing in. Use the confirmation link from your latest verification email.",
        {
          eyebrow: "Account verification",
          title: "Verify your Doc Kulot account",
          ctaLabel: "Verify email",
          ctaHref: verifyUrl || patientPortalHref(),
          note: "If you did not request this email, you can safely ignore it.",
        },
      );
    case "welcome":
      return finalizeTemplate(
        "Welcome to Doc Kulot",
        "Welcome to Doc Kulot. Your account is active. You can book a virtual consult, clinic consultation, or medical procedure reservation from the website.",
        {
          eyebrow: "Welcome",
          title: "Welcome to Doc Kulot",
          ...patientPortalCta(),
          note: "Your account is ready and you can start booking any time.",
        },
      );
    case "appointment_booked":
      return finalizeTemplate(
        status === "Confirmed"
          ? `Your ${locationContext} booking is confirmed`
          : `Your ${locationContext} booking was received`,
        status === "Confirmed"
          ? channel === "sms"
            ? `Doc Kulot: Your ${locationContext} booking is confirmed${scheduleLine ? ` for ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""}.`
            : [
              `Your ${locationContext} booking is confirmed${appt ? ` (ref ${appt})` : ""}.`,
              scheduleLine ? `Schedule: ${scheduleLine}` : "",
              "Please check your email or patient portal for full details.",
            ].filter(Boolean).join("\n")
          : channel === "sms"
            ? `Doc Kulot: Your ${locationContext} booking${scheduleLine ? ` for ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} was received.`
            : [
              `Your ${locationContext} booking has been received${appt ? ` (ref ${appt})` : ""}.`,
              scheduleLine ? `Schedule: ${scheduleLine}` : "",
              type === "Clinic"
                ? `Clinic bookings may be reviewed by the team for ${locationLabel}. Please wait for any follow-up from the clinic.`
                : "Please check your dashboard for updates.",
            ].filter(Boolean).join("\n"),
        {
          eyebrow: `${locationLabel} booking`,
          title: status === "Confirmed"
            ? `Your ${locationContext} booking is confirmed`
            : `Your ${locationContext} booking was received`,
          ...patientPortalCta(),
          note: type === "Clinic"
            ? `Clinic bookings for ${locationLabel} may be reviewed by the team.`
            : "You can review your booking from the patient portal.",
        },
      );
    case "appointment_staff_booked":
      return finalizeTemplate(
        `New appointment booked at ${locationLabel}`,
        type
          ? `A new ${displayType.toLowerCase()} appointment at ${locationLabel}${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} was just booked.`
          : `A new appointment at ${locationLabel}${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} was just booked.`,
        {
          eyebrow: locationUpdate,
          title: `New appointment booked at ${locationLabel}`,
          ...dashboardCta(),
          note: `Open the dashboard to review or manage the ${locationLabel} booking.`,
        },
      );
    case "appointment_staff_confirmed":
      return finalizeTemplate(
        type === "Online" ? "Virtual consult confirmed" : `Appointment confirmed at ${locationLabel}`,
        type
          ? `${displayType} appointment at ${locationLabel}${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has been confirmed and paid.`
          : `Appointment at ${locationLabel}${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has been confirmed and paid.`,
        {
          eyebrow: locationUpdate,
          title: type === "Online" ? "Virtual consult confirmed" : `Appointment confirmed at ${locationLabel}`,
          ...dashboardCta(),
          note: `Open the dashboard for the latest ${locationLabel} appointment status.`,
        },
      );
    case "appointment_staff_cancelled":
      return finalizeTemplate(
        `Appointment cancelled at ${locationLabel}`,
        type
          ? `${displayType} appointment at ${locationLabel}${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has been cancelled.`
          : `Appointment at ${locationLabel}${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has been cancelled.`,
        {
          eyebrow: locationUpdate,
          title: `Appointment cancelled at ${locationLabel}`,
          ...dashboardCta(),
          note: `Open the dashboard if you need to review related ${locationLabel} records.`,
        },
      );
    case "appointment_staff_reschedule_requested":
      return finalizeTemplate(
        `Reschedule request needs review for ${locationLabel}`,
        type
          ? `${displayType} appointment at ${locationLabel}${patientLine}${appt ? ` (ref ${appt})` : ""} was requested to move${scheduleLine ? ` to ${scheduleLine}` : ""}.`
          : `Appointment at ${locationLabel}${patientLine}${appt ? ` (ref ${appt})` : ""} was requested to move${scheduleLine ? ` to ${scheduleLine}` : ""}.`,
        {
          eyebrow: locationUpdate,
          title: `Reschedule request needs review for ${locationLabel}`,
          ...dashboardCta(),
          note: `Review the ${locationLabel} request in the dashboard when you are ready.`,
        },
      );
    case "appointment_staff_rescheduled":
      return finalizeTemplate(
        `Appointment rescheduled at ${locationLabel}`,
        type
          ? `${displayType} appointment at ${locationLabel}${patientLine}${scheduleLine ? ` is now scheduled for ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""}.`
          : `Appointment at ${locationLabel}${patientLine}${scheduleLine ? ` is now scheduled for ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""}.`,
        {
          eyebrow: locationUpdate,
          title: `Appointment rescheduled at ${locationLabel}`,
          ...dashboardCta(),
          note: `The updated ${locationLabel} schedule is available in the dashboard.`,
        },
      );
    case "appointment_staff_checked_in":
      return finalizeTemplate(
        `Patient checked in at ${locationLabel}`,
        `Patient${patientLine}${scheduleLine ? ` checked in for the ${scheduleLine}` : " checked in"}${appt ? ` (ref ${appt})` : ""} at ${locationLabel}.`,
        {
          eyebrow: locationUpdate,
          title: `Patient checked in at ${locationLabel}`,
          ...dashboardCta(),
          note: `Open the dashboard for the current ${locationLabel} queue and consultation status.`,
        },
      );
    case "appointment_staff_in_progress":
      return finalizeTemplate(
        `Consultation started at ${locationLabel}`,
        `Consultation${patientLine}${scheduleLine ? ` started for the ${scheduleLine}` : " has started"}${appt ? ` (ref ${appt})` : ""} at ${locationLabel}.`,
        {
          eyebrow: locationUpdate,
          title: `Consultation started at ${locationLabel}`,
          ...dashboardCta(),
          note: `Use the dashboard to continue the ${locationLabel} consultation workflow.`,
        },
      );
    case "appointment_staff_completed":
      return finalizeTemplate(
        `Consultation completed at ${locationLabel}`,
        `Consultation${patientLine}${scheduleLine ? ` was completed for the ${scheduleLine}` : " was completed"}${appt ? ` (ref ${appt})` : ""} at ${locationLabel}.`,
        {
          eyebrow: locationUpdate,
          title: `Consultation completed at ${locationLabel}`,
          ...dashboardCta(),
          note: `Open the dashboard if you need to review ${locationLabel} notes, billing, or records.`,
        },
      );
    case "appointment_staff_payment_failed":
      return finalizeTemplate(
        type === "Online"
          ? "Virtual consult payment failed"
          : `Appointment payment failed at ${locationLabel}`,
        type
          ? `${displayType} appointment at ${locationLabel}${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has a failed payment that may need follow-up.`
          : `Appointment at ${locationLabel}${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has a failed payment that may need follow-up.`,
        {
          eyebrow: locationUpdate,
          title: type === "Online" ? "Virtual consult payment failed" : `Appointment payment failed at ${locationLabel}`,
          ...dashboardCta(),
          note: `Review the failed ${locationLabel} payment and contact the patient if needed.`,
        },
      );
    case "appointment_confirmed":
      return finalizeTemplate(
        "Your appointment is confirmed",
        channel === "sms"
          ? `Doc Kulot: Your ${label}${appt ? ` (ref ${appt})` : ""} is confirmed.${link ? ` Link: ${link}` : ""}`
          : [
            `Your ${label}${appt ? ` (ref ${appt})` : ""} is confirmed.`,
            scheduleLine ? `Schedule: ${scheduleLine}` : "",
            link ? `Meeting link: ${link}` : "",
          ].filter(Boolean).join("\n"),
        {
          eyebrow: "Appointment confirmed",
          title: "Your appointment is confirmed",
          ...meetingCta(link),
          note: "Keep this email handy for the schedule and meeting details.",
        },
      );
    case "appointment_reschedule_requested":
      return finalizeTemplate(
        "Reschedule request received",
        [
          `Your reschedule request${appt ? ` for appointment ${appt}` : ""} was received.`,
          scheduleLine ? `Requested schedule: ${scheduleLine}` : "",
          "The clinic or assigned doctor will review it before your appointment is moved.",
        ].filter(Boolean).join("\n"),
        {
          eyebrow: "Reschedule request",
          title: "Reschedule request received",
          ...patientPortalCta(),
          note: "You can check the patient portal for updates on the request.",
        },
      );
    case "appointment_reschedule_approved":
      return finalizeTemplate(
        "Your appointment was rescheduled",
        channel === "sms"
          ? `Doc Kulot: Your appointment${appt ? ` ${appt}` : ""} was rescheduled${scheduleLine ? ` to ${scheduleLine}` : ""}.`
          : [
            `Your appointment${appt ? ` (ref ${appt})` : ""} has been rescheduled.`,
            scheduleLine ? `New schedule: ${scheduleLine}` : "",
          ].filter(Boolean).join("\n"),
        {
          eyebrow: "Appointment updated",
          title: "Your appointment was rescheduled",
          ...patientPortalCta(),
          note: "Check the portal for the updated schedule and details.",
        },
      );
    case "appointment_reschedule_rejected":
      return finalizeTemplate(
        "Reschedule request not approved",
        [
          `Your reschedule request${appt ? ` for appointment ${appt}` : ""} was not approved.`,
          "Your original appointment schedule remains unchanged. Please contact the clinic if you need help.",
        ].join("\n"),
        {
          eyebrow: "Reschedule request",
          title: "Reschedule request not approved",
          ...patientPortalCta(),
          note: "Your original schedule is still active.",
        },
      );
    case "appointment_payment_success":
      return finalizeTemplate(
        "Payment successful",
        `We received your payment${amount ? ` of ${amount}` : ""}${appt ? ` for appointment ${appt}` : ""}. Your booking is secured.`,
        {
          eyebrow: "Payment received",
          title: "Payment successful",
          ...patientPortalCta(),
          note: "Your booking is secured and ready for the next step.",
        },
      );
    case "online_meeting_link":
      return finalizeTemplate(
        "Your virtual consult meeting link",
        link
          ? `Your meeting link for appointment ${appt} is ready:\n${link}`
          : `Your meeting link for appointment ${appt} is ready in your dashboard.`,
        {
          eyebrow: "Virtual consult",
          title: "Your virtual consult meeting link",
          ...meetingCta(link),
          note: "Use the button when it is time to join your consultation.",
        },
      );
    case "appointment_paid_and_confirmed":
      if (purpose === "clinic_visit_reservation") {
        return finalizeTemplate(
          "Clinic visit reservation confirmed",
          channel === "sms"
            ? `Doc Kulot: PHP 200 reservation fee received. Your clinic visit slot${scheduleLine ? ` on ${scheduleLine}` : ""} is confirmed.${appt ? ` Ref ${appt}.` : ""} Show this to the clinic. The fee will be deducted from your bill.`
            : [
              `Your clinic visit reservation is confirmed${appt ? ` (ref ${appt})` : ""}.`,
              scheduleLine ? `Schedule: ${scheduleLine}` : "",
              `Reservation fee paid: ${amount || "PHP 200"} via PayMongo QR Ph — non-refundable.`,
              "This amount will be deducted from your clinic bill (POS) on your visit day. Consultation and any add-ons are paid at the clinic.",
              "Please arrive on time. This reservation secures your slot.",
            ].filter(Boolean).join("\n"),
          {
            eyebrow: "Clinic visit reservation",
            title: "Clinic visit reservation confirmed",
            ...patientPortalCta(),
            note: "Show this confirmation to the clinic receptionist on your visit day.",
          },
        );
      }
      if (purpose === "procedure_downpayment") {
        return finalizeTemplate(
          "Procedure reservation confirmed",
          channel === "sms"
            ? `Doc Kulot: ${amount || "PHP 1,000"} downpayment received for ${service || "your procedure"}. Schedule${scheduleLine ? `: ${scheduleLine}` : " confirmed"}.${appt ? ` Ref ${appt}.` : ""}`
            : [
              `Your ${service || "medical procedure"} reservation is confirmed${appt ? ` (ref ${appt})` : ""}.`,
              scheduleLine ? `Schedule: ${scheduleLine}` : "",
              `Payment received: ${amount || "PHP 1,000"} reservation/downpayment via PayMongo QR Ph.`,
              "This amount will be deducted from your final procedure bill. Consultation and remaining procedure charges are settled separately at the clinic.",
              "Please arrive on time and wait for the clinic team if they need additional details before your visit.",
            ].filter(Boolean).join("\n"),
          {
            eyebrow: "Procedure reservation",
            title: "Procedure reservation confirmed",
            ...patientPortalCta(),
            note: "Keep this email for the reservation details and payment record.",
          },
        );
      }
      return finalizeTemplate(
        "Virtual consult confirmed",
        channel === "sms"
          ? `Doc Kulot: ${amount || "PHP 800"} received. Your virtual consult${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} is confirmed.${link ? ` Link: ${link}` : ""}`
          : [
            `Payment received: ${amount || "PHP 800"} for your virtual consult${appt ? ` (ref ${appt})` : ""}.`,
            scheduleLine ? `Schedule: ${scheduleLine}` : "",
            "This includes the first virtual consult plus one follow-up.",
            link ? `Meeting link: ${link}` : "The meeting link will appear in your dashboard or be sent by the clinic once ready.",
          ].filter(Boolean).join("\n"),
        {
          eyebrow: "Payment received",
          title: "Virtual consult confirmed",
          ...meetingCta(link),
          note: "Your virtual consult is booked and ready.",
        },
      );
    case "appointment_payment_failed":
      return finalizeTemplate(
        type === "Online"
          ? "Payment could not be completed for your virtual consult"
          : `Payment could not be completed for ${locationLabel}`,
        channel === "sms"
          ? `Doc Kulot: Payment failed for your ${locationContext}${appt || reservationRef ? ` (ref ${appt || reservationRef})` : ""}. Please retry or contact the clinic.`
          : [
            `We could not complete the payment for your ${locationContext}${appt || reservationRef ? ` (ref ${appt || reservationRef})` : ""}.`,
            amount ? `Expected amount: ${amount}` : "",
            "Please retry checkout or contact the clinic so the schedule can be assisted.",
          ].filter(Boolean).join("\n"),
        {
          eyebrow: "Payment issue",
          title: type === "Online"
            ? "Payment could not be completed for your virtual consult"
            : `Payment could not be completed for ${locationLabel}`,
          ...patientPortalCta("Open patient portal"),
          note: type === "Online"
            ? "Please retry the payment or contact support for help."
            : `Please retry the payment or contact ${locationLabel} for help.`,
        },
      );
    case "appointment_reminder_24h":
      return finalizeTemplate(
        type === "Clinic"
          ? "Reminder: clinic appointment tomorrow"
          : "Reminder: virtual consult tomorrow",
        type === "Clinic"
          ? `Doc Kulot reminder: your ${label}${appt ? ` (ref ${appt})` : ""} is tomorrow. Please arrive on time and bring any needed records.`
          : `Doc Kulot reminder: your virtual consult${appt ? ` (ref ${appt})` : ""} is tomorrow.${link ? ` Meeting link: ${link}` : " Check your dashboard for the meeting link."}`,
        {
          eyebrow: "Appointment reminder",
          title: type === "Clinic"
            ? "Reminder: clinic appointment tomorrow"
            : "Reminder: virtual consult tomorrow",
          ...meetingCta(link),
          note: type === "Clinic"
            ? "Please arrive on time and bring any needed records."
            : "Open the link when it is time for your consultation.",
        },
      );
    case "appointment_reminder_6h":
      return finalizeTemplate(
        type === "Clinic"
          ? "Reminder: clinic appointment in a few hours"
          : "Reminder: appointment in a few hours",
        type === "Clinic"
          ? `Doc Kulot reminder: your ${label}${appt ? ` (ref ${appt})` : ""} is coming up soon.`
          : `Doc Kulot reminder: your virtual consult${appt ? ` (ref ${appt})` : ""} is coming up soon.${link ? ` Link: ${link}` : ""}`,
        {
          eyebrow: "Appointment reminder",
          title: type === "Clinic"
            ? "Reminder: clinic appointment in a few hours"
            : "Reminder: appointment in a few hours",
          ...meetingCta(link),
          note: type === "Clinic"
            ? "Your appointment is coming up soon."
            : "Use the link when your consultation begins.",
        },
      );
    case "appointment_cancelled":
      return finalizeTemplate(
        type === "Online"
          ? "Virtual consult cancelled"
          : `Appointment cancelled at ${locationLabel}`,
        `Your ${locationContext}${appt ? ` (ref ${appt})` : ""} has been cancelled. Contact ${type === "Online" ? "the clinic" : locationLabel} if you need help booking another schedule.`,
        {
          eyebrow: "Appointment update",
          title: type === "Online"
            ? "Virtual consult cancelled"
            : `Appointment cancelled at ${locationLabel}`,
          ...patientPortalCta(),
          note: type === "Online"
            ? "If you need a new schedule, you can book again from the portal."
            : `If you need a new schedule, you can book again from the portal or contact ${locationLabel}.`,
        },
      );
    case "billing_issued":
      return finalizeTemplate(
        "Your clinic bill is ready",
        `Your clinic bill${appt ? ` for appointment ${appt}` : ""} is ready. You can review it on your dashboard or ask the front desk for assistance.`,
        {
          eyebrow: "Billing update",
          title: "Your clinic bill is ready",
          ...patientPortalCta(),
          note: "Open the portal to review the bill and next steps.",
        },
      );
    case "prescription_released":
      return finalizeTemplate(
        "Your prescription is ready",
        `Your prescription${prescriptionNo ? ` (${prescriptionNo})` : ""} is ready. You can view, download, or print the PDF from your patient portal under Medical Documents.`,
        {
          eyebrow: "Prescription ready",
          title: "Your prescription is ready",
          ...patientPortalCta(),
          note: "Open Medical Documents to view, download, or print the prescription.",
        },
      );
    default:
      return finalizeTemplate("Notification from Doc Kulot", "You have a new notification.", {
        eyebrow: "Doc Kulot update",
        title: "Notification from Doc Kulot",
        ...patientPortalCta(),
      });
  }
}
