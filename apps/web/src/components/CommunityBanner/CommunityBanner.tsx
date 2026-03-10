type CommunityBannerProps = {
  src: string;
  kind?: string;
  height?: number;
  inset?: number;
  className?: string;
};

function normalizeCommunityBannerKind(kind?: string): string {
  const normalized = kind?.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (normalized === "field" || normalized === "major") return "specialization";
  return normalized;
}

function resolveContrastBackdrop(kind?: string): boolean {
  const normalized = normalizeCommunityBannerKind(kind);
  return normalized === "company" || normalized === "school" || normalized === "specialization";
}

export function CommunityBanner({
  src,
  kind,
  height = 120,
  inset = 6,
  className,
}: CommunityBannerProps) {
  const usesContrastBackdrop = resolveContrastBackdrop(kind);

  return (
    <div
      className={`flex w-full items-center justify-center overflow-hidden rounded-[14px] ${className ?? ""}`.trim()}
      style={{
        height: `${height}px`,
        padding: usesContrastBackdrop ? `${inset}px` : undefined,
        backgroundColor: usesContrastBackdrop ? "var(--color-community-image-backdrop)" : "var(--color-bg)",
      }}
    >
      <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" />
    </div>
  );
}
