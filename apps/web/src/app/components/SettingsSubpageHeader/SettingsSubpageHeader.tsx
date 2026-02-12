import { useNavigate } from "react-router";

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

export function SettingsSubpageHeader({
  backHref = "/app/settings",
  backLabel = "Back to Settings",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(backHref, { replace: true });
  };

  return (
    <section className="border-b border-border/70 bg-bg px-4 py-3">
      <div className="mx-auto w-full max-w-[560px]">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-secondary transition hover:text-strong"
          aria-label={backLabel}
        >
          <BackIcon className="h-5 w-5" />
          <span>{backLabel}</span>
        </button>
      </div>
    </section>
  );
}
