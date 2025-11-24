import { Link } from "react-router";

import { AppStoreButton } from "../AppStoreButton/AppStoreButton";
import { Logo } from "../Logo/Logo";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
        <div className="grid gap-8 md:grid-cols-[2fr,1fr,1fr,1fr]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-sm text-sm text-slate-600">
              Your community, verified. Where real employees and students speak freely.
            </p>
            <AppStoreButton size={5.5} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Product</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link className="transition hover:text-slate-900" to="/">
                  Home
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-slate-900" to="/faq">
                  FAQ
                </Link>
              </li>
              <li>
                <a className="transition hover:text-slate-900" href="#download">
                  Download
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Company</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link className="transition hover:text-slate-900" to="/about">
                  About
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-slate-900" to="/contact">
                  Contact
                </Link>
              </li>
              <li>
                <a
                  className="transition hover:text-slate-900"
                  href="https://twitter.com/loopedapp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  className="transition hover:text-slate-900"
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
            <h3 className="text-sm font-semibold text-slate-900">Legal</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link className="transition hover:text-slate-900" to="/privacy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="transition hover:text-slate-900" to="/terms">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Looped, Inc. All rights reserved.</p>
          <p>iOS app only</p>
        </div>
      </div>
    </footer>
  );
}
