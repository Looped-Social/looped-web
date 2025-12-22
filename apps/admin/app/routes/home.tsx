import type { Route } from "./+types/home";

import { useOutletContext } from "react-router";

import { AdminHome } from "../components/AdminHome/AdminHome";
import type { AdminRouteContext } from "./admin";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped Admin Overview" },
    { name: "description", content: "Looped admin dashboard overview" },
  ];
}

export default function Home() {
  const { admin } = useOutletContext<AdminRouteContext>();
  return <AdminHome admin={admin} />;
}
