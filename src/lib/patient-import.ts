import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { formatPatientFullName, splitPatientFullName } from "@/src/lib/patient-registration";

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
  patientCategory: "New" | "Regular";
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const IMPORT_EMAIL_DOMAIN = "imported.dockulot.test";

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
      patientCategory: "Regular" as const,
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
  const sheetEntry =
    byName.get("xl/worksheets/sheet1.xml")
    ?? entries.find((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name));
  if (!sheetEntry) throw new Error("XLSX workbook has no worksheet.");
  const sheetXml = readZipEntry(buffer, sheetEntry);

  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] ?? "";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const targetIndex = ref ? columnIndex(ref) : row.length;
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
      const value = type === "s" ? sharedStrings[Number(rawValue)] ?? "" : stripTags(rawValue);
      row[targetIndex] = value;
    }
    rows.push(row.map((value) => value ?? ""));
  }
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function placeholderEmail(input: ImportedPatientInput, index: number) {
  const key = (input.patientNumber || `${input.lastName}-${input.firstName}` || `row-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `row-${index + 1}`;
  return `${key}-${index + 1}@${IMPORT_EMAIL_DOMAIN}`;
}

function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "").trim();
}

function formatPatientNumber(value: string) {
  const numericPart = value.replace(/\D/g, "");
  return numericPart ? `PAT-${Number(numericPart).toString().padStart(3, "0")}` : "";
}

export async function importPatients(records: ImportedPatientInput[]): Promise<ImportResult> {
  const supabase = getSupabaseAdmin();
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const { data: patientNumbers, error: patientNumberError } = await supabase
    .from("patients")
    .select("patient_number");
  if (patientNumberError) throw patientNumberError;
  let nextPatientNumber = (patientNumbers ?? []).reduce((max, row) => {
    const formatted = formatPatientNumber(String((row as { patient_number?: string | null }).patient_number ?? ""));
    const numericValue = Number(formatted.slice(4));
    return Number.isFinite(numericValue) ? Math.max(max, numericValue) : max;
  }, 0) + 1;

  for (const [index, record] of records.entries()) {
    try {
      const fullName = formatPatientFullName(record);
      if (!fullName) {
        result.skipped += 1;
        continue;
      }
      const email = record.email.trim().toLowerCase() || placeholderEmail(record, index);
      const phone = record.phone.trim();
      const normalizedPhone = normalizePhone(phone);
      const patientNumber = formatPatientNumber(record.patientNumber) || `PAT-${String(nextPatientNumber++).padStart(3, "0")}`;

      const candidateProfiles = [];
      if (email) candidateProfiles.push(supabase.from("profiles").select("id, role").eq("email", email).maybeSingle<{ id: string; role: string }>());
      if (normalizedPhone) candidateProfiles.push(supabase.from("profiles").select("id, role").eq("phone", phone).maybeSingle<{ id: string; role: string }>());
      const profileResults = await Promise.all(candidateProfiles);
      const existingProfile = profileResults.find((item) => item.data)?.data ?? null;
      if (existingProfile && existingProfile.role !== "patient") {
        throw new Error(`Matched ${email || phone} to a non-patient account.`);
      }

      let existingByPatientNumber: { id: string } | null = null;
      if (patientNumber) {
        const { data } = await supabase
          .from("patients")
          .select("id")
          .eq("patient_number", patientNumber)
          .maybeSingle<{ id: string }>();
        existingByPatientNumber = data ?? null;
      }

      let userId = existingByPatientNumber?.id ?? existingProfile?.id ?? null;
      if (!userId) {
        const { data: created, error } = await supabase.auth.admin.createUser({
          email,
          password: randomUUID(),
          email_confirm: true,
          user_metadata: { full_name: fullName, imported_patient: true },
          app_metadata: { role: "patient" },
        });
        if (error || !created.user) throw error ?? new Error("Unable to create imported patient.");
        userId = created.user.id;
        result.created += 1;
      } else {
        result.updated += 1;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          email,
          full_name: fullName,
          phone: phone || null,
          role: "patient",
          is_active: true,
        })
        .eq("id", userId);
      if (profileError) throw profileError;

      const { error: patientError } = await supabase
        .from("patients")
        .upsert({
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
        });
      if (patientError) throw patientError;
    } catch (error) {
      result.errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Import failed."}`);
    }
  }

  return result;
}
