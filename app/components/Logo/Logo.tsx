import { Link } from "react-router";

import mainLogo from "../../assets/images/brand-assets/main-logo.svg";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      to="/"
      className={`flex cursor-pointer items-center gap-0 text-text-primary no-underline transition-opacity duration-200 hover:opacity-80 ${className}`}
    >
      <img src={mainLogo} alt="Looped" className=" w-auto text-lg h-6" />
      <span className="text-lg font-normal leading-none tracking-tight text-text-primary">ooped</span>
    </Link>
  );
}
