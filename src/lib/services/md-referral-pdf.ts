import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

export type MdReferralPdfRow = {
  referral_no: string;
  created_at: string;
  referred_specialty: string;
  referred_doctor?: string | null;
  reason_for_referral: string;
  note?: string | null;
  released_to_patient: boolean;
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

type PdfImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

export function getMdReferralPdfFilename(referralNo: string) {
  return `${referralNo.replace(/[^\w.-]+/g, "_")}.pdf`;
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

function decodePng(dataUrl: string) {
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

function formatReferralDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  return {
    date: date.toLocaleDateString("en-US"),
    time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

export function createMdReferralPdf(row: MdReferralPdfRow) {
  const createdAt = new Date(row.created_at);
  const doctorName = row.doctors?.profiles?.full_name ?? "Dr. Fatimah Al-Zahra T. Ditti";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : "Fatimah Al-Zahra T. Ditti, MD";
  const clinicHeaderName = doctorNameBase ? `${doctorNameBase} Online Clinic` : "Doc Kulot Online Clinic";
  const specialty = "Family Medicine Specialist | Aesthetic Medicine";
  const prcNo = row.doctors?.license_no ?? "0141185";
  const logoImage = loadLogoImage();
  const signatureImage = row.doctor_signature_data_url ? decodePng(row.doctor_signature_data_url) : null;
  const patientName = row.patients?.profiles?.full_name ?? "Patient";
  const patientAge = ageFromDob(row.patients?.dob, createdAt);
  const patientGender = row.patients?.gender ?? "Not recorded";
  const referredSpecialty = row.referred_specialty?.trim() || "Internal Medicine";
  const referredDoctor = row.referred_doctor?.trim() || "";
  const reason = row.reason_for_referral?.trim() || "Clinical consultation and management.";
  const refDate = formatReferralDate(row.created_at);

  const ops: string[] = [];
  ops.push("1 1 1 rg");
  rect(ops, 18, 18, 576, 756, "f");
  ops.push("0 g");

  // Top Left Logo
  if (logoImage) {
    ops.push("q");
    ops.push("140 0 0 74 42 696 cm /Im1 Do");
    ops.push("Q");
  }

  // Top Right: REFERRAL ID and Referral No
  text(ops, "REFERRAL ID", 570, 744, { size: 9, font: "F1", align: "right" });
  text(ops, row.referral_no, 570, 726, { size: 15, font: "F2", align: "right" });

  // Doctor & Clinic Header (Centered)
  text(ops, doctorHeaderName, 306, 680, { size: 16, font: "F2", align: "center" });
  text(ops, specialty, 306, 664, { size: 10, align: "center" });
  text(ops, clinicHeaderName, 306, 646, { size: 15, font: "F2", align: "center" });
  text(ops, "Zamboanga City, Zamboanga Del Sur", 306, 630, { size: 10, align: "center" });
  rule(ops, 42, 614, 570);

  // Patient Demographic Section
  text(ops, "Patient: ", 42, 586, { size: 11, font: "F1" });
  text(ops, patientName, 42 + textWidth("Patient: ", 11), 586, { size: 11, font: "F2" });
  text(ops, `Referred on: ${refDate.date}`, 570, 586, { size: 10, align: "right" });

  text(ops, patientAge != null ? `Age: ${patientAge} years old` : "Age: Not recorded", 42, 568, { size: 10.5 });
  if (refDate.time) {
    text(ops, `${refDate.time} PHT`, 570, 568, { size: 10, align: "right" });
  }

  text(ops, `Gender: ${patientGender}`, 42, 550, { size: 10.5 });

  // Content Section: Referred Doctor & Reason for Referral
  let curY = 510;
  text(ops, "Referred Doctor", 42, curY, { size: 12, font: "F2" });
  curY -= 18;
  if (referredDoctor) {
    text(ops, "Doctor: ", 42, curY, { size: 10.5, font: "F1" });
    text(ops, referredDoctor, 42 + textWidth("Doctor: ", 10.5), curY, { size: 10.5, font: "F2" });
    curY -= 16;
  }
  text(ops, "Specialty: ", 42, curY, { size: 10.5, font: "F1" });
  text(ops, referredSpecialty, 42 + textWidth("Specialty: ", 10.5), curY, { size: 10.5, font: "F2" });

  curY -= 26;
  text(ops, "Reason for Referral", 42, curY, { size: 12, font: "F2" });
  curY = wrapped(ops, reason, 42, curY - 16, { size: 10.5, max: 80, lines: 7, leading: 14 });

  // Physician Signature (Right-aligned, matching preview)
  const sigRuleY = 190;
  if (signatureImage) {
    const signatureBox = fitImageSize(signatureImage, 130, 48);
    const signatureX = 468 - signatureBox.width / 2;
    const signatureY = sigRuleY + 2;
    ops.push("q");
    ops.push(
      `${signatureBox.width.toFixed(2)} 0 0 ${signatureBox.height.toFixed(2)} ${signatureX.toFixed(2)} ${signatureY.toFixed(2)} cm ${logoImage ? "/Im2" : "/Im1"} Do`,
    );
    ops.push("Q");
  }
  rule(ops, 370, sigRuleY, 565);
  text(ops, doctorHeaderName, 468, sigRuleY - 14, { size: 10, font: "F2", align: "center" });
  text(ops, "Family Medicine", 468, sigRuleY - 26, { size: 8.5, align: "center" });
  text(ops, "Aesthetic Medicine", 468, sigRuleY - 37, { size: 8.5, align: "center" });
  text(ops, `PRC License No.: ${prcNo}`, 468, sigRuleY - 49, { size: 8.5, font: "F2", align: "center" });

  // Footer & Disclaimer matching preview
  text(ops, "(End of MD Referral)", 306, 92, { size: 9, align: "center" });
  text(
    ops,
    "Note to User: The information contained in this electronic referral is provided by the referring physician and should be verified upon presentation.",
    306,
    72,
    { size: 7.5, align: "center" },
  );
  rule(ops, 42, 56, 570);
  text(ops, "Powered by Doc Kulot", 306, 42, { size: 8.5, font: "F2", align: "center" });
  text(ops, "For clinic use only.", 306, 30, { size: 8, align: "center" });

  return pdf(ops, logoImage, signatureImage);
}
