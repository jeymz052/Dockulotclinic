import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { formatPatientFullName, splitPatientFullName } from "@/src/lib/patient-registration";
import { buildClinicPlaceholderEmail, normalizeClinicEmail } from "@/src/lib/patient-email";

export type ImportedPatientInput = {
  patientNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffixName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  address: string;
  religion: string;
  occupation: string;
  guardianName: string;
  doctorNotes: string;
  patientCategory: "New" | "Existing";
};

export type ImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\u0000/g, "").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function stripTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ""));
}

function normalizeExcelScalar(value: string) {
  const raw = stripTags(value).trim();
  if (!raw) return "";

  const scientific = raw.match(/^([+-]?\d+(?:\.\d+)?)[eE]([+-]?\d+)$/);
  if (!scientific) return raw;

  const [, mantissaRaw, exponentText] = scientific;
  let mantissa = mantissaRaw;
  const exponent = Number(exponentText);
  const negative = mantissa.startsWith("-");
  if (mantissa.startsWith("+") || mantissa.startsWith("-")) {
    mantissa = mantissa.slice(1);
  }

  const [integerPart, fractionPart = ""] = mantissa.split(".");
  const digits = `${integerPart}${fractionPart}`;
  const decimalIndex = integerPart.length + exponent;

  let normalized: string;
  if (exponent >= 0) {
    if (fractionPart.length <= exponent) {
      normalized = `${digits}${"0".repeat(exponent - fractionPart.length)}`;
    } else {
      normalized = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
    }
  } else if (decimalIndex > 0) {
    normalized = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  } else {
    normalized = `0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  }

  return negative ? `-${normalized}` : normalized;
}

function parseDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const mmddyyyy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 1 && serial < 100000) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + serial * 86_400_000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function splitCombinedName(value: string) {
  const raw = value.trim();
  if (!raw) return { firstName: "", middleName: "", lastName: "", suffixName: "" };
  const [familyPart, givenPart] = raw.includes(",")
    ? raw.split(",", 2).map((part) => part.trim())
    : ["", raw];
  const givenPieces = givenPart.split(/\s+/).filter(Boolean);
  return {
    firstName: givenPieces.slice(0, Math.max(1, givenPieces.length - 1)).join(" "),
    middleName: givenPieces.length > 1 ? givenPieces[givenPieces.length - 1] : "",
    lastName: familyPart,
    suffixName: "",
  };
}

function getHeaderValue(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value) return value;
  }
  return "";
}

function normalizeImportedPatientCategory(value: string): "New" | "Existing" | null {
  const normalized = normalizeHeader(value).replace(/\s+/g, "");
  if (!normalized) return null;
  if (normalized.includes("new")) {
    return "New";
  }
  return "Existing";
}

function getImportedPatientCategory(row: Record<string, string>): "New" | "Existing" {
  const categoryHeaderNames = [
    "patient category",
    "patient type",
    "patient status",
    "category",
    "status",
  ];

  for (const header of categoryHeaderNames) {
    const rawValue = row[normalizeHeader(header)];
    const category = rawValue ? normalizeImportedPatientCategory(rawValue) : null;
    if (category) return category;
  }

  return "Existing";
}

export function mapImportRows(rows: string[][]): ImportedPatientInput[] {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell).includes("patient number"))
    || row.some((cell) => normalizeHeader(cell).includes("family name")),
  );
  if (headerRowIndex === -1) return [];

  const headers = rows[headerRowIndex].map((cell) => normalizeHeader(cell));
  return rows.slice(headerRowIndex + 1).map((rawRow) => {
    const keyed: Record<string, string> = {};
    const doctorNotes: string[] = [];
    headers.forEach((header, index) => {
      const value = cleanCell(rawRow[index]);
      if (!header || !value) return;
      if (header.includes("doctor") && header.includes("notes")) {
        doctorNotes.push(value);
        return;
      }
      keyed[header] = keyed[header] ? `${keyed[header]}\n${value}` : value;
    });

    const combinedName = getHeaderValue(keyed, [
      "family name first name middle initial",
      "family name first name middle name middle initial",
      "name",
      "patient name",
      "full name",
    ]);
    const splitName = splitCombinedName(combinedName);
    const firstName = getHeaderValue(keyed, ["first name", "given name"]) || splitName.firstName;
    const lastName = getHeaderValue(keyed, ["family name", "last name", "surname"]) || splitName.lastName;
    const middleName = getHeaderValue(keyed, ["middle name", "middle initial"]) || splitName.middleName;
    const fallbackName = splitPatientFullName(combinedName);
    const normalizedFirstName = firstName || fallbackName.firstName;
    const normalizedLastName = lastName || fallbackName.lastName;

    return {
      patientNumber: getHeaderValue(keyed, ["patient number", "patient no", "patient code"]),
      firstName: normalizedFirstName,
      middleName,
      lastName: normalizedLastName,
      suffixName: getHeaderValue(keyed, ["suffix", "suffix name"]),
      email: getHeaderValue(keyed, ["email", "email address"]),
      phone: getHeaderValue(keyed, ["contact number", "phone", "mobile", "contact no"]),
      dateOfBirth: parseDate(getHeaderValue(keyed, ["birth date", "date of birth", "birthday", "dob"])),
      gender: getHeaderValue(keyed, ["sex", "gender"]),
      civilStatus: getHeaderValue(keyed, ["civil status"]),
      address: getHeaderValue(keyed, ["address"]),
      religion: getHeaderValue(keyed, ["religion"]),
      occupation: getHeaderValue(keyed, ["occupation"]),
      guardianName: getHeaderValue(keyed, ["name of guardian for peds", "guardian", "guardian name"]),
      doctorNotes: doctorNotes.filter(Boolean).join("\n\n"),
      patientCategory: getImportedPatientCategory(keyed),
    };
  }).filter((row) => formatPatientFullName(row) || row.patientNumber || row.phone);
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function readZipEntries(buffer: Buffer) {
  const entries: ZipEntry[] = [];
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Invalid XLSX file.");
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.toString("utf8", centralOffset + 46, centralOffset + 46 + nameLength);
    entries.push({ name, method, compressedSize, localHeaderOffset });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error("Invalid XLSX entry.");
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed.toString("utf8");
  if (entry.method === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error("Unsupported XLSX compression.");
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] ?? "";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const targetIndex = ref ? columnIndex(ref) : row.length;
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
      const value = type === "s" ? sharedStrings[Number(rawValue)] ?? "" : normalizeExcelScalar(rawValue);
      row[targetIndex] = value;
    }
    rows.push(row.map((value) => value ?? ""));
  }
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function parseSharedStrings(xml: string) {
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map((match) => {
    const textParts = [...match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => stripTags(part[1]));
    return textParts.join("");
  });
}

function columnIndex(ref: string) {
  const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
  let total = 0;
  for (const letter of letters) {
    total = total * 26 + letter.charCodeAt(0) - 64;
  }
  return Math.max(0, total - 1);
}

export function parseXlsx(buffer: Buffer) {
  const entries = readZipEntries(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const sharedXml = byName.get("xl/sharedStrings.xml")
    ? readZipEntry(buffer, byName.get("xl/sharedStrings.xml")!)
    : "";
  const sharedStrings = sharedXml ? parseSharedStrings(sharedXml) : [];
  const worksheetEntries = entries
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));

  if (!worksheetEntries.length) throw new Error("XLSX workbook has no worksheet.");

  const rows: string[][] = [];
  for (const entry of worksheetEntries) {
    rows.push(...parseWorksheetRows(readZipEntry(buffer, entry), sharedStrings));
  }
  return rows;
}

function formatPatientNumber(value: string) {
  const raw = value.trim().replace(/,/g, "");
  if (!raw) return "";

  const numericValue = Number(raw);
  if (Number.isFinite(numericValue)) {
    return `PAT-${Math.trunc(numericValue).toString().padStart(3, "0")}`;
  }

  const numericPart = raw.replace(/\D/g, "");
  return numericPart ? `PAT-${Number(numericPart).toString().padStart(3, "0")}` : "";
}

export async function importPatients(records: ImportedPatientInput[]): Promise<ImportResult> {
  const supabase = getSupabaseAdmin();
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  const [{ data: patientNumbers, error: patientNumberError }, { data: profileEmails, error: profileEmailError }] = await Promise.all([
    supabase.from("patients").select("patient_number"),
    supabase.from("profiles").select("email"),
  ]);
  if (patientNumberError) throw patientNumberError;
  if (profileEmailError) throw profileEmailError;

  const usedPatientNumbers = new Set<string>();
  let nextPatientNumber = 1;
  for (const row of patientNumbers ?? []) {
    const formatted = formatPatientNumber(String((row as { patient_number?: string | null }).patient_number ?? ""));
    if (!formatted) continue;
    usedPatientNumbers.add(formatted);
    const numericValue = Number(formatted.slice(4));
    if (Number.isFinite(numericValue)) {
      nextPatientNumber = Math.max(nextPatientNumber, numericValue + 1);
    }
  }

  const usedEmails = new Set<string>();
  for (const row of profileEmails ?? []) {
    const email = normalizeClinicEmail(String((row as { email?: string | null }).email ?? ""));
    if (email) usedEmails.add(email);
  }

  function allocatePatientNumber(preferred: string) {
    const formatted = formatPatientNumber(preferred);
    if (formatted && !usedPatientNumbers.has(formatted)) {
      usedPatientNumbers.add(formatted);
      return formatted;
    }

    while (usedPatientNumbers.has(`PAT-${String(nextPatientNumber).padStart(3, "0")}`)) {
      nextPatientNumber += 1;
    }

    const generated = `PAT-${String(nextPatientNumber++).padStart(3, "0")}`;
    usedPatientNumbers.add(generated);
    return generated;
  }

  function allocateEmail(preferred: string, record: ImportedPatientInput, index: number) {
    const normalized = normalizeClinicEmail(preferred);
    if (normalized && !usedEmails.has(normalized)) {
      usedEmails.add(normalized);
      return normalized;
    }

    const generated = buildClinicPlaceholderEmail(
      `${record.patientNumber || `${record.lastName}-${record.firstName}` || "import"}-${randomUUID()}`,
      index + 1,
    );
    usedEmails.add(generated);
    return generated;
  }

  for (const [index, record] of records.entries()) {
    try {
      const fullName = formatPatientFullName(record);
      if (!fullName) {
        result.skipped += 1;
        continue;
      }
      const suppliedEmail = record.email.trim().toLowerCase();
      const phone = record.phone.trim();
      const patientNumber = allocatePatientNumber(record.patientNumber);
      const email = allocateEmail(suppliedEmail, record, index);

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: fullName, imported_patient: true },
        app_metadata: { role: "patient" },
      });
      if (createError || !created.user) throw createError ?? new Error("Unable to create imported patient.");

      const userId = created.user.id;

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email,
          full_name: fullName,
          phone: phone || null,
          role: "patient",
          is_active: true,
        });
      if (profileError) throw profileError;

      const patientInsert = {
          id: userId,
          patient_number: patientNumber,
          first_name: record.firstName.trim() || null,
          middle_name: record.middleName.trim() || null,
          last_name: record.lastName.trim() || null,
          suffix_name: record.suffixName.trim() || null,
          dob: record.dateOfBirth || null,
          gender: record.gender.trim() || null,
          civil_status: record.civilStatus.trim() || null,
          address: record.address.trim() || null,
          religion: record.religion.trim() || null,
          occupation: record.occupation.trim() || null,
          guardian_name: record.guardianName.trim() || null,
          doctor_notes: record.doctorNotes.trim() || null,
          is_walk_in: false,
          patient_category: record.patientCategory,
      };

      const { error: patientError } = await supabase
        .from("patients")
        .insert(patientInsert);
      if (patientError) throw patientError;

      result.created += 1;
    } catch (error) {
      result.errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Import failed."}`);
    }
  }

  return result;
}
