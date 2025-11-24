import { useEffect, useState } from "react";

import heroImage from "../../assets/images/home-page-sample.jpeg";
import { AppStoreButton } from "../AppStoreButton/AppStoreButton";

const rotatingWords = ["community", "workspace", "college", "colleagues", "team", "office"];

export function Hero() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    let timeoutId: number;
    const intervalId = window.setInterval(() => {
      setIsFading(true);
      timeoutId = window.setTimeout(() => {
        setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
        setIsFading(false);
      }, 320);
    }, 2800);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <section id="get-looped" className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-12 top-10 h-56 w-56 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-[-8rem] h-72 w-72 rounded-full bg-brand/10 blur-[120px]" />
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-20 lg:gap-16">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand ring-1 ring-brand/15">
            Private beta · iOS only
          </div>

          <h1 className="flex flex-col text-4xl font-semibold leading-tight text-strong sm:text-5xl lg:text-6xl">
            <span className="block">Your</span>
            <span className="block min-h-[3.5rem] md:min-h-[4rem]">
              <span
                className={`inline-block min-w-[8rem] transition-all duration-300 ease-in-out ${
                  isFading ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                {rotatingWords[currentWordIndex]}
              </span>
              <span>,</span>
            </span>
            <span className="block text-brand">Verified.</span>
          </h1>

          <p className="max-w-2xl text-lg text-text-secondary md:text-xl">
            Looped is where real employees and students speak freely, anonymous by design.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div id="download">
              <AppStoreButton size={7} />
            </div>
            <div className="flex items-center gap-2 text-sm text-text-light">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
              <span>Download the app to get started</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
            {["Verified accounts", "Anonymity controls", "Company + campus channels"].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 rounded-full bg-bg-muted px-4 py-2 ring-1 ring-border"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex justify-center md:justify-end">
          <div className="relative max-w-[20rem] sm:max-w-[22rem] lg:max-w-[24rem]">
            <div className="absolute inset-0 -z-10 rounded-[28px] bg-gradient-to-br from-bg via-bg to-brand/5 blur-2xl" />
            <img
              src={heroImage}
              alt="Looped app interface"
              className="w-full rounded-[28px] border border-white/60 shadow-[0_25px_80px_rgba(234,64,74,0.12)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
