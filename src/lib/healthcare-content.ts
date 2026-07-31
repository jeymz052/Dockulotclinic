import type { IconType } from "react-icons";
import {
  FaCalendarCheck,
  FaCertificate,
  FaFlaskVial,
  FaHeartPulse,
  FaLaptopMedical,
  FaPrescriptionBottleMedical,
  FaStethoscope,
  FaUserDoctor,
} from "react-icons/fa6";

export type PublicNavItem = {
  label: string;
  href: string;
};

export type ServiceItem = {
  title: string;
  description: string;
  icon: IconType;
  modes?: Array<"Clinic" | "Online">;
  appointmentOnly?: boolean;
};

export type ClinicLocation = {
  name: string;
  address: string;
  schedule: string;
  note: string;
};

export type BeforeAfterItem = {
  title: string;
  beforeImage?: string;
  afterImage?: string;
  image?: string;
  program: string;
  caption: string;
};

export type AftercareGuide = {
  title: string;
  image: string;
  summary: string;
  bullets: string[];
};

export type ConsentGuide = {
  title: string;
  image: string;
  summary: string;
  bullets: string[];
};

export type PrescriptionGuide = {
  title: string;
  image: string;
  summary: string;
  bullets: string[];
};

export type ContentItem = {
  title: string;
  category: string;
  description: string;
  type: "Blog" | "Video" | "Live" | "Announcement";
};

export type FaqItem = {
  category: string;
  question: string;
  answer: string;
};

export const faqCategories = [
  "Appointment FAQ",
  "Clinic Services FAQ",
  "Online Consultation FAQ",
  "Payment FAQ",
  "Prescription FAQ",
  "Patient Portal FAQ",
  "Vlog/Content FAQ",
  "Contact & Inquiry FAQ",
];

