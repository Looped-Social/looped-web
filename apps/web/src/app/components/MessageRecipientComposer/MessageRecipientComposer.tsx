import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  addChannelMembers,
  createChannel,
  createConversation,
  MessagingApiError,
  searchUsersForMessages,
} from "@/lib/messagingApi";

const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

export type MessageRecipientComposerMode = "compose" | "add_members";

export type MessageRecipient = {
  userId: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
};

export type MessageRecipientComposerSuccess =
  | {
      kind: "conversation";
      conversationId: string;
      recipients: MessageRecipient[];
    }
  | {
      kind: "channel";
      channelId: string;
      recipients: MessageRecipient[];
    }
  | {
      kind: "add_members";
      addedCount: number;
      recipients: MessageRecipient[];
    };

type MessageRecipientComposerProps = {
  open: boolean;
  mode?: MessageRecipientComposerMode;
  channelId?: string;
  currentUserId?: string | null;
  excludedUserIds?: string[];
  title?: string;
  submitLabel?: string;
  onClose: () => void;
  onSuccess: (result: MessageRecipientComposerSuccess) => void;
};

type CursorEnvelope = {
  items?: unknown[];
  data?: unknown[];
  results?: unknown[];
  next_cursor?: string | null;
  nextCursor?: string | null;
  cursor?: string | null;
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

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) return value;
  }
  return undefined;
}

