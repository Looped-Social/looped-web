import { useMemo, useState } from "react";

import { AuthCard } from "./AuthCard";

type SignupCardProps = {
  onSubmit: (email: string, password: string) => Promise<void>;
  onSwitchToLogin: () => void;
  error?: string | null;
  isBusy?: boolean;
};

type PasswordRule = {
  key: string;
  label: string;
  valid: boolean;
};

function passwordRules(password: string): PasswordRule[] {
  return [
    { key: "length", label: "At least 8 characters", valid: password.length >= 8 },
    { key: "uppercase", label: "At least 1 uppercase letter", valid: /[A-Z]/.test(password) },
    { key: "number", label: "At least 1 number", valid: /\d/.test(password) },
    {
      key: "special",
      label: "At least 1 special character",
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

function isPasswordValid(password: string): boolean {
  return passwordRules(password).every((rule) => rule.valid);
}

export function SignupCard({
  onSubmit,
  onSwitchToLogin,
  error,
  isBusy = false,
}: SignupCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const rules = useMemo(() => passwordRules(password), [password]);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const validPassword = isPasswordValid(password);
  const canSubmit = !isBusy && email.trim().length > 0 && validPassword && passwordsMatch;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    if (!validPassword) {
      setLocalError("Use a stronger password that matches all requirements.");
      return;
    }
    if (!passwordsMatch) {
      setLocalError("Passwords do not match.");
      return;
    }
    setLocalError(null);
    await onSubmit(email.trim(), password);
  };

  return (
    <AuthCard title="Create your account" description="Sign up on web and continue onboarding.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="signup-email" className="text-sm font-medium text-text-primary">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="you@company.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-password" className="text-sm font-medium text-text-primary">
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 pr-16 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Create a password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-secondary transition hover:text-strong"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <ul className="space-y-1 text-xs text-text-light">
            {rules.map((rule) => (
              <li key={rule.key} className={rule.valid ? "text-green-600" : "text-text-light"}>
                {rule.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-confirm-password" className="text-sm font-medium text-text-primary">
            Confirm password
          </label>
          <input
            id="signup-confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Re-enter your password"
            required
          />
          {confirmPassword && !passwordsMatch ? <p className="text-xs text-brand">Passwords do not match.</p> : null}
        </div>

        {(localError || error) ? <p className="text-sm text-brand">{localError ?? error}</p> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? "Creating account..." : "Create account"}
        </button>

        <button
          type="button"
          onClick={onSwitchToLogin}
          disabled={isBusy}
          className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:opacity-60"
        >
          Already have an account? Sign in
        </button>
      </form>
    </AuthCard>
  );
}
