import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/src/components/layout/RoleProvider";

export const metadata: Metadata = {
  title: "Doc Kulot Clinic",
  description: "Clinic, patient portal, online consultation, POS, inventory, and doctor creator platform",
  icons: {
    icon: "/images/favicondockulot.png",
    apple: "/images/favicondockulot.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
