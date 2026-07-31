import { parseAppointmentContext } from "@/src/lib/appointment-context";
import { getClinicToday } from "@/src/lib/timezone";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export type RevenueReport = {
  online: number;
  clinic: number;
  total: number;
};

export type NoShowReport = {
  doctor_id: string;
  doctor_name: string;
  total: number;
  no_shows: number;
  completed: number;
  rate: number;
};

export type PeakHourReport = {
  start_time: string;
  count: number;
};

export type PatientVolumeReport = {
  appointments: number;
  unique_patients: number;
  total_patients: number;
};

export type PaymentMethodBreakdown = {
  method: string;
  transactions: number;
  amount: number;
};

export type PaymentStatusBreakdown = {
  status: string;
  transactions: number;
  amount: number;
};

export type DailyTrendPoint = {
  date: string;
  revenue: number;
  appointments: number;
  patients: number;
};

export type AppointmentTypeBreakdown = {
  type: string;
  count: number;
};

export type AppointmentStatusSummary = {
  total: number;
  completed: number;
  cancelled: number;
};

export type SalesSnapshot = {
  daily: number;
  monthly: number;
  pos_daily: number;
  pos_monthly: number;
};

export type PosReportSummary = {
  invoices: number;
  paid_invoices: number;
  paid_total: number;
  average_ticket: number;
  items_sold: number;
};

export type ContentReportItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  content_type: string;
  views: number;
  appointment_clicks: number;
};

export type WebsiteTrafficPoint = {
  date: string;
  pageviews: number;
  visitors: number;
};

export type RequestedServiceReport = {
  service: string;
  count: number;
};

export type ReportsPayload = {
  revenue: RevenueReport;
  no_show: NoShowReport[];
  peak_hours: PeakHourReport[];
  volume: PatientVolumeReport;
  payment_methods: PaymentMethodBreakdown[];
  payment_statuses: PaymentStatusBreakdown[];
  daily_trends: DailyTrendPoint[];
  appointment_types: AppointmentTypeBreakdown[];
  appointment_summary: AppointmentStatusSummary;
  sales_summary: SalesSnapshot;
  pos_summary: PosReportSummary;
  top_blogs: ContentReportItem[];
  top_videos: ContentReportItem[];
  content_clicks_total: number;
  visitor_traffic: WebsiteTrafficPoint[];
  requested_services: RequestedServiceReport[];
};

type PaymentRow = {
  amount: number | string;
  method: string;
  status: string;
  paid_at: string | null;
  billing_id: string | null;
  appointments?:
    | {
        appointment_type?: string | null;
      }
    | {
        appointment_type?: string | null;
      }[]
    | null;
};

type AppointmentRow = {
  patient_id: string;
  doctor_id: string;
  service_id: string | null;
  appointment_date: string;
  start_time: string;
  status: string;
  appointment_type: string;
  reason: string | null;
  clinic_services?:
    | {
        name?: string | null;
      }
    | {
        name?: string | null;
      }[]
    | null;
  doctors?:
    | {
        profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
      }
    | {
        profiles?: { full_name?: string | null } | { full_name?: string | null }[];
      }[]
    | null;
};

type BillingRow = {
  id: string;
  total: number | string;
  status: string;
  created_at: string;
  issued_at: string | null;
  billing_items?:
    | {
        quantity?: number | string | null;
      }[]
    | null;
};

type ContentRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  content_type: string;
  view_count: number | string;
  appointment_click_count: number | string;
  status: string;
};

type WebsiteAnalyticsRow = {
  event_name: string;
  path: string | null;
  content_post_id: string | null;
  service_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function normalizeDate(value: string) {
  return value.slice(0, 10);
}

function parseAmount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function getAppointmentType(
  value:
    | {
        appointment_type?: string | null;
      }
    | {
        appointment_type?: string | null;
      }[]
    | null
    | undefined,
) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.appointment_type ?? "Clinic";
}

function getDoctorName(value: AppointmentRow["doctors"]) {
  const doctor = Array.isArray(value) ? value[0] : value;
  const profile = Array.isArray(doctor?.profiles) ? doctor?.profiles[0] : doctor?.profiles;
  return profile?.full_name?.trim() || "Unknown doctor";
}

function getServiceName(value: AppointmentRow["clinic_services"], reason: string | null, type: string) {
  const service = Array.isArray(value) ? value[0] : value;
  const fromRelation = service?.name?.trim();
  if (fromRelation) return fromRelation;

  const fromReason = parseAppointmentContext(reason).service.trim();
  if (fromReason) return fromReason;

  return type === "Online" ? "Online Consultation" : "General Consultation";
}

function getMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function isWithinRange(date: string, from?: string, to?: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

async function getPayments(from?: string, to?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("payments")
    .select("amount, method, status, paid_at, billing_id, appointments(appointment_type)")
    .order("paid_at", { ascending: true, nullsFirst: false });

  if (from) query = query.gte("paid_at", `${from}T00:00:00`);
  if (to) query = query.lte("paid_at", `${to}T23:59:59.999`);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as unknown as PaymentRow[];
}

async function getAppointments(from?: string, to?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("appointments")
    .select("patient_id, doctor_id, service_id, appointment_date, start_time, status, appointment_type, reason, clinic_services(name), doctors(profiles(full_name))")
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (from) query = query.gte("appointment_date", from);
  if (to) query = query.lte("appointment_date", to);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as unknown as AppointmentRow[];
}

async function getBillings(from?: string, to?: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("billings")
    .select("id, total, status, created_at, issued_at, billing_items(quantity)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as BillingRow[]).filter((row) =>
    isWithinRange(normalizeDate(row.issued_at ?? row.created_at), from, to),
  );
}

async function getContentRows() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_posts")
    .select("id, title, slug, category, content_type, view_count, appointment_click_count, status")
    .eq("status", "Published")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;

  return (data ?? []) as ContentRow[];
}

