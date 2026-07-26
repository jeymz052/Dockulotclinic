import type { PublicContentPost } from "@/src/lib/services/content-posts";

const now = new Date().toISOString();

export const samplePosts: PublicContentPost[] = [
  {
    id: "sample-post-1",
    title: "Everyday Warning Signs Your Body Should Not Ignore",
    slug: "warning-signs-your-body-should-not-ignore",
    content_type: "Blog",
    category: "Medical Awareness",
    excerpt:
      "Persistent fatigue, sudden weight change, chest discomfort, recurring headaches, and unusual bleeding can all be clues that deserve a timely medical check.",
    body: null,
    blocks: [
      {
        type: "paragraph",
        text: "Many health problems begin with symptoms that seem minor at first. People often wait because the discomfort comes and goes, but some patterns are worth checking sooner rather than later.",
      },
      {
        type: "h2",
        text: "Symptoms that deserve attention",
      },
      {
        type: "ul",
        items: [
          "Chest pain, pressure, or shortness of breath",
          "Severe or frequent headaches",
          "Unexpected weight loss or weight gain",
          "Bleeding that is unusual for you",
          "Persistent fever, fatigue, or weakness",
        ],
      },
      {
        type: "paragraph",
        text: "A warning sign does not always mean a serious illness, but patterns that are new, worsening, or persistent should be assessed so problems are found early.",
      },
      {
        type: "cta",
        buttonText: "Book a medical checkup",
        buttonLink: "/#booking",
      },
    ],
    embed_url: null,
    thumbnail_url: "/images/dockulotbgs.png",
    is_featured: true,
    status: "Published",
    published_at: now,
    created_at: now,
    updated_at: now,
  },
  {
    id: "sample-post-2",
    title: "When a Persistent Cough Needs a Clinic Visit",
    slug: "persistent-cough-needs-clinic-visit",
    content_type: "Blog",
    category: "Patient Education",
    excerpt:
      "A cough that lasts for weeks, interrupts sleep, produces blood, or comes with fever and breathing difficulty should not be brushed aside.",
    body: null,
    blocks: [
      {
        type: "paragraph",
        text: "Coughs are common, especially after viral infections, but the duration and associated symptoms matter. Some cases improve with rest while others need evaluation for asthma, infection, reflux, or other causes.",
      },
      {
        type: "h2",
        text: "Seek medical advice if you notice",
      },
      {
        type: "ol",
        items: [
          "A cough lasting more than two to three weeks",
          "Fever, wheezing, or shortness of breath",
          "Chest pain or blood in mucus",
          "Weight loss or extreme tiredness",
        ],
      },
      {
        type: "blockquote",
        text: "Pay attention when a cough changes your daily routine, sleep, or breathing comfort.",
      },
    ],
    embed_url: null,
    thumbnail_url: "/images/dockulotslogonobg.png",
    is_featured: false,
    status: "Published",
    published_at: now,
    created_at: now,
    updated_at: now,
  },
  {
    id: "sample-post-3",
    title: "Simple Habits That Support Better Blood Pressure Control",
    slug: "simple-habits-better-blood-pressure-control",
    content_type: "Blog",
    category: "Lifestyle & Wellness",
    excerpt:
      "Blood pressure care is more sustainable when daily routines support it: medication adherence, salt awareness, sleep, movement, and regular monitoring all play a role.",
    body: null,
    blocks: [
      {
        type: "paragraph",
        text: "Managing blood pressure is rarely about one big change. Small habits done consistently often make the biggest difference.",
      },
      {
        type: "h2",
        text: "Helpful daily practices",
      },
      {
        type: "ul",
        items: [
          "Take medicines exactly as prescribed",
          "Keep a simple home blood pressure record",
          "Reduce highly salty processed foods",
          "Stay active in realistic, repeatable ways",
          "Protect your sleep and stress recovery time",
        ],
      },
      {
        type: "faq",
        question: "Do I need home monitoring?",
        answer:
          "Home readings can help your clinician understand patterns between visits and adjust treatment more accurately.",
      },
    ],
    embed_url: null,
    thumbnail_url: "/images/dockulotslogonobg.png",
    is_featured: false,
    status: "Published",
    published_at: now,
    created_at: now,
    updated_at: now,
  },
];
