import { createClient } from "@supabase/supabase-js";
import { HttpError, httpError, ok } from "@/src/lib/http";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { logActivity } from "@/src/lib/services/activity-log";
import { formatPatientFullName } from "@/src/lib/patient-registration";

type LoginPayload = {
  email?: string;
  password?: string;
};

function normalizeLoginPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Invalid login payload.");
  }

  const body = payload as LoginPayload;
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }

  return { email, password };
}

function getSupabaseAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase browser auth configuration is missing.");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isMissingOfficialPatientColumn(error: unknown) {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "42703"
      && "message" in error
      && /first_name|middle_name|last_name|suffix_name|civil_status|religion|occupation|guardian_name/i.test(String((error as { message?: unknown }).message ?? "")),
  );
}

function readPatientSignupMetadata(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const email = user.email?.trim().toLowerCase() ?? "";
  const fullName =
    formatPatientFullName({
      firstName: typeof metadata.first_name === "string" ? metadata.first_name : null,
      middleName: typeof metadata.middle_name === "string" ? metadata.middle_name : null,
      lastName: typeof metadata.last_name === "string" ? metadata.last_name : null,
      suffixName: typeof metadata.suffix_name === "string" ? metadata.suffix_name : null,
      fullName: typeof metadata.full_name === "string" ? metadata.full_name : null,
    }) || email.split("@")[0] || "Patient";

  return {
    email,
    fullName,
    firstName: typeof metadata.first_name === "string" && metadata.first_name.trim() ? metadata.first_name.trim() : null,
    middleName: typeof metadata.middle_name === "string" && metadata.middle_name.trim() ? metadata.middle_name.trim() : null,
    lastName: typeof metadata.last_name === "string" && metadata.last_name.trim() ? metadata.last_name.trim() : null,
    suffixName: typeof metadata.suffix_name === "string" && metadata.suffix_name.trim() ? metadata.suffix_name.trim() : null,
    phone: typeof metadata.phone === "string" && metadata.phone.trim() ? metadata.phone.trim() : null,
    dob: typeof metadata.dob === "string" && metadata.dob.trim() ? metadata.dob.trim() : null,
    gender: typeof metadata.gender === "string" && metadata.gender.trim() ? metadata.gender.trim() : null,
    civilStatus: typeof metadata.civil_status === "string" && metadata.civil_status.trim() ? metadata.civil_status.trim() : null,
    address: typeof metadata.address === "string" && metadata.address.trim() ? metadata.address.trim() : null,
    religion: typeof metadata.religion === "string" && metadata.religion.trim() ? metadata.religion.trim() : null,
    occupation: typeof metadata.occupation === "string" && metadata.occupation.trim() ? metadata.occupation.trim() : null,
    guardianName: typeof metadata.guardian_name === "string" && metadata.guardian_name.trim() ? metadata.guardian_name.trim() : null,
  };
}

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);
    enforceRateLimit(req, "auth-login", 8, 60_000);

    const { email, password } = normalizeLoginPayload(await req.json().catch(() => null));
    const authClient = getSupabaseAnonClient();
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      await logActivity({
        action: "auth.login_failed",
        entity_table: "profiles",
        metadata: { email },
      });
      throw new HttpError(401, "Invalid credentials.");
    }

    if (!data.user.email_confirmed_at) {
      await authClient.auth.signOut();
      throw new HttpError(403, "Please verify your email before signing in.");
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, is_active, role, email")
      .eq("id", data.user.id)
      .maybeSingle<{ id: string; is_active: boolean; role: string; email: string }>();

    if (profileError) throw profileError;

    if (!profile) {
      const registration = readPatientSignupMetadata(data.user);
      if (!registration.email) {
        await authClient.auth.signOut();
        throw new HttpError(403, "Your email is verified, but your patient profile is not ready yet. Contact the clinic administrator.");
      }

      const { error: profileSetupError } = await admin.from("profiles").upsert({
        id: data.user.id,
        email: registration.email,
        full_name: registration.fullName,
        phone: registration.phone,
        role: "patient",
        is_active: true,
      });
      if (profileSetupError) throw profileSetupError;

      const patientSetup = {
        id: data.user.id,
        first_name: registration.firstName,
        middle_name: registration.middleName,
        last_name: registration.lastName,
        suffix_name: registration.suffixName,
        dob: registration.dob,
        gender: registration.gender,
        civil_status: registration.civilStatus,
        address: registration.address,
        religion: registration.religion,
        occupation: registration.occupation,
        guardian_name: registration.guardianName,
      };
      const { error: patientSetupError } = await admin.from("patients").upsert(patientSetup);
      if (isMissingOfficialPatientColumn(patientSetupError)) {
        const { error: legacyPatientSetupError } = await admin.from("patients").upsert({
          id: data.user.id,
          dob: registration.dob,
          gender: registration.gender,
          address: registration.address,
        });
        if (legacyPatientSetupError) throw legacyPatientSetupError;
      } else if (patientSetupError) {
        throw patientSetupError;
      }
    }

    const { data: activeProfile, error: activeProfileError } = await admin
      .from("profiles")
      .select("id, is_active, role, email")
      .eq("id", data.user.id)
      .maybeSingle<{ id: string; is_active: boolean; role: string; email: string }>();

    if (activeProfileError) throw activeProfileError;
    if (!activeProfile?.is_active) {
      await authClient.auth.signOut();
      throw new HttpError(403, "This account is inactive. Contact the clinic administrator.");
    }

    return ok({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (e) {
    return httpError(e);
  }
}
