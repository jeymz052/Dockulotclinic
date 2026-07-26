import Link from "next/link";
import { clinicServices } from "@/src/lib/healthcare-content";

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-yellow-50/60 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-700">Clinic Services</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">Available services</h1>
        <p className="mt-4 max-w-3xl leading-8 text-slate-600">
          Patients can review services before booking. These services also become the source list for appointment type,
          POS billing, and reports in the fresh schema.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {clinicServices.map((service) => (
            <article key={service.title} className="rounded-2xl border border-yellow-100 bg-white p-6 shadow-sm">
              <service.icon className="text-2xl text-amber-400" />
              <h2 className="mt-4 text-lg font-bold text-black">{service.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
            </article>
          ))}
        </div>
        <Link href="/#booking" className="mt-10 inline-flex rounded-full bg-yellow-400 px-6 py-3 text-sm font-bold text-white">
          Book a service
        </Link>
      </div>
    </main>
  );
}