export const publicNav: PublicNavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Online", href: "/online-services" },
  { label: "Book", href: "/booking" },
  { label: "Blog", href: "/#blog" },
  { label: "Videos", href: "/#videos" },
  { label: "Live", href: "/#live" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export const clinicServices: ServiceItem[] = [
  {
    title: "General Consultation",
    description: "Clinic-based assessment for common health concerns, follow-ups, and primary care.",
    icon: FaStethoscope,
    modes: ["Clinic"],
  },
  {
    title: "Telemedicine Services",
    description: "Weight loss management, PCOS management, chronic disease review, lab interpretation, and prescription refill.",
    icon: FaLaptopMedical,
    modes: ["Online"],
  },
  {
    title: "Women's Health and Aesthetic Care",
    description: "PCOS, acne, hormonal acne, weight loss support, and aesthetic medicine consults.",
    icon: FaCalendarCheck,
    modes: ["Clinic", "Online"],
  },
  {
    title: "Medical Certificate Request",
    description: "Request documentation after appropriate clinical assessment and approval.",
    icon: FaCertificate,
    modes: ["Clinic"],
  },
  {
    title: "Laboratory Results Interpretation",
    description: "Review results and next steps with the doctor after your tests are available.",
    icon: FaFlaskVial,
    modes: ["Clinic", "Online"],
  },
  {
    title: "Prescription Refill",
    description: "Medication refill review for eligible maintenance or follow-up cases.",
    icon: FaPrescriptionBottleMedical,
    modes: ["Clinic", "Online"],
  },
  {
    title: "Botox",
    description: "Appointment-only aesthetic procedure with limited daily slots.",
    icon: FaHeartPulse,
    modes: ["Clinic"],
    appointmentOnly: true,
  },
  {
    title: "Mesolipo",
    description: "Appointment-only procedure for targeted aesthetic body contour support.",
    icon: FaUserDoctor,
    modes: ["Clinic"],
    appointmentOnly: true,
  },
  {
    title: "Fillers",
    description: "Appointment-only facial enhancement procedure.",
    icon: FaUserDoctor,
    modes: ["Clinic"],
    appointmentOnly: true,
  },
  {
    title: "Threads",
    description: "Appointment-only thread lift consultation and procedure booking.",
    icon: FaStethoscope,
    modes: ["Clinic"],
    appointmentOnly: true,
  },
  {
    title: "Wart and Skin Tag Removal",
    description: "Appointment-only cautery/removal procedure with consent requirement.",
    icon: FaCertificate,
    modes: ["Clinic"],
    appointmentOnly: true,
  },
  {
    title: "Mole Surgery",
    description: "Appointment-only minor procedure for mole assessment and removal planning.",
    icon: FaFlaskVial,
    modes: ["Clinic"],
    appointmentOnly: true,
  },
  {
    title: "Sclerotherapy",
    description: "Appointment-only treatment for selected vein concerns.",
    icon: FaHeartPulse,
    modes: ["Clinic"],
    appointmentOnly: true,
  },
  {
    title: "GLP Initiation",
    description: "Appointment-only weight loss treatment start with proper review and aftercare.",
    icon: FaPrescriptionBottleMedical,
    modes: ["Clinic"],
    appointmentOnly: true,
  },
  {
    title: "Flu Vaccination",
    description: "Seasonal flu vaccination after screening and doctor approval.",
    icon: FaCalendarCheck,
    modes: ["Clinic"],
  },
  {
    title: "Wellness Consultation",
    description: "Lifestyle, wellness, and patient education support tailored to the patient.",
    icon: FaUserDoctor,
    modes: ["Clinic", "Online"],
  },
];

export const clinicLocations: ClinicLocation[] = [
  {
    name: "FamMed Family Clinic",
    address: "Arquiza Building, Pasobolong, Zamboanga City",
    schedule: "Every Friday",
    note: "Book up to 5 procedure clients only.",
  },
  {
    name: "Premier Medical Center",
    address: "Room 420",
    schedule: "Tuesday, Thursday, Saturday",
    note: "Appointment-only medical procedures and consultations.",
  },
  {
    name: "RT Lim Family Hospital",
    address: "Room 4",
    schedule: "Every 1st and 3rd Sunday of the month",
    note: "Limited clinic days for selected visits and procedures.",
  },
];

export const beforeAfterResults: BeforeAfterItem[] = [
  {
    title: "GlowRx progress 1",
    program: "GlowRx",
    beforeImage: "/images/weightloss before1.png",
    afterImage: "/images/weightloss after1.png",
    caption: "A steady change with medical guidance, follow-up, and consistency.",
  },
  {
    title: "GlowRx progress 2",
    program: "GlowRx",
    beforeImage: "/images/weightloss before2.png",
    afterImage: "/images/weightloss after2.png",
    caption: "A cleaner silhouette after a structured and supervised program.",
  },
  {
    title: "GlowRx progress 3",
    program: "GlowRx",
    beforeImage: "/images/weightloss before3.png",
    afterImage: "/images/weightloss after3.png",
    caption: "Visible progress supported by medical care and long-term habits.",
  },
  {
    title: "Botox result",
    program: "Aesthetic Medicine",
    image: "/images/botox before and after.jpg",
    caption: "Softer expression after targeted Botox treatment.",
  },
];

export const aftercareGuides: AftercareGuide[] = [
  {
    title: "GLP Injection Aftercare",
    image: "/images/glp injection aftercare.jpg",
    summary: "Small habits, steady hydration, and follow-up help support safe progress.",
    bullets: [
      "Expect mild nausea, bloating, gas, or headache at the start.",
      "Stay hydrated, eat balanced meals, and move regularly.",
      "Avoid overeating, alcohol, and self-medicating without advice.",
    ],
  },
  {
    title: "Post Botox Aftercare",
    image: "/images/post botox aftercare.jpg",
    summary: "Keep the area calm for the first day so the treatment can settle well.",
    bullets: [
      "Keep your head upright for 4 to 6 hours.",
      "Avoid rubbing, massage, intense exercise, alcohol, and heat exposure.",
      "Results usually appear in 3 to 7 days and may last for months.",
    ],
  },
  {
    title: "Post Sclerotherapy Aftercare",
    image: "/images/post sclerotherapy afrercare.jpg",
    summary: "Compression, walking, and gentle care help reduce bruising and swelling.",
    bullets: [
      "Wear compression stockings as instructed.",
      "Walk regularly and keep the treated area clean and dry.",
      "Avoid intense exercise, long hot baths, and direct sun exposure.",
    ],
  },
  {
    title: "Post Wart Cautery Aftercare",
    image: "/images/post warts cuttery removal aftercare.jpg",
    summary: "Gentle cleaning and protection help the area heal safely.",
    bullets: [
      "Keep the area dry for the first 24 hours.",
      "Do not pick the scab and use only the prescribed ointment or medicines.",
      "Avoid soaking, makeup, and harsh products until fully healed.",
    ],
  },
];

export const consentGuide: ConsentGuide = {
  title: "Patient Consent Form",
  image: "/images/patient consent.jpg",
  summary: "Procedure patients must complete and sign the consent form before treatment.",
  bullets: [
    "The procedure, risks, benefits, and alternatives are explained first.",
    "The patient, witness, and physician signatures are required.",
    "Consent is mandatory for Botox, fillers, Mesolipo, sclerotherapy, GLP initiation, and cautery procedures.",
  ],
};

export const prescriptionGuide: PrescriptionGuide = {
  title: "Prescription Format",
  image: "/images/prescription sample.jpg",
  summary: "The prescription page follows the clinic format with patient details, doctor signature, and PDF-ready output.",
  bullets: [
    "Patients can view the prescription in the portal, then download or print it as a PDF.",
    "The doctor can send the same prescription through email from the prescription page.",
    "The document keeps the doctor name, prescription ID, and signature section visible.",
  ],
};

export const portalFeatures = [
  "View appointment history",
  "View allowed diagnosis and consultation notes",
  "View, download, and print prescriptions",
  "View billing history and receipts",
  "Access uploaded medical files",
  "Send follow-up inquiries",
  "Book another appointment",
];

export const dashboardModules = [
  { title: "Appointments", description: "Clinic and online booking, approvals, queue, reminders, and calendar." },
  { title: "Patient Records", description: "Patient profile, history, files, vitals, and controlled patient visibility." },
  { title: "Diagnosis & Prescriptions", description: "Diagnosis, dosage instructions, treatment plan, follow-up date, PDF/print output." },
  { title: "POS & Billing", description: "Invoices, services, medicine/product sales, payments, receipts, and sales history." },
  { title: "Creator Content", description: "Blogs, videos, health tips, announcements, live events, and featured content." },
  { title: "Inquiry System", description: "Visitor questions, replies, statuses, and inquiry-to-appointment conversion." },
  { title: "Reports & Security", description: "Clinic, content, sales, roles, access control, and activity logs." },
];

export const contentCategories = [
  "Health Tips",
  "Clinic Updates",
  "Medical Awareness",
  "Patient Education",
  "Online Consultation Topics",
  "Lifestyle & Wellness",
  "FAQ Videos",
  "Live Replays",
];

export const featuredContent: ContentItem[] = [
  {
    title: "When to choose online consultation",
    category: "Online Consultation Topics",
    description: "A practical guide for deciding whether your concern is safe for virtual care.",
    type: "Blog",
  },
  {
    title: "Prescription safety reminders",
    category: "Patient Education",
    description: "Simple reminders before renewing or changing medication routines.",
    type: "Video",
  },
  {
    title: "Weekly Ask the Doctor Live",
    category: "FAQ Videos",
    description: "A scheduled live Q&A that helps followers become informed patients.",
    type: "Live",
  },
  {
    title: "Clinic schedule update",
    category: "Clinic Updates",
    description: "Pinned announcement for holidays, blocked dates, or updated service hours.",
    type: "Announcement",
  },
];

export const liveEvents = [
  {
    title: "Ask the Doctor: Common Adult Health Concerns",
    date: "June 7, 2026",
    time: "7:00 PM",
    platform: "Facebook Live / YouTube Live",
    linkLabel: "Register interest",
  },
  {
    title: "Wellness Talk: Better Habits for Busy Patients",
    date: "June 21, 2026",
    time: "6:30 PM",
    platform: "Zoom Webinar",
    linkLabel: "Join waitlist",
  },
  {
    title: "Live Replay: Online Consultation FAQs",
    date: "Available after stream",
    time: "On demand",
    platform: "YouTube Replay",
    linkLabel: "Watch replay",
  },
];

export const faqs: FaqItem[] = [
  {
    category: "Appointment FAQ",
    question: "How to book an appointment?",
    answer: "Open the booking page, choose clinic visit or online consultation, select a service, date, and time, then submit your patient details.",
  },
  {
    category: "Clinic Services FAQ",
    question: "Do you accept walk-in patients?",
    answer: "Walk-ins can be encoded by clinic staff, but procedure days and limited clinic slots still follow the doctor's posted schedule.",
  },
  {
    category: "Prescription FAQ",
    question: "How can I access my prescription?",
    answer: "Log in to the patient portal and open your consultation history. Prescriptions shared by the doctor can be viewed, printed, downloaded, or emailed as a PDF.",
  },
  {
    category: "Patient Portal FAQ",
    question: "Can I print my prescription online?",
    answer: "Yes. If the doctor has released it to your portal, you can download the PDF or print it for pharmacy use.",
  },
  {
    category: "Online Consultation FAQ",
    question: "How do I book an online consultation?",
    answer: "Choose Telemedicine Services during booking, describe your concern, upload supporting files if needed, and wait for confirmation and meeting details.",
  },
  {
    category: "Vlog/Content FAQ",
    question: "Where can I watch doctor’s videos?",
    answer: "Open the Videos page for embedded YouTube, TikTok, Facebook videos, live replays, and health education content.",
  },
  {
    category: "Contact & Inquiry FAQ",
    question: "How can I send an inquiry?",
    answer: "Use the Contact page for appointment, service, consultation, collaboration, or general questions.",
  },
  {
    category: "Payment FAQ",
    question: "What services are available?",
    answer: "Visitors can book clinic visits, telemedicine, women and aesthetic care, wellness consultations, prescription support, and the listed procedure services.",
  },
];

export const onlineConsultationSteps = [
  "Choose online consultation during booking",
  "Review the 800 peso telemedicine fee, which covers the first consult plus one follow-up, and attach symptoms, concern, photos, or files if needed",
  "Select a preferred schedule",
  "Wait for admin approval and meeting link",
  "Join via Google Meet or Zoom",
  "Receive diagnosis and prescription in the patient portal when released",
];

export const retainedSystemModules = [
  "Public website and doctor creator content",
  "Appointment booking and doctor schedule calendar",
  "Patient portal",
  "Diagnosis, prescriptions, and consultation notes",
  "Doctor dashboard",
  "Admin/staff dashboard",
  "POS and billing",
  "FAQ and inquiry management",
  "Online consultation",
  "Clinic and content reports",
  "Role-based security and activity logs",
];

export const removedReferenceModules = [
  "Reference clinic branding and old landing copy",
  "Old schema assumptions from the previous Supabase project",
  "Single-purpose consultation pricing content as the main public message",
];
