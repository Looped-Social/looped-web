import { useEffect, useState } from "react";

import heroDarkImage from "~/assets/landing-page/hero/home-page-sample-dark.PNG";
import heroLightImage from "~/assets/landing-page/hero/main-feed-light.PNG";
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
    <section id="get-looped" className="bg-bg pb-12 pt-8 md:pb-16 md:pt-12">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 md:grid-cols-[1.12fr_0.88fr] md:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="flex flex-col text-5xl font-semibold leading-[1.05] text-strong sm:text-6xl lg:text-7xl">
            <span className="block leading-[1.05]">Your</span>
            <span className="block min-h-[4.1rem] leading-[1.05] sm:min-h-[4.8rem] lg:min-h-[5.5rem]">
              <span
                className={`inline-block min-w-[10.5rem] transition-all duration-[500ms] ease-in-out sm:min-w-[12.5rem] ${
                  isFading ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                {rotatingWords[currentWordIndex]}
              </span>
              ,
            </span>
            <span className="block text-brand">Verified.</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-text-secondary md:text-xl">
            Looped is where verified employees and students share honest perspective with people who understand their
            context.
          </p>

          <div id="download" className="mt-6 flex flex-wrap items-center gap-4">
            <AppStoreButton size={5.8} />
            <p className="text-sm text-text-secondary">iOS first. Signed-in members can also use web.</p>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <div className="w-full max-w-[430px] rounded-3xl border border-border bg-bg-muted/35 p-3 shadow-[0_12px_34px_rgba(15,23,42,0.14)]">
            <img
              src={heroLightImage}
              alt="Looped app interface"
              className="block h-auto w-full rounded-2xl ring-1 ring-black/5 dark:hidden"
            />
            <img
              src={heroDarkImage}
              alt="Looped app interface"
              className="hidden h-auto w-full rounded-2xl ring-1 ring-white/15 dark:block"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
