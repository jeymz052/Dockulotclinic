import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

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
  doctor_signature_data_url?: string | null;
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

function formatPrescriptionSpecialty(raw?: string | null) {
  const specialty = raw?.trim();
  if (!specialty) return "Family and Aesthetic Medicine Specialist";
  if (/family medicine specialist/i.test(specialty)) return "Family and Aesthetic Medicine Specialist";
  if (/family medicine and aesthetic medicine/i.test(specialty)) return "Family and Aesthetic Medicine Specialist";
  return specialty;
}

function fitImageSize(image: PdfImage, maxWidth: number, maxHeight: number) {
  const ratio = image.width / image.height;
  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return { width, height };
}

type PdfImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.trim().match(/^data:(image\/png);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

function paeth(left: number, up: number, upLeft: number) {
  const predictor = left + up - upLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const upLeftDistance = Math.abs(predictor - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodePngBuffer(input: Buffer): PdfImage | null {
  if (!input) return null;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (input.length < 8 || !input.subarray(0, 8).equals(signature)) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts: Buffer[] = [];

  while (offset + 8 <= input.length) {
    const length = input.readUInt32BE(offset);
    offset += 4;
    const type = input.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const chunk = input.subarray(offset, offset + length);
    offset += length + 4;

    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk.readUInt8(8);
      colorType = chunk.readUInt8(9);
    } else if (type === "IDAT") {
      idatParts.push(Buffer.from(chunk));
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height || bitDepth !== 8) return null;
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels) return null;

  const inflated = inflateSync(Buffer.concat(idatParts));
  const stride = width * channels;
  const bytesPerPixel = channels;
  const raw = Buffer.alloc(width * height * 3);
  const current = Buffer.alloc(stride);
  const previous = Buffer.alloc(stride);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    inflated.copy(current, 0, inputOffset, inputOffset + stride);
    inputOffset += stride;

    switch (filter) {
      case 1:
        for (let x = 0; x < stride; x += 1) {
          const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
          current[x] = (current[x] + left) & 0xff;
        }
        break;
      case 2:
        for (let x = 0; x < stride; x += 1) {
          current[x] = (current[x] + previous[x]) & 0xff;
        }
        break;
      case 3:
        for (let x = 0; x < stride; x += 1) {
          const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
          const up = previous[x];
          current[x] = (current[x] + Math.floor((left + up) / 2)) & 0xff;
        }
        break;
      case 4:
        for (let x = 0; x < stride; x += 1) {
          const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
          const up = previous[x];
          const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
          current[x] = (current[x] + paeth(left, up, upLeft)) & 0xff;
        }
        break;
      case 0:
        break;
      default:
        return null;
    }

    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const target = (y * width + x) * 3;
      if (colorType === 6) {
        const alpha = current[source + 3] / 255;
        raw[target] = Math.round(current[source] * alpha + 255 * (1 - alpha));
        raw[target + 1] = Math.round(current[source + 1] * alpha + 255 * (1 - alpha));
        raw[target + 2] = Math.round(current[source + 2] * alpha + 255 * (1 - alpha));
      } else if (colorType === 2) {
        raw[target] = current[source];
        raw[target + 1] = current[source + 1];
        raw[target + 2] = current[source + 2];
      } else {
        raw[target] = current[source];
        raw[target + 1] = current[source];
        raw[target + 2] = current[source];
      }
    }

    previous.set(current);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 3;
      if (raw[idx] > 245 && raw[idx + 1] > 245 && raw[idx + 2] > 245) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX >= 0 && maxY >= 0) {
    const padding = 10;
    const leftPadding = Math.max(8, Math.floor(padding * 0.7));
    const rightPadding = Math.max(8, Math.floor(padding * 0.7));
    const topPadding = Math.max(padding + 6, 18);
    const bottomPadding = 0;
    const cropX = Math.max(0, minX - leftPadding);
    const cropY = Math.max(0, minY - topPadding);
    const cropWidth = Math.min(width - cropX, maxX - minX + leftPadding + rightPadding + 1);
    const cropHeight = Math.min(height - cropY, maxY - minY + topPadding + bottomPadding + 1);
    const cropped = Buffer.alloc(cropWidth * cropHeight * 3);
    for (let y = 0; y < cropHeight; y += 1) {
      const sourceStart = ((cropY + y) * width + cropX) * 3;
      const sourceEnd = sourceStart + cropWidth * 3;
      const targetStart = y * cropWidth * 3;
      raw.copy(cropped, targetStart, sourceStart, sourceEnd);
    }

    return {
      width: cropWidth,
      height: cropHeight,
      data: new Uint8Array(deflateSync(cropped)),
    };
  }

  return {
    width,
    height,
    data: new Uint8Array(deflateSync(raw)),
  };
}

