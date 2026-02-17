import {
  Link,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { Logo } from "@looped/ui";
import { ToastProvider, ToastViewport } from "@/app/components/AppToast/AppToast";
import { IOSAppPrompt } from "@/marketing/components/IOSAppPrompt/IOSAppPrompt";

import type { Route } from "./+types/root";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function() {
              try {
                var stored = localStorage.getItem('looped-theme');
                var preference = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
                var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            })();
          `,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Outlet />
      <IOSAppPrompt />
      <ToastViewport />
    </ToastProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  if (isRouteErrorResponse(error)) {
    message = isNotFound ? "404" : "Error";
    details = isNotFound ? "The page you are looking for does not exist." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  if (isNotFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-shell-bg px-5 py-12 md:px-8">
        <div className="w-full max-w-[920px] text-center">
          <div className="flex justify-center">
            <Logo imageClassName="h-12 w-auto md:h-16" to="/" />
          </div>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-brand md:text-base">404</p>
          <h1 className="mt-3 text-3xl font-semibold text-strong md:text-5xl">Page not found</h1>
          <p className="mx-auto mt-4 max-w-[680px] text-base text-text-secondary md:text-xl">
            This link may be outdated, removed, or typed incorrectly.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 md:mt-10">
            <Link
              to="/"
              className="inline-flex rounded-full border border-border/70 bg-bg px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong md:px-6 md:py-3 md:text-base"
            >
              Go home
            </Link>
            <Link
              to="/app"
              className="inline-flex rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover md:px-6 md:py-3 md:text-base"
            >
              Go to app
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-shell-bg px-5 py-12 md:px-8">
      <div className="w-full max-w-[780px] text-center">
        <div className="flex justify-center">
          <Logo imageClassName="h-12 w-auto md:h-16" to="/" />
        </div>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-brand md:text-base">{message}</p>
        <h1 className="mt-3 text-3xl font-semibold text-strong md:text-5xl">Something went wrong</h1>
        <p className="mx-auto mt-4 max-w-[620px] text-base text-text-secondary md:text-xl">{details}</p>
        <div className="mt-8 flex items-center justify-center gap-3 md:mt-10">
          <Link
            to="/"
            className="inline-flex rounded-full border border-border/70 bg-bg px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong md:px-6 md:py-3 md:text-base"
          >
            Go home
          </Link>
          <Link
            to="/app"
            className="inline-flex rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover md:px-6 md:py-3 md:text-base"
          >
            Go to app
          </Link>
        </div>
        {stack && (
          <pre className="mt-8 w-full overflow-x-auto rounded-xl border border-border/70 bg-bg p-3 text-left text-xs text-text-secondary">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
