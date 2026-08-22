import { EmailActionLanding } from "@/src/components/auth/EmailActionLanding";

export default function ConfirmLinkPage() {
  return (
    <EmailActionLanding
      badge="Secure verification"
      title="Confirm your Doc Kulot account"
      description="Verifying your email now. If the browser does not continue automatically, use the button below."
      buttonLabel="Confirm email address"
      note="After verification, you will return to Doc Kulot to finish signing in."
      fallbackHref="/login"
      fallbackLabel="Back to login"
      autoProceed
    />
  );
}
