import { Link } from "react-router";

import { OnboardingContinueButton } from "@/app/components/OnboardingContinueButton/OnboardingContinueButton";

type VerificationInfoMode = "onboarding" | "modal";

type VerificationInfoContentProps = {
  mode: VerificationInfoMode;
  isBusy?: boolean;
  onContinue?: () => void;
  onBack?: () => void;
  onClose?: () => void;
};

type VerificationRow = {
  action: string;
  verified: "allowed" | "restricted";
  notVerified: "allowed" | "restricted";
};

const VERIFICATION_ROWS: VerificationRow[] = [
  { action: "Browse", verified: "allowed", notVerified: "allowed" },
  { action: "Post", verified: "allowed", notVerified: "restricted" },
  { action: "Like", verified: "allowed", notVerified: "restricted" },
  { action: "Comment", verified: "allowed", notVerified: "restricted" },
  { action: "Repost", verified: "allowed", notVerified: "allowed" },
];

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function AllowedIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function RestrictedIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function StatusCell({
  status,
  lastColumn = false,
}: {
  status: "allowed" | "restricted";
  lastColumn?: boolean;
}) {
  const isAllowed = status === "allowed";
  return (
    <div
      className={`flex min-h-12 items-center justify-center border-b border-border/50 px-2 ${
        isAllowed ? "bg-secondary/14 text-secondary" : "bg-error/14 text-error"
      } ${lastColumn ? "" : "border-r"}`}
      aria-label={isAllowed ? "Allowed" : "Restricted"}
    >
      {isAllowed ? <AllowedIcon className="h-7 w-7" /> : <RestrictedIcon className="h-7 w-7" />}
    </div>
  );
}

export function VerificationInfoContent({
  mode,
  isBusy = false,
  onContinue,
  onBack,
  onClose,
}: VerificationInfoContentProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-strong md:text-3xl">Posting is per community</h2>
          <p className="max-w-2xl text-sm leading-6 text-text-secondary">
            Every post belongs to a community. Post, like, and comment are available only where you're verified.
          </p>
        </div>
        {mode === "modal" && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="space-y-3 rounded-[14px] bg-bg-muted/45 p-[14px]">
        <p className="text-sm font-medium text-text-secondary">Access in a community</p>
        <div className="overflow-hidden rounded-[12px] border border-text-secondary/20 bg-bg/90">
          <div className="grid grid-cols-[minmax(120px,1fr)_minmax(82px,0.85fr)_minmax(112px,1fr)]">
            <div className="flex min-h-10 items-center border-b border-r border-border/50 bg-bg-muted/35 px-3 text-xs text-text-secondary">
              <span className="whitespace-nowrap truncate">Action</span>
            </div>
            <div className="flex min-h-10 items-center justify-center border-b border-r border-border/50 bg-bg-muted/35 px-2 text-xs text-text-secondary">
              <span className="whitespace-nowrap truncate">Verified</span>
            </div>
            <div className="flex min-h-10 items-center justify-center border-b border-border/50 bg-bg-muted/35 px-2 text-xs text-text-secondary">
              <span className="whitespace-nowrap truncate">Not verified</span>
            </div>

            {VERIFICATION_ROWS.map((row) => (
              <FragmentRow key={row.action} row={row} />
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-text-secondary">You can verify anytime from a community page.</p>
      <p className="text-sm text-text-secondary">
        Questions? Visit our{" "}
        <Link to="/faq" className="font-semibold text-text-secondary underline underline-offset-2 transition hover:text-strong">
          FAQ
        </Link>{" "}
        or our{" "}
        <Link to="/about" className="font-semibold text-text-secondary underline underline-offset-2 transition hover:text-strong">
          About
        </Link>
        .
      </p>

      {mode === "onboarding" ? (
        <div className="flex gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={isBusy}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Back"
            >
              <BackIcon className="h-5 w-5" />
            </button>
          ) : null}
          <OnboardingContinueButton
            label="Continue"
            loadingLabel="Continuing..."
            onClick={() => onContinue?.()}
            isEnabled={Boolean(onContinue)}
            isLoading={isBusy}
            variant="primary"
          />
        </div>
      ) : null}
    </section>
  );
}

function FragmentRow({ row }: { row: VerificationRow }) {
  return (
    <>
      <div className="flex min-h-12 items-center border-b border-r border-border/50 bg-bg/95 px-3 text-[13px] text-strong">
        <span className="whitespace-nowrap truncate">{row.action}</span>
      </div>
      <StatusCell status={row.verified} />
      <StatusCell status={row.notVerified} lastColumn />
    </>
  );
}
