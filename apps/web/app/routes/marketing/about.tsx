import type { Route } from "./+types/about";
import { AboutPage } from "@/marketing/pages/AboutPage/AboutPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About Looped" },
    {
      name: "description",
      content: "Learn why Looped exists and how we’re building verified, pseudonymous communities.",
    },
  ];
}

export default function About() {
  return <AboutPage />;
}
