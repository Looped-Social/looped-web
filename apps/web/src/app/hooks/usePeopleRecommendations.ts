import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchPeopleRecommendationRailPage,
  fetchPeopleRecommendationRails,
  sendPeopleRecommendationFeedback,
  type PeopleRecommendationApiError,
  type PeopleRecommendationFeedbackEventInput,
  type PeopleRecommendationFeedbackType,
  type PeopleRecommendationItem,
  type PeopleRecommendationRailPage,
} from "@/lib/peopleRecommendationsApi";
import { parseUserApiError, setUserFollowing } from "@/lib/userApi";

export type PeopleRecommendationsStatus = "loading" | "loaded" | "empty" | "error";

const IMPRESSION_VISIBLE_MS = 500;
const FEEDBACK_BATCH_THRESHOLD = 20;
const FEEDBACK_FLUSH_INTERVAL_MS = 2_000;
const FEEDBACK_MAX_BATCH_SIZE = 200;
const INITIAL_RAIL_LIMIT = 10;
const PAGED_RAIL_LIMIT = 20;

function randomEventId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function parseRecommendationErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "status" in error && "details" in error) {
    const apiError = error as PeopleRecommendationApiError;
    const raw = (apiError.details ?? "").trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === "object" && parsed !== null) {
          const payload = parsed as Record<string, unknown>;
          if (typeof payload.message === "string" && payload.message.trim().length > 0) {
            return payload.message.trim();
          }
          const code = typeof payload.error === "string" ? payload.error.trim() : "";
          if (code) {
            return code.replaceAll("_", " ");
          }
        }
      } catch {
        return raw;
      }
    }

    if (apiError.status === 0) {
      return "Network issue while loading recommendations. Please try again.";
    }

    return apiError.message || "Unable to load recommendations right now.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load recommendations right now.";
}

function mergeUniqueRecommendationItems(existing: PeopleRecommendationItem[], incoming: PeopleRecommendationItem[]): PeopleRecommendationItem[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((item) => item.recommendationId));
  const next = [...existing];
  for (const item of incoming) {
    if (seen.has(item.recommendationId)) continue;
    seen.add(item.recommendationId);
    next.push(item);
  }
  return next;
}

function buildFeedbackEvent(
  type: PeopleRecommendationFeedbackType,
  item: PeopleRecommendationItem
): PeopleRecommendationFeedbackEventInput {
  return {
    eventId: randomEventId(),
    type,
    recommendationId: item.recommendationId,
    trackingToken: item.tracking.token,
    position: item.tracking.position,
    clientTs: new Date().toISOString(),
    metadata: {
      surface: "search",
      rail: "pymk",
    },
  };
}

