import type { Route } from "./+types/home";
import { HomePage } from "@/pages/HomePage/HomePage";

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
  return <HomePage />;
}
