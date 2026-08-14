"use client";

import Link from "next/link";
import type { IconType } from "react-icons";
import {
  FaArrowPointer,
  FaCalendarCheck,
  FaCalendarDay,
  FaCalendarXmark,
  FaChartLine,
  FaEye,
  FaFileExcel,
  FaFileInvoiceDollar,
  FaFilePdf,
  FaHospitalUser,
  FaMoneyBillTrendUp,
  FaPlay,
  FaStethoscope,
  FaUsers,
} from "react-icons/fa6";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRole } from "@/src/components/layout/RoleProvider";

type RevenueReport = { total: number };
type VolumeReport = { total_patients: number };
type AppointmentStatusSummary = { total: number; completed: number; cancelled: number };
type SalesSnapshot = { daily: number; monthly: number; pos_daily: number; pos_monthly: number };
type PosSummary = { invoices: number; paid_invoices: number; paid_total: number; average_ticket: number; items_sold: number };
type ContentReportItem = {
  id: string;
  title: string;
  views: number;
  appointment_clicks: number;
};
type DailyTrendPoint = { date: string; revenue: number; appointments: number; patients: number };
type WebsiteTrafficPoint = { date: string; pageviews: number; visitors: number };
type RequestedServiceReport = { service: string; count: number };
type KpiItem = {
  label: string;
  value: string;
  hint: string;
  accent: (typeof KPI_ACCENTS)[number];
  icon: IconType;
};

type ReportsPayload = {
  revenue: RevenueReport;
  volume: VolumeReport;
  appointment_summary: AppointmentStatusSummary;
  sales_summary: SalesSnapshot;
  pos_summary: PosSummary;
  daily_trends: DailyTrendPoint[];
  top_blogs: ContentReportItem[];
  top_videos: ContentReportItem[];
  content_clicks_total: number;
  visitor_traffic: WebsiteTrafficPoint[];
  requested_services: RequestedServiceReport[];
};

const KPI_ACCENTS = [
  "border-black bg-black text-white",
  "border-neutral-200 bg-white text-black",
  "border-neutral-200 bg-neutral-50 text-black",
  "border-neutral-200 bg-white text-black",
  "border-black bg-black text-white",
  "border-neutral-200 bg-white text-black",
  "border-neutral-200 bg-neutral-50 text-black",
  "border-neutral-200 bg-white text-black",
] as const;

