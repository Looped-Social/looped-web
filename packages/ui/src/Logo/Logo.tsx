import { Link } from "react-router";

import loopedLogo from "../assets/looped-logo.svg";
import loopedLogoDark from "../assets/looped-logo-dark.svg";
import { useTheme } from "../hooks/useTheme";

type LogoProps = {
  className?: string;
  imageClassName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  width?: number | string;
  height?: number | string;
};

const sizePresets: Record<
  NonNullable<LogoProps["size"]>,
  { className: string; style?: { width: number; height: number } }
> = {
  xs: { className: "h-4 w-auto" },
  sm: { className: "h-5 w-auto" },
  md: { className: "w-5", style: { width: 200, height: 57 } },
  lg: { className: "w-auto", style: { width: 300, height: 75 } },
  xl: { className: "w-auto", style: { width: 400, height: 90 } },
};

export function Logo({
  className = "",
  imageClassName,
  size = "md",
  width,
  height,
}: LogoProps) {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? loopedLogoDark : loopedLogo;
  const preset = sizePresets[size];
  const imageClasses = imageClassName ?? preset.className;
  const imageStyle =
    width || height ? { width, height } : imageClassName ? undefined : preset.style;

  return (
    <Link
      to="/"
      className={`inline-flex w-fit shrink-0 cursor-pointer items-center gap-0 text-text-primary no-underline transition-opacity duration-200 hover:opacity-80 ${className}`}
    >
      <img src={logoSrc} alt="Looped" className={imageClasses} style={imageStyle} />
    </Link>
  );
}