async function getWebsiteAnalytics(from?: string, to?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("website_analytics")
    .select("event_name, path, content_post_id, service_id, metadata, created_at")
    .order("created_at", { ascending: true });

  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999`);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as WebsiteAnalyticsRow[];
}

export async function getRevenue(from?: string, to?: string): Promise<RevenueReport> {
  const data = await getPayments(from, to);

  let online = 0;
  let clinic = 0;
  for (const row of data) {
    if (row.status !== "Paid") continue;
    const amount = parseAmount(row.amount);
    const type = getAppointmentType(row.appointments);
    if (type === "Online") online += amount;
    else clinic += amount;
  }

  return { online, clinic, total: online + clinic };
}

export async function getNoShowRates(from?: string, to?: string): Promise<NoShowReport[]> {
  const rows = await getAppointments(from, to);
  const relevant = rows.filter((row) => row.status === "NoShow" || row.status === "Completed");

  const agg = new Map<
    string,
    {
      doctor_name: string;
      total: number;
      no_shows: number;
      completed: number;
    }
  >();

  for (const row of relevant) {
    const current = agg.get(row.doctor_id) ?? {
      doctor_name: getDoctorName(row.doctors),
      total: 0,
      no_shows: 0,
      completed: 0,
    };
    current.total += 1;
    if (row.status === "NoShow") current.no_shows += 1;
    if (row.status === "Completed") current.completed += 1;
    agg.set(row.doctor_id, current);
  }

  return [...agg.entries()]
    .map(([doctor_id, value]) => ({
      doctor_id,
      doctor_name: value.doctor_name,
      total: value.total,
      no_shows: value.no_shows,
      completed: value.completed,
      rate: value.total ? value.no_shows / value.total : 0,
    }))
    .sort((a, b) => b.rate - a.rate || b.no_shows - a.no_shows || a.doctor_name.localeCompare(b.doctor_name));
}

export async function getPeakHours(from?: string, to?: string): Promise<PeakHourReport[]> {
  const rows = await getAppointments(from, to);
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.status === "Cancelled") continue;
    const key = row.start_time.slice(0, 5);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([start_time, count]) => ({ start_time, count }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export async function getPatientVolume(from?: string, to?: string): Promise<PatientVolumeReport> {
  const supabase = getSupabaseAdmin();
  const [{ count: totalPatients, error: patientsError }, appointments] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    getAppointments(from, to),
  ]);

  if (patientsError) throw patientsError;

  const activeAppointments = appointments.filter((row) => row.status !== "Cancelled");
  const uniquePatients = new Set(activeAppointments.map((row) => row.patient_id));

  return {
    appointments: activeAppointments.length,
    unique_patients: uniquePatients.size,
    total_patients: totalPatients ?? 0,
  };
}

export async function getPaymentMethodBreakdown(from?: string, to?: string): Promise<PaymentMethodBreakdown[]> {
  const rows = await getPayments(from, to);
  const agg = new Map<string, PaymentMethodBreakdown>();

  for (const row of rows) {
    if (row.status !== "Paid") continue;
    const current = agg.get(row.method) ?? { method: row.method, transactions: 0, amount: 0 };
    current.transactions += 1;
    current.amount += parseAmount(row.amount);
    agg.set(row.method, current);
  }

  return [...agg.values()].sort((a, b) => b.amount - a.amount);
}

export async function getPaymentStatusBreakdown(from?: string, to?: string): Promise<PaymentStatusBreakdown[]> {
  const rows = await getPayments(from, to);
  const agg = new Map<string, PaymentStatusBreakdown>();

  for (const row of rows) {
    const current = agg.get(row.status) ?? { status: row.status, transactions: 0, amount: 0 };
    current.transactions += 1;
    current.amount += parseAmount(row.amount);
    agg.set(row.status, current);
  }

  return [...agg.values()].sort((a, b) => b.transactions - a.transactions);
}

export async function getDailyTrends(from?: string, to?: string): Promise<DailyTrendPoint[]> {
  const [payments, appointments] = await Promise.all([getPayments(from, to), getAppointments(from, to)]);
  const agg = new Map<string, DailyTrendPoint>();

  for (const row of payments) {
    if (row.status !== "Paid" || !row.paid_at) continue;
    const date = normalizeDate(row.paid_at);
    const current = agg.get(date) ?? { date, revenue: 0, appointments: 0, patients: 0 };
    current.revenue += parseAmount(row.amount);
    agg.set(date, current);
  }

  for (const row of appointments) {
    if (row.status === "Cancelled") continue;
    const date = row.appointment_date;
    const current = agg.get(date) ?? { date, revenue: 0, appointments: 0, patients: 0 };
    current.appointments += 1;
    agg.set(date, current);
  }

  const patientPerDay = new Map<string, Set<string>>();
  for (const row of appointments) {
    if (row.status === "Cancelled") continue;
    const set = patientPerDay.get(row.appointment_date) ?? new Set<string>();
    set.add(row.patient_id);
    patientPerDay.set(row.appointment_date, set);
  }

  for (const [date, patients] of patientPerDay.entries()) {
    const current = agg.get(date) ?? { date, revenue: 0, appointments: 0, patients: 0 };
    current.patients = patients.size;
    agg.set(date, current);
  }

  return [...agg.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAppointmentTypeBreakdown(from?: string, to?: string): Promise<AppointmentTypeBreakdown[]> {
  const rows = await getAppointments(from, to);
  const agg = new Map<string, number>();

  for (const row of rows) {
    if (row.status === "Cancelled") continue;
    agg.set(row.appointment_type, (agg.get(row.appointment_type) ?? 0) + 1);
  }

  return [...agg.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getAppointmentSummary(from?: string, to?: string): Promise<AppointmentStatusSummary> {
  const rows = await getAppointments(from, to);

  return {
    total: rows.length,
    completed: rows.filter((row) => row.status === "Completed").length,
    cancelled: rows.filter((row) => row.status === "Cancelled").length,
  };
}

export async function getSalesSummary(): Promise<SalesSnapshot> {
  const today = getClinicToday();
  const fromMonth = monthStart(today);
  const [dailyRevenue, monthlyRevenue, dailyPayments, monthlyPayments] = await Promise.all([
    getRevenue(today, today),
    getRevenue(fromMonth, today),
    getPayments(today, today),
    getPayments(fromMonth, today),
  ]);

  const posDaily = dailyPayments
    .filter((row) => row.status === "Paid" && row.billing_id)
    .reduce((sum, row) => sum + parseAmount(row.amount), 0);
  const posMonthly = monthlyPayments
    .filter((row) => row.status === "Paid" && row.billing_id)
    .reduce((sum, row) => sum + parseAmount(row.amount), 0);

  return {
    daily: dailyRevenue.total,
    monthly: monthlyRevenue.total,
    pos_daily: posDaily,
    pos_monthly: posMonthly,
  };
}

export async function getPosSummary(from?: string, to?: string): Promise<PosReportSummary> {
  const rows = await getBillings(from, to);
  const paidRows = rows.filter((row) => row.status === "Paid");
  const itemsSold = paidRows.reduce(
    (sum, row) =>
      sum
      + (row.billing_items ?? []).reduce((lineSum, item) => lineSum + parseAmount(item.quantity), 0),
    0,
  );
  const paidTotal = paidRows.reduce((sum, row) => sum + parseAmount(row.total), 0);

  return {
    invoices: rows.length,
    paid_invoices: paidRows.length,
    paid_total: paidTotal,
    average_ticket: paidRows.length ? paidTotal / paidRows.length : 0,
    items_sold: itemsSold,
  };
}

export async function getContentSummary(from?: string, to?: string) {
  const [contentRows, analyticsRows] = await Promise.all([getContentRows(), getWebsiteAnalytics(from, to)]);
  const rows = !from && !to
    ? contentRows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        category: row.category,
        content_type: row.content_type,
        views: parseAmount(row.view_count),
        appointment_clicks: parseAmount(row.appointment_click_count),
      }))
    : contentRows
        .map((row) => {
          const relatedEvents = analyticsRows.filter((event) => event.content_post_id === row.id);
          return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            category: row.category,
            content_type: row.content_type,
            views: relatedEvents.filter((event) => event.event_name === "content_view" || event.event_name === "video_open").length,
            appointment_clicks: relatedEvents.filter((event) => event.event_name === "appointment_click").length,
          };
        })
        .filter((row) => row.views > 0 || row.appointment_clicks > 0);

  const top_blogs = rows
    .filter((row) => row.content_type === "Blog" || row.content_type === "HealthTip")
    .sort((a, b) => b.views - a.views || b.appointment_clicks - a.appointment_clicks || a.title.localeCompare(b.title))
    .slice(0, 5);
  const top_videos = rows
    .filter((row) => row.content_type === "Video" || row.content_type === "Announcement" || row.content_type === "LiveReplay")
    .sort((a, b) => b.views - a.views || b.appointment_clicks - a.appointment_clicks || a.title.localeCompare(b.title))
    .slice(0, 5);

  return {
    top_blogs,
    top_videos,
    content_clicks_total: rows.reduce((sum, row) => sum + row.appointment_clicks, 0),
  };
}

export async function getWebsiteTraffic(from?: string, to?: string): Promise<WebsiteTrafficPoint[]> {
  const rows = await getWebsiteAnalytics(from, to);
  const agg = new Map<string, { pageviews: number; visitors: Set<string> }>();

  for (const row of rows) {
    if (row.event_name !== "page_view") continue;
    const date = normalizeDate(row.created_at);
    const current = agg.get(date) ?? { pageviews: 0, visitors: new Set<string>() };
    current.pageviews += 1;
    const clientId = getMetadataValue(row.metadata, "client_id");
    current.visitors.add(clientId || `anon-${row.created_at}-${current.pageviews}`);
    agg.set(date, current);
  }

  return [...agg.entries()]
    .map(([date, value]) => ({
      date,
      pageviews: value.pageviews,
      visitors: value.visitors.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRequestedServices(from?: string, to?: string): Promise<RequestedServiceReport[]> {
  const rows = await getAppointments(from, to);
  const agg = new Map<string, number>();

  for (const row of rows) {
    if (row.status === "Cancelled") continue;
    const service = getServiceName(row.clinic_services, row.reason, row.appointment_type).trim();
    if (!service) continue;
    agg.set(service, (agg.get(service) ?? 0) + 1);
  }

  return [...agg.entries()]
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count || a.service.localeCompare(b.service))
    .slice(0, 8);
}

export async function getReportsDashboard(from?: string, to?: string): Promise<ReportsPayload> {
  const [
    revenue,
    no_show,
    peak_hours,
    volume,
    payment_methods,
    payment_statuses,
    daily_trends,
    appointment_types,
    appointment_summary,
    sales_summary,
    pos_summary,
    contentSummary,
    visitor_traffic,
    requested_services,
  ] = await Promise.all([
    getRevenue(from, to),
    getNoShowRates(from, to),
    getPeakHours(from, to),
    getPatientVolume(from, to),
    getPaymentMethodBreakdown(from, to),
    getPaymentStatusBreakdown(from, to),
    getDailyTrends(from, to),
    getAppointmentTypeBreakdown(from, to),
    getAppointmentSummary(from, to),
    getSalesSummary(),
    getPosSummary(from, to),
    getContentSummary(from, to),
    getWebsiteTraffic(from, to),
    getRequestedServices(from, to),
  ]);

  return {
    revenue,
    no_show,
    peak_hours,
    volume,
    payment_methods,
    payment_statuses,
    daily_trends,
    appointment_types,
    appointment_summary,
    sales_summary,
    pos_summary,
    top_blogs: contentSummary.top_blogs,
    top_videos: contentSummary.top_videos,
    content_clicks_total: contentSummary.content_clicks_total,
    visitor_traffic,
    requested_services,
  };
}
