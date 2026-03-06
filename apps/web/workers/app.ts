import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);
const CANONICAL_HOST = "looped-social.com";
const REDIRECT_HOSTS = new Set(["www.looped-social.com", "mylooped.app", "www.mylooped.app"]);

export default {
  fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.has(url.host)) {
      url.protocol = "https:";
      url.host = CANONICAL_HOST;
      return Response.redirect(url.toString(), 308);
    }

    return requestHandler(request, { cloudflare: { env, ctx } });
  },
};
