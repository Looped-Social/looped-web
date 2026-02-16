import { useCallback } from "react";
import { useNavigate } from "react-router";

import { useToast } from "@/app/components/AppToast/AppToast";
import { searchUsers } from "@/lib/searchApi";
import { normalizeTappedHashtag, normalizeTappedMention } from "@/lib/textEntities";

type ResolvedSearchUser = {
  id: string;
  handle?: string;
  username?: string;
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

function normalizeSearchUser(item: unknown): ResolvedSearchUser | null {
  if (!isRecord(item)) return null;
  const id = normalizeOptional(item.id ?? item.user_id ?? item.userId);
  if (!id) return null;

  const handle = normalizeOptional(item.handle)?.replace(/^@/, "");
  const username = normalizeOptional(item.username)?.replace(/^@/, "");

  return {
    id,
    handle,
    username,
  };
}

function isExactMentionMatch(user: ResolvedSearchUser, handle: string): boolean {
  const normalizedHandle = handle.toLowerCase();
  return (
    user.handle?.toLowerCase() === normalizedHandle ||
    user.username?.toLowerCase() === normalizedHandle
  );
}

export function useEntityNavigation() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const openHashtag = useCallback(
    (value: string) => {
      const hashtag = normalizeTappedHashtag(value);
      if (!hashtag) return;
      navigate(`/app/hashtags/${encodeURIComponent(hashtag)}`);
    },
    [navigate]
  );

  const openMention = useCallback(
    async (value: string) => {
      const handle = normalizeTappedMention(value);
      if (!handle) return;

      try {
        const response = await searchUsers({
          query: handle,
          limit: 25,
        });

        const users = (Array.isArray(response.items) ? response.items : [])
          .map(normalizeSearchUser)
          .filter((item): item is ResolvedSearchUser => Boolean(item));

        const match = users.find((user) => isExactMentionMatch(user, handle));

        if (!match) {
          showToast({
            title: "Profile unavailable",
            message: "Profile unavailable",
            tone: "error",
          });
          return;
        }

        navigate(`/app/profile/${encodeURIComponent(match.id)}`);
      } catch {
        showToast({
          title: "Profile unavailable",
          message: "Profile unavailable",
          tone: "error",
        });
      }
    },
    [navigate, showToast]
  );

  return {
    openHashtag,
    openMention,
  };
}
