import { Link } from "react-router";

import mainLogo from "../../assets/images/brand-assets/main-logo.svg";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-2 text-slate-900 transition-opacity hover:opacity-80 ${className}`}
    >
      <img src={mainLogo} alt="Looped" className="h-8 w-auto" />
      <span className="text-lg font-semibold leading-none tracking-tight">ooped</span>
    </Link>
  );
}
