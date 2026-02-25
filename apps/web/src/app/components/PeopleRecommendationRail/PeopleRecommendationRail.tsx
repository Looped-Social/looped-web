import { type CSSProperties, type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";

import type { PeopleRecommendationItem, PeopleRecommendationRailPage, PeopleRecommendationReason } from "@/lib/peopleRecommendationsApi";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

type PeopleRecommendationRailProps = {
  rail: PeopleRecommendationRailPage;
  isLoadingMore: boolean;
  canFollow: (item: PeopleRecommendationItem) => boolean;
  isConnecting: (userId: string) => boolean;
  onProfileTap: (item: PeopleRecommendationItem) => void;
  onFollowTap: (item: PeopleRecommendationItem) => void;
  onHideTap: (item: PeopleRecommendationItem) => void;
  onLessLikeThisTap: (item: PeopleRecommendationItem) => void;
  onCardVisibilityChange: (item: PeopleRecommendationItem, isVisible: boolean) => void;
  onReachEnd: () => void;
};

const railCssVariables = {
  "--bg": "var(--looped-background)",
  "--text-primary": "var(--looped-text-primary)",
  "--text-secondary": "var(--looped-text-secondary)",
  "--verified": "var(--looped-verified-badge)",
  "--primary": "var(--looped-primary)",
  "--radius-card": "18px",
  "--font-title": '500 20px "Poppins"',
  "--font-name": '600 17px "Poppins"',
  "--font-small": '400 12px "Poppins"',
} as CSSProperties;

function isSuppressedReason(reason: PeopleRecommendationReason): boolean {
  const normalizedCode = reason.code.trim().toUpperCase();
  const normalizedText = reason.text.trim().toUpperCase();
  return normalizedCode.includes("DISCOVERY") || normalizedText.includes("SUGGESTED FOR YOU");
}

function selectReason(reasons: PeopleRecommendationReason[]): PeopleRecommendationReason | null {
  const mutual = reasons.find((reason) => reason.code.toUpperCase().includes("MUTUAL"));
  if (mutual) return mutual;

  const community = reasons.find((reason) => reason.code.toUpperCase().includes("COMMUNITY"));
  if (community) return community;

  const nonSuppressed = reasons.find((reason) => !isSuppressedReason(reason));
  if (nonSuppressed) return nonSuppressed;

  return reasons[0] ?? null;
}

function deriveRailCommunityName(rail: PeopleRecommendationRailPage): string | null {
  if (rail.community?.name?.trim()) {
    return rail.community.name.trim();
  }

  const title = rail.title.trim();
  const prefix = "People in ";
  if (title.startsWith(prefix)) {
    const fromTitle = title.slice(prefix.length).trim();
    return fromTitle.length > 0 ? fromTitle : null;
  }

  return null;
}

function resolveReasonText(item: PeopleRecommendationItem, rail: PeopleRecommendationRailPage): string | null {
  const selectedReason = selectReason(item.reasons);
  if (selectedReason && !isSuppressedReason(selectedReason)) {
    return selectedReason.text;
  }

  const itemCommunity = item.user.community?.name?.trim();
  if (itemCommunity) return `Verified in ${itemCommunity}`;

  const railCommunity = deriveRailCommunityName(rail);
  if (railCommunity) return `Verified in ${railCommunity}`;

  return null;
}

function handleAvatarError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

export function PeopleRecommendationRail({
  rail,
  isLoadingMore,
  canFollow,
  isConnecting,
  onProfileTap,
  onFollowTap,
  onHideTap,
  onLessLikeThisTap,
  onCardVisibilityChange,
  onReachEnd,
}: PeopleRecommendationRailProps) {
  const [openMenuRecommendationId, setOpenMenuRecommendationId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardElementsRef = useRef(new Map<string, HTMLButtonElement>());

  const itemsByRecommendationId = useMemo(() => {
    const map = new Map<string, PeopleRecommendationItem>();
    for (const item of rail.items) {
      map.set(item.recommendationId, item);
    }
    return map;
  }, [rail.items]);

  const lastRecommendationId = rail.items[rail.items.length - 1]?.recommendationId ?? null;

  useEffect(() => {
    if (!openMenuRecommendationId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-people-recommendation-menu]")) return;
      setOpenMenuRecommendationId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenuRecommendationId]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || rail.items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target;
          if (!(target instanceof HTMLElement)) continue;

          const recommendationId = target.dataset.recommendationId;
          if (!recommendationId) continue;

          const item = itemsByRecommendationId.get(recommendationId);
          if (!item) continue;

          onCardVisibilityChange(item, entry.isIntersecting);

          if (entry.isIntersecting && rail.hasMore && recommendationId === lastRecommendationId) {
            onReachEnd();
          }
        }
      },
      {
        root,
        threshold: 0.85,
      }
    );

    for (const item of rail.items) {
      const element = cardElementsRef.current.get(item.recommendationId);
      if (!element) continue;
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [itemsByRecommendationId, lastRecommendationId, onCardVisibilityChange, onReachEnd, rail.hasMore, rail.items]);

  return (
    <section className="space-y-3" style={railCssVariables}>
      <div className="px-4">
        <h3
          className="text-[1.15rem] leading-tight"
          style={{
            color: "var(--text-primary)",
            font: "var(--font-title)",
          }}
        >
          {rail.title || "Recommended for you"}
        </h3>
      </div>

      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-[10px] overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rail.items.map((item) => {
          const recommendationId = item.recommendationId;
          const reasonText = resolveReasonText(item, rail);
          const canConnect = canFollow(item);
          const connecting = isConnecting(item.user.id);
          const showMenuActions = item.actions.canHide || item.actions.canLessLikeThis;

          return (
            <button
              key={recommendationId}
              ref={(element) => {
                if (element) {
                  cardElementsRef.current.set(recommendationId, element);
                } else {
                  cardElementsRef.current.delete(recommendationId);
                }
              }}
              data-recommendation-id={recommendationId}
              type="button"
              onClick={() => onProfileTap(item)}
              className="relative h-[248px] w-[160px] shrink-0 snap-start overflow-visible text-left"
              style={{
                background: "var(--bg)",
                borderRadius: "var(--radius-card)",
                border: "1px solid color-mix(in srgb, var(--text-secondary) 25%, transparent)",
                boxShadow: "0 2px 10px color-mix(in srgb, var(--text-primary) 8%, transparent)",
              }}
            >
              <div className="flex h-full flex-col px-2 pb-2 pt-2">
                <div className="flex items-center justify-end">
                  {showMenuActions ? (
                    <div className="relative" data-people-recommendation-menu>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setOpenMenuRecommendationId((current) =>
                            current === recommendationId ? null : recommendationId
                          );
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-muted text-[0.95rem] text-text-secondary"
                        aria-label="Open recommendation actions"
                      >
                        ...
                      </button>
                      {openMenuRecommendationId === recommendationId ? (
                        <div className="absolute right-0 top-7 z-20 min-w-[128px] overflow-hidden rounded-xl border border-border bg-bg shadow-lg">
                          {item.actions.canHide ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpenMenuRecommendationId(null);
                                onHideTap(item);
                              }}
                              className="block w-full px-3 py-2 text-left text-xs font-medium text-text-primary transition hover:bg-bg-muted"
                            >
                              Hide
                            </button>
                          ) : null}
                          {item.actions.canLessLikeThis ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpenMenuRecommendationId(null);
                                onLessLikeThisTap(item);
                              }}
                              className="block w-full px-3 py-2 text-left text-xs font-medium text-text-primary transition hover:bg-bg-muted"
                            >
                              Less like this
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="h-6 w-6" aria-hidden="true" />
                  )}
                </div>

                <div className="mt-1 flex justify-center">
                  <img
                    src={item.user.avatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                    alt=""
                    loading="lazy"
                    onError={handleAvatarError}
                    className="h-[70px] w-[70px] rounded-full object-cover"
                  />
                </div>

                <div className="mt-2 text-center">
                  <p
                    className="truncate"
                    style={{
                      color: "var(--text-primary)",
                      font: "var(--font-name)",
                    }}
                  >
                    {item.user.displayName}
                  </p>
                  <p
                    className="truncate"
                    style={{
                      color: "var(--text-secondary)",
                      font: "var(--font-small)",
                    }}
                  >
                    @{item.user.handle.replace(/^@/, "")}
                  </p>
                </div>

                <div className="mt-2 flex min-h-[36px] items-start justify-center px-1 text-center">
                  {reasonText ? (
                    <p
                      className="line-clamp-2"
                      style={{
                        color: "var(--text-secondary)",
                        font: "var(--font-small)",
                      }}
                    >
                      {reasonText}
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto pt-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onFollowTap(item);
                    }}
                    disabled={!canConnect || connecting}
                    className="w-full rounded-full px-3 py-1.5 text-center text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-65"
                    style={{ background: "var(--primary)" }}
                  >
                    {canConnect && !connecting ? "Follow" : "Following"}
                  </button>
                </div>
              </div>
            </button>
          );
        })}

        {isLoadingMore ? (
          <div
            className="flex h-[248px] w-[160px] shrink-0 snap-start items-center justify-center rounded-[18px] border border-border bg-bg"
            style={{
              borderRadius: "var(--radius-card)",
            }}
          >
            <div className="text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border border-t-brand" />
              <p className="mt-2 text-xs text-text-secondary">Loading...</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
