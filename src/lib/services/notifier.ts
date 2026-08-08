/**
 * Pluggable email/SMS delivery. Replace these stubs with real providers:
 *   - Email: Resend, Postmark, SendGrid, SES
 *   - SMS:   Twilio, Semaphore (PH), Vonage
 *
 * The worker at /api/v2/notifications/drain calls these.
 */

export type EmailInput = {
  to: string;
  subject: string;
  body: string;
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

function appointmentLabel(type: string, service: string, purpose: string) {
  if (purpose === "procedure_downpayment") return `${service || "medical procedure"} reservation`;
  if (type === "Online") return "teleconsultation";
  if (service) return service;
  return type === "Clinic" ? "clinic consultation" : "appointment";
}

export function renderTemplate(
  template: string,
  payload: TemplatePayload,
  channel: RenderChannel = "email",
): { subject: string; body: string } {
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
  const scheduleLine = [appointmentDate, startTime].filter(Boolean).join(" at ");
  const patientLine = patientName ? ` for ${patientName}` : "";
  const label = appointmentLabel(type, service, purpose);
  const shortLabel = label.charAt(0).toUpperCase() + label.slice(1);

  switch (template) {
    case "verify_email":
      return {
        subject: "Verify your Doc Kulot account",
        body: verifyUrl
          ? `Please verify your email before signing in. Open this confirmation link to activate your account: ${verifyUrl}`
          : "Please verify your email before signing in. Use the confirmation link from your latest verification email.",
      };
    case "welcome":
      return {
        subject: "Welcome to Doc Kulot",
        body: "Welcome to Doc Kulot. Your account is active. You can book a teleconsultation, clinic consultation, or medical procedure reservation from the website.",
      };
    case "appointment_booked":
      return {
        subject: status === "Confirmed" ? "Your booking is confirmed" : "Your booking was received",
        body: status === "Confirmed"
          ? channel === "sms"
            ? `Doc Kulot: Your ${label} booking is confirmed${scheduleLine ? ` for ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""}.`
            : [
              `Your ${label} booking is confirmed${appt ? ` (ref ${appt})` : ""}.`,
              scheduleLine ? `Schedule: ${scheduleLine}` : "",
              "Please check your email or patient portal for full details.",
            ].filter(Boolean).join("\n")
          : channel === "sms"
            ? `Doc Kulot: Your ${label} booking${scheduleLine ? ` for ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} was received.`
            : [
              `Your ${label} booking has been received${appt ? ` (ref ${appt})` : ""}.`,
              scheduleLine ? `Schedule: ${scheduleLine}` : "",
              type === "Clinic"
                ? "Clinic bookings may be reviewed by the team. Please wait for any follow-up from the clinic."
                : "Please check your dashboard for updates.",
            ].filter(Boolean).join("\n"),
      };
    case "appointment_staff_booked":
      return {
        subject: "New appointment booked",
        body: type
          ? `A new ${type.toLowerCase()} appointment${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} was just booked.`
          : `A new appointment${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} was just booked.`,
      };
    case "appointment_staff_confirmed":
      return {
        subject: "Online appointment confirmed",
        body: type
          ? `${type} appointment${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has been confirmed and paid.`
          : `Appointment${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has been confirmed and paid.`,
      };
    case "appointment_staff_cancelled":
      return {
        subject: "Appointment cancelled",
        body: type
          ? `${type} appointment${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has been cancelled.`
          : `Appointment${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has been cancelled.`,
      };
    case "appointment_staff_rescheduled":
      return {
        subject: "Appointment rescheduled",
        body: type
          ? `${type} appointment${patientLine}${scheduleLine ? ` is now scheduled for ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""}.`
          : `Appointment${patientLine}${scheduleLine ? ` is now scheduled for ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""}.`,
      };
    case "appointment_staff_checked_in":
      return {
        subject: "Patient checked in",
        body: `Patient${patientLine}${scheduleLine ? ` checked in for the ${scheduleLine}` : " checked in"}${appt ? ` (ref ${appt})` : ""}.`,
      };
    case "appointment_staff_in_progress":
      return {
        subject: "Consultation started",
        body: `Consultation${patientLine}${scheduleLine ? ` started for the ${scheduleLine}` : " has started"}${appt ? ` (ref ${appt})` : ""}.`,
      };
    case "appointment_staff_completed":
      return {
        subject: "Consultation completed",
        body: `Consultation${patientLine}${scheduleLine ? ` was completed for the ${scheduleLine}` : " was completed"}${appt ? ` (ref ${appt})` : ""}.`,
      };
    case "appointment_staff_payment_failed":
      return {
        subject: "Online payment failed",
        body: type
          ? `${type} appointment${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has a failed payment that may need follow-up.`
          : `Appointment${patientLine}${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} has a failed payment that may need follow-up.`,
      };
    case "appointment_confirmed":
      return {
        subject: "Your appointment is confirmed",
        body: channel === "sms"
          ? `Doc Kulot: Your ${label}${appt ? ` (ref ${appt})` : ""} is confirmed.${link ? ` Link: ${link}` : ""}`
          : [
            `Your ${label}${appt ? ` (ref ${appt})` : ""} is confirmed.`,
            scheduleLine ? `Schedule: ${scheduleLine}` : "",
            link ? `Meeting link: ${link}` : "",
          ].filter(Boolean).join("\n"),
      };
    case "appointment_payment_success":
      return {
        subject: "Payment successful",
        body: `We received your payment${amount ? ` of ${amount}` : ""}${appt ? ` for appointment ${appt}` : ""}. Your booking is secured.`,
      };
    case "online_meeting_link":
      return {
        subject: "Your online meeting link",
        body: link
          ? `Your meeting link for appointment ${appt} is ready: ${link}`
          : `Your meeting link for appointment ${appt} is ready in your dashboard.`,
      };
    case "appointment_paid_and_confirmed":
      if (purpose === "procedure_downpayment") {
        return {
          subject: "Procedure reservation confirmed",
          body: channel === "sms"
            ? `Doc Kulot: ${amount || "PHP 1,000"} downpayment received for ${service || "your procedure"}. Schedule${scheduleLine ? `: ${scheduleLine}` : " confirmed"}.${appt ? ` Ref ${appt}.` : ""}`
            : [
              `Your ${service || "medical procedure"} reservation is confirmed${appt ? ` (ref ${appt})` : ""}.`,
              scheduleLine ? `Schedule: ${scheduleLine}` : "",
              `Payment received: ${amount || "PHP 1,000"} reservation/downpayment via PayMongo QR Ph.`,
              "This amount will be deducted from your final procedure bill. Consultation and remaining procedure charges are settled separately at the clinic.",
              "Please arrive on time and wait for the clinic team if they need additional details before your visit.",
            ].filter(Boolean).join("\n"),
        };
      }
      return {
        subject: "Teleconsultation confirmed",
        body: channel === "sms"
          ? `Doc Kulot: ${amount || "PHP 800"} received. Your teleconsultation${scheduleLine ? ` on ${scheduleLine}` : ""}${appt ? ` (ref ${appt})` : ""} is confirmed.${link ? ` Link: ${link}` : ""}`
          : [
            `Payment received: ${amount || "PHP 800"} for your teleconsultation${appt ? ` (ref ${appt})` : ""}.`,
            scheduleLine ? `Schedule: ${scheduleLine}` : "",
            "This includes the first online consult plus one follow-up.",
            link ? `Meeting link: ${link}` : "The meeting link will appear in your dashboard or be sent by the clinic once ready.",
          ].filter(Boolean).join("\n"),
      };
    case "appointment_payment_failed":
      return {
        subject: "Payment could not be completed",
        body: channel === "sms"
          ? `Doc Kulot: Payment failed for your ${label}${appt || reservationRef ? ` (ref ${appt || reservationRef})` : ""}. Please retry or contact the clinic.`
          : [
            `We could not complete the payment for your ${label}${appt || reservationRef ? ` (ref ${appt || reservationRef})` : ""}.`,
            amount ? `Expected amount: ${amount}` : "",
            "Please retry checkout or contact the clinic so the schedule can be assisted.",
          ].filter(Boolean).join("\n"),
      };
    case "appointment_reminder_24h":
      return {
        subject: type === "Clinic"
          ? "Reminder: clinic appointment tomorrow"
          : "Reminder: online consultation tomorrow",
        body: type === "Clinic"
          ? `Doc Kulot reminder: your ${label}${appt ? ` (ref ${appt})` : ""} is tomorrow. Please arrive on time and bring any needed records.`
          : `Doc Kulot reminder: your teleconsultation${appt ? ` (ref ${appt})` : ""} is tomorrow.${link ? ` Meeting link: ${link}` : " Check your dashboard for the meeting link."}`,
      };
    case "appointment_reminder_6h":
      return {
        subject: type === "Clinic"
          ? "Reminder: clinic appointment in a few hours"
          : "Reminder: appointment in a few hours",
        body: type === "Clinic"
          ? `Doc Kulot reminder: your ${label}${appt ? ` (ref ${appt})` : ""} is coming up soon.`
          : `Doc Kulot reminder: your teleconsultation${appt ? ` (ref ${appt})` : ""} is coming up soon.${link ? ` Link: ${link}` : ""}`,
      };
    case "appointment_cancelled":
      return {
        subject: "Appointment cancelled",
        body: `Your ${label}${appt ? ` (ref ${appt})` : ""} has been cancelled. Contact the clinic if you need help booking another schedule.`,
      };
    case "billing_issued":
      return {
        subject: "Your clinic bill is ready",
        body: `Your clinic bill${appt ? ` for appointment ${appt}` : ""} is ready. You can review it on your dashboard or ask the front desk for assistance.`,
      };
    case "prescription_released":
      return {
        subject: "Your prescription is ready",
        body: `Your prescription${prescriptionNo ? ` (${prescriptionNo})` : ""} is ready. You can view, download, or print the PDF from your patient portal under Prescriptions.`,
      };
    default:
      return { subject: "Notification from Doc Kulot", body: "You have a new notification." };
  }
}
