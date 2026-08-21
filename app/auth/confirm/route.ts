import { NextResponse } from "next/server";
import { createClient, type EmailOtpType } from "@supabase/supabase-js";
import { getSafeAuthRedirect } from "@/src/lib/auth/redirect";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { enqueueNotification } from "@/src/lib/services/notification";
import { formatPatientFullName } from "@/src/lib/patient-registration";

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const verified = requestUrl.searchParams.get("verified");
  const next = getSafeAuthRedirect(requestUrl.searchParams.get("next"), "/login");
  const redirectUrl = new URL(next, requestUrl.origin);
  const recoveryRedirectUrl = new URL("/auth/reset", requestUrl.origin);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    redirectUrl.searchParams.set(
      "message",
      "Supabase auth configuration is missing.",
    );
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let error: Error | null = null;
  let verifiedUserId: string | null = null;

  if (type === "recovery" && code) {
    recoveryRedirectUrl.searchParams.set("code", code);
    return NextResponse.redirect(recoveryRedirectUrl);
  }

  if (type === "recovery" && tokenHash) {
    recoveryRedirectUrl.searchParams.set("token_hash", tokenHash);
    recoveryRedirectUrl.searchParams.set("type", type);
    return NextResponse.redirect(recoveryRedirectUrl);
  }

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
    verifiedUserId = result.data.user?.id ?? null;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    error = result.error;
    verifiedUserId = result.data.user?.id ?? null;
  } else if (verified === "1") {
    redirectUrl.searchParams.set("message", "Email verified successfully. You can now sign in.");
    return NextResponse.redirect(redirectUrl);
  } else {
    redirectUrl.searchParams.set(
      "message",
      "This verification link is invalid, expired, or already used. If you can already sign in, your email is likely verified.",
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (error) {
    redirectUrl.searchParams.set(
      "message",
      "This verification link is invalid, expired, or already used. If you can already sign in, your email is likely verified.",
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (verifiedUserId) {
    let profileSetupFailed = false;
    try {
      const admin = getSupabaseAdmin();
      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(verifiedUserId);
      if (authUserError) throw authUserError;

      const userMetadata =
        authUser.user?.user_metadata && typeof authUser.user.user_metadata === "object"
          ? authUser.user.user_metadata
          : {};
      const firstName = typeof userMetadata.first_name === "string" ? userMetadata.first_name.trim() : "";
      const middleName = typeof userMetadata.middle_name === "string" ? userMetadata.middle_name.trim() : "";
      const lastName = typeof userMetadata.last_name === "string" ? userMetadata.last_name.trim() : "";
      const suffixName = typeof userMetadata.suffix_name === "string" ? userMetadata.suffix_name.trim() : "";
      const fullName = formatPatientFullName({
        firstName,
        middleName,
        lastName,
        suffixName,
        fullName: typeof userMetadata.full_name === "string" ? userMetadata.full_name : null,
      }) || authUser.user?.email?.split("@")[0] || "Patient";
      const phone = typeof userMetadata.phone === "string" ? userMetadata.phone.trim() : "";
      const dob = typeof userMetadata.dob === "string" ? userMetadata.dob : null;
      const gender = typeof userMetadata.gender === "string" ? userMetadata.gender : null;
      const civilStatus = typeof userMetadata.civil_status === "string" ? userMetadata.civil_status : null;
      const address = typeof userMetadata.address === "string" ? userMetadata.address : null;
      const religion = typeof userMetadata.religion === "string" ? userMetadata.religion : null;
      const occupation = typeof userMetadata.occupation === "string" ? userMetadata.occupation : null;
      const guardianName = typeof userMetadata.guardian_name === "string" ? userMetadata.guardian_name : null;
      const email = authUser.user?.email?.trim().toLowerCase();

      if (!email) {
        throw new Error("Verified user is missing an email address.");
      }

      const { error: updateAuthError } = await admin.auth.admin.updateUserById(verifiedUserId, {
        app_metadata: {
          ...(authUser.user?.app_metadata && typeof authUser.user.app_metadata === "object"
            ? authUser.user.app_metadata
            : {}),
          role: "patient",
        },
        user_metadata: {
          ...userMetadata,
          full_name: fullName,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          suffix_name: suffixName,
          phone,
          dob,
          gender,
          civil_status: civilStatus,
          address,
          religion,
          occupation,
          guardian_name: guardianName,
        },
      });
      if (updateAuthError) throw updateAuthError;

      const { error: upsertProfileError } = await admin.from("profiles").upsert({
        id: verifiedUserId,
        email,
        full_name: fullName,
        phone: phone || null,
        role: "patient",
        is_active: true,
      });
      if (upsertProfileError) throw upsertProfileError;

      const patientProfile = {
        id: verifiedUserId,
        first_name: firstName || null,
        middle_name: middleName || null,
        last_name: lastName || null,
        suffix_name: suffixName || null,
        dob,
        gender,
        civil_status: civilStatus,
        address,
        religion,
        occupation,
        guardian_name: guardianName,
      };
      const { error: upsertPatientError } = await admin.from("patients").upsert(patientProfile);
      if (isMissingOfficialPatientColumn(upsertPatientError)) {
        const { error: legacyPatientError } = await admin.from("patients").upsert({
          id: verifiedUserId,
          dob,
          gender,
          address,
        });
        if (legacyPatientError) throw legacyPatientError;
      } else if (upsertPatientError) {
        throw upsertPatientError;
      }

      await enqueueNotification({
        user_id: verifiedUserId,
        template: "welcome",
        channels: ["email"],
        payload: { full_name: fullName },
      });
    } catch (notificationError) {
      profileSetupFailed = true;
      console.error("[auth-confirm] failed to queue welcome notification", notificationError);
    }

    if (profileSetupFailed) {
      redirectUrl.searchParams.set(
        "message",
        "Email verified, but your patient profile setup did not finish. Try signing in once, or contact the clinic administrator if this message appears again.",
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  redirectUrl.searchParams.set("message", "Email verified successfully. You can now sign in.");
  return NextResponse.redirect(redirectUrl);
}
