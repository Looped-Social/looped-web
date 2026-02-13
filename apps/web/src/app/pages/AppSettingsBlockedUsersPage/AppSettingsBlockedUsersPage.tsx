import { type SyntheticEvent, useCallback, useEffect, useState } from "react";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { SettingsSubpageHeader } from "@/app/components/SettingsSubpageHeader/SettingsSubpageHeader";
import { fetchBlockedUsers, type BlockedUserItem, unblockPrincipal } from "@/lib/settingsApi";
import { normalizeSettingsError } from "@/lib/settingsHttp";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

export function AppSettingsBlockedUsersPage() {
  const { showToast } = useToast();

  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BlockedUserItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [unblockingIds, setUnblockingIds] = useState<Record<string, boolean>>({});

  const loadBlocked = useCallback(async ({ cursor }: { cursor?: string } = {}) => {
    if (cursor) {
      setIsLoadingMore(true);
    } else {
      setStatus("loading");
      setError(null);
    }

    try {
      const response = await fetchBlockedUsers({ limit: 20, cursor });
      if (!cursor) {
        setItems(response.items);
      } else {
        setItems((current) => [...current, ...response.items]);
      }
      setNextCursor(response.nextCursor);
      setStatus("idle");
    } catch (loadError) {
      const normalized = normalizeSettingsError(loadError);
      setStatus("error");
      setError(normalized.message || "Unable to load blocked users.");
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadBlocked();
  }, [loadBlocked]);

  const handleUnblock = useCallback(
    async (item: BlockedUserItem) => {
      if (unblockingIds[item.principalId]) return;

      const previous = items;
      setUnblockingIds((current) => ({ ...current, [item.principalId]: true }));
      setItems((current) => current.filter((entry) => entry.principalId !== item.principalId));

      try {
        await unblockPrincipal(item.principalId);
        await loadBlocked();
        showToast({
          kind: "success",
          title: "User unblocked",
          message: `${item.displayName} has been unblocked.`,
        });
      } catch (errorValue) {
        const normalized = normalizeSettingsError(errorValue);
        setItems(previous);
        showToast({
          kind: "error",
          title: "Couldn’t unblock user",
          message: normalized.message || "Try again.",
        });
      } finally {
        setUnblockingIds((current) => {
          const next = { ...current };
          delete next[item.principalId];
          return next;
        });
      }
    },
    [items, loadBlocked, showToast, unblockingIds]
  );

  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Blocked Users" showAction={false} showBack={false} />
      <SettingsSubpageHeader backHref="/app/settings" />

      <div className="mx-auto w-full max-w-[560px] space-y-4 bg-bg px-4 py-4">
        <header>
          <h1 className="text-xl font-semibold text-strong">Blocked Users</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage people and principals you’ve blocked.</p>
        </header>

        {status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={`blocked-skeleton-${index}`} className="animate-pulse rounded-2xl border border-border/60 bg-bg px-4 py-3">
                <div className="h-4 w-1/3 rounded-full bg-bg-muted" />
                <div className="mt-2 h-3 w-2/3 rounded-full bg-bg-muted" />
              </div>
            ))}
          </div>
        ) : null}

        {status === "error" ? (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-bg px-4 py-3">
            <p className="text-sm font-semibold text-strong">Unable to load blocked users.</p>
            <p className="text-sm text-text-secondary">{error}</p>
            <button
              type="button"
              onClick={() => void loadBlocked()}
              className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {status === "idle" ? (
          items.length > 0 ? (
            <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-bg">
              {items.map((item) => (
                <div key={item.principalId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bg-muted">
                      <img
                        src={item.profileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={handleProfileImageError}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-strong">{item.displayName}</p>
                      <p className="truncate text-xs text-text-secondary">
                        {item.handle ? `@${item.handle.replace(/^@/, "")}` : item.kind ?? "principal"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(unblockingIds[item.principalId])}
                    onClick={() => void handleUnblock(item)}
                    className="rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                  >
                    {unblockingIds[item.principalId] ? "Unblocking…" : "Unblock"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No blocked users.</p>
          )
        ) : null}

        {status === "idle" && nextCursor ? (
          <button
            type="button"
            onClick={() => void loadBlocked({ cursor: nextCursor })}
            disabled={isLoadingMore}
            className="w-full rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </div>
    </AppLayout>
  );
}
