import type { Route } from "./+types/favicon-ico";

export function loader(_args: Route.LoaderArgs) {
  return new Response(null, {
    status: 301,
    headers: {
      Location: "/favicon.svg",
      "Cache-Control": "public, max-age=86400, must-revalidate",
    },
  });
}

