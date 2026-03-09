import { useEffect, useRef, useState } from "react";

import { Hero } from "@/marketing/components/Hero/Hero";
import { HomeChoiceDialog, HomeLandingChrome } from "@/marketing/components/HomeLandingChrome/HomeLandingChrome";
import { HomeStorySections } from "@/marketing/components/HomeStorySections/HomeStorySections";

export function HomePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [chromeTone, setChromeTone] = useState<"light" | "dark">("light");
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateTone = () => {
      const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-home-tone]"));
      if (!sections.length) return;

      const containerRect = container.getBoundingClientRect();
      const probeY = containerRect.top + container.clientHeight * 0.5;

      let activeSection = sections[0];
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= probeY) {
          activeSection = section;
          break;
        }
      }

      const nextTone = activeSection.dataset.homeTone === "dark" ? "dark" : "light";
      setChromeTone(nextTone);
    };

    updateTone();
    container.addEventListener("scroll", updateTone, { passive: true });

    return () => {
      container.removeEventListener("scroll", updateTone);
    };
  }, []);

  return (
    <div className="landing-force-light h-screen overflow-hidden bg-bg">
      <HomeLandingChrome tone={chromeTone} />
      <main ref={scrollContainerRef} className="h-screen snap-y snap-mandatory overflow-y-auto">
        <Hero onOpenDialog={() => setIsDialogOpen(true)} />
        <HomeStorySections />
      </main>
      <HomeChoiceDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </div>
  );
}
