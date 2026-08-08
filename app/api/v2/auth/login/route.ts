import { createClient } from "@supabase/supabase-js";
import { HttpError, httpError, ok } from "@/src/lib/http";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { logActivity } from "@/src/lib/services/activity-log";

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

function readPatientSignupMetadata(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const email = user.email?.trim().toLowerCase() ?? "";
  const fullName =
    typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : email.split("@")[0] || "Patient";

  return {
    email,
    fullName,
    phone: typeof metadata.phone === "string" && metadata.phone.trim() ? metadata.phone.trim() : null,
    dob: typeof metadata.dob === "string" && metadata.dob.trim() ? metadata.dob.trim() : null,
    gender: typeof metadata.gender === "string" && metadata.gender.trim() ? metadata.gender.trim() : null,
    address: typeof metadata.address === "string" && metadata.address.trim() ? metadata.address.trim() : null,
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

      const { error: patientSetupError } = await admin.from("patients").upsert({
        id: data.user.id,
        dob: registration.dob,
        gender: registration.gender,
        address: registration.address,
      });
      if (patientSetupError) throw patientSetupError;
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
