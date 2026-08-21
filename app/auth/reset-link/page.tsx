import { EmailActionLanding } from "@/src/components/auth/EmailActionLanding";

export default function ResetLinkPage() {
  return (
    <EmailActionLanding
      badge="Password reset"
      title="Reset your Doc Kulot password"
      description="Open the button below to activate your secure reset link. After verification, you will be taken to the password form."
      buttonLabel="Continue to password reset"
      note="If you did not request this email, you can safely ignore it."
      fallbackHref="/login"
      fallbackLabel="Back to login"
    />
  );
}
