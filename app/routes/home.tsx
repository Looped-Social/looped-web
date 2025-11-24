import type { Route } from "./+types/home";
import { CompanyLogos } from "../components/CompanyLogos/CompanyLogos";
import { Footer } from "../components/Footer/Footer";
import { Hero } from "../components/Hero/Hero";
import { Navbar } from "../components/Navbar/Navbar";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Your community, verified." },
    {
      name: "description",
      content: "Looped is where real employees and students speak freely, anonymous by design.",
    },
  ];
}

export default function Home() {
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
