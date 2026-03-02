type OnboardingContinueButtonVariant = "primary" | "capsule";
type OnboardingContinueButtonBehavior = "disabled" | "hiddenUntilValid";

type OnboardingContinueButtonProps = {
  label: string;
  onClick: () => void;
  isEnabled?: boolean;
  isLoading?: boolean;
  variant?: OnboardingContinueButtonVariant;
  behavior?: OnboardingContinueButtonBehavior;
  className?: string;
  loadingLabel?: string;
};

export function OnboardingContinueButton({
  label,
  onClick,
  isEnabled = true,
  isLoading = false,
  variant = "primary",
  behavior = "disabled",
  className,
  loadingLabel,
}: OnboardingContinueButtonProps) {
  if (behavior === "hiddenUntilValid" && !isEnabled && !isLoading) {
    return null;
  }

  const disabled = isLoading || !isEnabled;
  const baseClassName = variant === "capsule"
    ? "inline-flex h-[50px] items-center justify-center rounded-full px-6 text-base font-semibold transition"
    : "inline-flex h-[50px] items-center justify-center rounded-xl px-6 text-base font-semibold transition";

  const stateClassName = (() => {
    if (isLoading) return "bg-brand text-white";
    if (variant === "capsule") {
      return disabled ? "bg-brand text-white opacity-40" : "bg-brand text-white hover:bg-brand/90";
    }
    return disabled
      ? "bg-bg-muted text-text-light"
      : "bg-brand text-white hover:bg-brand/90";
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClassName} ${stateClassName} ${className ?? ""}`.trim()}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          <span>{loadingLabel ?? label}</span>
        </span>
      ) : (
        label
      )}
    </button>
  );
}
