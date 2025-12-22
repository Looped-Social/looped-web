import { useState } from "react";

import { AuthCard } from "./AuthCard";

type LoginCardProps = {
  onSubmit: (email: string, password: string) => Promise<void>;
  onGoogle?: () => Promise<void>;
  onApple?: () => Promise<void>;
  error?: string | null;
  isBusy?: boolean;
};

type IconProps = {
  className?: string;
};

function GoogleIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.81-.07-1.62-.21-2.4H12v4.54h6.47c-.28 1.54-1.12 2.84-2.39 3.72v3.09h3.86c2.26-2.08 3.55-5.15 3.55-8.95z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.86-3.09c-1.07.72-2.44 1.15-4.09 1.15-3.15 0-5.82-2.13-6.78-4.99H1.27v3.14C3.24 21.38 7.37 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.22 14.17A7.22 7.22 0 0 1 4.84 12c0-.76.13-1.49.37-2.17V6.69H1.27A11.99 11.99 0 0 0 0 12c0 1.93.46 3.75 1.27 5.31l3.95-3.14z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.96 1.19 15.24 0 12 0 7.37 0 3.24 2.62 1.27 6.69l3.95 3.14C6.18 6.96 8.85 4.77 12 4.77z"
      />
    </svg>
  );
}

function AppleIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M16.36 1.38c0 1.14-.46 2.2-1.28 3.02-.8.84-2.14 1.48-3.3 1.38-.12-1.06.4-2.2 1.2-3.02.8-.84 2.18-1.46 3.38-1.38z" />
      <path d="M20.8 17.03c-.56 1.3-.82 1.88-1.54 3.04-1 1.6-2.4 3.6-4.14 3.62-1.54.02-1.94-1-4-1-2.08 0-2.52.98-4.02 1.02-1.72.04-3.06-1.78-4.06-3.38-2.76-4.3-3.06-9.36-1.36-11.98 1.2-1.84 3.1-2.92 4.86-2.92 1.82 0 2.98 1.02 4.5 1.02 1.48 0 2.38-1.02 4.5-1.02 1.56 0 3.22.86 4.42 2.34-3.88 2.12-3.24 7.66.84 9.26z" />
    </svg>
  );
}

export function LoginCard({
  onSubmit,
  onGoogle,
  onApple,
  error,
  isBusy = false,
}: LoginCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isDisabled = isBusy || !email || !password;
  const hasProviders = Boolean(onGoogle || onApple);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDisabled) return;
    await onSubmit(email.trim(), password);
  };

  return (
    <AuthCard
      title="Admin sign in"
      description="Use your verified Looped admin email to continue."
    >
      <div className="space-y-6">
        {hasProviders && (
          <div className="space-y-3">
            {onGoogle && (
              <button
                type="button"
                disabled={isBusy}
                onClick={onGoogle}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-semibold text-text-primary  transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleIcon className="h-5 w-5" />
                Continue with Google
              </button>
            )}
            {onApple && (
              <button
                type="button"
                disabled={isBusy}
                onClick={onApple}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-semibold text-text-primary  transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <AppleIcon className="h-5 w-5" />
                Continue with Apple
              </button>
            )}
          </div>
        )}

        {hasProviders && (
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase text-text-light">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="admin@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <p className="text-sm text-brand">{error}</p>}

          <button
            type="submit"
            disabled={isDisabled}
            className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white  transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </AuthCard>
  );
}