function parseApiErrorMessage(error: unknown): string {
  if (error instanceof MessagingApiError) {
    if (error.status === 403) {
      return "This person isn't accepting new message requests.";
    }
    const details = (error.details ?? "").trim();
    if (details.length > 0) {
      try {
        const parsed: unknown = JSON.parse(details);
        if (isRecord(parsed)) {
          const code = normalizeOptional(parsed.error)?.toLowerCase();
          if (code === "forbidden" || code === "message_forbidden") {
            return "This person isn't accepting new message requests.";
          }
          const message = normalizeOptional(parsed.message);
          if (message) return message;
        }
      } catch {
        return details;
      }
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function extractNextCursor(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  return (
    normalizeOptional(payload.next_cursor) ??
    normalizeOptional(payload.nextCursor) ??
    normalizeOptional(payload.cursor)
  );
}

function normalizeRecipient(item: unknown): MessageRecipient | null {
  if (!isRecord(item)) return null;
  const userId = pickString(item, ["id", "user_id", "userId"]);
  if (!userId) return null;
  const displayName =
    normalizeOptional(
      pickString(item, ["display_name", "displayName", "name", "full_name", "fullName", "handle", "username"])
    ) ?? "Unknown";

  const rawHandle = normalizeOptional(pickString(item, ["handle", "username"]));
  const handle = rawHandle ? rawHandle.replace(/^@/, "") : undefined;
  const avatarUrl = normalizeOptional(
    pickString(item, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl", "image_url", "imageUrl"])
  );

  return { userId: String(userId), displayName, handle, avatarUrl };
}

function extractConversationId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const direct = pickString(payload, ["id", "conversation_id", "conversationId"]);
  if (direct) return direct;
  const nested =
    (isRecord(payload.conversation) ? payload.conversation : null) ??
    (isRecord(payload.data) ? payload.data : null) ??
    (isRecord(payload.item) ? payload.item : null);
  if (!nested) return undefined;
  return pickString(nested, ["id", "conversation_id", "conversationId"]);
}

function extractChannelId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const direct = pickString(payload, ["id", "channel_id", "channelId"]);
  if (direct) return direct;
  const nested =
    (isRecord(payload.channel) ? payload.channel : null) ??
    (isRecord(payload.data) ? payload.data : null) ??
    (isRecord(payload.item) ? payload.item : null);
  if (!nested) return undefined;
  return pickString(nested, ["id", "channel_id", "channelId"]);
}

function buildGroupName(recipients: MessageRecipient[]): string {
  if (recipients.length === 0) return "New Group";
  if (recipients.length === 1) return recipients[0].displayName;
  if (recipients.length === 2) return `${recipients[0].displayName}, ${recipients[1].displayName}`;
  return `${recipients[0].displayName}, ${recipients[1].displayName} +${recipients.length - 2}`;
}

function XIcon({ className }: { className?: string }) {
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
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

export function MessageRecipientComposer({
  open,
  mode = "compose",
  channelId,
  currentUserId,
  excludedUserIds,
  title,
  submitLabel,
  onClose,
  onSuccess,
}: MessageRecipientComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);

  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<MessageRecipient[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [selectedRecipients, setSelectedRecipients] = useState<MessageRecipient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedExclusions = useMemo(() => {
    const set = new Set<string>();
    if (currentUserId) set.add(String(currentUserId));
    for (const userId of excludedUserIds ?? []) {
      if (!userId) continue;
      set.add(String(userId));
    }
    return set;
  }, [currentUserId, excludedUserIds]);

  useEffect(() => {
    if (!open) return;
    setSearchText("");
    setResults([]);
    setNextCursor(undefined);
    setSelectedRecipients([]);
    setIsSearching(false);
    setIsLoadingMore(false);
    setIsSubmitting(false);
    setError(null);
    requestIdRef.current += 1;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const trimmedQuery = searchText.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setNextCursor(undefined);
      setIsSearching(false);
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setIsSearching(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const response = (await searchUsersForMessages({ query: trimmedQuery, limit: 20 })) as CursorEnvelope;
        if (requestIdRef.current !== currentRequestId) return;
        const normalized = extractItems(response)
          .map(normalizeRecipient)
          .filter((recipient): recipient is MessageRecipient => Boolean(recipient))
          .filter((recipient) => !normalizedExclusions.has(recipient.userId));
        setResults(normalized);
        setNextCursor(extractNextCursor(response));
      } catch (searchError) {
        if (requestIdRef.current !== currentRequestId) return;
        setError(parseApiErrorMessage(searchError));
        setResults([]);
        setNextCursor(undefined);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [normalizedExclusions, open, searchText]);

  const isSelected = (userId: string) => selectedRecipients.some((recipient) => recipient.userId === userId);

  const toggleRecipient = (recipient: MessageRecipient) => {
    const exists = selectedRecipients.some((entry) => entry.userId === recipient.userId);
    setSelectedRecipients((previous) => {
      const existsInPrevious = previous.some((entry) => entry.userId === recipient.userId);
      if (existsInPrevious) return previous.filter((entry) => entry.userId !== recipient.userId);
      return [...previous, recipient];
    });

    if (!exists) {
      requestIdRef.current += 1;
      setSearchText("");
      setResults([]);
      setNextCursor(undefined);
      setError(null);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const removeRecipient = (userId: string) => {
    setSelectedRecipients((previous) => previous.filter((recipient) => recipient.userId !== userId));
  };

  const loadMore = async () => {
    const trimmedQuery = searchText.trim();
    if (!nextCursor || isLoadingMore || trimmedQuery.length < 2) return;
    setIsLoadingMore(true);
    setError(null);
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    try {
      const response = (await searchUsersForMessages({
        query: trimmedQuery,
        limit: 20,
        cursor: nextCursor,
      })) as CursorEnvelope;
      if (requestIdRef.current !== currentRequestId) return;
      const incoming = extractItems(response)
        .map(normalizeRecipient)
        .filter((recipient): recipient is MessageRecipient => Boolean(recipient))
        .filter((recipient) => !normalizedExclusions.has(recipient.userId));
      setResults((previous) => {
        const next = [...previous];
        const seen = new Set(previous.map((recipient) => recipient.userId));
        for (const recipient of incoming) {
          if (seen.has(recipient.userId)) continue;
          seen.add(recipient.userId);
          next.push(recipient);
        }
        return next;
      });
      setNextCursor(extractNextCursor(response));
    } catch (loadError) {
      if (requestIdRef.current !== currentRequestId) return;
      setError(parseApiErrorMessage(loadError));
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoadingMore(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (selectedRecipients.length === 0) {
      setError("Select at least one recipient.");
      return;
    }

    const selectedIds = selectedRecipients
      .map((recipient) => Number(recipient.userId))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (selectedIds.length !== selectedRecipients.length) {
      setError("One or more selected recipients are invalid.");
      return;
    }

    if (mode === "add_members" && !channelId) {
      setError("Missing channel id for add members.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "add_members") {
        await addChannelMembers(channelId as string, selectedIds);
        onSuccess({
          kind: "add_members",
          addedCount: selectedIds.length,
          recipients: selectedRecipients,
        });
        return;
      }

      if (selectedRecipients.length === 1) {
        const response = await createConversation(selectedRecipients[0].userId);
        const conversationId = extractConversationId(response);
        if (!conversationId) {
          throw new Error("Unable to open conversation.");
        }
        onSuccess({
          kind: "conversation",
          conversationId,
          recipients: selectedRecipients,
        });
        return;
      }

      const groupName = buildGroupName(selectedRecipients);
      const response = await createChannel({
        name: groupName,
        memberUserIds: selectedIds,
      });
      const channelResultId = extractChannelId(response);
      if (!channelResultId) {
        throw new Error("Unable to create group.");
      }
      onSuccess({
        kind: "channel",
        channelId: channelResultId,
        recipients: selectedRecipients,
      });
    } catch (submitError) {
      setError(parseApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const trimmedSearch = searchText.trim();
  const heading = title ?? (mode === "add_members" ? "Add Members" : "New Message");
  const actionLabel =
    submitLabel ??
    (mode === "add_members"
      ? selectedRecipients.length > 0
        ? `Add ${selectedRecipients.length}`
        : "Add members"
      : "Next");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={isSubmitting ? undefined : onClose}
    >
      <div
        className="flex h-[88dvh] w-full flex-col rounded-t-2xl border border-border/70 bg-bg p-4 shadow-xl sm:h-auto sm:max-h-[84vh] sm:max-w-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-strong">{heading}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition hover:bg-bg-muted hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close composer"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-border/70 bg-bg px-3 py-2">
          <div className={`flex gap-2 ${selectedRecipients.length > 0 ? "items-start" : "items-center"}`}>
            <span className={`text-sm font-semibold text-text-secondary ${selectedRecipients.length > 0 ? "pt-1" : ""}`}>
              To:
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                {selectedRecipients.map((recipient) => (
                  <button
                    key={recipient.userId}
                    type="button"
                    onClick={() => removeRecipient(recipient.userId)}
                    className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-xs font-semibold text-brand transition hover:bg-brand/15"
                    aria-label={`Remove ${recipient.displayName}`}
                  >
                    <span className="max-w-[150px] truncate">{recipient.displayName}</span>
                    <XIcon className="h-3 w-3" />
                  </button>
                ))}
              </div>
              <input
                ref={inputRef}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search people"
                className={`h-8 w-full bg-transparent text-sm text-strong placeholder:text-text-light focus-visible:outline-none ${
                  selectedRecipients.length > 0 ? "mt-2" : ""
                }`}
                aria-label="Search recipients"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {trimmedSearch.length === 0 ? (
            <p className="px-1 py-2 text-sm text-text-secondary">Search people to start a conversation.</p>
          ) : null}
          {trimmedSearch.length > 0 && trimmedSearch.length < 2 ? (
            <p className="px-1 py-2 text-sm text-text-secondary">Type at least 2 characters.</p>
          ) : null}
          {isSearching ? <p className="px-1 py-2 text-sm text-text-secondary">Searching...</p> : null}
          {!isSearching && trimmedSearch.length >= 2 && results.length === 0 ? (
            <p className="px-1 py-2 text-sm text-text-secondary">No results.</p>
          ) : null}

          <div className="space-y-1">
            {results.map((recipient) => {
              const selected = isSelected(recipient.userId);
              return (
                <button
                  key={recipient.userId}
                  type="button"
                  onClick={() => toggleRecipient(recipient)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                    selected ? "border-brand/45 bg-brand/5" : "border-transparent hover:bg-bg-muted"
                  }`}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-muted">
                    <img
                      src={recipient.avatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={handleProfileImageError}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-strong">{recipient.displayName}</p>
                    {recipient.handle ? <p className="truncate text-xs text-text-secondary">@{recipient.handle}</p> : null}
                  </div>
                  <span
                    className={`h-4 w-4 rounded-full border ${selected ? "border-brand bg-brand" : "border-border"}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          {nextCursor && trimmedSearch.length >= 2 ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={isLoadingMore}
              className="mt-2 w-full rounded-lg border border-border/70 px-3 py-2 text-xs font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </div>

        <div className="mt-3 space-y-2 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          {error ? <p className="text-sm text-brand">{error}</p> : null}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={selectedRecipients.length === 0 || isSubmitting}
            className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Please wait..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