const BAR_COLORS = ["#111111", "#525252", "#a3a3a3", "#d4d4d4", "#737373", "#262626"];

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMoneyCompact(n: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function numberFromChartValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cell(value: string | number, styleId?: string) {
  const isNumber = typeof value === "number";
  const type = isNumber ? "Number" : "String";
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Cell${style}><Data ss:Type="${type}">${isNumber ? value : xmlEscape(value)}</Data></Cell>`;
}

function isHeaderRow(row: Array<string | number>) {
  if (!row.length) return false;
  const normalized = row.map(String);
  return (
    normalized.includes("Metric")
    || normalized.includes("Date")
    || normalized.includes("Service")
    || normalized.includes("Title")
    || normalized.includes("Most Requested Services")
    || normalized.includes("Most Viewed Blogs")
    || normalized.includes("Most Viewed Videos")
  );
}

function worksheet(name: string, rows: Array<Array<string | number>>) {
  const body = rows
    .map((row, rowIndex) => {
      const styleId = rowIndex === 0 && row.length === 1 ? "Title" : isHeaderRow(row) ? "Header" : row.length ? "Body" : undefined;
      return `<Row>${row.map((value) => cell(value, styleId)).join("")}</Row>`;
    })
    .join("");
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>
<Column ss:AutoFitWidth="1" ss:Width="190"/>
<Column ss:AutoFitWidth="1" ss:Width="130"/>
<Column ss:AutoFitWidth="1" ss:Width="120"/>
<Column ss:AutoFitWidth="1" ss:Width="120"/>
${body}</Table></Worksheet>`;
}

function buildWorkbook(data: ReportsPayload, from: string, to: string) {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<Styles>
  <Style ss:ID="Title">
    <Font ss:Bold="1" ss:Size="14" ss:Color="#111111"/>
    <Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/>
    <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D4"/></Borders>
  </Style>
  <Style ss:ID="Header">
    <Font ss:Bold="1" ss:Color="#FFFFFF"/>
    <Interior ss:Color="#111111" ss:Pattern="Solid"/>
    <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111111"/></Borders>
  </Style>
  <Style ss:ID="Body">
    <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/></Borders>
  </Style>
</Styles>
${worksheet("Clinic Summary", [
  ["Reports and Analytics"],
  ["Date From", from],
  ["Date To", to],
  [],
  ["Metric", "Value"],
  ["Total Appointments", data.appointment_summary.total],
  ["Completed Appointments", data.appointment_summary.completed],
  ["Cancelled Appointments", data.appointment_summary.cancelled],
  ["Patient Count", data.volume.total_patients],
  ["Daily Sales", data.sales_summary.daily],
  ["Monthly Sales", data.sales_summary.monthly],
  ["POS Collections", data.pos_summary.paid_total],
  ["POS Invoices", data.pos_summary.invoices],
])}
${worksheet("Sales Trend", [
  ["Date", "Revenue", "Appointments", "Patients"],
  ...data.daily_trends.map((row) => [row.date, row.revenue, row.appointments, row.patients]),
])}
${worksheet("Content Summary", [
  ["Metric", "Value"],
  ["Appointment Clicks From Content", data.content_clicks_total],
  [],
  ["Most Requested Services", "Count"],
  ...data.requested_services.map((row) => [row.service, row.count]),
  [],
  ["Most Viewed Blogs", "Views"],
  ...data.top_blogs.map((row) => [row.title, row.views]),
  [],
  ["Most Viewed Videos", "Views"],
  ...data.top_videos.map((row) => [row.title, row.views]),
])}
${worksheet("Website Traffic", [
  ["Date", "Visitors", "Pageviews"],
  ...data.visitor_traffic.map((row) => [row.date, row.visitors, row.pageviews]),
])}
</Workbook>`;
}

function downloadWorkbook(data: ReportsPayload, from: string, to: string) {
  const workbook = buildWorkbook(data, from, to);
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reports-analytics-${from}-to-${to}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatMoneyPdf(value: number) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizePdfText(value: string | number) {
  return String(value)
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string | number) {
  return normalizePdfText(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function fitPdfCell(value: string | number, width: number) {
  const text = normalizePdfText(value);
  if (text.length <= width) return text.padEnd(width, " ");
  return `${text.slice(0, Math.max(width - 1, 0))}.`;
}

function pdfTableRow(values: Array<string | number>, widths: number[]) {
  return values.map((value, index) => fitPdfCell(value, widths[index] ?? 16)).join(" | ");
}

function pdfRule(widths: number[]) {
  return widths.map((width) => "-".repeat(width)).join("-+-");
}

function appendPdfTable(
  lines: string[],
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  widths: number[],
) {
  lines.push("", title, pdfRule(widths), pdfTableRow(headers, widths), pdfRule(widths));
  if (!rows.length) {
    lines.push(pdfTableRow(["No data", "", "", ""].slice(0, headers.length), widths));
    return;
  }

  for (const row of rows) {
    lines.push(pdfTableRow(row, widths));
  }
  lines.push(pdfRule(widths));
}

function buildPdfLines(data: ReportsPayload, from: string, to: string) {
  const lines: string[] = [
    "Reports & Analytics",
    `Report window: ${from} to ${to}`,
  ];

  appendPdfTable(lines, "Clinic Reports", ["Metric", "Value"], [
    ["Total appointments", data.appointment_summary.total],
    ["Completed appointments", data.appointment_summary.completed],
    ["Cancelled appointments", data.appointment_summary.cancelled],
    ["Patient count", data.volume.total_patients],
    ["Daily sales", `PHP ${formatMoneyPdf(data.sales_summary.daily)}`],
    ["Monthly sales", `PHP ${formatMoneyPdf(data.sales_summary.monthly)}`],
    ["POS collections", `PHP ${formatMoneyPdf(data.pos_summary.paid_total)}`],
    ["POS paid invoices", data.pos_summary.paid_invoices],
  ], [34, 28]);

  appendPdfTable(lines, "Sales Trend", ["Date", "Revenue", "Appts", "Patients"], data.daily_trends.slice(0, 22).map((row) => [
    row.date,
    `PHP ${formatMoneyPdf(row.revenue)}`,
    row.appointments,
    row.patients,
  ]), [14, 20, 10, 10]);

  appendPdfTable(lines, "Content Reports", ["Metric", "Value"], [
    ["Appointment clicks from content", data.content_clicks_total],
    ["Website traffic days", data.visitor_traffic.length],
  ], [34, 28]);

  appendPdfTable(lines, "Website Visitor Traffic", ["Date", "Visitors", "Pageviews"], data.visitor_traffic.slice(0, 18).map((row) => [
    row.date,
    row.visitors,
    row.pageviews,
  ]), [16, 14, 14]);

  appendPdfTable(lines, "Most Viewed Blogs", ["Title", "Views", "Clicks"], data.top_blogs.map((row) => [
    row.title,
    row.views,
    row.appointment_clicks,
  ]), [46, 10, 10]);

  appendPdfTable(lines, "Most Viewed Videos", ["Title", "Views", "Clicks"], data.top_videos.map((row) => [
    row.title,
    row.views,
    row.appointment_clicks,
  ]), [46, 10, 10]);

  appendPdfTable(lines, "Most Requested Services", ["Service", "Requests"], data.requested_services.map((row) => [
    row.service,
    row.count,
  ]), [46, 12]);

  return lines;
}

function buildPdfBytes(data: ReportsPayload, from: string, to: string) {
  const lines = buildPdfLines(data, from, to);
  const linesPerPage = 48;
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects: string[] = [];
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  for (const pageLines of pages) {
    const pageId = objects.length;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    contentIds.push(contentId);

    const contentLines = pageLines
      .map((line, index) => `${index === 0 ? "48 744 Td" : "0 -15 Td"} (${escapePdfText(line)}) Tj`)
      .join("\n");
    const content = `BT\n/F1 9 Tf\n${contentLines}\nET`;

    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function downloadPdf(data: ReportsPayload, from: string, to: string) {
  const pdfBytes = buildPdfBytes(data, from, to);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reports-analytics-${from}-to-${to}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { accessToken, isLoading: authLoading } = useRole();
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayIso);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    if (from > to) {
      setError("The start date cannot be later than the end date.");
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        setLoading(true);
        const url = new URL("/api/v2/reports", window.location.origin);
        url.searchParams.set("from", from);
        url.searchParams.set("to", to);
        const res = await fetch(url.toString(), {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load reports.");
        const payload = (await res.json()) as ReportsPayload;
        if (!active) return;
        setData(payload);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load reports.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading, from, to]);

  const clinicKpis = useMemo<KpiItem[]>(
    () => [
      {
        label: "Total Appointments",
        value: loading ? "..." : String(data?.appointment_summary.total ?? 0),
        hint: "All appointments in selected range",
        accent: KPI_ACCENTS[0],
        icon: FaCalendarDay,
      },
      {
        label: "Completed Appointments",
        value: loading ? "..." : String(data?.appointment_summary.completed ?? 0),
        hint: "Finished consultations and visits",
        accent: KPI_ACCENTS[1],
        icon: FaCalendarCheck,
      },
      {
        label: "Cancelled Appointments",
        value: loading ? "..." : String(data?.appointment_summary.cancelled ?? 0),
        hint: "Cancelled records in selected range",
        accent: KPI_ACCENTS[2],
        icon: FaCalendarXmark,
      },
      {
        label: "Patient Count",
        value: loading ? "..." : String(data?.volume.total_patients ?? 0),
        hint: "Registered patients in the system",
        accent: KPI_ACCENTS[3],
        icon: FaHospitalUser,
      },
      {
        label: "Daily Sales",
        value: loading ? "..." : formatMoney(data?.sales_summary.daily ?? 0),
        hint: "Today across clinic, online, and POS",
        accent: KPI_ACCENTS[4],
        icon: FaFileInvoiceDollar,
      },
      {
        label: "Monthly Sales",
        value: loading ? "..." : formatMoney(data?.sales_summary.monthly ?? 0),
        hint: "Current month total sales",
        accent: KPI_ACCENTS[5],
        icon: FaMoneyBillTrendUp,
      },
      {
        label: "POS Reports",
        value: loading ? "..." : formatMoney(data?.pos_summary.paid_total ?? 0),
        hint: `${data?.pos_summary.paid_invoices ?? 0} paid invoices`,
        accent: KPI_ACCENTS[6],
        icon: FaChartLine,
      },
    ],
    [data, loading],
  );

  const contentKpis = useMemo<KpiItem[]>(() => {
    const topBlog = data?.top_blogs[0];
    const topVideo = data?.top_videos[0];
    const topService = data?.requested_services[0];
    const totalVisitors = data?.visitor_traffic.reduce((sum, row) => sum + row.visitors, 0) ?? 0;
    const totalPageviews = data?.visitor_traffic.reduce((sum, row) => sum + row.pageviews, 0) ?? 0;

    return [
      {
        label: "Most Viewed Blogs",
        value: loading ? "..." : String(topBlog?.views ?? 0),
        hint: topBlog ? shorten(topBlog.title, 42) : "No blog views tracked yet",
        accent: KPI_ACCENTS[0],
        icon: FaEye,
      },
      {
        label: "Most Viewed Videos",
        value: loading ? "..." : String(topVideo?.views ?? 0),
        hint: topVideo ? shorten(topVideo.title, 42) : "No video views tracked yet",
        accent: KPI_ACCENTS[5],
        icon: FaPlay,
      },
      {
        label: "Appointment Clicks",
        value: loading ? "..." : String(data?.content_clicks_total ?? 0),
        hint: "Booking clicks from content",
        accent: KPI_ACCENTS[1],
        icon: FaArrowPointer,
      },
      {
        label: "Website Visitor Traffic",
        value: loading ? "..." : String(totalVisitors),
        hint: `${totalPageviews} pageviews in selected range`,
        accent: KPI_ACCENTS[6],
        icon: FaUsers,
      },
      {
        label: "Most Requested Services",
        value: loading ? "..." : String(topService?.count ?? 0),
        hint: topService ? topService.service : "No service demand tracked yet",
        accent: KPI_ACCENTS[3],
        icon: FaStethoscope,
      },
    ];
  }, [data, loading]);

  const clinicStatusData = useMemo(() => {
    const total = data?.appointment_summary.total ?? 0;
    const completed = data?.appointment_summary.completed ?? 0;
    const cancelled = data?.appointment_summary.cancelled ?? 0;
    const other = Math.max(total - completed - cancelled, 0);

    return [
      { label: "Completed", value: completed },
      { label: "Cancelled", value: cancelled },
      { label: "Other", value: other },
    ].filter((row) => row.value > 0);
  }, [data]);

  const salesData = useMemo(
    () => [
      { label: "Daily", value: data?.sales_summary.daily ?? 0 },
      { label: "Monthly", value: data?.sales_summary.monthly ?? 0 },
      { label: "POS Daily", value: data?.sales_summary.pos_daily ?? 0 },
      { label: "POS Monthly", value: data?.sales_summary.pos_monthly ?? 0 },
    ],
    [data],
  );

  const salesTrendData = useMemo(
    () => (data?.daily_trends ?? []).map((row) => ({
      date: row.date,
      revenue: row.revenue,
      appointments: row.appointments,
    })),
    [data],
  );

  const blogChartData = useMemo(
    () => (data?.top_blogs ?? []).slice(0, 5).map((row) => ({
      name: shorten(row.title),
      views: row.views,
    })),
    [data],
  );

  const videoChartData = useMemo(
    () => (data?.top_videos ?? []).slice(0, 5).map((row) => ({
      name: shorten(row.title),
      views: row.views,
    })),
    [data],
  );

  const maxRequestedServiceCount = Math.max(...((data?.requested_services ?? []).map((row) => row.count)), 1);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-[1500px] space-y-7 pb-10">
        <section className="overflow-hidden rounded-lg border border-black bg-black text-white shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
          <div className="grid gap-0 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="px-5 py-7 sm:px-8 lg:px-10">
              <p className="text-xs font-black uppercase tracking-[0.34em] text-white/55">Reports & Analytics</p>
              <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Clinic performance in one clean command center
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Track appointments, revenue, POS collections, content reach, traffic, and service demand from the same reporting window.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <QuickLink href="/appointments" label="Appointments" />
                <QuickLink href="/payments/pos" label="POS" />
                <QuickLink href="/contents" label="Content" />
              </div>
            </div>
            <div className="grid border-t border-white/10 bg-white/[0.06] p-4 sm:grid-cols-3 xl:grid-cols-1 xl:border-l xl:border-t-0">
              <HeroStat label="Report window" value={`${formatDateLabel(from)} - ${formatDateLabel(to)}`} />
              <HeroStat label="Monthly sales" value={loading ? "..." : formatMoney(data?.sales_summary.monthly ?? 0)} />
              <HeroStat label="Content clicks" value={loading ? "..." : String(data?.content_clicks_total ?? 0)} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-[0_18px_45px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr_1.1fr_0.85fr] xl:items-end">
            <div className="self-center">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Report window</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600">Filter the dashboard and export exactly what is on screen.</p>
            </div>

            <ControlGroup label="Quick range">
              <div className="grid grid-cols-2 gap-2">
                <PresetButton label="Today" onClick={() => { setFrom(todayIso); setTo(todayIso); }} />
                <PresetButton label="Last 7 days" onClick={() => applyPreset(setFrom, setTo, 6)} />
                <PresetButton label="Last 30 days" onClick={() => applyPreset(setFrom, setTo, 29)} />
                <PresetButton label="This month" onClick={() => { setFrom(monthStart); setTo(todayIso); }} />
              </div>
            </ControlGroup>

            <ControlGroup label="Custom dates">
              <div className="grid grid-cols-2 gap-2">
                <DateField label="From" value={from} onChange={setFrom} />
                <DateField label="To" value={to} onChange={setTo} />
              </div>
            </ControlGroup>

            <ControlGroup label="Export">
              <div className="grid grid-cols-2 gap-2">
                <ExportButton
                  label="Excel"
                  icon={FaFileExcel}
                  onClick={() => data && downloadWorkbook(data, from, to)}
                  disabled={!data || loading}
                />
                <ExportButton
                  label="PDF"
                  icon={FaFilePdf}
                  onClick={() => data && downloadPdf(data, from, to)}
                  disabled={!data || loading}
                />
              </div>
            </ControlGroup>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-800">{error}</div>
        ) : null}

        <ReportGroup
          eyebrow="Clinic reports"
          title="Operational snapshot"
          description="Appointments, patient volume, sales, and POS performance stay visible before you move into trend analysis."
          items={clinicKpis}
        />

        <div className="space-y-6">
          <Panel title="Clinic reports" subtitle="Status mix and appointment volume for the selected range">
            {loading ? (
              <LoadingBlock className="h-[360px]" />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoTile label="Total appointments" value={String(data?.appointment_summary.total ?? 0)} />
                  <InfoTile label="Completed" value={String(data?.appointment_summary.completed ?? 0)} />
                  <InfoTile label="Cancelled" value={String(data?.appointment_summary.cancelled ?? 0)} />
                  <InfoTile label="Patient count" value={String(data?.volume.total_patients ?? 0)} />
                </div>
                <ChartShell title="Appointment status mix" caption="Completed, cancelled, and remaining appointment statuses">
                  {!clinicStatusData.length ? (
                    <EmptyState text="No appointment status data is available yet." />
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={clinicStatusData} dataKey="value" nameKey="label" innerRadius={64} outerRadius={104} paddingAngle={3}>
                              {clinicStatusData.map((row, index) => (
                                <Cell key={row.label} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${numberFromChartValue(value)} appointments`} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3 self-center">
                        {clinicStatusData.map((row, index) => (
                          <LegendRow
                            key={row.label}
                            color={BAR_COLORS[index % BAR_COLORS.length]}
                            label={row.label}
                            value={`${row.value} appointments`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </ChartShell>
              </div>
            )}
          </Panel>

          <Panel title="Sales analytics" subtitle="Daily sales, monthly sales, and POS reporting in one view">
            {loading ? (
              <LoadingBlock className="h-[360px]" />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InfoTile label="Daily sales" value={formatMoney(data?.sales_summary.daily ?? 0)} />
                  <InfoTile label="Monthly sales" value={formatMoney(data?.sales_summary.monthly ?? 0)} />
                  <InfoTile label="POS collections" value={formatMoney(data?.pos_summary.paid_total ?? 0)} />
                  <InfoTile label="Average ticket" value={formatMoney(data?.pos_summary.average_ticket ?? 0)} />
                </div>
                <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                  <ChartShell title="Revenue trend" caption="Paid revenue by day in the selected report window">
                    {!salesTrendData.length ? (
                      <EmptyState text="No daily sales trend is available for this range." />
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={salesTrendData} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="salesRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#111111" stopOpacity={0.24} />
                                <stop offset="95%" stopColor="#111111" stopOpacity={0.03} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={formatDateLabel} stroke="#737373" fontSize={12} />
                            <YAxis stroke="#737373" fontSize={12} tickFormatter={(value) => formatMoneyCompact(Number(value))} />
                            <Tooltip
                              labelFormatter={(label) => formatDateLabel(String(label))}
                              formatter={(value) => formatMoney(numberFromChartValue(value))}
                            />
                            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#111111" fill="url(#salesRevenueFill)" strokeWidth={3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartShell>
                  <ChartShell title="Sales snapshot" caption="Daily, monthly, and POS totals">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesData} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                          <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" stroke="#737373" fontSize={12} tickFormatter={(value) => formatMoneyCompact(Number(value))} />
                          <YAxis dataKey="label" type="category" width={86} stroke="#737373" fontSize={11} />
                          <Tooltip formatter={(value) => formatMoney(numberFromChartValue(value))} />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                            {salesData.map((row, index) => (
                              <Cell key={row.label} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartShell>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <ReportGroup
          eyebrow="Content reports"
          title="Reach, traffic, and demand"
          description="The content view connects public engagement to booking intent and requested service demand."
          items={contentKpis}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Panel title="Website visitor traffic" subtitle="Daily website traffic for the selected report window">
            {loading ? (
              <LoadingBlock className="h-[320px]" />
            ) : !data?.visitor_traffic.length ? (
              <EmptyState text="No website visitor traffic has been tracked yet." />
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.visitor_traffic} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pageviewFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#111111" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#111111" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="visitorFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#737373" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#737373" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} stroke="#737373" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="#737373" fontSize={12} />
                    <Tooltip
                      labelFormatter={(label) => formatDateLabel(String(label))}
                      formatter={(value, name) => [`${numberFromChartValue(value)}`, String(name) === "visitors" ? "Visitors" : "Pageviews"]}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="pageviews" name="Pageviews" stroke="#111111" fill="url(#pageviewFill)" strokeWidth={3} />
                    <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#737373" fill="url(#visitorFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Appointment clicks from content" subtitle="Tracked booking CTA clicks from blog and video pages">
            {loading ? (
              <LoadingBlock className="h-[320px]" />
            ) : (
              <div className="flex min-h-[320px] flex-col justify-between rounded-lg border border-black bg-black p-6 text-white">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">Content conversion signal</p>
                  <p className="mt-5 text-6xl font-black tracking-tight text-white">{data?.content_clicks_total ?? 0}</p>
                  <p className="mt-3 text-sm leading-6 text-white/65">
                    Booking-intent clicks from content pages, useful for connecting patient education to appointment demand.
                  </p>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <MiniInfo label="Blogs tracked" value={String(data?.top_blogs.length ?? 0)} />
                  <MiniInfo label="Videos tracked" value={String(data?.top_videos.length ?? 0)} />
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel title="Most viewed blogs" subtitle="Top blog posts by views in the selected range">
            {loading ? (
              <LoadingBlock className="h-[320px]" />
            ) : !blogChartData.length ? (
              <EmptyState text="No blog view analytics are available yet." />
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={blogChartData} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
                    <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} stroke="#737373" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={150} stroke="#737373" fontSize={11} />
                    <Tooltip formatter={(value) => `${numberFromChartValue(value)} views`} />
                    <Bar dataKey="views" fill="#111111" radius={[0, 6, 6, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Most viewed videos" subtitle="Top video and replay content by views in the selected range">
            {loading ? (
              <LoadingBlock className="h-[320px]" />
            ) : !videoChartData.length ? (
              <EmptyState text="No video analytics are available yet." />
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={videoChartData} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
                    <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} stroke="#737373" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={150} stroke="#737373" fontSize={11} />
                    <Tooltip formatter={(value) => `${numberFromChartValue(value)} views`} />
                    <Bar dataKey="views" fill="#525252" radius={[0, 6, 6, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Most requested services" subtitle="Service demand based on booked appointments in the selected range">
          {loading ? (
            <LoadingBlock className="h-[340px]" />
          ) : !data?.requested_services.length ? (
            <EmptyState text="No requested service data is available yet." />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
              <div className="space-y-3">
                {data.requested_services.map((row) => (
                  <div key={row.service} className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 text-sm font-bold text-neutral-950">{row.service}</p>
                      <span className="shrink-0 rounded-md bg-black px-3 py-1 text-xs font-black text-white">{row.count}</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-neutral-100">
                      <div
                        className="h-2 rounded-full bg-black"
                        style={{ width: `${Math.max((row.count / maxRequestedServiceCount) * 100, 10)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.requested_services} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
                    <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} stroke="#737373" fontSize={12} />
                    <YAxis dataKey="service" type="category" width={130} stroke="#737373" fontSize={11} />
                    <Tooltip formatter={(value) => `${numberFromChartValue(value)} requests`} />
                    <Bar dataKey="count" fill="#111111" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}

function shorten(value: string, max = 26) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function applyPreset(setFrom: (value: string) => void, setTo: (value: string) => void, daysBack: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);
  setFrom(start.toISOString().slice(0, 10));
  setTo(end.toISOString().slice(0, 10));
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="mb-5 border-b border-neutral-200 pb-4">
        <h2 className="text-lg font-black tracking-tight text-neutral-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b xl:border-r-0 xl:last:border-b-0">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 break-words text-xl font-black tracking-tight text-white">{value}</p>
    </div>
  );
}

function ChartShell({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-neutral-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-neutral-600">{caption}</p>
      </div>
      {children}
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <span className="truncate text-sm font-semibold text-neutral-700">{label}</span>
      </div>
      <span className="shrink-0 text-sm font-black text-neutral-950">{value}</span>
    </div>
  );
}

function ReportGroup({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: KpiItem[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-neutral-200 pb-4">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">{eyebrow}</p>
        <h2 className="text-2xl font-black tracking-tight text-black">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-neutral-600">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} accent={item.accent} icon={item.icon} />
        ))}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
  icon: IconType;
}) {
  const isDark = accent.includes("bg-black");

  return (
    <div className={`min-h-36 rounded-lg border ${accent} p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(0,0,0,0.10)]`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className={isDark ? "h-1.5 w-12 rounded-full bg-white/35" : "h-1.5 w-12 rounded-full bg-black"} />
        <div className={isDark ? "flex size-10 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white" : "flex size-10 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-950"}>
          <Icon className="text-lg" aria-hidden="true" />
        </div>
      </div>
      <p className={isDark ? "text-xs font-black uppercase tracking-[0.16em] text-white/55" : "text-xs font-black uppercase tracking-[0.16em] text-neutral-500"}>{label}</p>
      <p className={isDark ? "mt-3 break-words text-2xl font-black tracking-tight text-white sm:text-3xl" : "mt-3 break-words text-2xl font-black tracking-tight text-black sm:text-3xl"}>{value}</p>
      <p className={isDark ? "mt-2 line-clamp-2 text-sm leading-5 text-white/65" : "mt-2 line-clamp-2 text-sm leading-5 text-neutral-600"}>{hint}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-white/20 bg-white/10 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white hover:text-black"
    >
      {label}
    </Link>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      {children}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-neutral-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800 outline-none transition focus:border-black focus:ring-4 focus:ring-neutral-100"
      />
    </label>
  );
}

function ExportButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: IconType;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-black px-4 text-sm font-black text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
    >
      <Icon className="text-base" aria-hidden="true" />
      {label}
    </button>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 rounded-md border border-neutral-200 bg-white px-3 text-sm font-bold text-neutral-700 transition hover:border-black hover:bg-black hover:text-white"
    >
      {label}
    </button>
  );
}

function LoadingBlock({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100/70 shimmer ${className}`} />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-sm font-medium text-neutral-500">
      {text}
    </div>
  );
}

