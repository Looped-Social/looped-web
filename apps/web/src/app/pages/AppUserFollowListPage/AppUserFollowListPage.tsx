import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { fetchDefaultProfileImageUrl } from "@/lib/profileEditApi";
import { UserApiError, fetchUserFollowers, fetchUserFollowing, fetchUserMe } from "@/lib/userApi";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

type FollowListMode = "followers" | "following";

type AppUserFollowListPageProps = {
  userId: string;
  mode: FollowListMode;
};

type FollowListItem = {
  key: string;
  entityId?: string;
  displayName: string;
  handle?: string;
  subtitle: string;
  avatarUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function normalizeOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = normalizeOptional(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function resolveCurrentUserId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.user)) {
    return pickString(payload.user, ["id", "user_id", "userId"]);
  }
  return pickString(payload, ["id", "user_id", "userId"]);
}

function parseApiError(error: unknown): { status?: number; code?: string; message: string } {
  if (error instanceof UserApiError) {
    const raw = error.details?.trim();
    if (!raw) return { status: error.status, message: error.message };

    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        const code = normalizeOptional(parsed.error);
        const message = normalizeOptional(parsed.message) ?? raw;
        return { status: error.status, code, message };
      }
    } catch {
      return { status: error.status, message: raw };
    }

    return { status: error.status, message: raw };
  }

  if (error instanceof Error) return { message: error.message };
  return { message: "Something went wrong." };
}

function errorMessageForFollowList(error: { status?: number; code?: string; message: string }): string {
  if (error.code === "forbidden" || error.status === 403) return "This list is private.";
  if (error.code === "not_found" || error.status === 404) return "That account no longer exists.";
  if (error.code === "user_not_provisioned" || error.status === 409) {
    return "Complete onboarding in the iOS app to view this list.";
  }
  if (error.code === "unauthorized" || error.status === 401) return "Please sign in again to continue.";
  return error.message;
}

function normalizeFollowResponse(
  payload: unknown,
  mode: FollowListMode
): { items: unknown[]; nextCursor: string | null } {
  if (!isRecord(payload)) {
    return { items: [], nextCursor: null };
  }

  const items =
    (Array.isArray(payload.items) ? payload.items : null) ??
    (mode === "followers" && Array.isArray(payload.followers) ? payload.followers : null) ??
    (mode === "following" && Array.isArray(payload.following) ? payload.following : null) ??
    [];

  const nextCursor =
    normalizeOptional(payload.next_cursor ?? payload.nextCursor) ?? null;

  return { items, nextCursor };
}

