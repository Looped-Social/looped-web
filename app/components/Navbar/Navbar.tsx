import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { Logo } from "../Logo/Logo";

const finePrintLinks = [
  { label: "Community Rules", to: "/community-rules" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
  { label: "FAQ", to: "/faq" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isFinePrintOpen, setIsFinePrintOpen] = useState(false);
  const [isMobileFinePrintOpen, setIsMobileFinePrintOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFinePrintOpen(false);
      }
    };

    if (isFinePrintOpen) {
      document.addEventListener("mousedown", clickHandler);
    }

    return () => document.removeEventListener("mousedown", clickHandler);
  }, [isFinePrintOpen]);

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <header
      className={`sticky top-0 z-50 bg-bg transition-shadow ${
        isScrolled ? "shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-border/80" : ""
      }`}
    >
      <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-10">
          <Logo />

          <nav className="hidden items-center gap-8 text-[0.95rem] font-normal text-text-primary md:flex">
            <Link className="transition-colors hover:text-strong" to="/about">
              About
            </Link>

            <div className="relative" ref={dropdownRef}>
              <button
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 transition-colors hover:bg-bg-muted hover:text-strong"
                onClick={() => setIsFinePrintOpen((open) => !open)}
                aria-expanded={isFinePrintOpen}
              >
                The Fine Print
                <svg
                  className={`h-3 w-3 transition-transform ${isFinePrintOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="2 4 6 8 10 4" />
                </svg>
              </button>

              {isFinePrintOpen && (
                <div className="absolute left-0 top-full mt-3 w-56 rounded-lg border border-border bg-bg p-2 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                  {finePrintLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="block rounded-md px-3 py-2 text-[0.95rem] text-text-primary transition hover:bg-bg-muted hover:text-strong"
                      onClick={() => setIsFinePrintOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link className="transition-colors hover:text-strong" to="/contact">
              Get in touch
            </Link>
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link className="text-[0.95rem] font-normal text-text-primary transition hover:text-strong" to="/login">
            Log in
          </Link>
          <a
            href="#get-looped"
            className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/80"
          >
            Get Looped
          </a>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-primary transition hover:bg-bg-muted/70 md:hidden"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </div>

      {isMobileOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => {
              setIsMobileOpen(false);
              setIsMobileFinePrintOpen(false);
            }}
          />

          <div className="fixed inset-y-0 right-0 z-50 flex w-[82%] max-w-sm flex-col gap-6 bg-bg p-6 shadow-[0_22px_60px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-primary transition hover:bg-bg-muted/70"
                onClick={() => {
                  setIsMobileOpen(false);
                  setIsMobileFinePrintOpen(false);
                }}
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col gap-3 text-base font-medium text-text-primary">
              <Link
                to="/about"
                className="rounded-lg px-3 py-2 transition hover:bg-bg-muted"
                onClick={() => setIsMobileOpen(false)}
              >
                About
              </Link>

              <div className="rounded-lg bg-bg-muted">
                <button
                  className="flex w-full items-center justify-between px-3 py-3 text-left"
                  onClick={() => setIsMobileFinePrintOpen((open) => !open)}
                  aria-expanded={isMobileFinePrintOpen}
                >
                  <span>The Fine Print</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${isMobileFinePrintOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="2 4 6 8 10 4" />
                  </svg>
                </button>

                {isMobileFinePrintOpen && (
                  <div className="flex flex-col border-t border-border">
                    {finePrintLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="px-4 py-3 text-sm text-text-secondary transition hover:bg-bg"
                        onClick={() => setIsMobileOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                to="/contact"
                className="rounded-lg px-3 py-2 transition hover:bg-bg-muted"
                onClick={() => setIsMobileOpen(false)}
              >
                Get in touch
              </Link>
            </nav>

            <div className="mt-auto space-y-3 pt-4">
              <Link
                to="/login"
                className="block rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                onClick={() => setIsMobileOpen(false)}
              >
                Log in
              </Link>
              <a
                href="#get-looped"
                className="block rounded-full bg-brand px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand/90"
                onClick={() => setIsMobileOpen(false)}
              >
                Get Looped
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
