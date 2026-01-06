type FeatureSection = {
  title: string;
  description: string;
  cta: string;
  reverse?: boolean;
};

const featureSections: FeatureSection[] = [
  {
    title: "Get verified",
    description:
      "Getting verified is simple and quick. All information verified fast and secure, never kept",
    cta: "How We Verify",
  },
  {
    title: "Anonymous",
    description:
      "Talk anonymously, free from trackers and data breaches. Anonymous to others, always authentic.",
    cta: "Our Privacy Pledge",
    reverse: true,
  },
  {
    title: "Find your people",
    description:
      "Connect with verified people in your local community. Join trusted groups at your workplace or school, or create your own space in minutes.",
    cta: "Learn More",
  },
];

export function FeatureSections() {
  return (
    <section className="bg-bg py-20 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-24 px-4">
        {featureSections.map((section) => {
          const mediaOrder = section.reverse ? "lg:order-2" : "lg:order-1";
          const textOrder = section.reverse ? "lg:order-1" : "lg:order-2";

          return (
            <div
              key={section.title}
              className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
            >
              <div className={`flex justify-center ${mediaOrder}`}>
                <div className="relative aspect-square w-full max-w-[480px] rounded-[32px] bg-bg-muted shadow-sm">
                  <span className="sr-only">{section.title} video placeholder</span>
                </div>
              </div>

              <div className={`space-y-3 ${textOrder}`}>
                <h3 className="text-3xl font-semibold text-strong md:text-4xl">
                  {section.title}
                </h3>
                <p className="max-w-xl text-base leading-7 text-text-secondary md:text-lg md:leading-8">
                  {section.description}
                </p>
                <button
                  type="button"
                  className="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90"
                >
                  {section.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
