import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

export type LaboratoryRequestPdfRow = {
  request_no: string;
  created_at: string;
  selected_tests?: string[];
  blood_chemistry?: string[];
  hematology?: string[];
  immuno_serology?: string[];
  clinical_microscopy?: string[];
  ultrasound?: string | null;
  xray?: string | null;
  ct_scan?: string | null;
  others?: string | null;
  notes?: string | null;
  released_to_patient?: boolean;
  patients?: {
    dob?: string | null;
    gender?: string | null;
    address?: string | null;
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

export function getLaboratoryRequestPdfFilename(requestNo: string) {
  return `${requestNo.replace(/[^\w.-]+/g, "_")}.pdf`;
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

function drawCheckbox(ops: string[], x: number, y: number, label: string, checked: boolean, size = 8.5) {
  // Draw checkbox square
  rect(ops, x, y, 7.5, 7.5, "S");
  if (checked) {
    // Draw mark inside box
    ops.push("0.9 w");
    ops.push(`${(x + 1.5).toFixed(2)} ${(y + 3.8).toFixed(2)} m ${(x + 3.2).toFixed(2)} ${(y + 1.8).toFixed(2)} l ${(x + 6.2).toFixed(2)} ${(y + 6.2).toFixed(2)} l S`);
    ops.push("1 w");
  }
  // Draw label
  text(ops, label, x + 11, y + 0.5, { size, font: checked ? "F2" : "F1" });
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
  return `${date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })}`;
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
  const pLeft = Math.abs(predictor - left);
  const pUp = Math.abs(predictor - up);
  const pUpLeft = Math.abs(predictor - upLeft);

  if (pLeft <= pUp && pLeft <= pUpLeft) return left;
  if (pUp <= pUpLeft) return up;
  return upLeft;
}

function decodePngBuffer(input: Buffer): PdfImage | null {
  if (input.length < 8) return null;
  if (input.readUInt32BE(0) !== 0x89504e47 || input.readUInt32BE(4) !== 0x0d0a1a0a) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let compressionMethod = 0;
  let filterMethod = 0;
  let interlaceMethod = 0;
  const idatChunks: Buffer[] = [];

  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString("ascii", offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      compressionMethod = data[10];
      filterMethod = data[11];
      interlaceMethod = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (
    !width ||
    !height ||
    bitDepth !== 8 ||
    compressionMethod !== 0 ||
    filterMethod !== 0 ||
    interlaceMethod !== 0
  ) {
    return null;
  }

  let bytesPerPixel = 0;
  if (colorType === 2) bytesPerPixel = 3;
  else if (colorType === 6) bytesPerPixel = 4;
  else return null;

  const compressed = Buffer.concat(idatChunks);
  const uncompressed = inflateSync(compressed);
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc(width * height * 3);

  let sourceOffset = 0;
  let targetOffset = 0;
  const scanline = Buffer.alloc(stride);
  const previousScanline = Buffer.alloc(stride);

  for (let row = 0; row < height; row += 1) {
    const filter = uncompressed[sourceOffset];
    sourceOffset += 1;

    for (let column = 0; column < stride; column += 1) {
      const current = uncompressed[sourceOffset + column];
      const left = column >= bytesPerPixel ? scanline[column - bytesPerPixel] : 0;
      const up = previousScanline[column];
      const upLeft = column >= bytesPerPixel ? previousScanline[column - bytesPerPixel] : 0;

      let value = current;
      if (filter === 1) value = (current + left) & 0xff;
      else if (filter === 2) value = (current + up) & 0xff;
      else if (filter === 3) value = (current + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) value = (current + paeth(left, up, upLeft)) & 0xff;
      else if (filter !== 0) return null;

      scanline[column] = value;
    }

    sourceOffset += stride;

    for (let pixel = 0; pixel < width; pixel += 1) {
      const pixelOffset = pixel * bytesPerPixel;
      const red = scanline[pixelOffset];
      const green = scanline[pixelOffset + 1];
      const blue = scanline[pixelOffset + 2];
      const alpha = colorType === 6 ? scanline[pixelOffset + 3] : 255;

      const normalizedAlpha = alpha / 255;
      raw[targetOffset] = Math.round(red * normalizedAlpha + 255 * (1 - normalizedAlpha));
      raw[targetOffset + 1] = Math.round(green * normalizedAlpha + 255 * (1 - normalizedAlpha));
      raw[targetOffset + 2] = Math.round(blue * normalizedAlpha + 255 * (1 - normalizedAlpha));
      targetOffset += 3;
    }

    scanline.copy(previousScanline);
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

export function createLaboratoryRequestPdf(row: LaboratoryRequestPdfRow) {
  const createdAt = new Date(row.created_at);
  const doctorName = row.doctors?.profiles?.full_name ?? "Dr. Fatimah Al-Zahra T. Ditti";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD, DFM` : "FATIMAH AL-ZAHRA T. DITTI, MD, DFM";
  const clinicHeaderName = doctorNameBase ? `${doctorNameBase} Online Clinic` : "Doc Kulot Online Clinic";
  const prcNo = row.doctors?.license_no ?? "0141185";
  const logoImage = loadLogoImage();
  const signatureImage = row.doctor_signature_data_url ? decodePng(row.doctor_signature_data_url) : null;
  const patientName = row.patients?.profiles?.full_name ?? "Patient";
  const patientAge = ageFromDob(row.patients?.dob, createdAt);
  const patientGender = row.patients?.gender ? (row.patients.gender.toLowerCase().startsWith("f") ? "F" : "M") : "";
  const patientAddress = row.patients?.address?.trim() || "";

  // Selected tests set
  const selectedSet = new Set(
    (row.selected_tests ?? []).concat(
      row.blood_chemistry ?? [],
      row.hematology ?? [],
      row.immuno_serology ?? [],
      row.clinical_microscopy ?? [],
    ),
  );

  const ops: string[] = [];
  // White background
  ops.push("1 1 1 rg");
  rect(ops, 18, 18, 576, 756, "f");
  ops.push("0 g");

  // Doc Kulot logo — top left, same size/position as prescription
  if (logoImage) {
    ops.push("q");
    ops.push("140 0 0 78 42 700 cm /Im1 Do");
    ops.push("Q");
  }

  // LABORATORY REQUEST label — top right
  text(ops, "Laboratory Request ID", 570, 746, { size: 10, font: "F2", align: "right" });
  text(ops, row.request_no, 570, 732, { size: 13, font: "F2", align: "right" });

  // Doctor / clinic block — centered, same style as prescription
  text(ops, doctorHeaderName, 306, 714, { size: 16, font: "F2", align: "center" });
  text(ops, "Family Medicine Specialist | Aesthetic Medicine", 306, 698, { size: 10, align: "center" });
  text(ops, clinicHeaderName, 306, 683, { size: 14, font: "F2", align: "center" });
  text(ops, "Zamboanga City, Zamboanga Del Sur", 306, 669, { size: 8.5, align: "center" });

  // Horizontal rule under header
  rule(ops, 38, 660, 565);

  // Document Title
  text(ops, "L A B O R A T O R Y   R E Q U E S T", 306, 644, { size: 13, font: "F2", align: "center" });

  // Patient Demographic Section
  const dateStr = dateTime(row.created_at);
  text(ops, "Date:", 430, 622, { size: 9.5, font: "F2" });
  text(ops, dateStr, 460, 622, { size: 9.5 });
  rule(ops, 455, 619, 565);

  text(ops, "Patient's name:", 38, 602, { size: 9.5, font: "F2" });
  text(ops, patientName, 120, 602, { size: 10, font: "F2" });
  rule(ops, 115, 599, 565);

  text(ops, "Address:", 38, 580, { size: 9.5, font: "F2" });
  text(ops, patientAddress, 88, 580, { size: 9 });
  rule(ops, 84, 577, 385);

  text(ops, "Age / Sex:", 398, 580, { size: 9.5, font: "F2" });
  const ageSexStr = patientAge != null ? `${patientAge} / ${patientGender || "-"}` : patientGender || "-";
  text(ops, ageSexStr, 460, 580, { size: 9.5, font: "F2" });
  rule(ops, 455, 577, 565);

  // Divider
  rule(ops, 38, 564, 565);

  // -------------------------------------------------------------
  // 4 CATEGORIES (2x2 Grid)
  // -------------------------------------------------------------

  // Row 1 Left: BLOOD CHEMISTRY
  text(ops, "BLOOD CHEMISTRY", 38, 548, { size: 9.5, font: "F2" });
  const bloodChemLeft = [
    "Lipid Profile",
    "Fasting Blood Sugar",
    "Blood Uric Acid",
    "SGOT (AST)",
    "SGPT (ALT)",
    "BUN",
    "Creatinine",
  ];
  const bloodChemRight = [
    "Electrolytes",
    "Total protein",
    "B1, B2",
    "HbA1c",
  ];

  let chemY = 530;
  bloodChemLeft.forEach((label) => {
    drawCheckbox(ops, 38, chemY, label, selectedSet.has(label));
    chemY -= 15;
  });

  let chemRightY = 530;
  bloodChemRight.forEach((label) => {
    drawCheckbox(ops, 185, chemRightY, label, selectedSet.has(label));
    chemRightY -= 15;
  });

  // Row 1 Right: HEMATOLOGY
  text(ops, "HEMATOLOGY", 335, 548, { size: 9.5, font: "F2" });
  const hematologyItems = [
    "Complete Blood Count",
    "Blood Typing",
    "Clotting/Bleeding Time",
    "Protime",
    "APTT",
  ];
  let hemaY = 530;
  hematologyItems.forEach((label) => {
    drawCheckbox(ops, 335, hemaY, label, selectedSet.has(label));
    hemaY -= 15;
  });

  // Row 2 Left: IMMUNO/SEROLOGY
  text(ops, "IMMUNO/SEROLOGY", 38, 408, { size: 9.5, font: "F2" });
  const immunoLeft = [
    "HBsAg",
    "Hepatitis C Virus",
    "Hepatitis A Virus",
    "HIV",
    "Syphilis Test",
  ];
  const immunoRight = [
    "Typhoid",
    "Dengue",
    "H.Pylori",
  ];
  let immunoY = 390;
  immunoLeft.forEach((label) => {
    drawCheckbox(ops, 38, immunoY, label, selectedSet.has(label));
    immunoY -= 15;
  });

  let immunoRightY = 390;
  immunoRight.forEach((label) => {
    drawCheckbox(ops, 185, immunoRightY, label, selectedSet.has(label));
    immunoRightY -= 15;
  });

  // Row 2 Right: CLINICAL MICROSCOPY
  text(ops, "CLINICAL MICROSCOPY", 335, 408, { size: 9.5, font: "F2" });
  const microscopyItems = [
    "Urinalysis",
    "Fecalysis",
    "Pregnancy Test",
    "Fecal Occult Blood",
  ];
  let microY = 390;
  microscopyItems.forEach((label) => {
    drawCheckbox(ops, 335, microY, label, selectedSet.has(label));
    microY -= 15;
  });

  // Divider
  rule(ops, 38, 300, 565);

  // -------------------------------------------------------------
  // IMAGING / RADIOLOGY & SPECIAL DIAGNOSTICS
  // -------------------------------------------------------------
  text(ops, "IMAGING & SPECIAL DIAGNOSTICS", 38, 283, { size: 9.5, font: "F2" });

  text(ops, "Ultrasound:", 38, 263, { size: 9, font: "F2" });
  text(ops, row.ultrasound?.trim() || "________________________________________________________", 102, 263, { size: 9, font: row.ultrasound ? "F2" : "F1" });

  text(ops, "X-Ray:", 38, 243, { size: 9, font: "F2" });
  text(ops, row.xray?.trim() || "________________________________________________________", 82, 243, { size: 9, font: row.xray ? "F2" : "F1" });

  text(ops, "CT Scan / Others:", 38, 223, { size: 9, font: "F2" });
  text(ops, row.ct_scan?.trim() || "__________________________________________________", 130, 223, { size: 9, font: row.ct_scan ? "F2" : "F1" });

  // OTHERS / REMARKS
  text(ops, "OTHERS / CLINICAL REMARKS:", 38, 198, { size: 9.5, font: "F2" });
  const othersText = row.others?.trim() || row.notes?.trim() || "____________________________________________________________________________________";
  text(ops, othersText, 38, 180, { size: 9, font: row.others || row.notes ? "F2" : "F1" });
  rule(ops, 38, 172, 565);

  // -------------------------------------------------------------
  // REQUESTING PHYSICIAN SIGNATURE & FOOTER
  // -------------------------------------------------------------
  text(ops, "Requesting Physician", 460, 134, { size: 9.5, font: "F2", align: "center" });

  if (signatureImage) {
    const signatureBox = fitImageSize(signatureImage, 110, 48);
    const signatureX = 460 - signatureBox.width / 2;
    const signatureY = 90;
    ops.push("q");
    ops.push(
      `${signatureBox.width.toFixed(2)} 0 0 ${signatureBox.height.toFixed(2)} ${signatureX.toFixed(2)} ${signatureY.toFixed(2)} cm ${logoImage ? "/Im2" : "/Im1"} Do`,
    );
    ops.push("Q");
  }

  rule(ops, 370, 86, 550);
  text(ops, doctorHeaderName, 460, 73, { size: 9.5, font: "F2", align: "center" });
  text(ops, "Family Medicine", 460, 62, { size: 8.5, align: "center" });
  text(ops, "Aesthetic Medicine", 460, 52, { size: 8.5, align: "center" });
  text(ops, `PRC License No.: ${prcNo}`, 460, 42, { size: 8.5, font: "F2", align: "center" });

  // Footer
  rule(ops, 38, 36, 565);
  text(ops, "Note: This diagnostic request is issued for clinical evaluation. Results should be submitted for physician review.", 38, 26, { size: 7.5 });
  text(ops, "Powered by Doc Kulot Online Clinic", 306, 18, { size: 8, font: "F2", align: "center" });

  return pdf(ops, logoImage, signatureImage);
}
