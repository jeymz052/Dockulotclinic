import Image from "next/image";

type QrPhLogoProps = {
  className?: string;
};

export function QrPhLogo({ className = "h-auto w-20" }: QrPhLogoProps) {
  return (
    <Image
      src="/images/qr-ph-logo.svg"
      alt="QR Ph"
      width={300}
      height={71}
      className={className}
    />
  );
}
