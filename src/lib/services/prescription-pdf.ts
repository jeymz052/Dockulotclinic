export type PrescriptionPdfRow = {
  id: string;
  prescription_no: string;
  patient_id: string;
  doctor_id: string;
  general_instructions: string | null;
  follow_up_date: string | null;
  released_to_patient: boolean;
  created_at: string;
  diagnoses?: {
    diagnosis_text?: string | null;
    treatment_plan?: string | null;
    follow_up_date?: string | null;
  } | null;
  prescription_items?: Array<{
    medicine_name: string;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
    sort_order?: number | null;
  }>;
  patients?: {
    dob?: string | null;
    gender?: string | null;
    profiles?: { full_name?: string | null } | null;
  } | null;
  doctors?: {
    specialty?: string | null;
    license_no?: string | null;
    profiles?: { full_name?: string | null } | null;
  } | null;
};

type Font = "F1" | "F2" | "F3";

export function getPrescriptionPdfFilename(prescriptionNo: string) {
  return `${prescriptionNo.replace(/[^\w.-]+/g, "_")}.pdf`;
}

function pdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function textWidth(value: string, size: number) {
  return pdfText(value).length * size * 0.52;
}

function text(
  ops: string[],
  value: string,
  x: number,
  y: number,
  options: { size?: number; font?: Font; align?: "left" | "center" | "right" } = {},
) {
  const size = options.size ?? 10;
  const font = options.font ?? "F1";
  const align = options.align ?? "left";
  const width = textWidth(value, size);
  const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  ops.push(`BT /${font} ${size} Tf ${left.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(value)}) Tj ET`);
}

function rect(ops: string[], x: number, y: number, w: number, h: number, mode: "S" | "f" = "S") {
  ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
}

