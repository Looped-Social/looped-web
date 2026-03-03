import { Link } from "react-router";
import { useEffect, useState } from "react";

import heroDarkImage from "@/assets/marketing/landing-page/hero/home-page-sample-dark.PNG";
import heroLightImage from "@/assets/marketing/landing-page/hero/main-feed-light.PNG";
import { useUserSession } from "@/hooks/useUserSession";
import { AppStoreButton } from "../AppStoreButton/AppStoreButton";

const rotatingWords = ["community", "workplace", "college", "colleagues", "team", "office"];
const rotationFadeDurationMs = 500;
const rotationIntervalMs = 2400;

type IconProps = {
  className?: string;
};

function GoogleIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.81-.07-1.62-.21-2.4H12v4.54h6.47c-.28 1.54-1.12 2.84-2.39 3.72v3.09h3.86c2.26-2.08 3.55-5.15 3.55-8.95z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.86-3.09c-1.07.72-2.44 1.15-4.09 1.15-3.15 0-5.82-2.13-6.78-4.99H1.27v3.14C3.24 21.38 7.37 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.22 14.17A7.22 7.22 0 0 1 4.84 12c0-.76.13-1.49.37-2.17V6.69H1.27A11.99 11.99 0 0 0 0 12c0 1.93.46 3.75 1.27 5.31l3.95-3.14z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.96 1.19 15.24 0 12 0 7.37 0 3.24 2.62 1.27 6.69l3.95 3.14C6.18 6.96 8.85 4.77 12 4.77z"
      />
    </svg>
  );
}

function AppleIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.36 1.38c0 1.14-.46 2.2-1.28 3.02-.8.84-2.14 1.48-3.3 1.38-.12-1.06.4-2.2 1.2-3.02.8-.84 2.18-1.46 3.38-1.38z" />
      <path d="M20.8 17.03c-.56 1.3-.82 1.88-1.54 3.04-1 1.6-2.4 3.6-4.14 3.62-1.54.02-1.94-1-4-1-2.08 0-2.52.98-4.02 1.02-1.72.04-3.06-1.78-4.06-3.38-2.76-4.3-3.06-9.36-1.36-11.98 1.2-1.84 3.1-2.92 4.86-2.92 1.82 0 2.98 1.02 4.5 1.02 1.48 0 2.38-1.02 4.5-1.02 1.56 0 3.22.86 4.42 2.34-3.88 2.12-3.24 7.66.84 9.26z" />
    </svg>
  );
}

export function Hero() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const { signInWithGoogle, signInWithApple, error, status } = useUserSession();

  useEffect(() => {
    let timeoutId: number | undefined;
    const intervalId = window.setInterval(() => {
      setIsFading(true);
      timeoutId = window.setTimeout(() => {
        setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
        setIsFading(false);
      }, rotationFadeDurationMs);
    }, rotationIntervalMs);

    return () => {
      clearInterval(intervalId);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <section id="get-looped" className="bg-bg py-6 sm:py-8">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 md:grid-cols-[1.05fr_0.95fr] md:px-10 lg:gap-10 lg:px-14">
        <div className="flex max-w-[560px] flex-col gap-4">
          <h1 className="flex flex-col text-[52px] font-semibold leading-[1.02] text-strong sm:text-[60px] lg:text-[72px]">
            <span className="block leading-[1.05]">Your</span>
            <span className="block min-h-[4rem] leading-[1.05] sm:min-h-[4.5rem] lg:min-h-[5rem]">
              <span
                className={`inline-block min-w-[10rem] text-[52px] font-semibold leading-[1.05] transition-all duration-[500ms] ease-in-out sm:text-[60px] lg:min-w-[12rem] lg:text-[72px] lg:leading-[1.05] ${
                  isFading ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                {rotatingWords[currentWordIndex]}
              </span>
              <span>,</span>
            </span>
            <span className="block text-brand">Verified.</span>
          </h1>

          <p className="max-w-xl text-[20px] leading-relaxed text-text-primary sm:text-[24px]">
            Looped is where real employees and students speak freely.
          </p>

          <div className="max-w-[420px] space-y-3 pt-2">
            <button
              type="button"
              disabled={status === "checking" || status === "loading"}
              onClick={signInWithGoogle}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-bg px-5 py-3.5 text-[1.05rem] font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon className="h-5 w-5" />
              Continue with Google
            </button>

            <button
              type="button"
              disabled={status === "checking" || status === "loading"}
              onClick={signInWithApple}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-bg px-5 py-3.5 text-[1.05rem] font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <AppleIcon className="h-5 w-5" />
              Continue with Apple
            </button>

            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-3.5 text-[1.05rem] font-semibold text-white transition hover:bg-brand/90"
            >
              Sign in with email
            </Link>

            {error ? <p className="text-sm text-brand">{error}</p> : null}

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:gap-4">
              <div id="download" className="shrink-0">
                <AppStoreButton size={5.1} />
              </div>

              <p className="text-base text-text-secondary sm:whitespace-nowrap">
                New to Looped?{" "}
                <Link to="/login" className="font-semibold text-secondary transition hover:opacity-85">
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex justify-center md:justify-end">
          <div className="absolute inset-0 -z-10 rounded-[28px] bg-gradient-to-br from-bg via-bg to-brand/5 blur-2xl dark:to-white/10" />
          <img
            src={heroLightImage}
            alt="Looped app interface"
            className="w-[72%] min-w-[240px] max-w-[360px] rounded-[24px] ring-1 ring-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:hidden sm:w-[58%] md:w-[62%] lg:w-[68%]"
          />
          <img
            src={heroDarkImage}
            alt="Looped app interface"
            className="hidden w-[72%] min-w-[240px] max-w-[360px] rounded-[24px] ring-1 ring-white/15 shadow-[0_20px_80px_rgba(0,0,0,0.75)] dark:block sm:w-[58%] md:w-[62%] lg:w-[68%]"
          />
        </div>
      </div>
    </section>
  );
}