function decodePng(dataUrl: string): PdfImage | null {
  const input = dataUrlToBuffer(dataUrl);
  if (!input) return null;
  return decodePngBuffer(input);
}

function loadLogoImage() {
  try {
    const input = readFileSync(`${process.cwd()}/public/images/dockulotslogonobg.png`);
    return decodePngBuffer(input);
  } catch {
    return null;
  }
}

function pdf(ops: string[], logoImage?: PdfImage | null, signatureImage?: PdfImage | null) {
  const byteLength = (value: string) => Buffer.byteLength(value, "latin1");
  const stream = ["q", "1 w", "0 g", ...ops, "Q"].join("\n");
  const imageObjects: Array<{ objectNumber: number; name: string; image: PdfImage }> = [];
  let nextObjectNumber = 8;
  if (logoImage) {
    imageObjects.push({ objectNumber: nextObjectNumber, name: "/Im1", image: logoImage });
    nextObjectNumber += 1;
  }
  if (signatureImage) {
    imageObjects.push({ objectNumber: nextObjectNumber, name: logoImage ? "/Im2" : "/Im1", image: signatureImage });
    nextObjectNumber += 1;
  }

  const resources = imageObjects.length
    ? `<< /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> /XObject << ${imageObjects
        .map((entry) => `${entry.name} ${entry.objectNumber} 0 R`)
        .join(" ")} >> >>`
    : "<< /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >>";

  const objects: Array<string | null> = [];
  objects[1] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj";
  objects[2] = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj";
  objects[3] = `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents 7 0 R >> endobj`;
  objects[4] = "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj";
  objects[5] = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj";
  objects[6] = "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >> endobj";
  objects[7] = `7 0 obj << /Length ${byteLength(stream)} >> stream\n${stream}\nendstream endobj`;
  for (const entry of imageObjects) {
    objects[entry.objectNumber] = `${entry.objectNumber} 0 obj << /Type /XObject /Subtype /Image /Width ${entry.image.width} /Height ${entry.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${entry.image.data.length} >> stream\n${Buffer.from(entry.image.data).toString("latin1")}\nendstream endobj`;
  }

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let number = 1; number < objects.length; number += 1) {
    const object = objects[number];
    if (!object) continue;
    offsets[number] = byteLength(body);
    body += `${object}\n`;
  }
  const xref = byteLength(body);
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let number = 1; number < objects.length; number += 1) {
    if (!objects[number]) {
      body += "0000000000 00000 f \n";
      continue;
    }
    body += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

export function createPrescriptionPdf(row: PrescriptionPdfRow) {
  const createdAt = new Date(row.created_at);
  const medicines = [...(row.prescription_items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const doctorName = row.doctors?.profiles?.full_name ?? "Dr. Fatimah Al-Zahra T. Ditti";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : doctorName;
  const clinicHeaderName = doctorNameBase ? `${doctorNameBase} Online Clinic` : "Doc Kulot Online Clinic";
  const specialty = formatPrescriptionSpecialty(row.doctors?.specialty);
  const prcNo = row.doctors?.license_no ?? "0141185";
  const logoImage = loadLogoImage();
  const signatureImage = row.doctor_signature_data_url ? decodePng(row.doctor_signature_data_url) : null;
  const patientName = row.patients?.profiles?.full_name ?? "Patient";
  const patientAge = ageFromDob(row.patients?.dob, createdAt);
  const followUp = row.follow_up_date ?? row.diagnoses?.follow_up_date ?? "";
  const note = [
    row.general_instructions ? `Instructions: ${row.general_instructions}` : "",
    followUp ? `Follow-up: ${followUp}` : "",
  ].filter(Boolean).join("\n") || "No additional notes.";

  const ops: string[] = [];
  ops.push("1 1 1 rg");
  rect(ops, 18, 18, 576, 756, "f");
  ops.push("0 g");
  if (logoImage) {
    ops.push("q");
    ops.push("140 0 0 78 42 700 cm /Im1 Do");
    ops.push("Q");
  }
  text(ops, "Prescription ID", 570, 746, { size: 10, font: "F2", align: "right" });
  text(ops, row.prescription_no, 570, 732, { size: 13, font: "F2", align: "right" });
  text(ops, doctorHeaderName, 306, 678, { size: 16, font: "F2", align: "center" });
  text(ops, specialty, 306, 660, { size: 11.5, align: "center" });
  text(ops, clinicHeaderName, 306, 640, { size: 17, font: "F2", align: "center" });
  text(ops, "Zamboanga City, Zamboanga Del Sur", 306, 622, { size: 11.5, align: "center" });
  rule(ops, 42, 578, 570);

  text(ops, "Patient:", 42, 550, { size: 12 });
  text(ops, patientName, 90, 550, { size: 13, font: "F2" });
  text(ops, `Prescribed on: ${dateTime(row.created_at)}`, 570, 552, { size: 10, align: "right" });
  text(ops, patientAge != null ? `Age: ${patientAge} years old` : "Age: Not recorded", 42, 531, { size: 11 });
  text(ops, row.patients?.gender ? `Gender: ${row.patients.gender}` : "Gender: Not recorded", 42, 512, { size: 11 });

  text(ops, "Rx", 42, 478, { size: 28, font: "F2" });
  rule(ops, 78, 482, 570);
  let y = 446;
  for (const item of medicines.slice(0, 6)) {
    const details = [item.dosage, item.duration].filter(Boolean).join(" ");
    const sig = [item.frequency, item.instructions].filter(Boolean).join(" ");
    y = wrapped(ops, item.medicine_name, 58, y, { size: 16, font: "F2", max: 46, lines: 2, leading: 16 }) - 2;
    if (details) y = wrapped(ops, details, 58, y, { size: 11.5, max: 72, lines: 2, leading: 13 }) - 2;
    if (sig) y = wrapped(ops, `Sig. ${sig}`, 58, y, { size: 11.5, max: 68, lines: 2, leading: 13 }) - 8;
  }
  if (medicines.length === 0) {
    text(ops, "No medicine items added.", 58, y, { size: 11 });
    y -= 22;
  }

  text(ops, "Note:", 42, Math.max(y, 170), { size: 13, font: "F3" });
  wrapped(ops, note, 42, Math.max(y - 18, 152), { size: 11, max: 80, lines: 4, leading: 14 });
  rule(ops, 390, 90, 437);
  rule(ops, 499, 90, 545);
  if (signatureImage) {
    const signatureBox = fitImageSize(signatureImage, 92, 34);
    const signatureX = 468 - signatureBox.width / 2;
    const signatureY = 96;
    ops.push("q");
    ops.push(
      `${signatureBox.width.toFixed(2)} 0 0 ${signatureBox.height.toFixed(2)} ${signatureX.toFixed(2)} ${signatureY.toFixed(2)} cm ${logoImage ? "/Im2" : "/Im1"} Do`,
    );
    ops.push("Q");
  }
  text(ops, "Physician's Signature", 468, 58, { size: 12, align: "center" });
  text(ops, `PRC No.: ${prcNo}`, 468, 38, { size: 12, align: "center" });
  text(ops, "(End of Prescription)", 306, 24, { size: 10, align: "center" });
  rule(ops, 42, 18, 570);
  wrapped(ops, "Note to User: The information contained in this electronic prescription is provided by the prescriber. Verify the original prescription before dispensing.", 42, 12, { size: 7, max: 118, lines: 2, leading: 9 });
  text(ops, "Powered by Doc Kulot", 306, 6, { size: 8, font: "F2", align: "center" });

  return pdf(ops, logoImage, signatureImage);
}
