import amazonLogo from "@/assets/images/company-logos/amazon.svg";
import googleLogo from "@/assets/images/company-logos/google.svg";
import jpmorganLogo from "@/assets/images/company-logos/jpmorgan.svg";
import ncstateLogo from "@/assets/images/company-logos/ncstate.png";
import uncLogo from "@/assets/images/company-logos/unc.svg";
import walmartLogo from "@/assets/images/company-logos/walmart.svg";

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
    <section className="border-y border-border bg-bg py-10 md:py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
        <p className="text-sm font-medium text-text-secondary">People on Looped come from teams like</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6">
          {logos.map((logo) => (
            <div
              key={logo.alt}
              className="flex h-16 items-center justify-center rounded-xl border border-border bg-bg-muted/45 p-3"
            >
              <img src={logo.src} alt={logo.alt} className="max-h-9 w-auto max-w-[130px] object-contain" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
