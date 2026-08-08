import type { Metadata } from "next";
import BookAppointmentPage from "@/src/components/appointments/BookAppointmentPage";

export const metadata: Metadata = {
  title: "Book an Appointment",
  description:
    "Book a Doc Kulot clinic appointment or online consultation by choosing a service, date, time, and patient details.",
  alternates: {
    canonical: "/booking",
  },
};

export default function BookingPage() {
  return (
    <main className="min-h-screen bg-yellow-50/60 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-700">Appointment Booking</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">Book an appointment</h1>
        <p className="mt-4 max-w-3xl leading-8 text-slate-600">
          Select clinic or online consultation, service, date, and time. Admin or staff can confirm the appointment from
          the dashboard.
        </p>
        <div className="mt-10 overflow-hidden rounded-3xl border border-yellow-100 bg-white p-3 shadow-xl">
          <BookAppointmentPage />
        </div>
      </div>
    </main>
  );
}
