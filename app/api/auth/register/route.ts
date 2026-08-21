import { HttpError, httpError, ok } from "@/src/lib/http";
import { isProtectedSuperAdminEmail } from "@/src/lib/auth/protected-accounts";
import { validatePatientSignupFields, type PatientSignupFields } from "@/src/lib/patient-registration";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";

type RegisterPayload = PatientSignupFields;

function assertRegisterPayload(payload: unknown): RegisterPayload {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Invalid registration payload.");
  }

  const body = payload as Partial<RegisterPayload>;
  const fields: RegisterPayload = {
    email: body.email ?? "",
    password: body.password ?? "",
    confirmPassword: body.confirmPassword ?? "",
  };

  const validationError = validatePatientSignupFields(fields);
  if (validationError) {
    throw new HttpError(400, validationError);
  }
  if (isProtectedSuperAdminEmail(fields.email)) {
    throw new HttpError(400, "This email is reserved for the super admin account.");
  }

  return fields;
}

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);
    enforceRateLimit(req, "auth-register", 10, 60_000);

    const body = assertRegisterPayload(await req.json());
    return ok({
      success: true,
      message: "Account created in pending state. Please verify your email to finish registration.",
      patient: {
        email: body.email,
      },
    }, 201);
  } catch (e) {
    return httpError(e);
  }
}
