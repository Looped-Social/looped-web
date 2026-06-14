import { useEffect, useState } from "react";

import landingPagePhoto from "@/assets/marketing/landing-page/hero/landing-page-photo2.png";

type HeroProps = {
  onOpenDialog: () => void;
};

const rotatingWords = ["workplace", "field", "career"];
const rotationFadeDurationMs = 550;
const rotationIntervalMs = 3200;

export function Hero({ onOpenDialog }: HeroProps) {
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
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <section
      id="get-looped"
      data-home-tone="light"
      className="relative min-h-screen snap-start snap-always overflow-hidden bg-white"
    >
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-20 pt-36 sm:px-6 sm:pb-24 sm:pt-40 lg:px-8 lg:pb-28 lg:pt-44">
        <div className="flex flex-1 flex-col items-center justify-center gap-10 lg:grid lg:grid-cols-[0.38fr_0.62fr] lg:items-center lg:gap-3">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center lg:mx-0 lg:-translate-y-20 lg:items-start lg:pl-6 lg:text-left xl:pl-8">
            <h1 className="flex flex-col items-center text-[2.8rem] font-semibold leading-[0.97] tracking-[-0.05em] text-strong sm:text-[3.7rem] lg:items-start lg:text-[4.9rem]">
              <span className="block text-balance">Verified connection</span>
              <span className="flex flex-wrap items-baseline justify-center gap-x-[0.18em] gap-y-1 lg:justify-start">
                <span className="block">in your</span>
                <span
                  className={`inline-block min-w-[4.6ch] text-center text-brand transition-all duration-[550ms] ease-in-out lg:text-left ${
                    isFading ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                  }`}
                >
                  {rotatingWords[currentWordIndex]}.
                </span>
              </span>
            </h1>
            <p className="mt-6 max-w-[30ch] text-lg leading-8 text-text-secondary sm:text-xl">
              Connect, grow, and be yourself with people who understand your work.
            </p>

            <button
              type="button"
              onClick={onOpenDialog}
              className="mt-7 inline-flex items-center justify-center rounded-full bg-brand px-8 py-4 text-lg font-semibold text-white transition hover:bg-brand/90"
            >
              get looped
            </button>
          </div>

          <div className="relative flex w-full justify-center lg:-translate-y-10 lg:justify-end">
            <img
              src={landingPagePhoto}
              alt="Looped collage showing people connecting across workplace-style social posts."
              loading="eager"
              decoding="async"
              className="h-auto w-[min(66vw,44rem)] max-w-full drop-shadow-[0_26px_80px_rgba(15,23,42,0.24)] lg:w-[min(60vw,54rem)] lg:max-w-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
