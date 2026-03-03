import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadContext: AppLoadContext
) {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  const userAgent = request.headers.get("user-agent");
  const shouldWaitForAll =
    ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) ?? false;

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), streamTimeout + 1000);

  let didError = false;
  try {
    const body = await renderToReadableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        signal: abortController.signal,
        onError(error) {
          didError = true;
          console.error(error);
        },
      }
    );

    if (shouldWaitForAll) {
      // `allReady` is a React stream extension used for crawler/static rendering.
      await (body as ReadableStream & { allReady?: Promise<void> }).allReady;
    }

    responseHeaders.set("Content-Type", "text/html");

    return new Response(body, {
      status: didError ? 500 : responseStatusCode,
      headers: responseHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

