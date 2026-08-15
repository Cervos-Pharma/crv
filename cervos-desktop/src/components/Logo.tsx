import { APP_NAME } from "../lib/branding";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

const LOGO_URL = "/logo.png";

export default function Logo({ size = "md", className = "" }: LogoProps) {
  return (
    <img
      src={LOGO_URL}
      alt={APP_NAME}
      className={`object-contain ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt={APP_NAME}
      className={`object-contain h-8 w-8 ${className}`}
    />
  );
}
