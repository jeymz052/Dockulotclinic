import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { resolveAftercareGuideForService, type AftercareGuide } from "@/src/lib/healthcare-content";

export type ProcedureConsentPdfRow = {
  id: string;
  patient_id?: string;
  procedure_name: string;
  patient_name: string;
  patient_signature?: string | null;
  witness_name?: string | null;
  witness_signature?: string | null;
  witness_signed_at?: string | null;
  physician_name?: string | null;
  physician_signature?: string | null;
  physician_signed_at?: string | null;
  consent_snapshot?: Record<string, unknown> | null;
  aftercare_acknowledged?: boolean;
  aftercare_guide_title?: string | null;
  signed_at: string;
  doctor_signature_data_url?: string | null;
  doctor_license_no?: string | null;
  doctor_specialty?: string | null;
};

export type ProcedureAftercarePdfRow = {
  id: string;
  patient_id?: string;
  procedure_name: string;
  patient_name: string;
  aftercare_guide_title?: string | null;
  aftercare_acknowledged?: boolean;
  signed_at: string;
  doctor_name?: string | null;
  doctor_specialty?: string | null;
  doctor_license_no?: string | null;
  doctor_signature_data_url?: string | null;
};

type Font = "F1" | "F2" | "F3";

type PdfImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

export function getProcedureConsentPdfFilename(procedureName: string) {
  const safe = procedureName.replace(/[^\w.-]+/g, "_").trim() || "Procedure";
  return `${safe}_Consent_Form.pdf`;
}

