import { EmailActionLanding } from "@/src/components/auth/EmailActionLanding";

export default function ResetLinkPage() {
  return (
    <EmailActionLanding
      badge="Password reset"
      title="Reset your Doc Kulot password"
      description="Resetting your password now. If the browser does not continue automatically, use the button below."
      buttonLabel="Continue to password reset"
      note="If you did not request this email, you can safely ignore it."
      fallbackHref="/login"
      fallbackLabel="Back to login"
      autoProceed
    />
  );
}
