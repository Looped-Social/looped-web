import { CompanyLogos } from "@/marketing/components/CompanyLogos/CompanyLogos";
import { FeatureSections } from "@/marketing/components/FeatureSections/FeatureSections";
import { Footer } from "@/marketing/components/Footer/Footer";
import { Hero } from "@/marketing/components/Hero/Hero";
import { Navbar } from "@/marketing/components/Navbar/Navbar";

export function HomePage() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main>
        <Hero />
        <CompanyLogos />
        <FeatureSections />
      </main>
      <Footer />
    </div>
  );
}
