import { Link } from "react-router";

import { AppStoreButton } from "../AppStoreButton/AppStoreButton";
import { Logo } from "@looped/ui";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-bg-muted">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
        <div className="grid gap-8 md:grid-cols-4 md:[grid-template-columns:2fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo />
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
                  href="https://twitter.com/loopedapp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  className="transition hover:text-strong"
                  href="https://instagram.com/loopedapp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-strong">Legal</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>
                <Link className="transition hover:text-strong" to="/privacy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-strong" to="/terms">
                  Terms of Service
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
