import { Link } from "react-router";

import mainLogo from "../../assets/images/brand-assets/main-logo.svg";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-2 text-strong transition-opacity hover:opacity-80 ${className}`}
    >
      <img src={mainLogo} alt="Looped" className="h-6 w-auto" />
      <span className="text-lg font-medium leading-none tracking-tight">ooped</span>
    </Link>
  );
}