export function getProcedureAftercarePdfFilename(procedureName: string) {
  const safe = procedureName.replace(/[^\w.-]+/g, "_").trim() || "Procedure";
  return `${safe}_Aftercare_Instructions.pdf`;
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

function wrap(value: string, max = 80) {
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
  options: { size?: number; font?: Font; max?: number; lines?: number; leading?: number; align?: "left" | "center" | "right" } = {},
) {
  const size = options.size ?? 10;
  const leading = options.leading ?? size + 4;
  const lines = wrap(value, options.max ?? 80).slice(0, options.lines ?? 12);
  lines.forEach((line, index) => text(ops, line, x, y - index * leading, { size, font: options.font, align: options.align }));
  return y - lines.length * leading;
}

function dateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
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
    const padding = 8;
    const leftPadding = padding;
    const rightPadding = padding;
    const topPadding = padding;
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

function decodePng(dataUrl?: string | null): PdfImage | null {
  if (!dataUrl) return null;
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

function buildPdfDocument(ops: string[], images: Array<{ name: string; image: PdfImage }>) {
  const byteLength = (value: string) => Buffer.byteLength(value, "latin1");
  const stream = ["q", "1 w", "0 g", ...ops, "Q"].join("\n");
  const imageObjects: Array<{ objectNumber: number; name: string; image: PdfImage }> = [];
  let nextObjectNumber = 8;

  for (const entry of images) {
    imageObjects.push({ objectNumber: nextObjectNumber, name: entry.name, image: entry.image });
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

const DEFAULT_CONSENT_POINTS = [
  "I confirm that all procedure/s to be done on me has been fully explained to me in a language that I understand, including the nature and purpose, expected benefits, possible risks, side effects, complications and possible alternatives, including doing nothing.",
  "I understand the intended outcome and that results may vary from person to person. No guarantees or promises have been made to me regarding specific results.",
  "I understand that while every effort will be made to ensure safety and the best possible care, no medical procedure is 100% risk-free.",
  "I am aware that the clinic and the attending physician (Doc Kulot) do not take responsibility for any uneventful incident, complication, or dissatisfaction that may occur despite proper care.",
  "I hereby consent willingly and voluntarily to undergo the above-stated procedure(s). I will not hold the clinic, its staff, or the attending physician liable for any adverse outcome, and I will not initiate any legal action or claim against them.",
  "I understand that I may withdraw my consent at any time prior to the procedure. Once the procedure has started, I understand that I may not be able to withdraw my consent.",
];

export function createProcedureConsentPdf(row: ProcedureConsentPdfRow) {
  const logoImage = loadLogoImage();
  const patientSig = decodePng(row.patient_signature);
  const witnessSig = decodePng(row.witness_signature);
  const doctorSig = decodePng(row.physician_signature || row.doctor_signature_data_url);

  const images: Array<{ name: string; image: PdfImage }> = [];
  if (logoImage) images.push({ name: "/ImLogo", image: logoImage });
  if (patientSig) images.push({ name: "/ImPatientSig", image: patientSig });
  if (witnessSig) images.push({ name: "/ImWitnessSig", image: witnessSig });
  if (doctorSig) images.push({ name: "/ImDoctorSig", image: doctorSig });

  const snapshot = row.consent_snapshot ?? {};
  const points: string[] = Array.isArray(snapshot.consentBullets) && snapshot.consentBullets.length >= 6
    ? (snapshot.consentBullets as string[]).filter((item) => typeof item === "string" && item.trim())
    : DEFAULT_CONSENT_POINTS;

  const doctorName = row.physician_name || "Dr. Fatimah Al-Zahra T. Ditti";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : doctorName;
  const prcNo = row.doctor_license_no || "0141185";

  const procName = row.procedure_name || "Medical / Aesthetic Procedure";
  const normProc = procName.toLowerCase();
  const isBotox = normProc.includes("botox");
  const isFillers = normProc.includes("filler");
  const isMeso = normProc.includes("mesotherapy") || normProc.includes("mesolipo");
  const isSclero = normProc.includes("sclerotherapy");
  const isGlp = normProc.includes("glp");
  const isOther = !isBotox && !isFillers && !isMeso && !isSclero && !isGlp;

  const ops: string[] = [];
  // White page canvas
  ops.push("1 1 1 rg");
  rect(ops, 12, 12, 588, 768, "f");
  ops.push("0 g");

  // Logo top left
  if (logoImage) {
    ops.push("q");
    ops.push("135 0 0 74 34 698 cm /ImLogo Do");
    ops.push("Q");
  }

  // Header Center / Top
  text(ops, "Doc Kulot", 306, 756, { size: 22, font: "F2", align: "center" });
  text(ops, "FAMILY MEDICINE SPECIALIST", 306, 742, { size: 10, font: "F2", align: "center" });
  text(ops, "— AESTHETIC MEDICINE —", 306, 730, { size: 9, font: "F1", align: "center" });

  text(ops, "PATIENT CONSENT", 306, 705, { size: 20, font: "F2", align: "center" });
  text(ops, "INFORMED CONSENT FOR MEDICAL / AESTHETIC PROCEDURE(S)", 306, 689, { size: 9.5, font: "F2", align: "center" });

  // PROCEDURE(S) TO BE PERFORMED box
  ops.push("0.96 0.94 0.90 rg");
  rect(ops, 34, 630, 544, 48, "f");
  ops.push("0.6 0.45 0.25 RG");
  rect(ops, 34, 630, 544, 48, "S");
  ops.push("0 g");

  // Procedure title banner inside box
  ops.push("0.6 0.45 0.25 rg");
  rect(ops, 186, 666, 240, 16, "f");
  ops.push("1 1 1 rg");
  text(ops, "PROCEDURE(S) TO BE PERFORMED:", 306, 670.5, { size: 8.5, font: "F2", align: "center" });
  ops.push("0 g");

  // Checklist row 1: Standard procedures
  const checks = [
    { label: "Botox", checked: isBotox, x: 50 },
    { label: "Fillers", checked: isFillers, x: 135 },
    { label: "Mesotherapy", checked: isMeso, x: 225 },
    { label: "Sclerotherapy", checked: isSclero, x: 335 },
    { label: "GLP Initiation", checked: isGlp, x: 455 },
  ];

  checks.forEach((item) => {
    if (item.checked) {
      ops.push("0.6 0.45 0.25 rg");
      rect(ops, item.x, 647, 10.5, 10.5, "f");
      ops.push("1 1 1 rg");
      text(ops, "v", item.x + 5.25, 649, { size: 8, font: "F2", align: "center" });
      ops.push("0 g");
    } else {
      rect(ops, item.x, 647, 10.5, 10.5, "S");
    }
    text(ops, item.label, item.x + 14, 648.5, { size: 9.5, font: item.checked ? "F2" : "F1" });
  });

  // Checklist row 2: Other procedure
  if (isOther) {
    ops.push("0.6 0.45 0.25 rg");
    rect(ops, 50, 635, 10.5, 10.5, "f");
    ops.push("1 1 1 rg");
    text(ops, "v", 55.25, 637, { size: 8, font: "F2", align: "center" });
    ops.push("0 g");
  } else {
    rect(ops, 50, 635, 10.5, 10.5, "S");
  }
  text(ops, "Other procedure:", 64, 636.5, { size: 9.5, font: isOther ? "F2" : "F1" });
  rule(ops, 158, 635, 568);
  if (isOther) {
    text(ops, procName, 168, 637, { size: 9.5, font: "F2" });
  }

  // Preamble
  let y = 612;
  y = wrapped(
    ops,
    `I, the undersigned, hereby voluntarily give my consent to undergo the above-stated procedure(s) to be performed by Doc Kulot, Family Medicine Specialist and Aesthetic Medicine.`,
    34,
    y,
    { size: 9.6, font: "F1", max: 84, lines: 2, leading: 13 },
  ) - 8;

  // 6 Bullet Points with larger font and comfortable line spacing
  for (let i = 0; i < points.length; i += 1) {
    // Check icon / badge
    ops.push("0.6 0.45 0.25 rg");
    rect(ops, 34, y - 1, 11, 11, "f");
    ops.push("1 1 1 rg");
    text(ops, "v", 39.5, y + 0.5, { size: 8.5, font: "F2", align: "center" });
    ops.push("0 g");

    y = wrapped(ops, points[i], 52, y, { size: 9.2, max: 80, lines: 3, leading: 12.5 }) - 6;
  }

  // DISCLAIMER Box with larger font and generous padding
  y -= 4;
  const discHeight = 52;
  ops.push("0.98 0.96 0.92 rg");
  rect(ops, 34, y - discHeight + 10, 544, discHeight, "f");
  ops.push("0.7 0.5 0.2 RG");
  rect(ops, 34, y - discHeight + 10, 544, discHeight, "S");
  ops.push("0 g");

  // Disclaimer Shield Icon Box
  ops.push("0.7 0.5 0.2 rg");
  rect(ops, 44, y - discHeight + 22, 20, 20, "f");
  ops.push("1 1 1 rg");
  text(ops, "+", 54, y - discHeight + 25, { size: 16, font: "F2", align: "center" });
  ops.push("0 g");

  text(ops, "DISCLAIMER", 74, y - 1, { size: 9.5, font: "F2" });
  wrapped(
    ops,
    "By signing this form, I acknowledge that I have read, understood, and had the opportunity to ask questions. All procedures, benefits, risks, possible side effects, alternatives, and expected outcomes were explained to me. I am signing this consent form of my own free will.",
    74,
    y - 13,
    { size: 8.8, max: 76, lines: 3, leading: 11.5 },
  );

  // 3 Signature Columns: Patient, Witness, Physician
  const sigBoxTop = y - discHeight - 4;
  const sigBoxBottom = 34;
  const sigBoxHeight = sigBoxTop - sigBoxBottom;
  const sigLineY = sigBoxBottom + 48;
  const colWidth = 168;
  const col1X = 34;
  const col2X = 222;
  const col3X = 410;

  // Box around signatures
  ops.push("0.98 0.98 0.98 rg");
  rect(ops, 34, sigBoxBottom, 544, sigBoxHeight, "f");
  ops.push("0.85 0.85 0.85 RG");
  rect(ops, 34, sigBoxBottom, 544, sigBoxHeight, "S");
  ops.push("0 g");

  // Column 1: Patient Signature
  text(ops, "PATIENT SIGNATURE", col1X + 12, sigLineY + 54, { size: 9, font: "F2" });
  if (patientSig) {
    const box = fitImageSize(patientSig, 125, 42);
    const imgX = col1X + 18;
    const imgY = sigLineY + 6;
    ops.push("q");
    ops.push(`${box.width.toFixed(2)} 0 0 ${box.height.toFixed(2)} ${imgX.toFixed(2)} ${imgY.toFixed(2)} cm /ImPatientSig Do`);
    ops.push("Q");
  }
  rule(ops, col1X + 12, sigLineY + 4, col1X + colWidth - 12);
  text(ops, `PRINTED NAME: ${row.patient_name}`, col1X + 12, sigLineY - 11, { size: 8.8, font: "F2" });
  text(ops, `DATE: ${dateTime(row.signed_at)}`, col1X + 12, sigLineY - 25, { size: 8.5 });

  // Column 2: Witness Signature
  text(ops, "WITNESS SIGNATURE", col2X + 12, sigLineY + 54, { size: 9, font: "F2" });
  if (witnessSig) {
    const box = fitImageSize(witnessSig, 125, 42);
    const imgX = col2X + 18;
    const imgY = sigLineY + 6;
    ops.push("q");
    ops.push(`${box.width.toFixed(2)} 0 0 ${box.height.toFixed(2)} ${imgX.toFixed(2)} ${imgY.toFixed(2)} cm /ImWitnessSig Do`);
    ops.push("Q");
  }
  rule(ops, col2X + 12, sigLineY + 4, col2X + colWidth - 12);
  text(ops, `PRINTED NAME: ${row.witness_name || "Clinic Witness"}`, col2X + 12, sigLineY - 11, { size: 8.8, font: "F2" });
  text(ops, `DATE: ${row.witness_signed_at ? dateTime(row.witness_signed_at) : (row.witness_signature ? dateTime(row.signed_at) : "Pending")}`, col2X + 12, sigLineY - 25, { size: 8.5 });

  // Column 3: Physician Signature
  text(ops, "PHYSICIAN (DOC KULOT) SIGNATURE", col3X + 6, sigLineY + 54, { size: 8.5, font: "F2" });
  if (doctorSig) {
    const box = fitImageSize(doctorSig, 125, 42);
    const imgX = col3X + 12;
    const imgY = sigLineY + 6;
    ops.push("q");
    ops.push(`${box.width.toFixed(2)} 0 0 ${box.height.toFixed(2)} ${imgX.toFixed(2)} ${imgY.toFixed(2)} cm /ImDoctorSig Do`);
    ops.push("Q");
  }
  rule(ops, col3X + 6, sigLineY + 4, col3X + colWidth - 6);
  text(ops, `PRINTED NAME: ${doctorHeaderName}`, col3X + 6, sigLineY - 10, { size: 8, font: "F2" });
  text(ops, "Family Medicine", col3X + 6, sigLineY - 19, { size: 7.5 });
  text(ops, "Aesthetic Medicine", col3X + 6, sigLineY - 27, { size: 7.5 });
  text(ops, `PRC License No.: ${prcNo}`, col3X + 6, sigLineY - 36, { size: 7.5, font: "F2" });
  text(ops, `DATE: ${row.physician_signed_at ? dateTime(row.physician_signed_at) : (doctorSig ? dateTime(row.signed_at) : "Pending")}`, col3X + 6, sigLineY - 45, { size: 7.5 });

  // Page bottom copyright
  text(ops, "Doc Kulot Clinic System — Official Patient Consent Document", 306, 16, { size: 8, align: "center" });

  return buildPdfDocument(ops, images);
}

export function createProcedureAftercarePdf(row: ProcedureAftercarePdfRow) {
  const logoImage = loadLogoImage();
  const doctorSig = decodePng(row.doctor_signature_data_url);

  const images: Array<{ name: string; image: PdfImage }> = [];
  if (logoImage) images.push({ name: "/ImLogo", image: logoImage });
  if (doctorSig) images.push({ name: "/ImDoctorSig", image: doctorSig });

  const guide: AftercareGuide | null = resolveAftercareGuideForService(row.procedure_name);
  const guideTitle = row.aftercare_guide_title || guide?.title || `${row.procedure_name} Aftercare`;
  const summary = guide?.summary || "Follow these post-procedure instructions carefully to support optimal healing and results.";
  const bullets = guide?.bullets ?? [
    "Follow all post-procedure care instructions given by the doctor.",
    "Keep the treated area clean, dry, and protected.",
    "Avoid strenuous activities and heat exposure for 24-48 hours.",
    "Contact the clinic immediately if you experience unusual symptoms or severe discomfort.",
  ];
  const dos = guide?.dos ?? [];
  const donts = guide?.donts ?? [];
  const followUp = guide?.followUp || "Keep your scheduled follow-up consultation with the doctor.";
  const alert = guide?.alert || "Contact the clinic promptly for severe pain, unusual swelling, redness, fever, or concerning symptoms.";

  const doctorName = row.doctor_name || "Dr. Fatimah Al-Zahra T. Ditti";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : doctorName;
  const specialty = row.doctor_specialty || "Family Medicine Specialist | Aesthetic Medicine";
  const prcNo = row.doctor_license_no || "0141185";

  const ops: string[] = [];
  ops.push("1 1 1 rg");
  rect(ops, 18, 18, 576, 756, "f");
  ops.push("0 g");

  if (logoImage) {
    ops.push("q");
    ops.push("130 0 0 72 42 705 cm /ImLogo Do");
    ops.push("Q");
  }

  text(ops, "POST-PROCEDURE AFTERCARE", 570, 752, { size: 10, font: "F2", align: "right" });
  text(ops, `Date: ${dateTime(row.signed_at)}`, 570, 738, { size: 9, align: "right" });
  text(ops, doctorHeaderName, 306, 724, { size: 15, font: "F2", align: "center" });
  text(ops, "Family Medicine Specialist | Aesthetic Medicine", 306, 709, { size: 9.5, align: "center" });
  text(ops, "Doc Kulot Online Clinic", 306, 692, { size: 14, font: "F2", align: "center" });
  text(ops, "Zamboanga City, Zamboanga Del Sur", 306, 678, { size: 9.5, align: "center" });
  rule(ops, 42, 668, 570);

  // Title
  text(ops, "POST-PROCEDURE AFTERCARE INSTRUCTIONS", 306, 646, { size: 13.5, font: "F2", align: "center" });

  // Banner
  ops.push("0.96 0.96 0.96 rg");
  rect(ops, 42, 604, 528, 32, "f");
  ops.push("0 g");
  rect(ops, 42, 604, 528, 32, "S");

  text(ops, `Patient: ${row.patient_name}`, 52, 622, { size: 10.5, font: "F2" });
  text(ops, `Procedure: ${row.procedure_name}`, 52, 610, { size: 10, font: "F2" });
  text(ops, `Guide: ${guideTitle}`, 558, 622, { size: 9.5, align: "right" });
  text(ops, `Status: ${row.aftercare_acknowledged ? "Acknowledged" : "Provided"}`, 558, 610, { size: 9.5, font: "F2", align: "right" });

  let y = 582;
  text(ops, guideTitle.toUpperCase(), 42, y, { size: 11, font: "F2" });
  y -= 14;
  y = wrapped(ops, summary, 42, y, { size: 9.5, max: 90, lines: 3, leading: 13 }) - 8;

  // Key Instructions
  text(ops, "KEY CARE INSTRUCTIONS", 42, y, { size: 10, font: "F2" });
  y -= 14;
  for (const bullet of bullets.slice(0, 5)) {
    text(ops, "-", 48, y, { size: 10, font: "F2" });
    y = wrapped(ops, bullet, 58, y, { size: 9, max: 84, lines: 3, leading: 12 }) - 3;
  }

  // Dos & Don'ts if available
  if (dos.length > 0 || donts.length > 0) {
    y -= 6;
    if (dos.length > 0) {
      text(ops, "DOs:", 42, y, { size: 9.5, font: "F2" });
      y -= 12;
      for (const item of dos.slice(0, 3)) {
        text(ops, "+", 48, y, { size: 9, font: "F2" });
        y = wrapped(ops, item, 58, y, { size: 8.5, max: 84, lines: 2, leading: 11 }) - 2;
      }
    }
    if (donts.length > 0) {
      y -= 4;
      text(ops, "DON'Ts:", 42, y, { size: 9.5, font: "F2" });
      y -= 12;
      for (const item of donts.slice(0, 3)) {
        text(ops, "x", 48, y, { size: 9, font: "F2" });
        y = wrapped(ops, item, 58, y, { size: 8.5, max: 84, lines: 2, leading: 11 }) - 2;
      }
    }
  }

  // Follow-up & Urgent Alert
  y -= 6;
  text(ops, "Follow-up & Warnings:", 42, y, { size: 9.5, font: "F2" });
  y -= 12;
  y = wrapped(ops, `Follow-up: ${followUp}`, 52, y, { size: 8.5, max: 86, lines: 2, leading: 11 }) - 2;
  y = wrapped(ops, `Urgent Alert: ${alert}`, 52, y, { size: 8.5, font: "F3", max: 86, lines: 2, leading: 11 }) - 8;

  // Physician Signature
  const sigY = Math.max(y - 10, 84);
  if (doctorSig) {
    const box = fitImageSize(doctorSig, 120, 42);
    const imgX = 460 - box.width / 2;
    const imgY = sigY + 4;
    ops.push("q");
    ops.push(`${box.width.toFixed(2)} 0 0 ${box.height.toFixed(2)} ${imgX.toFixed(2)} ${imgY.toFixed(2)} cm /ImDoctorSig Do`);
    ops.push("Q");
  }
  rule(ops, 370, sigY + 2, 550);
  text(ops, doctorHeaderName, 460, sigY - 10, { size: 9.5, font: "F2", align: "center" });
  text(ops, "Family Medicine", 460, sigY - 20, { size: 8, align: "center" });
  text(ops, "Aesthetic Medicine", 460, sigY - 29, { size: 8, align: "center" });
  text(ops, `PRC License No.: ${prcNo}`, 460, sigY - 38, { size: 8, font: "F2", align: "center" });

  rule(ops, 42, 28, 570);
  text(ops, "(End of Post-Procedure Aftercare Instructions)", 306, 18, { size: 8.5, align: "center" });
  text(ops, "Powered by Doc Kulot Online Clinic System", 306, 8, { size: 7.5, font: "F2", align: "center" });

  return buildPdfDocument(ops, images);
}
