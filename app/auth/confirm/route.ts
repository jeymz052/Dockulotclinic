import { NextResponse } from "next/server";
import { createClient, type EmailOtpType } from "@supabase/supabase-js";
import { getSafeAuthRedirect } from "@/src/lib/auth/redirect";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { enqueueNotification } from "@/src/lib/services/notification";

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
    redirectUrl.searchParams.set("message", "Email verified. You can now sign in.");
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
      const fullName = typeof userMetadata.full_name === "string" && userMetadata.full_name.trim()
        ? userMetadata.full_name.trim()
        : authUser.user?.email?.split("@")[0] ?? "Patient";
      const phone = typeof userMetadata.phone === "string" ? userMetadata.phone.trim() : "";
      const dob = typeof userMetadata.dob === "string" ? userMetadata.dob : null;
      const gender = typeof userMetadata.gender === "string" ? userMetadata.gender : null;
      const address = typeof userMetadata.address === "string" ? userMetadata.address : null;
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
          phone,
          dob,
          gender,
          address,
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

      const { error: upsertPatientError } = await admin.from("patients").upsert({
        id: verifiedUserId,
        dob,
        gender,
        address,
      });
      if (upsertPatientError) throw upsertPatientError;

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

  redirectUrl.searchParams.set("message", "Email verified. You can now sign in.");
  return NextResponse.redirect(redirectUrl);
}
