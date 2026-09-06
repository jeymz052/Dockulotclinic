import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;
  try {
    return await requireAuthenticatedUser(token);
  } catch {
    return null;
  }
}

/**
 * GET /api/messages/contacts?q=...
 * - For clinic staff/doctors: search/list unique patients to start a message with
 * - Deduplicates multi-imported/duplicate patient records so only one entry per patient is returned
 * - For patients: returns Doc Kulot (clinic doctor) info
 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "messages.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";

  if (auth.role === "PATIENT") {
    // Return the clinic doctor(s)
    const { data: doctors, error } = await supabase
      .from("doctors")
      .select("id, profiles(id, full_name, avatar_url, last_seen_at, role)")
      .limit(5);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const contacts = (doctors || []).map((doc) => {
      const p = Array.isArray(doc.profiles) ? doc.profiles[0] : doc.profiles;
      return {
        id: doc.id,
        full_name: p?.full_name || "Doc Kulot",
        avatar_url: p?.avatar_url || null,
        last_seen_at: p?.last_seen_at || null,
        role: "doctor",
      };
    });

    return NextResponse.json({ contacts });
  }

  // Clinic staff / doctor: search patient directory with deduplication
  let patientQuery = supabase
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url, last_seen_at, role")
    .eq("role", "patient")
    .order("full_name", { ascending: true });

  if (q) {
    patientQuery = patientQuery.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    );
  } else {
    // Fetch a healthy sample to deduplicate from
    patientQuery = patientQuery.limit(100);
  }

  const { data: profiles, error } = await patientQuery;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const profileList = profiles || [];
  const profileIds = profileList.map((p) => p.id);

  // Fetch official patient numbers from patients table
  const patientNumberMap = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: patientsData } = await supabase
      .from("patients")
      .select("id, patient_number")
      .in("id", profileIds);

    if (patientsData) {
      for (const pat of patientsData) {
        if (pat.id && pat.patient_number) {
          patientNumberMap.set(pat.id, pat.patient_number);
        }
      }
    }
  }

  // Fetch appointment counts to prioritize profiles with active booking history
  const apptCountMap = new Map<string, number>();
  if (profileIds.length > 0) {
    const { data: apptData } = await supabase
      .from("appointments")
      .select("patient_id")
      .in("patient_id", profileIds);

    if (apptData) {
      for (const a of apptData) {
        if (a.patient_id) {
          apptCountMap.set(a.patient_id, (apptCountMap.get(a.patient_id) || 0) + 1);
        }
      }
    }
  }

  // Deduplicate by normalized patient name
  type DedupItem = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    patient_number: string | null;
    avatar_url: string | null;
    last_seen_at: string | null;
    role: string;
    score: number;
  };

  const dedupMap = new Map<string, DedupItem>();

  for (const p of profileList) {
    const normName = (p.full_name || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!normName) continue;

    const patientNumber = patientNumberMap.get(p.id) || null;
    const apptCount = apptCountMap.get(p.id) || 0;
    const isSyntheticEmail =
      !p.email ||
      p.email.includes("@imported.") ||
      p.email.includes("dockulot.test") ||
      p.email.includes("-0@im") ||
      p.email.includes("-1@im");

    let score = 0;
    if (!isSyntheticEmail) score += 30; // Real patient login email
    if (apptCount > 0) score += 20 * apptCount; // Has bookings
    if (patientNumber) score += 15; // Has official clinic patient number
    if (p.phone && p.phone.trim().length >= 7) score += 10;
    if (p.last_seen_at) score += 5;

    const candidate: DedupItem = {
      id: p.id,
      full_name: p.full_name.trim(),
      email: isSyntheticEmail ? null : p.email, // Don't expose internal imported uuids
      phone: p.phone || null,
      patient_number: patientNumber,
      avatar_url: p.avatar_url || null,
      last_seen_at: p.last_seen_at || null,
      role: p.role,
      score,
    };

    if (!dedupMap.has(normName) || dedupMap.get(normName)!.score < score) {
      dedupMap.set(normName, candidate);
    }
  }

  const uniqueContacts = Array.from(dedupMap.values())
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .slice(0, 30);

  return NextResponse.json({ contacts: uniqueContacts });
}
