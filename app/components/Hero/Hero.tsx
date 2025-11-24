import { useEffect, useState } from "react";

import heroImage from "../../assets/images/home-page-sample.jpeg";
import { AppStoreButton } from "../AppStoreButton/AppStoreButton";

const rotatingWords = ["community", "workspace", "college", "colleagues", "team", "office"];
const rotationFadeDurationMs = 500;
const rotationIntervalMs = 3000;

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
    <section id="get-looped" className="bg-bg py-4 sm:py-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-4 px-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:gap-3 md:pl-[5.5rem] md:-mt-5">
          <h1 className="flex flex-col text-5xl font-semibold leading-[1.1] text-strong md:text-6xl">
            <span className="block">Your</span>
            <span className="block min-h-[3.5rem] md:min-h-[4rem]">
              <span
                className={`inline-block min-w-[8rem] transition-all duration-[500ms] ease-in-out ${
                  isFading ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                {rotatingWords[currentWordIndex]}
              </span>
              <span>,</span>
            </span>
            <span className="block text-brand">Verified.</span>
          </h1>

          <p className="mt-1 max-w-5xl text-2xl font-normal leading-[1.6] text-text-primary">
            Looped is where real employees and students speak freely, anonymous by design
          </p>

          <div id="download" className="mt-2">
            <AppStoreButton size={7} />
          </div>
        </div>

        <div className="relative flex justify-center md:justify-end md:pr-[5rem]">
          <div className="absolute inset-0 -z-10 rounded-[28px] bg-gradient-to-br from-bg via-bg to-brand/5 blur-2xl" />
          <img
            src={heroImage}
            alt="Looped app interface"
            className="w-[70%] max-w-[360px] rounded-[24px] border border-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.1)] sm:w-[55%]"
          />
        </div>
      </div>
    </section>
  );
}
