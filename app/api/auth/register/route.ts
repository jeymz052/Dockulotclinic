import { HttpError, httpError, ok } from "@/src/lib/http";
import {
  normalizePatientRegistrationFields,
  validatePatientRegistrationFields,
  type PatientRegistrationFields,
} from "@/src/lib/patient-registration";
import { isProtectedSuperAdminEmail } from "@/src/lib/auth/protected-accounts";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";

type RegisterPayload = PatientRegistrationFields & {
};

function assertRegisterPayload(payload: unknown): RegisterPayload {
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Invalid registration payload.");
  }

  const body = payload as Partial<RegisterPayload>;
  const fields = normalizePatientRegistrationFields({
    fullName: body.fullName ?? "",
    firstName: body.firstName ?? "",
    middleName: body.middleName ?? "",
    lastName: body.lastName ?? "",
    suffixName: body.suffixName ?? "",
    email: body.email ?? "",
    phone: body.phone ?? "",
    dateOfBirth: body.dateOfBirth ?? "",
    gender: body.gender ?? "",
    civilStatus: body.civilStatus ?? "",
    address: body.address ?? "",
    religion: body.religion ?? "",
    occupation: body.occupation ?? "",
    guardianName: body.guardianName ?? "",
  });

  const validationError = validatePatientRegistrationFields(fields);
  if (validationError) {
    throw new HttpError(400, validationError);
  }
  if (isProtectedSuperAdminEmail(fields.email)) {
    throw new HttpError(400, "This email is reserved for the super admin account.");
  }

  return {
    ...fields,
  };
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
        fullName: body.fullName,
      },
    }, 201);
  } catch (e) {
    return httpError(e);
  }
}
