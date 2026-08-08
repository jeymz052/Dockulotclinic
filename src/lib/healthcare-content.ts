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
  priceLabel?: string;
  bookingNote?: string;
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
  image?: string;
  summary: string;
  bullets: string[];
  expectations?: string[];
  care?: string[];
  dos?: string[];
  donts?: string[];
  followUp?: string;
  alert?: string;
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
    description: "Clinic-based assessment for common health concerns, follow-ups, and primary care. First clinic consult is 600 pesos; follow-up clinic consult is 300 pesos.",
    icon: FaStethoscope,
    modes: ["Clinic"],
    priceLabel: "600 first consult / 300 follow-up",
  },
  {
    title: "Telemedicine Services",
    description: "Weight loss management, PCOS management, chronic disease review, lab interpretation, and prescription refill. The 800 peso online consult includes the first consult plus one follow-up.",
    icon: FaLaptopMedical,
    modes: ["Online"],
    priceLabel: "800 online consult",
  },
  {
    title: "Women's Health and Aesthetic Care",
    description: "PCOS, acne, hormonal acne, weight loss support, and aesthetic medicine consults.",
    icon: FaCalendarCheck,
    modes: ["Clinic", "Online"],
  },
  {
    title: "Procedure Consultation",
    description: "Consult first for Botox, Mesolipo, fillers, sclerotherapy, wart removal, mole surgery, or other procedure concerns before reserving an actual procedure schedule.",
    icon: FaUserDoctor,
    modes: ["Clinic", "Online"],
    priceLabel: "Consultation fee applies",
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
    description: "Appointment-only aesthetic procedure. Final total depends on the treated area and number of units.",
    icon: FaHeartPulse,
    modes: ["Clinic"],
    appointmentOnly: true,
    priceLabel: "200 per unit",
    bookingNote: "Procedure booking requires a 1,000 peso reservation fee deductible from the final bill.",
  },
  {
    title: "Mesolipo",
    description: "Appointment-only procedure for targeted aesthetic body contour support. Final total depends on the area of concern.",
    icon: FaUserDoctor,
    modes: ["Clinic"],
    appointmentOnly: true,
    priceLabel: "Starts at 4,900",
    bookingNote: "Procedure booking requires a 1,000 peso reservation fee deductible from the final bill.",
  },
  {
    title: "Fillers",
    description: "Appointment-only facial enhancement procedure. Final total depends on the area of concern and treatment plan.",
    icon: FaUserDoctor,
    modes: ["Clinic"],
    appointmentOnly: true,
    priceLabel: "Starts at 4,999",
    bookingNote: "Procedure booking requires a 1,000 peso reservation fee deductible from the final bill.",
  },
  {
    title: "Wart Removal / Skin Tag Removal",
    description: "Appointment-only cautery or removal procedure with consent requirement. Final total depends on number, size, and area.",
    icon: FaCertificate,
    modes: ["Clinic"],
    appointmentOnly: true,
    priceLabel: "Starts at 2,999",
    bookingNote: "Procedure booking requires a 1,000 peso reservation fee deductible from the final bill.",
  },
  {
    title: "Mole Surgery",
    description: "Appointment-only minor procedure for mole assessment and removal planning. Final total depends on the area and clinical assessment.",
    icon: FaFlaskVial,
    modes: ["Clinic"],
    appointmentOnly: true,
    priceLabel: "Starts at 6,999",
    bookingNote: "Procedure booking requires a 1,000 peso reservation fee deductible from the final bill.",
  },
  {
    title: "Sclerotherapy",
    description: "Appointment-only treatment for selected vein concerns. Final total depends on the treated area.",
    icon: FaHeartPulse,
    modes: ["Clinic"],
    appointmentOnly: true,
    priceLabel: "Starts at 5,999",
    bookingNote: "Procedure booking requires a 1,000 peso reservation fee deductible from the final bill.",
  },
  {
    title: "GLP Initiation",
    description: "Appointment-only weight loss treatment start with proper review and aftercare. Book consultation first so the doctor can assess if this is appropriate.",
    icon: FaPrescriptionBottleMedical,
    modes: ["Clinic"],
    appointmentOnly: true,
    priceLabel: "Consultation required",
    bookingNote: "Procedure booking requires a 1,000 peso reservation fee deductible from the final bill when a procedure schedule is confirmed.",
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
    title: "GlowRx weight-management progress 1",
    program: "GlowRx",
    beforeImage: "/images/weightloss before1.png",
    afterImage: "/images/weightloss after1.png",
    caption: "A steady change with medical guidance, follow-up, and consistency.",
  },
  {
    title: "GlowRx weight-management progress 2",
    program: "GlowRx",
    beforeImage: "/images/weightloss before2.png",
    afterImage: "/images/weightloss after2.png",
    caption: "A cleaner silhouette after a structured and supervised program.",
  },
  {
    title: "GlowRx weight-management progress 3",
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
  {
    title: "Mesolipo double-chin contouring result",
    program: "Aesthetic Medicine",
    image: "/images/double chin before and after.jpg",
    caption: "Double-chin contouring result from an appointment-only aesthetic procedure.",
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
    expectations: ["Mild nausea, bloating, gas, headache, or reduced appetite may occur when starting treatment."],
    dos: ["Stay hydrated, eat balanced meals, and follow the prescribed dosing plan.", "Keep your scheduled follow-up so the clinician can review your response."],
    donts: ["Do not change your dose, self-medicate, or use alcohol excessively without clinical advice."],
    alert: "Contact the clinic for persistent vomiting, severe abdominal pain, dehydration, or other concerning symptoms.",
  },
  {
    title: "Post Botox Aftercare",
    image: "/images/post botox aftercare.jpg",
    summary: "Keep the treated areas calm so Botox can settle as intended.",
    bullets: [
      "Keep your head upright for 4 to 6 hours.",
      "Use a gentle cleanser, moisturiser, and SPF 30+; avoid AHA, BHA, retinol, and vitamin C for 24 to 48 hours.",
      "Do not lie down, take naps, massage the area, exercise intensely, drink alcohol, or use saunas and hot showers for 24 hours.",
      "Results begin in 3 to 7 days, with the full effect around 10 to 14 days.",
    ],
    expectations: [
      "Results begin in 3 to 7 days; the full effect is usually seen in 10 to 14 days.",
      "Mild redness, swelling, or tiny bumps may occur but usually settle within a few hours.",
      "You can return to your normal routine right away.",
      "Results may last 3 to 6 months, depending on your body.",
    ],
    care: [
      "Use a gentle cleanser and lukewarm water.",
      "Keep skin hydrated with a good moisturiser.",
      "Wear sunscreen with SPF 30 or higher.",
      "Avoid AHA, BHA, retinol, and vitamin C for 24 to 48 hours.",
    ],
    dos: [
      "Keep your head upright for 4 to 6 hours.",
      "Stay relaxed and avoid touching or massaging treated areas.",
      "Drink plenty of water.",
      "Follow any specific instructions given by your doctor.",
    ],
    donts: [
      "Do not lie down or take naps for 4 to 6 hours.",
      "Avoid intense exercise, heavy lifting, or strenuous activities for 24 hours.",
      "Do not massage, rub, or apply pressure to treated areas for 24 hours.",
      "Avoid saunas, steam rooms, hot showers, and excessive heat for 24 to 48 hours.",
      "Avoid alcohol and blood thinners, such as aspirin or omega-3, for 24 hours unless advised otherwise.",
    ],
    followUp: "A follow-up may be recommended in 2 weeks to assess your results and make any necessary adjustments.",
    alert: "If you experience anything unusual or have concerns, please contact the clinic right away.",
  },
  {
    title: "Post Mesolipo Aftercare",
    summary: "Support healing of the treated contour area and follow the clinician's plan for compression and review.",
    bullets: [
      "Expect temporary swelling, bruising, tenderness, firmness, or numbness in the treated area.",
      "Wear any compression garment exactly as directed and keep follow-up appointments.",
      "Avoid strenuous exercise, alcohol, heat exposure, and massage of the area until your clinician clears you.",
      "Contact the clinic promptly for worsening pain, spreading redness, fever, drainage, or other unusual symptoms.",
    ],
    expectations: ["Temporary swelling, bruising, tenderness, firmness, or numbness in the treated area can occur."],
    dos: ["Wear any compression garment exactly as directed.", "Keep follow-up appointments and contact the clinic for worsening symptoms."],
    donts: ["Avoid strenuous exercise, alcohol, heat exposure, and massage of the area until your clinician clears you."],
  },
  {
    title: "Post Dermal Filler Aftercare",
    summary: "Protect the treated area while swelling settles and the filler integrates.",
    bullets: [
      "Mild swelling, tenderness, bruising, and unevenness can occur initially; use a cool compress only if advised.",
      "Avoid pressure or massage on the treated area unless your clinician specifically instructs you to do so.",
      "Avoid strenuous exercise, alcohol, intense heat, and facial treatments for 24 to 48 hours.",
      "Seek urgent care for severe or increasing pain, skin blanching or mottling, vision changes, or unusual discoloration.",
    ],
    expectations: ["Mild swelling, tenderness, bruising, and unevenness can occur while the filler settles."],
    dos: ["Use a cool compress only if advised and follow all clinician instructions."],
    donts: ["Avoid pressure or massage, strenuous exercise, alcohol, intense heat, and facial treatments for 24 to 48 hours."],
    alert: "Seek urgent care for severe or increasing pain, skin blanching or mottling, vision changes, or unusual discoloration.",
  },
  {
    title: "Post Sclerotherapy Aftercare",
    image: "/images/post sclerotherapy afrercare.jpg",
    summary: "Compression, walking, and gentle care help reduce bruising and support healing.",
    bullets: [
      "Wear compression stockings as directed, commonly continuously for 24 to 48 hours and then during the day as advised.",
      "Walk for 15 to 30 minutes daily, stay hydrated, keep the area clean and dry, and elevate your legs when resting.",
      "Avoid intense exercise for 3 to 7 days, hot baths/saunas for one week, long flights or prolonged sitting for 7 to 10 days, high heels, and sun exposure.",
      "Seek medical attention for severe pain, swelling, redness, warmth, shortness of breath, or other unusual symptoms.",
    ],
    expectations: [
      "Mild redness, warmth, itchiness, or bruising can occur and is normal.",
      "Bruising or brown marks may develop and fade in 7 to 14 days.",
      "Treated veins may feel firm or tender for a few days.",
      "Improvement is gradual; multiple sessions may be needed for the best result.",
    ],
    care: [
      "Wear compression stockings as directed—usually continuously for 24 to 48 hours, then during the day for several days to weeks.",
      "Keep the treated area clean and dry; showering is fine, but avoid very hot water.",
      "Moisturise dry skin gently and use SPF 30 or higher on treated areas.",
      "Elevate your legs when resting to help reduce swelling.",
    ],
    dos: [
      "Walk regularly for 15 to 30 minutes a day to promote circulation.",
      "Wear compression stockings as instructed.",
      "Stay well hydrated.",
      "Continue normal daily activities, but take it easy.",
      "Follow your doctor's specific instructions.",
    ],
    donts: [
      "Avoid intense exercise, heavy lifting, or strenuous activities for 3 to 7 days.",
      "Avoid hot baths, saunas, steam rooms, and hot tubs for 1 week.",
      "Avoid long flights or prolonged sitting for 7 to 10 days if possible.",
      "Avoid high heels for several days if they cause discomfort.",
      "Avoid direct sun exposure on treated areas until bruising has faded.",
    ],
    followUp: "A follow-up may be recommended in 2 to 6 weeks to assess your progress and plan the next session if needed.",
    alert: "Seek medical attention for severe pain, swelling, redness, warmth, shortness of breath, or any unusual symptoms.",
  },
  {
    title: "Post Wart Cautery Aftercare",
    image: "/images/post warts cuttery removal aftercare.jpg",
    summary: "Gentle cleaning and protection help the cauterised area heal safely.",
    bullets: [
      "Keep the area dry for the first 24 hours, then gently clean with mild soap and water once or twice a day.",
      "Use prescribed ointment and medications as directed; never pick, scratch, or peel the scab.",
      "Avoid soaking for 3 to 5 days, intense activity that causes rubbing or sweating for 2 to 3 days, and alcohol, iodine, peroxide, or harsh products unless advised.",
      "Use SPF 30+ once healed and contact the clinic for increased pain, pus, redness, fever, or other concerns.",
    ],
    expectations: [
      "Mild redness, swelling, or tenderness in the treated area can last 2 to 3 days.",
      "A scab will form within 1 to 2 days and usually falls off naturally in 7 to 14 days.",
      "The skin may look pink for a while as it heals.",
      "Complete healing usually takes 2 to 4 weeks.",
    ],
    care: [
      "Keep the area clean and dry; gently clean with mild soap and water once or twice daily.",
      "Apply prescribed ointment as directed.",
      "Do not pick, scratch, or peel the scab—let it fall off naturally.",
      "Cover with a clean bandage if needed, especially where there is friction.",
      "Use SPF 30 or higher once healed.",
    ],
    dos: [
      "Keep the area dry for the first 24 hours.",
      "Take prescribed medications as directed.",
      "Wear loose clothing if the area is prone to rubbing.",
      "Maintain good hygiene, eat a healthy diet, and stay hydrated.",
      "Monitor for signs of infection.",
    ],
    donts: [
      "Do not pick or scratch the scab.",
      "Do not soak the area in swimming pools, baths, or while swimming for 3 to 5 days.",
      "Avoid intense exercise or activities that cause heavy sweating or friction for 2 to 3 days.",
      "Do not apply alcohol, iodine, hydrogen peroxide, or harsh products unless advised.",
      "Avoid direct sun exposure, makeup, and irritating products until fully healed.",
    ],
    followUp: "A follow-up may be recommended in 1 to 2 weeks to check healing and ensure the wart is fully removed.",
    alert: "For increased pain, pus, redness, fever, or any concerns, please contact the clinic.",
  },
  {
    title: "Post Mole Surgery Aftercare",
    summary: "Care for the incision as directed to reduce infection risk and support scar healing.",
    bullets: [
      "Keep the wound clean and dry for the time specified by your clinician; use the prescribed dressing and ointment only.",
      "Do not pull at stitches, pick scabs, soak the wound, or expose it to friction until cleared.",
      "Limit activity that stretches the surgical site and return for scheduled wound checks or stitch removal.",
      "Contact the clinic promptly for worsening redness, swelling, bleeding, pus, fever, wound opening, or severe pain.",
    ],
    dos: ["Use only the prescribed dressing and ointment, and return for scheduled wound checks or stitch removal."],
    donts: ["Do not pull stitches, pick scabs, soak the wound, or expose it to friction until cleared."],
    alert: "Contact the clinic promptly for worsening redness, swelling, bleeding, pus, fever, wound opening, or severe pain.",
  },
];

export function resolveAftercareGuideForService(serviceTitle: string) {
  const normalized = serviceTitle.toLowerCase();
  if (normalized.includes("glp")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("glp")) ?? null;
  }
  if (normalized.includes("botox")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("botox")) ?? null;
  }
  if (normalized.includes("mesolipo") || normalized.includes("mesotherapy")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("mesolipo")) ?? null;
  }
  if (normalized.includes("filler")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("filler")) ?? null;
  }
  if (normalized.includes("sclerotherapy")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("sclerotherapy")) ?? null;
  }
  if (normalized.includes("wart") || normalized.includes("cautery") || normalized.includes("skin tag")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("wart")) ?? null;
  }
  if (normalized.includes("mole")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("mole")) ?? null;
  }
  return null;
}

export const consentGuide: ConsentGuide = {
  title: "Patient Consent Form",
  image: "/images/patient consent.jpg",
  summary: "Procedure patients must complete and sign the consent form before treatment.",
  bullets: [
    "The procedure, risks, benefits, and alternatives are explained first.",
    "The patient, witness, and physician signatures are required.",
    "Consent is mandatory for Botox, fillers, Mesolipo, sclerotherapy, GLP initiation, wart or skin tag removal, mole surgery, and cautery procedures.",
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
