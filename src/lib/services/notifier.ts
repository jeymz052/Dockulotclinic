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
};

export type SmsInput = {
  to: string;
  body: string;
};

export async function sendEmail(input: EmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:stub] to=${input.to} subject="${input.subject}"`);
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

export function renderTemplate(template: string, payload: TemplatePayload): { subject: string; body: string } {
  const appt = (payload.appointment_id as string)?.slice(0, 8) ?? "";
  const link = payload.meeting_link as string | undefined;
  const type = payload.appointment_type as string | undefined;
  const verifyUrl = payload.verification_link as string | undefined;
  const patientName = payload.patient_name as string | undefined;
  const appointmentDate = payload.appointment_date as string | undefined;
  const startTime = payload.start_time as string | undefined;
  const prescriptionNo = payload.prescription_no as string | undefined;
  const scheduleLine = [appointmentDate, startTime].filter(Boolean).join(" at ");
  const patientLine = patientName ? ` for ${patientName}` : "";

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
        body: "Welcome! Your account is now active. You can book clinic visits and online consultations at any time.",
      };
    case "appointment_booked":
      return {
        subject: "Your appointment booking was received",
        body: `Your ${type?.toLowerCase() ?? "clinic"} appointment request (ref ${appt}) has been recorded.`,
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
        body: `Your appointment (ref ${appt}) is confirmed.${link ? ` Meeting link: ${link}` : ""}`,
      };
    case "appointment_payment_success":
      return {
        subject: "Payment successful",
        body: `We received your payment for appointment ${appt}. Your online consultation is now secured.`,
      };
    case "online_meeting_link":
      return {
        subject: "Your online meeting link",
        body: link
          ? `Your meeting link for appointment ${appt} is ready: ${link}`
          : `Your meeting link for appointment ${appt} is ready in your dashboard.`,
      };
    case "appointment_paid_and_confirmed":
      return {
        subject: "Online consultation confirmed",
        body: `Payment received. Your online consultation (ref ${appt}) is confirmed.${
          link ? ` Meeting link: ${link}` : ""
        }`,
      };
    case "appointment_payment_failed":
      return {
        subject: "Payment could not be completed",
        body: `We couldn't process your payment for appointment ${appt}. Please try again to confirm your slot.`,
      };
    case "appointment_reminder_24h":
      return {
        subject: type === "Clinic"
          ? "Reminder: clinic appointment tomorrow"
          : "Reminder: online consultation tomorrow",
        body: type === "Clinic"
          ? `This is a 24-hour reminder for your clinic appointment (ref ${appt}) tomorrow.`
          : `This is a 24-hour reminder for your online consultation (ref ${appt}) tomorrow.${
            link ? ` Meeting link: ${link}` : ""
          }`,
      };
    case "appointment_reminder_6h":
      return {
        subject: type === "Clinic"
          ? "Reminder: clinic appointment in a few hours"
          : "Reminder: appointment in a few hours",
        body: type === "Clinic"
          ? `Your clinic appointment (ref ${appt}) is coming up soon.`
          : `Your appointment (ref ${appt}) is coming up soon.${link ? ` Meeting link: ${link}` : ""}`,
      };
    case "appointment_cancelled":
      return {
        subject: "Appointment cancelled",
        body: `Your appointment (ref ${appt}) has been cancelled.`,
      };
    case "billing_issued":
      return {
        subject: "Your receipt is ready",
        body: `Your bill (ref ${appt}) has been issued. You can review it on your dashboard.`,
      };
    case "prescription_released":
      return {
        subject: "Your prescription is ready",
        body: `Your prescription${prescriptionNo ? ` (${prescriptionNo})` : ""} is ready in the patient portal. You can view, download, or print it from Prescriptions.`,
      };
    default:
      return { subject: "Notification from Doc Kulot", body: "You have a new notification." };
  }
}
