export type DbRole =
  | "super_admin"
  | "admin"
  | "staff"
  | "secretary"
  | "doctor"
  | "patient";

export type ApptType = "Clinic" | "Online";
export type ScheduleMode = "Clinic" | "Online" | "Both";

export type ApptStatus =
  | "PendingPayment"
  | "Pending"
  | "Confirmed"
  | "CheckedIn"
  | "InProgress"
  | "Completed"
  | "Cancelled"
  | "NoShow";

export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";

export type PaymentMethod = "Cash" | "GCash" | "QR" | "Card" | "BankTransfer";

export type BillingStatus = "Draft" | "Issued" | "Paid" | "Void";

// Discount provenance — controls whether the cashier typed it manually or
// the system applied a Senior Citizen / PWD discount (20% off + VAT exempt
// per RA 9994 / RA 10754).
export type DiscountKind = "None" | "Manual" | "SeniorCitizen" | "PWD";

export type NotificationChannel = "email" | "sms";

export type Profile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: DbRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Doctor = {
  id: string;
  specialty: string;
  license_no: string;
  consultation_fee_clinic: number;
  consultation_fee_online: number;
};

export type DoctorSchedule = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  schedule_mode: ScheduleMode;
  is_active: boolean;
};

export type DoctorUnavailability = {
  id: string;
  doctor_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: ApptType;
  status: ApptStatus;
  queue_number: number;
  reason: string;
  meeting_link: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  appointment_id: string | null;
  billing_id: string | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: string | null;
  provider_ref: string | null;
  paid_at: string | null;
  created_at: string;
  // Cash tendered by the patient. NULL means exact amount; otherwise
  // (tendered_amount - amount) is the change due.
  tendered_amount: number | null;
};

export type OnlineBookingReservation = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_type: ApptType;
  appointment_date: string;
  start_time: string;
  end_time: string;
  queue_number: number;
  reason: string;
  amount: number;
  status: "Pending" | "Paid" | "Failed" | "Expired" | "Converted";
  payment_provider: string | null;
  payment_ref: string | null;
  appointment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Billing = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: BillingStatus;
  issued_at: string | null;
  created_at: string;
  discount_kind: DiscountKind;
  discount_id_number: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
};

export type BillingItem = {
  id: string;
  billing_id: string;
  pricing_id: string | null;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type ConsultationNote = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  prescription: string | null;
  notes: string | null;
  visible_to_patient: boolean;
  created_at: string;
  updated_at: string;
};

// Editable copy + image references for the public landing page. Single-row
// table — see migrations/20260508_landing_content.sql.
export type LandingTestimonial = {
  name: string;
  title: string;
  quote: string;
};

export type LandingProgramSlide = {
  key: string;
  name: string;
  description: string;
  ctaLabel: string;
};

export type LandingNavItem = {
  label: string;
  href: string;
};

export type LandingServiceBullet = {
  title: string;
  body: string;
};

export type LandingService = {
  kind: "clinic" | "online" | string;
  title: string;
  description: string;
  bullets: LandingServiceBullet[];
};

export type LandingHighlight = {
  title: string;
  body: string;
};

export type LandingHowToStep = {
  step: number;
  title: string;
  description: string;
};

export type LandingContent = {
  id: boolean;
  hero_eyebrow: string;
  hero_title_line1: string;
  hero_title_line2: string;
  hero_subtitle: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  hero_background_url: string | null;
  about_eyebrow: string;
  about_title: string;
  about_subtitle: string;
  doctor_name: string;
  doctor_title: string;
  doctor_photo_url: string | null;
  about_highlights: LandingHighlight[];
  feature_1_title: string;
  feature_1_body: string;
  feature_2_title: string;
  feature_2_body: string;
  feature_3_title: string;
  feature_3_body: string;
  cta_title: string;
  cta_subtitle: string;
  cta_button_label: string;
  testimonials: LandingTestimonial[];
  // Phase 2 fields — see migrations/20260508b_landing_content_full.sql
  nav_items: LandingNavItem[];
  program_slides: LandingProgramSlide[];
  services_eyebrow: string;
  services_title: string;
  services_subtitle: string;
  services: LandingService[];
  blog_eyebrow: string;
  blog_title: string;
  blog_subtitle: string;
  blog_categories_title: string;
  blog_recent_posts_title: string;
  blog_categories: string[];
  videos_eyebrow: string;
  videos_title: string;
  videos_subtitle: string;
  live_eyebrow: string;
  live_title: string;
  live_subtitle: string;
  live_cta_label: string;
  results_eyebrow: string;
  results_title: string;
  results_subtitle: string;
  faq_eyebrow: string;
  faq_title: string;
  faq_subtitle: string;
  how_to_eyebrow: string;
  how_to_title: string;
  how_to_steps: LandingHowToStep[];
  testimonials_eyebrow: string;
  testimonials_title: string;
  testimonials_subtitle: string;
  booking_title: string;
  booking_subtitle: string;
  contact_eyebrow: string;
  contact_title: string;
  contact_subtitle: string;
  contact_info_title: string;
  contact_hours_label: string;
  contact_facebook_label: string;
  contact_facebook_url: string;
  contact_youtube_label: string;
  contact_youtube_url: string;
  footer_brand_blurb: string;
  footer_services: string[];
  footer_hours: string[];
  footer_contact_text: string;
  footer_copyright: string;
  updated_at: string;
  updated_by: string | null;
};

// Per-visit vital signs. All fields nullable so the secretary can save a
// partial record at check-in (e.g., BP + temp + pulse) and the doctor can
// fill in the rest later.
export type VitalSigns = {
  id: string;
  appointment_id: string;
  recorded_by: string | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  temperature_c: number | null;
  pulse_rate: number | null;
  oxygen_saturation: number | null;
  respiratory_rate: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