function rule(ops: string[], x1: number, y: number, x2: number) {
  ops.push(`${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
}

function wrap(value: string, max = 78) {
  const lines: string[] = [];
  for (const paragraph of value.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > max && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function wrapped(
  ops: string[],
  value: string,
  x: number,
  y: number,
  options: { size?: number; font?: Font; max?: number; lines?: number; leading?: number } = {},
) {
  const size = options.size ?? 10;
  const leading = options.leading ?? size + 4;
  const lines = wrap(value, options.max ?? 78).slice(0, options.lines ?? 6);
  lines.forEach((line, index) => text(ops, line, x, y - index * leading, { size, font: options.font }));
  return y - lines.length * leading;
}

function ageFromDob(dob?: string | null, at = new Date()) {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = at.getFullYear() - birth.getFullYear();
  const birthday = new Date(at.getFullYear(), birth.getMonth(), birth.getDate());
  if (at < birthday) age -= 1;
  return age >= 0 ? age : null;
}

function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })} PHT`;
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function finder(ops: string[], x: number, y: number, c: number) {
  rect(ops, x, y, c * 5, c * 5, "f");
  ops.push("1 g");
  rect(ops, x + c, y + c, c * 3, c * 3, "f");
  ops.push("0 g");
  rect(ops, x + c * 2, y + c * 2, c, c, "f");
}

function qrLikeMark(ops: string[], value: string, x: number, y: number, size: number) {
  const cell = size / 21;
  const seed = hash(value);
  finder(ops, x, y + cell * 16, cell);
  finder(ops, x + cell * 16, y + cell * 16, cell);
  finder(ops, x, y, cell);
  for (let row = 0; row < 21; row += 1) {
    for (let col = 0; col < 21; col += 1) {
      const skip = (col < 6 && row < 6) || (col > 14 && row < 6) || (col < 6 && row > 14);
      if (!skip && (seed + row * 17 + col * 31 + row * col * 7) % 5 < 2) {
        rect(ops, x + col * cell, y + row * cell, cell * 0.9, cell * 0.9, "f");
      }
    }
  }
}

function pdf(ops: string[]) {
  const encoder = new TextEncoder();
  const stream = ["q", "1 w", "0 g", ...ops, "Q"].join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >> endobj",
    `7 0 obj << /Length ${encoder.encode(stream).length} >> stream\n${stream}\nendstream endobj`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(encoder.encode(body).length);
    body += `${object}\n`;
  }
  const xref = encoder.encode(body).length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(body);
}

export function createPrescriptionPdf(row: PrescriptionPdfRow) {
  const createdAt = new Date(row.created_at);
  const medicines = [...(row.prescription_items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const doctorName = row.doctors?.profiles?.full_name ?? "Dr. Fatimah Al-Zahra T. Ditti";
  const specialty = row.doctors?.specialty ?? "Family Medicine";
  const prcNo = row.doctors?.license_no ?? "0141185";
  const patientName = row.patients?.profiles?.full_name ?? "Patient";
  const patientAge = ageFromDob(row.patients?.dob, createdAt);
  const note = [
    row.general_instructions ?? "",
    row.follow_up_date || row.diagnoses?.follow_up_date ? `Follow-up: ${row.follow_up_date ?? row.diagnoses?.follow_up_date}` : "",
  ].filter(Boolean).join("\n") || "No additional notes.";

  const ops: string[] = [];
  ops.push("1 1 1 rg");
  rect(ops, 18, 18, 576, 756, "f");
  ops.push("0 g");
  rect(ops, 42, 715, 42, 38);
  text(ops, "PPD", 63, 738, { size: 13, font: "F2", align: "center" });
  text(ops, "Clinic", 63, 724, { size: 10, font: "F2", align: "center" });
  text(ops, "Connecting", 94, 742, { size: 12, font: "F2" });
  text(ops, "Healthcare", 94, 728, { size: 12, font: "F2" });
  text(ops, "to Everyone", 94, 714, { size: 12, font: "F2" });
  rect(ops, 414, 718, 46, 35, "f");
  ops.push("1 g");
  text(ops, "TFD", 437, 731, { size: 16, font: "F2", align: "center" });
  ops.push("0 g");
  text(ops, "TheFilipinoDoctor", 470, 730, { size: 18, font: "F2" });

  qrLikeMark(ops, row.prescription_no, 266, 614, 80);
  text(ops, "(Scan QR code to validate)", 306, 600, { size: 9, align: "center" });
  text(ops, `PRESCRIPTION ID: ${row.prescription_no}`, 306, 586, { size: 10, font: "F2", align: "center" });
  text(ops, doctorName, 306, 553, { size: 18, font: "F2", align: "center" });
  text(ops, specialty, 306, 535, { size: 12, align: "center" });
  text(ops, "Doc Kulot Online Clinic", 306, 508, { size: 16, font: "F2", align: "center" });
  text(ops, "Zamboanga City, Zamboanga Del Sur", 306, 490, { size: 12, align: "center" });
  rule(ops, 42, 468, 570);

  text(ops, `Prescribed on: ${dateTime(row.created_at)}`, 570, 444, { size: 10, font: "F2", align: "right" });
  text(ops, "Patient:", 42, 418, { size: 14 });
  text(ops, patientName, 100, 418, { size: 16, font: "F2" });
  text(ops, patientAge != null ? `Age: ${patientAge} years old` : "Age: Not recorded", 42, 398, { size: 11 });
  text(ops, row.patients?.gender ? `Gender: ${row.patients.gender}` : "Gender: Not recorded", 42, 382, { size: 11 });

  text(ops, "Rx", 42, 350, { size: 22, font: "F2" });
  let y = 319;
  for (const item of medicines.slice(0, 6)) {
    const details = [item.dosage, item.duration].filter(Boolean).join(" ");
    const sig = [item.frequency, item.instructions].filter(Boolean).join(" ");
    y = wrapped(ops, item.medicine_name, 62, y, { size: 16, font: "F2", max: 42, lines: 2 }) - 4;
    if (details) y = wrapped(ops, details, 62, y, { size: 11, max: 72, lines: 2 }) - 2;
    if (sig) y = wrapped(ops, `Sig. ${sig}`, 78, y, { size: 11, max: 68, lines: 2 }) - 8;
  }
  if (medicines.length === 0) {
    text(ops, "No medicine items added.", 62, y, { size: 11 });
    y -= 22;
  }

  text(ops, "Note:", 42, Math.max(y, 158), { size: 12, font: "F3" });
  wrapped(ops, note, 42, Math.max(y - 18, 140), { size: 11, max: 74, lines: 4 });
  rule(ops, 390, 119, 545);
  text(ops, "Physician's Signature", 468, 101, { size: 11, align: "center" });
  text(ops, `PRC No.: ${prcNo}`, 468, 84, { size: 11, align: "center" });
  text(ops, "(End of Prescription)", 306, 58, { size: 10, align: "center" });
  rule(ops, 42, 45, 570);
  wrapped(ops, "Note to User: The information contained in this electronic prescription is provided by the prescriber. If any information is suspected to be altered, verify the original prescription record before dispensing.", 42, 33, { size: 7, max: 118, lines: 2, leading: 9 });
  text(ops, "Powered by The Filipino Doctor", 306, 12, { size: 8, font: "F2", align: "center" });

  return pdf(ops);
}
