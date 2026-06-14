import type { Route } from "./+types/sitemap";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const urls = ["/", "/blog/looped-is-shutting-down", "/about", "/contact", "/faq", "/privacy", "/terms"].map((path) =>
    new URL(path, origin).toString(),
  );

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((url) => `  <url>\n    <loc>${xmlEscape(url)}</loc>\n  </url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