export function usePeopleRecommendations() {
  const [status, setStatus] = useState<PeopleRecommendationsStatus>("loading");
  const [rail, setRail] = useState<PeopleRecommendationRailPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [connectingUserIds, setConnectingUserIds] = useState<Set<string>>(new Set());
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());

  const hasLoadedOnceRef = useRef(false);
  const isMountedRef = useRef(true);
  const railRef = useRef<PeopleRecommendationRailPage | null>(null);

  const queuedFeedbackEventsRef = useRef<PeopleRecommendationFeedbackEventInput[]>([]);
  const feedbackFlushTimerRef = useRef<number | null>(null);
  const isFlushingFeedbackRef = useRef(false);

  const visibleRecommendationIdsRef = useRef<Set<string>>(new Set());
  const impressionedRecommendationIdsRef = useRef<Set<string>>(new Set());
  const pendingImpressionTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    railRef.current = rail;
  }, [rail]);

  useEffect(() => {
    if (!rail) {
      setFollowedUserIds(new Set());
      setConnectingUserIds(new Set());
      return;
    }

    const activeUserIds = new Set(rail.items.map((item) => item.user.id));

    setFollowedUserIds((previous) => {
      const next = new Set<string>();
      for (const userId of previous) {
        if (activeUserIds.has(userId)) {
          next.add(userId);
        }
      }
      for (const item of rail.items) {
        if (!item.actions.canConnect) {
          next.add(item.user.id);
        }
      }
      return next;
    });

    setConnectingUserIds((previous) => {
      const next = new Set<string>();
      for (const userId of previous) {
        if (activeUserIds.has(userId)) {
          next.add(userId);
        }
      }
      return next;
    });
  }, [rail]);

  const clearImpressionTimer = useCallback((recommendationId: string) => {
    const existingTimer = pendingImpressionTimersRef.current.get(recommendationId);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      pendingImpressionTimersRef.current.delete(recommendationId);
    }
  }, []);

  const removeCandidatesByUserIds = useCallback((userIds: Set<string>) => {
    if (userIds.size === 0) return;

    const currentRail = railRef.current;
    if (currentRail) {
      for (const item of currentRail.items) {
        if (!userIds.has(item.user.id)) continue;
        clearImpressionTimer(item.recommendationId);
        visibleRecommendationIdsRef.current.delete(item.recommendationId);
      }
    }

    if (isMountedRef.current) {
      setRail((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          items: previous.items.filter((item) => !userIds.has(item.user.id)),
        };
      });
      setFollowedUserIds((previous) => {
        const next = new Set(previous);
        for (const userId of userIds) {
          next.delete(userId);
        }
        return next;
      });
      setConnectingUserIds((previous) => {
        const next = new Set(previous);
        for (const userId of userIds) {
          next.delete(userId);
        }
        return next;
      });
    }
  }, [clearImpressionTimer]);

  const flushFeedback = useCallback(async (force: boolean) => {
    if (isFlushingFeedbackRef.current) return;
    if (queuedFeedbackEventsRef.current.length === 0) return;
    if (!force && queuedFeedbackEventsRef.current.length < FEEDBACK_BATCH_THRESHOLD) return;

    if (feedbackFlushTimerRef.current !== null) {
      window.clearTimeout(feedbackFlushTimerRef.current);
      feedbackFlushTimerRef.current = null;
    }

    isFlushingFeedbackRef.current = true;
    try {
      while (queuedFeedbackEventsRef.current.length > 0) {
        const batch = queuedFeedbackEventsRef.current.slice(0, FEEDBACK_MAX_BATCH_SIZE);
        queuedFeedbackEventsRef.current = queuedFeedbackEventsRef.current.slice(batch.length);

        try {
          const response = await sendPeopleRecommendationFeedback(batch);
          if (response.suppressedCandidateIds.length > 0) {
            removeCandidatesByUserIds(new Set(response.suppressedCandidateIds));
          }
        } catch (flushError) {
          queuedFeedbackEventsRef.current = [...batch, ...queuedFeedbackEventsRef.current];
          if (isMountedRef.current) {
            setError(parseRecommendationErrorMessage(flushError));
            setStatus((previous) => (previous === "loaded" ? previous : "error"));
          }
          break;
        }
      }
    } finally {
      isFlushingFeedbackRef.current = false;
      if (queuedFeedbackEventsRef.current.length > 0 && feedbackFlushTimerRef.current === null) {
        feedbackFlushTimerRef.current = window.setTimeout(() => {
          feedbackFlushTimerRef.current = null;
          void flushFeedback(true);
        }, FEEDBACK_FLUSH_INTERVAL_MS);
      }
    }
  }, [removeCandidatesByUserIds]);

  const queueFeedback = useCallback((event: PeopleRecommendationFeedbackEventInput, immediate: boolean) => {
    queuedFeedbackEventsRef.current.push(event);

    if (immediate || queuedFeedbackEventsRef.current.length >= FEEDBACK_BATCH_THRESHOLD) {
      if (feedbackFlushTimerRef.current !== null) {
        window.clearTimeout(feedbackFlushTimerRef.current);
        feedbackFlushTimerRef.current = null;
      }
      void flushFeedback(true);
      return;
    }

    if (feedbackFlushTimerRef.current === null) {
      feedbackFlushTimerRef.current = window.setTimeout(() => {
        feedbackFlushTimerRef.current = null;
        void flushFeedback(true);
      }, FEEDBACK_FLUSH_INTERVAL_MS);
    }
  }, [flushFeedback]);

  const loadRecommendations = useCallback(async (force: boolean) => {
    if (hasLoadedOnceRef.current && !force) return;

    if (isMountedRef.current) {
      setStatus("loading");
      setError(null);
    }

    try {
      const bundle = await fetchPeopleRecommendationRails({
        surface: "search",
        rails: ["pymk"],
        limitPerRail: INITIAL_RAIL_LIMIT,
      });
      const nextRail = bundle.rails.find((entry) => entry.rail === "pymk") ?? null;

      if (!isMountedRef.current) return;

      if (!nextRail || nextRail.items.length === 0) {
        setRail(nextRail);
        setStatus("empty");
        setFollowedUserIds(new Set());
        setConnectingUserIds(new Set());
      } else {
        setRail(nextRail);
        setStatus("loaded");
        setFollowedUserIds(
          new Set(nextRail.items.filter((item) => !item.actions.canConnect).map((item) => item.user.id))
        );
      }
      setError(null);
      hasLoadedOnceRef.current = true;
    } catch (loadError) {
      if (!isMountedRef.current) return;
      setError(parseRecommendationErrorMessage(loadError));
      setStatus("error");
    }
  }, []);

  const loadMoreRecommendations = useCallback(async () => {
    const currentRail = railRef.current;
    if (!currentRail) return;
    if (!currentRail.hasMore || !currentRail.nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const page = await fetchPeopleRecommendationRailPage({
        rail: "pymk",
        surface: "search",
        limit: PAGED_RAIL_LIMIT,
        cursor: currentRail.nextCursor,
      });

      if (!isMountedRef.current) return;

      setRail((previous) => {
        if (!previous) return page;
        return {
          ...previous,
          title: page.title || previous.title,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          community: page.community ?? previous.community,
          experiment: page.experiment ?? previous.experiment,
          items: mergeUniqueRecommendationItems(previous.items, page.items),
        };
      });
      setStatus("loaded");
      setError(null);
    } catch (loadMoreError) {
      if (isMountedRef.current) {
        setError(parseRecommendationErrorMessage(loadMoreError));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore]);

  useEffect(() => {
    void loadRecommendations(false);
  }, [loadRecommendations]);

  useEffect(() => {
    const activeRecommendationIds = new Set(rail?.items.map((item) => item.recommendationId) ?? []);

    for (const recommendationId of Array.from(visibleRecommendationIdsRef.current)) {
      if (activeRecommendationIds.has(recommendationId)) continue;
      visibleRecommendationIdsRef.current.delete(recommendationId);
    }

    for (const [recommendationId, timerId] of Array.from(pendingImpressionTimersRef.current.entries())) {
      if (activeRecommendationIds.has(recommendationId)) continue;
      window.clearTimeout(timerId);
      pendingImpressionTimersRef.current.delete(recommendationId);
    }
  }, [rail]);

  const canFollowRecommendation = useCallback((item: PeopleRecommendationItem): boolean => {
    return item.actions.canConnect && !followedUserIds.has(item.user.id);
  }, [followedUserIds]);

  const isConnectingRecommendationUser = useCallback((userId: string): boolean => {
    return connectingUserIds.has(userId);
  }, [connectingUserIds]);

  const followRecommendation = useCallback(async (item: PeopleRecommendationItem) => {
    if (!canFollowRecommendation(item)) return;
    if (connectingUserIds.has(item.user.id)) return;

    setConnectingUserIds((previous) => {
      const next = new Set(previous);
      next.add(item.user.id);
      return next;
    });

    try {
      await setUserFollowing(item.user.id, true);
      if (!isMountedRef.current) return;
      setFollowedUserIds((previous) => {
        const next = new Set(previous);
        next.add(item.user.id);
        return next;
      });
      queueFeedback(buildFeedbackEvent("connect_request_sent", item), false);
    } catch (followError) {
      if (isMountedRef.current) {
        const parsed = parseUserApiError(followError);
        setError(parsed.message || "Unable to follow this user right now.");
      }
    } finally {
      if (isMountedRef.current) {
        setConnectingUserIds((previous) => {
          const next = new Set(previous);
          next.delete(item.user.id);
          return next;
        });
      }
    }
  }, [canFollowRecommendation, connectingUserIds, queueFeedback]);

  const trackRecommendationProfileOpen = useCallback((item: PeopleRecommendationItem) => {
    queueFeedback(buildFeedbackEvent("profile_open", item), false);
  }, [queueFeedback]);

  const hideRecommendation = useCallback((item: PeopleRecommendationItem) => {
    removeCandidatesByUserIds(new Set([item.user.id]));
    queueFeedback(buildFeedbackEvent("hide", item), true);
  }, [queueFeedback, removeCandidatesByUserIds]);

  const lessLikeThisRecommendation = useCallback((item: PeopleRecommendationItem) => {
    removeCandidatesByUserIds(new Set([item.user.id]));
    queueFeedback(buildFeedbackEvent("less_like_this", item), true);
  }, [queueFeedback, removeCandidatesByUserIds]);

  const trackRecommendationVisibility = useCallback((item: PeopleRecommendationItem, isVisible: boolean) => {
    const recommendationId = item.recommendationId;

    if (!isVisible) {
      visibleRecommendationIdsRef.current.delete(recommendationId);
      clearImpressionTimer(recommendationId);
      return;
    }

    if (impressionedRecommendationIdsRef.current.has(recommendationId)) {
      visibleRecommendationIdsRef.current.add(recommendationId);
      return;
    }

    visibleRecommendationIdsRef.current.add(recommendationId);

    if (pendingImpressionTimersRef.current.has(recommendationId)) return;

    const timerId = window.setTimeout(() => {
      pendingImpressionTimersRef.current.delete(recommendationId);
      if (!visibleRecommendationIdsRef.current.has(recommendationId)) return;
      if (impressionedRecommendationIdsRef.current.has(recommendationId)) return;

      impressionedRecommendationIdsRef.current.add(recommendationId);
      queueFeedback(buildFeedbackEvent("impression", item), false);
    }, IMPRESSION_VISIBLE_MS);

    pendingImpressionTimersRef.current.set(recommendationId, timerId);
  }, [clearImpressionTimer, queueFeedback]);

  useEffect(() => {
    const pendingImpressionTimers = pendingImpressionTimersRef.current;
    const visibleRecommendationIds = visibleRecommendationIdsRef.current;

    return () => {
      isMountedRef.current = false;

      if (feedbackFlushTimerRef.current !== null) {
        window.clearTimeout(feedbackFlushTimerRef.current);
        feedbackFlushTimerRef.current = null;
      }

      for (const timerId of pendingImpressionTimers.values()) {
        window.clearTimeout(timerId);
      }
      pendingImpressionTimers.clear();
      visibleRecommendationIds.clear();

      void flushFeedback(true);
    };
  }, [flushFeedback]);

  return {
    status,
    rail,
    error,
    isLoadingMore,
    loadMoreRecommendations,
    retryRecommendations: () => loadRecommendations(true),
    canFollowRecommendation,
    isConnectingRecommendationUser,
    followRecommendation,
    trackRecommendationProfileOpen,
    hideRecommendation,
    lessLikeThisRecommendation,
    trackRecommendationVisibility,
  };
}
