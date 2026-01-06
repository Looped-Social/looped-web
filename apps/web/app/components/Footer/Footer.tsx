import { Link } from "react-router";

import { AppStoreButton } from "../AppStoreButton/AppStoreButton";
import { LoopedMoto, LoopedMotoDark, useTheme } from "@looped/ui";

export function Footer() {
  const { theme } = useTheme();
  const currentYear = new Date().getFullYear();
  const motoSrc = theme === "dark" ? LoopedMotoDark : LoopedMoto;

  return (
    <footer className="mt-16 border-t border-border bg-bg-muted">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
        <div className="grid gap-8 md:grid-cols-4 md:[grid-template-columns:2fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Link
              to="/"
              className="inline-flex w-fit shrink-0 items-center transition-opacity duration-200 hover:opacity-80"
            >
              <img src={motoSrc} alt="Looped" className="h-20 w-auto" />
            </Link>
            <p className="max-w-sm text-sm text-text-secondary">
              Your community, verified. Where real employees and students speak freely.
            </p>
            <AppStoreButton size={5.5} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-strong">Product</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>
                <Link className="transition hover:text-strong" to="/">
                  Home
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/faq">
                  FAQ
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/contact">
                  Feedback
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/community-request">
                  Community Request
                </Link>
              </li>
              <li>
                <a className="transition hover:text-strong" href="#download">
                  Download
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-strong">Company</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>
                <Link className="transition hover:text-strong" to="/about">
                  About
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/contact">
                  Contact
                </Link>
              </li>
              <li>
                <a
                  className="transition hover:text-strong"
                  href="https://twitter.com/loopedsm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  className="transition hover:text-strong"
                  href="https://instagram.com/loopedsm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  className="transition hover:text-strong"
                  href="https://tiktok.com/@loopedsm"
                  target="_blank"
                  rel="noreferrer"
                >
                  TikTok
                </a>
              </li>
              <li>
                <a
                  className="transition hover:text-strong"
                  href="https://www.linkedin.com/company/loopedsm"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-strong">Legal</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>
                <Link className="transition hover:text-strong" to="/privacy">
                  Privacy
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/delete-account">
                  Delete Account
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/privacy-policy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/cookies">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/terms">
                  User Agreement
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/community-rules">
                  Content Policy
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/attributions">
                  Attributions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm text-text-light sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:gap-6">
          <p className="text-left sm:text-left">© {currentYear} Looped, Inc. All rights reserved.</p>
          <p className="text-left sm:text-right">iOS app only</p>
        </div>
      </div>
    </footer>
  );
}
