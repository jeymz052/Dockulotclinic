import type {
  LandingHeroSlide,
  LandingProgramSlide,
  LandingService,
  LandingTestimonial,
} from "@/src/lib/db/types";

export const DEFAULT_RX_HERO_SLIDES: LandingHeroSlide[] = [
  {
    key: "glowrx",
    image: "/images/glowrx bg.png",
    title: "GlowRx by Doc Kulot",
    subtitle: "Medical Weight Loss & Aesthetic Wellness",
  },
  {
    key: "hormonerx",
    image: "/images/hormonerx bg.png",
    title: "HormoneRx by Doc Kulot",
    subtitle: "PCOS, Hormonal Acne & Women's Hormonal Health",
  },
  {
    key: "heartrx",
    image: "/images/heartrx bg.png",
    title: "HeartRx by Doc Kulot",
    subtitle: "Hypertension, Cholesterol & Cardiovascular Wellness",
  },
  {
    key: "metabolicrx",
    image: "/images/metabolicrx bg.png",
    title: "MetabolicRx by Doc Kulot",
    subtitle: "Diabetes, Prediabetes & Fatty Liver Care",
  },
  {
    key: "preventrx",
    image: "/images/preventrx bg.png",
    title: "PreventRx by Doc Kulot",
    subtitle: "Executive Check-ups & Preventive Health",
  },
];

export const DEFAULT_PROGRAM_SLIDES: LandingProgramSlide[] = [
  {
    key: "glowrx",
    name: "GlowRx by Doc Kulot",
    description:
      "GlowRx by Doc Kulot is a comprehensive, evidence-based program that focuses on sustainable weight management while improving your overall health, confidence, and quality of life. Every plan is personalized and supervised throughout the journey. Glow beyond the scale. Because true beauty starts with better health.",
    ctaLabel: "Book a consultation",
  },
  {
    key: "hormonerx",
    name: "HormoneRx by Doc Kulot",
    description:
      "HormoneRx by Doc Kulot is a personalized, evidence-based program designed for women experiencing hormonal imbalances such as PCOS, hormonal acne, irregular periods, insulin resistance, and other hormone-related concerns. Our goal is to treat the root cause, not just the symptoms, through compassionate, holistic, and medically supervised care.",
    ctaLabel: "Book a consultation",
  },
  {
    key: "heartrx",
    name: "HeartRx by Doc Kulot",
    description:
      "HeartRx by Doc Kulot is to help prevent, detect, and manage cardiovascular diseases through personalized medical care, lifestyle medicine, and long-term follow-up. Whether you're living with hypertension, high cholesterol, diabetes, or simply want to reduce your cardiovascular risk, HeartRx focuses on keeping your heart healthy for life.",
    ctaLabel: "Book a consultation",
  },
  {
    key: "metabolicrx",
    name: "MetabolicRx by Doc Kulot",
    description:
      "MetabolicRx by Doc Kulot is designed to help individuals prevent, manage, and reverse metabolic diseases through personalized medical care, lifestyle medicine, and continuous physician support. Whether you have prediabetes, diabetes, fatty liver disease, obesity, or metabolic syndrome, our goal is to optimize your health and reduce your risk of long-term complications.",
    ctaLabel: "Book a consultation",
  },
  {
    key: "preventrx",
    name: "PreventRx by Doc Kulot",
    description:
      "PreventRx by Doc Kulot is a preventive care program focused on keeping you healthy before illness develops. Through regular health screenings, vaccinations, lifestyle medicine, and personalized risk assessments, we help you detect diseases early, reduce future health risks, and build a healthier future.",
    ctaLabel: "Book a consultation",
  },
];

export const DEFAULT_LANDING_SERVICES: LandingService[] = [
  {
    kind: "Clinic",
    title: "General Consultation",
    description:
      "Clinic-based assessment for common health concerns, follow-ups, and primary care. First clinic consult is 600 pesos; follow-up clinic consult is 300 pesos.",
    bullets: [
      { title: "Assessment", body: "Clinic-based assessment for common symptoms and concerns" },
      { title: "Follow-up", body: "Follow-up visits for ongoing treatment or recovery" },
      { title: "Primary care", body: "Primary care support and next-step planning" },
    ],
  },
  {
    kind: "Featured",
    title: "Telemedicine Services",
    description:
      "Weight loss management, PCOS management, chronic disease review, lab interpretation, and prescription refill. The 800 peso virtual consult includes the first consult plus one follow-up.",
    bullets: [
      { title: "Weight loss management", body: "Weight loss management with structured follow-up" },
      { title: "PCOS management", body: "PCOS support and hormonal symptom review" },
      { title: "Chronic disease review", body: "Chronic disease monitoring and maintenance consults" },
      { title: "Laboratory interpretation", body: "Laboratory results interpretation and next-step planning" },
      { title: "Prescription refill", body: "Prescription refill review for eligible cases" },
    ],
  },
  {
    kind: "Women's health",
    title: "Women's Health and Aesthetic Care",
    description:
      "PCOS, acne, hormonal acne, weight loss support, and aesthetic medicine consults.",
    bullets: [
      { title: "PCOS", body: "PCOS consultation and symptom support" },
      { title: "Hormonal acne", body: "Acne and hormonal acne assessment" },
      { title: "Weight loss support", body: "Weight loss support connected to women's health goals" },
    ],
  },
  {
    kind: "Support",
    title: "Documentation and Refill Support",
    description:
      "Laboratory interpretation, prescription refill, medical certificate requests, flu vaccination, and wellness follow-up.",
    bullets: [
      { title: "Lab review", body: "Laboratory results interpretation and next-step planning" },
      { title: "Refills", body: "Prescription refill review for eligible cases" },
      { title: "Certificates", body: "Medical certificate requests after appropriate clinical assessment" },
    ],
  },
];

export const DEFAULT_TESTIMONIALS: LandingTestimonial[] = [
  {
    name: "GlowRx Patient",
    title: "Medical weight loss program",
    quote:
      "The plan felt realistic from the start. I had structure, regular follow-up, and clear medical guidance that helped me stay consistent and more confident in my progress.",
  },
  {
    name: "HormoneRx Patient",
    title: "PCOS and hormonal health care",
    quote:
      "I finally felt listened to. My concerns were explained clearly, my treatment plan felt personalized, and I could actually understand the next steps for my hormone health.",
  },
  {
    name: "HeartRx Patient",
    title: "Cardiovascular wellness support",
    quote:
      "The consultations helped me take my blood pressure and overall heart health seriously without feeling overwhelmed. Everything was practical, encouraging, and easy to follow.",
  },
  {
    name: "PreventRx Patient",
    title: "Executive check-up program",
    quote:
      "The preventive approach gave me peace of mind. Screenings, risk review, and lifestyle advice all came together in a way that felt proactive and reassuring.",
  },
  {
    name: "MetabolicRx Patient",
    title: "Metabolic health care",
    quote:
      "I appreciated how the guidance connected my lab results, nutrition habits, and long-term health goals. It felt like a complete plan instead of quick advice.",
  },
  {
    name: "Clinic Patient",
    title: "General consultation experience",
    quote:
      "From booking to follow-up, the experience was smooth and professional. I felt respected, informed, and comfortable asking questions throughout the consultation.",
  },
];

export const DEFAULT_FOOTER_HOURS = [
  "FamMed Family Clinic: Monday to Friday, 9:00 AM - 4:00 PM",
  "RT Lim Family Hospital: 1st and 3rd Sundays, 9:00 AM - 4:00 PM",
];