function normalizeFollowItem(item: unknown, index: number): FollowListItem | null {
  if (!isRecord(item)) return null;

  const entityId = pickString(item, ["user_id", "userId", "id"]);
  const handle = pickString(item, ["handle", "username"]);
  const displayName =
    pickString(item, ["display_name", "displayName", "name"]) ??
    handle ??
    "Looped User";

  return {
    key: `${entityId ?? "row"}-${index}`,
    entityId,
    displayName,
    handle,
    subtitle: handle ? `@${handle.replace(/^@/, "")}` : "@looped",
    avatarUrl: pickString(item, ["profile_image_url", "profileImageUrl"]),
  };
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

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

export function AppUserFollowListPage({ userId, mode }: AppUserFollowListPageProps) {
  const navigate = useNavigate();
  const [defaultProfileImageUrl, setDefaultProfileImageUrl] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [items, setItems] = useState<FollowListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loading-more" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const listStatusRef = useRef(status);
  const lastAutoLoadCursorRef = useRef<string | null>(null);

  const title = mode === "followers" ? "Followers" : "Following";

  useEffect(() => {
    listStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    let active = true;
    fetchDefaultProfileImageUrl()
      .then((url) => {
        if (!active) return;
        setDefaultProfileImageUrl(url);
      })
      .catch(() => {
        if (!active) return;
        setDefaultProfileImageUrl(undefined);
      });

    fetchUserMe()
      .then((payload) => {
        if (!active) return;
        setCurrentUserId(resolveCurrentUserId(payload) ?? null);
      })
      .catch(() => {
        if (!active) return;
        setCurrentUserId(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const normalized = searchInput.trim();
    const timeout = window.setTimeout(() => {
      setDebouncedQuery((previous) => (previous === normalized ? previous : normalized));
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadList = useCallback(
    async ({ cursor, replace }: { cursor?: string; replace: boolean }) => {
      setErrorMessage(null);
      setStatus(cursor ? "loading-more" : "loading");

      try {
        const response =
          mode === "followers"
            ? await fetchUserFollowers({ userId, limit: 20, cursor, query: debouncedQuery || undefined })
            : await fetchUserFollowing({ userId, limit: 20, cursor, query: debouncedQuery || undefined });

        const normalized = normalizeFollowResponse(response as unknown, mode);
        const parsedItems = normalized.items
          .map((entry, index) => normalizeFollowItem(entry, index))
          .filter((entry): entry is FollowListItem => Boolean(entry));

        setItems((previous) => (replace ? parsedItems : [...previous, ...parsedItems]));
        setNextCursor(normalized.nextCursor);
        setStatus("idle");
      } catch (error) {
        const parsed = parseApiError(error);
        setErrorMessage(errorMessageForFollowList(parsed));
        setStatus("error");
      }
    },
    [debouncedQuery, mode, userId]
  );

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    lastAutoLoadCursorRef.current = null;
    void loadList({ replace: true });
  }, [loadList, mode, userId, debouncedQuery]);

  useEffect(() => {
    const node = infiniteSentinelRef.current;
    if (!node) return;
    if (!nextCursor) return;
    if (status === "loading" || status === "loading-more") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!nextCursor) return;
        if (listStatusRef.current === "loading" || listStatusRef.current === "loading-more") return;
        if (lastAutoLoadCursorRef.current === nextCursor) return;

        lastAutoLoadCursorRef.current = nextCursor;
        void loadList({ cursor: nextCursor, replace: false });
      },
      {
        root: null,
        rootMargin: "300px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadList, nextCursor, status]);

  const handleAvatarError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      if (defaultProfileImageUrl && image.dataset.defaultFallbackApplied !== "true") {
        image.dataset.defaultFallbackApplied = "true";
        image.src = defaultProfileImageUrl;
        return;
      }
      if (image.dataset.fallbackApplied === "true") return;
      image.dataset.fallbackApplied = "true";
      image.src = DEFAULT_PROFILE_IMAGE_SRC;
    },
    [defaultProfileImageUrl]
  );

  const emptyLabel = useMemo(() => {
    if (debouncedQuery.length > 0) return "No results";
    return mode === "followers" ? "No followers yet" : "Not following anyone yet";
  }, [debouncedQuery.length, mode]);

  const activeNavId = currentUserId && currentUserId === userId ? "profile" : "";
  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(`/app/profile/${userId}`, { replace: true });
  }, [navigate, userId]);

  return (
    <AppLayout activeNavId={activeNavId}>
      <AppMobileHeader title={title} showAction={false} showBack backHref={`/app/profile/${userId}`} />

      <section className="border-b border-border/70 bg-bg px-4 py-3">
        <div className="mx-auto w-full max-w-[560px]">
          <button
            type="button"
            onClick={handleBack}
            className="mb-2.5 hidden items-center gap-1 text-sm font-semibold text-text-secondary transition hover:text-strong lg:inline-flex"
          >
            <BackIcon className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.currentTarget.value)}
              placeholder="Search"
              className="w-full rounded-full border border-border/70 bg-bg-muted py-2.5 pl-9 pr-3 text-sm text-strong outline-none transition focus:border-brand/50"
            />
          </div>
        </div>
      </section>

      <div className="divide-y divide-border/70 bg-bg">
        {items.map((item) => {
          const row = (
            <>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-text-secondary">
                <img
                  src={item.avatarUrl ?? defaultProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={handleAvatarError}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1.03rem] font-semibold text-strong">{item.displayName}</p>
                <p className="truncate text-sm text-text-secondary">{item.subtitle}</p>
              </div>
            </>
          );

          return item.entityId ? (
            <Link
              key={item.key}
              to={`/app/profile/${item.entityId}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-bg-muted/35"
            >
              {row}
            </Link>
          ) : (
            <div key={item.key} className="flex items-center gap-3 px-4 py-3">
              {row}
            </div>
          );
        })}

        {status === "loading" ? (
          <div className="px-4 py-5 text-sm text-text-secondary">Loading {title.toLowerCase()}...</div>
        ) : null}

        {errorMessage ? (
          <div className="space-y-2 px-4 py-4">
            <p className="text-sm font-semibold text-strong">Unable to load {title.toLowerCase()}.</p>
            <p className="text-sm text-text-secondary">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadList({ replace: true })}
              className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
            >
              Retry
            </button>
          </div>
        ) : null}

        {items.length === 0 && status === "idle" && !errorMessage ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">{emptyLabel}</div>
        ) : null}

        {status === "loading-more" ? (
          <div className="px-4 py-4 text-center text-sm text-text-secondary">Loading more...</div>
        ) : null}

        <div ref={infiniteSentinelRef} className="h-1" aria-hidden="true" />
      </div>
    </AppLayout>
  );
}
