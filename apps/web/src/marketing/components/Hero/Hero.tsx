import { useEffect, useState } from "react";

type HeroProps = {
  onOpenDialog: () => void;
};

const rotatingWords = ["workplace", "community", "career"];
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
      className="relative min-h-screen snap-start snap-always overflow-hidden bg-brand/8"
    >
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-32 pt-28 sm:px-6 sm:pb-36 sm:pt-32 lg:px-8 lg:pb-40 lg:pt-36">
        <div className="flex flex-1 items-center justify-center">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <h1 className="flex flex-col items-center text-[2.8rem] font-semibold leading-[0.97] tracking-[-0.05em] text-strong sm:text-[3.7rem] lg:text-[4.9rem]">
              <span className="block whitespace-nowrap">Verified connection</span>
              <span className="block whitespace-nowrap">in your</span>
              <span
                className={`block min-w-[10.5ch] whitespace-nowrap text-center text-brand transition-all duration-[550ms] ease-in-out ${
                  isFading ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                {rotatingWords[currentWordIndex]}.
              </span>
            </h1>
            <p className="mt-6 max-w-[28ch] text-lg leading-8 text-text-secondary sm:text-xl">
              Connect, grow and be yourself in your workplace.
            </p>

            <button
              type="button"
              onClick={onOpenDialog}
              className="mt-10 inline-flex items-center justify-center rounded-full bg-brand px-7 py-3.5 text-base font-semibold text-white transition hover:bg-brand/90"
            >
              get looped
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
