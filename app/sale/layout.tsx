import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "11.11 Sale — Doc Kulot",
  description:
    "11% OFF all medical procedures! Buy Nov 11–14, 2026. Schedule Mon–Fri until Nov 30. Botox, Fillers, Mesolipo, GlowRx, and more.",
  alternates: {
    canonical: "/sale",
  },
};

export default function SaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

