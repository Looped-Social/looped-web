import { CompanyLogos } from "~/components/CompanyLogos/CompanyLogos";
import { Footer } from "~/components/Footer/Footer";
import { Hero } from "~/components/Hero/Hero";
import { Navbar } from "~/components/Navbar/Navbar";

export function HomePage() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main>
        <Hero />
        <CompanyLogos />
      </main>
      <Footer />
    </div>
  );
}
