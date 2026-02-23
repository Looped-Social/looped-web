import type { IconType } from "react-icons";
import { SiInstagram, SiLinkedin, SiTiktok, SiX } from "react-icons/si";

type SocialLink = {
  label: string;
  href: string;
  Icon: IconType;
};

const socialLinks: SocialLink[] = [
  { label: "Twitter", href: "https://twitter.com/loopedsm", Icon: SiX },
  { label: "Instagram", href: "https://instagram.com/loopedsm", Icon: SiInstagram },
  { label: "TikTok", href: "https://tiktok.com/@loopedsm", Icon: SiTiktok },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/loopedsm", Icon: SiLinkedin },
];

type SocialIconLinksProps = {
  className?: string;
  linkClassName?: string;
  iconClassName?: string;
};

export function SocialIconLinks({ className, linkClassName, iconClassName }: SocialIconLinksProps) {
  return (
    <div className={joinClasses("flex flex-wrap items-center gap-4", className)}>
      {socialLinks.map(({ label, href, Icon }) => (
        <a
          key={label}
          className={joinClasses(
            "inline-flex h-11 w-11 items-center justify-center text-strong transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
            linkClassName,
          )}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={label}
        >
          <Icon aria-hidden className={joinClasses("h-7 w-7", iconClassName)} />
          <span className="sr-only">{label}</span>
        </a>
      ))}
    </div>
  );
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}
