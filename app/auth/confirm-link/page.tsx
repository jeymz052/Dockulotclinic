import { EmailActionLanding } from "@/src/components/auth/EmailActionLanding";

export default function ConfirmLinkPage() {
  return (
    <EmailActionLanding
      badge="Secure verification"
      title="Confirm your Doc Kulot account"
      description="Open the button below to verify your email address. The extra click protects you from automated email scanners consuming the link before you do."
      buttonLabel="Confirm email address"
      note="After verification, you will return to Doc Kulot to finish signing in."
      fallbackHref="/login"
      fallbackLabel="Back to login"
    />
  );
}
