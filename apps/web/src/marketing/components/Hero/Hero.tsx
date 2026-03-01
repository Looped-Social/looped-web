import { useEffect, useState } from "react";

import heroDarkImage from "@/assets/marketing/landing-page/hero/home-page-sample-dark.PNG";
import heroLightImage from "@/assets/marketing/landing-page/hero/main-feed-light.PNG";
import { AppStoreButton } from "../AppStoreButton/AppStoreButton";

const rotatingWords = ["community", "workplace", "college", "colleagues", "team", "office"];
const rotationFadeDurationMs = 500;
const rotationIntervalMs = 2400;

export function Hero() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

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
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-4 md:grid-cols-[1.25fr_0.75fr] md:px-10 lg:px-14">
        <div className="flex flex-col gap-3 md:gap-5 md:pl-0">
          <h1 className="flex flex-col text-[60px] font-semibold leading-[1.05] text-strong md:text-[72px] md:leading-[1.05]">
            <span className="block leading-[1.05]">Your</span>
            <span className="block min-h-[4.2rem] leading-[1.05] md:min-h-[5rem]">
              <span
                className={`inline-block min-w-[10rem] text-[60px] font-semibold leading-[1.05] transition-all duration-[500ms] ease-in-out md:min-w-[12rem] md:text-[72px] md:leading-[1.05] ${
                  isFading ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                {rotatingWords[currentWordIndex]}
              </span>
              <span>,</span>
            </span>
            <span className="block text-brand">Verified.</span>
          </h1>

          <p className="mt-2 max-w-none text-[24px] font-normal leading-relaxed text-text-primary md:text-[28px]">
            Looped is where real employees and students speak freely
          </p>

          <div id="download" className="mt-2">
            <AppStoreButton size={6.2} />
          </div>
        </div>

        <div className="relative flex justify-center md:justify-end md:pr-0">
          <div className="absolute inset-0 -z-10 rounded-[28px] bg-gradient-to-br from-bg via-bg to-brand/5 blur-2xl dark:to-white/10" />
          <img
            src={heroLightImage}
            alt="Looped app interface"
            className="w-[80%] min-w-[260px] max-w-[440px] rounded-[24px] ring-1 ring-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:hidden sm:w-[65%] md:w-[75%] lg:w-[80%]"
          />
          <img
            src={heroDarkImage}
            alt="Looped app interface"
            className="hidden w-[80%] min-w-[260px] max-w-[440px] rounded-[24px] ring-1 ring-white/15 shadow-[0_20px_80px_rgba(0,0,0,0.75)] dark:block sm:w-[65%] md:w-[75%] lg:w-[80%]"
          />
        </div>
      </div>
    </section>
  );
}
