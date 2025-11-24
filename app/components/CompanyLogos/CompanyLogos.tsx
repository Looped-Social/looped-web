import amazonLogo from "../../assets/images/company-logos/amazon.svg";
import googleLogo from "../../assets/images/company-logos/google.svg";
import jpmorganLogo from "../../assets/images/company-logos/jpmorgan.svg";
import ncstateLogo from "../../assets/images/company-logos/ncstate.png";
import uncLogo from "../../assets/images/company-logos/unc.svg";
import walmartLogo from "../../assets/images/company-logos/walmart.svg";

const logos = [
  { src: uncLogo, alt: "University of North Carolina at Chapel Hill" },
  { src: ncstateLogo, alt: "NC State University" },
  { src: googleLogo, alt: "Google" },
  { src: jpmorganLogo, alt: "J.P. Morgan" },
  { src: walmartLogo, alt: "Walmart" },
  { src: amazonLogo, alt: "Amazon" },
];

export function CompanyLogos() {
  return (
    <section className="bg-slate-50 py-10 md:py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:gap-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Trusted by people everywhere
          </p>

          <div className="group relative w-full overflow-hidden">
            <div className="flex min-w-max items-center gap-10 [animation:marquee_28s_linear_infinite] group-hover:[animation-play-state:paused]">
              {[...logos, ...logos].map((logo, index) => (
                <div key={`${logo.alt}-${index}`} className="flex h-14 min-w-[120px] items-center justify-center">
                  <img src={logo.src} alt={logo.alt} className="max-h-full max-w-[140px] object-contain" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
