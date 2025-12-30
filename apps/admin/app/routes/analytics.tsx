import type { Route } from "./+types/analytics";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  fetchCommunityLeaderboard,
  fetchHashtagLeaderboard,
  fetchUserStats,
} from "../lib/adminApi";
import type {
  CommunityLeaderboardItem,
  HashtagLeaderboardItem,
  UserStatsResponse,
} from "../types/admin";

const COMMUNITY_LIMIT = 50;
const COMMUNITY_PAGE_SIZE = 10;
const HASHTAG_LIMIT = 50;

const rangePresets = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
  { value: "90d", label: "Past 90 days" },
] as const;

type BaseRangePreset = (typeof rangePresets)[number]["value"];
type RangePreset = BaseRangePreset | "custom";
type CommunityMetric = "likes" | "shares" | "followers" | "verifications" | "accounts";

type DateRange = {
  preset: RangePreset;
  from: string;
  to: string;
};

type RangeFilterProps = {
  label?: string;
  range: DateRange;
  setRange: Dispatch<SetStateAction<DateRange>>;
};

function formatNumber(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
}

function getUtcToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function createRange(preset: BaseRangePreset): DateRange {
  if (preset === "all") {
    return { preset, from: "", to: "" };
  }
  const today = getUtcToday();
  const days =
    preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 0;
  const from = formatDateInput(addDaysUtc(today, -(days - 1)));
  const to = formatDateInput(today);
  return { preset, from, to };
}

function rangeSummary(range: DateRange) {
  if (range.preset !== "custom") {
    return rangePresets.find((preset) => preset.value === range.preset)?.label ?? "Range";
  }
  if (range.from && range.to) return `${range.from} to ${range.to}`;
  if (range.from) return `From ${range.from}`;
  if (range.to) return `Until ${range.to}`;
  return "Custom range";
}

function getRangeParams(range: DateRange) {
  if (range.preset === "all" && !range.from && !range.to) {
    return { from: undefined, to: undefined };
  }
  const from = range.from || undefined;
  const toDate = range.to ? parseDateInput(range.to) : null;
  const to = toDate ? formatDateInput(addDaysUtc(toDate, 1)) : undefined;
  return { from, to };
}

function getCommunityMetricValue(item: CommunityLeaderboardItem, metric: CommunityMetric) {
  switch (metric) {
    case "likes":
      return typeof item.likes_count === "number" ? item.likes_count : 0;
    case "shares":
      return typeof item.shares_count === "number" ? item.shares_count : 0;
    case "followers":
      return typeof item.followers_count === "number" ? item.followers_count : 0;
    case "verifications":
      return typeof item.verifications_count === "number" ? item.verifications_count : 0;
    case "accounts":
      return typeof item.accounts_total === "number" ? item.accounts_total : 0;
    default:
      return 0;
  }
}

function getCommunityLabel(item: CommunityLeaderboardItem) {
  const typed = item as CommunityLeaderboardItem & {
    communityId?: number;
    id?: number;
    name?: string | null;
  };
  if (item.community_name && String(item.community_name).trim()) {
    return String(item.community_name);
  }
  if (typed.name && String(typed.name).trim()) {
    return String(typed.name);
  }
  const fallbackId =
    typeof item.community_id === "number"
      ? item.community_id
      : typeof typed.communityId === "number"
        ? typed.communityId
        : typeof typed.id === "number"
          ? typed.id
          : null;
  if (typeof fallbackId === "number") {
    return `Community #${fallbackId}`;
  }
  return "Community";
}

function getCommunityId(item: CommunityLeaderboardItem) {
  const typed = item as CommunityLeaderboardItem & { communityId?: number; id?: number };
  if (typeof item.community_id === "number") return item.community_id;
  if (typeof typed.communityId === "number") return typed.communityId;
  if (typeof typed.id === "number") return typed.id;
  return null;
}

function getHashtagLabel(item: HashtagLeaderboardItem) {
  const name = item.name?.trim();
  if (!name) return "Hashtag";
  return name.startsWith("#") ? name : `#${name}`;
}

function RangeFilter({ label = "Time range", range, setRange }: RangeFilterProps) {
  const isAllTime = range.preset === "all";
  return (
    <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-text-light">{label}</p>
        <span className="text-xs text-text-light">{rangeSummary(range)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {rangePresets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => setRange(createRange(preset.value))}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              range.preset === preset.value
                ? "border-brand bg-brand text-white"
                : "border-border bg-bg text-text-secondary hover:text-text-primary"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRange((prev) => ({ ...prev, preset: "custom" }))}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            range.preset === "custom"
              ? "border-brand bg-brand text-white"
              : "border-border bg-bg text-text-secondary hover:text-text-primary"
          }`}
        >
          Custom
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase text-text-light">
          From
          <input
            type="date"
            value={range.from}
            onChange={(event) =>
              setRange((prev) => ({ ...prev, preset: "custom", from: event.target.value }))
            }
            disabled={isAllTime}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="text-xs font-semibold uppercase text-text-light">
          To
          <input
            type="date"
            value={range.to}
            onChange={(event) =>
              setRange((prev) => ({ ...prev, preset: "custom", to: event.target.value }))
            }
            disabled={isAllTime}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-text-light">End date is inclusive (UTC).</p>
    </div>
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped Admin Analytics" },
    { name: "description", content: "Looped admin analytics dashboards" },
  ];
}

export default function AnalyticsRoute() {
  const communityMetric: CommunityMetric = "likes";
  const [communityRange, setCommunityRange] = useState<DateRange>(() => createRange("7d"));
  const [communityId, setCommunityId] = useState("");
  const [communityItems, setCommunityItems] = useState<CommunityLeaderboardItem[]>([]);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityPage, setCommunityPage] = useState(1);

  const [hashtagRange, setHashtagRange] = useState<DateRange>(() => createRange("7d"));
  const [hashtagCommunityId, setHashtagCommunityId] = useState("");
  const [hashtagItems, setHashtagItems] = useState<HashtagLeaderboardItem[]>([]);
  const [hashtagError, setHashtagError] = useState<string | null>(null);
  const [hashtagLoading, setHashtagLoading] = useState(false);

  const [userRange, setUserRange] = useState<DateRange>(() => createRange("30d"));
  const [userStats, setUserStats] = useState<UserStatsResponse | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  const communityMetricLabel = "Likes";

  const communityMax = useMemo(() => {
    const values = communityItems.map((item) => getCommunityMetricValue(item, communityMetric));
    return Math.max(1, ...values);
  }, [communityItems, communityMetric]);

  const communityPageCount = Math.max(
    1,
    Math.ceil(communityItems.length / COMMUNITY_PAGE_SIZE)
  );
  const communityPageItems = communityItems.slice(
    (communityPage - 1) * COMMUNITY_PAGE_SIZE,
    communityPage * COMMUNITY_PAGE_SIZE
  );
  const communityChartData = useMemo(
    () =>
      communityPageItems.map((item) => ({
        name: getCommunityLabel(item),
        value: getCommunityMetricValue(item, communityMetric),
      })),
    [communityPageItems, communityMetric]
  );

  const hashtagChartData = useMemo(
    () =>
      hashtagItems.slice(0, 10).map((item) => ({
        name: getHashtagLabel(item),
        value: typeof item.usage_count === "number" ? item.usage_count : 0,
      })),
    [hashtagItems]
  );

  const userChartData = useMemo(() => {
    if (!userStats) return [];
    return [
      { name: "Total users", value: userStats.total_users ?? 0 },
      { name: "New users", value: userStats.new_users ?? 0 },
      { name: "Deleted users", value: userStats.deleted_users ?? 0 },
    ];
  }, [userStats]);

  const hashtagMax = useMemo(() => {
    const values = hashtagItems.map((item) =>
      typeof item.usage_count === "number" ? item.usage_count : 0
    );
    return Math.max(1, ...values);
  }, [hashtagItems]);

  useEffect(() => {
    let active = true;
    const { from, to } = getRangeParams(communityRange);
    setCommunityLoading(true);
    setCommunityError(null);
    fetchCommunityLeaderboard({
      metric: communityMetric,
      communityId: communityId.trim() || undefined,
      from,
      to,
      limit: COMMUNITY_LIMIT,
    })
      .then((items) => {
        if (!active) return;
        setCommunityItems(items);
      })
      .catch((error) => {
        if (!active) return;
        setCommunityError(
          error instanceof Error ? error.message : "Unable to load community leaderboard."
        );
        setCommunityItems([]);
      })
      .finally(() => {
        if (!active) return;
        setCommunityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [communityRange, communityId, communityMetric]);

  useEffect(() => {
    setCommunityPage(1);
  }, [communityItems]);

  useEffect(() => {
    let active = true;
    const { from, to } = getRangeParams(hashtagRange);
    setHashtagLoading(true);
    setHashtagError(null);
    fetchHashtagLeaderboard({
      communityId: hashtagCommunityId.trim() || undefined,
      from,
      to,
      limit: HASHTAG_LIMIT,
    })
      .then((items) => {
        if (!active) return;
        setHashtagItems(items);
      })
      .catch((error) => {
        if (!active) return;
        setHashtagError(
          error instanceof Error ? error.message : "Unable to load hashtag leaderboard."
        );
        setHashtagItems([]);
      })
      .finally(() => {
        if (!active) return;
        setHashtagLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hashtagRange, hashtagCommunityId]);

  useEffect(() => {
    let active = true;
    const { from, to } = getRangeParams(userRange);
    setUserLoading(true);
    setUserError(null);
    fetchUserStats({ from, to })
      .then((stats) => {
        if (!active) return;
        setUserStats(stats);
      })
      .catch((error) => {
        if (!active) return;
        setUserError(error instanceof Error ? error.message : "Unable to load user stats.");
        setUserStats(null);
      })
      .finally(() => {
        if (!active) return;
        setUserLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userRange]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">
              Community leaderboard
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">
              Top communities by {communityMetricLabel.toLowerCase()}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Showing {COMMUNITY_PAGE_SIZE} communities per page.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(communityRange)}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {communityChartData.length > 0 && (
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Likes chart
                </p>
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={communityChartData}
                      margin={{ top: 4, right: 16, left: 12, bottom: 4 }}
                    >
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip cursor={{ fill: "rgba(234,64,74,0.08)" }} />
                      <Bar dataKey="value" fill="#ea404a" radius={[6, 6, 6, 6]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {communityError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
                <p className="text-sm font-semibold text-text-primary">
                  Unable to load community leaderboard.
                </p>
                <p className="mt-1 text-xs text-text-light">
                  Double-check filters or try again.
                </p>
                <details className="mt-2 text-xs text-text-light">
                  <summary className="cursor-pointer">Details</summary>
                  <p className="mt-2 whitespace-pre-wrap">{communityError}</p>
                </details>
              </div>
            )}
            {communityLoading && communityItems.length === 0 && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                Loading community leaderboard...
              </div>
            )}
            {!communityLoading && communityItems.length === 0 && !communityError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                No communities match the current filters.
              </div>
            )}

            {communityPageItems.map((item, index) => {
              const metricValue = getCommunityMetricValue(item, communityMetric);
              const percent = Math.min(100, (metricValue / communityMax) * 100);
              const communityIdValue = getCommunityId(item);
              return (
                <div
                  key={`${communityIdValue ?? "community"}-${index}`}
                  className="rounded-2xl border border-border bg-bg px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {getCommunityLabel(item)}
                      </p>
                      <p className="text-xs text-text-light">
                        Community ID: {communityIdValue ?? "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-strong">
                        {formatNumber(metricValue)}
                      </p>
                      <p className="text-xs text-text-light">{communityMetricLabel}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-5">
                    <span>Likes: {formatNumber(item.likes_count)}</span>
                    <span>Shares: {formatNumber(item.shares_count)}</span>
                    <span>Followers: {formatNumber(item.followers_count)}</span>
                    <span>Verifications: {formatNumber(item.verifications_count)}</span>
                    <span>Accounts: {formatNumber(item.accounts_total)}</span>
                  </div>
                </div>
              );
            })}

            {communityItems.length > COMMUNITY_PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-bg px-4 py-3 text-xs text-text-secondary">
                <span>
                  Page {communityPage} of {communityPageCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCommunityPage((prev) => Math.max(1, prev - 1))}
                    disabled={communityPage === 1}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCommunityPage((prev) => Math.min(communityPageCount, prev + 1))
                    }
                    disabled={communityPage >= communityPageCount}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-text-light">
                Leaderboard filters
              </p>
              <p className="mt-3 text-xs text-text-secondary">
                Metric: <span className="font-semibold text-text-primary">Likes</span>
              </p>
              <label className="mt-3 block text-xs font-semibold uppercase text-text-light">
                Community ID (optional)
                <input
                  type="text"
                  value={communityId}
                  onChange={(event) => setCommunityId(event.target.value)}
                  placeholder="All communities"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary"
                />
              </label>
              <p className="mt-2 text-xs text-text-light">
                Leave blank for global ranking.
              </p>
            </div>
            <RangeFilter range={communityRange} setRange={setCommunityRange} />
          </aside>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">
              Hashtag leaderboard
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Trending hashtags</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Showing the top {HASHTAG_LIMIT} hashtags for the selected range.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(hashtagRange)}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {hashtagChartData.length > 0 && (
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Hashtag usage chart
                </p>
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={hashtagChartData}
                      margin={{ top: 4, right: 16, left: 12, bottom: 4 }}
                    >
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip cursor={{ fill: "rgba(234,64,74,0.08)" }} />
                      <Bar dataKey="value" fill="#ea404a" radius={[6, 6, 6, 6]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {hashtagError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
                <p className="text-sm font-semibold text-text-primary">
                  Unable to load hashtag leaderboard.
                </p>
                <p className="mt-1 text-xs text-text-light">
                  Double-check filters or try again.
                </p>
                <details className="mt-2 text-xs text-text-light">
                  <summary className="cursor-pointer">Details</summary>
                  <p className="mt-2 whitespace-pre-wrap">{hashtagError}</p>
                </details>
              </div>
            )}
            {hashtagLoading && hashtagItems.length === 0 && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                Loading hashtag leaderboard...
              </div>
            )}
            {!hashtagLoading && hashtagItems.length === 0 && !hashtagError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                No hashtags match the current filters.
              </div>
            )}

            {hashtagItems.map((item, index) => {
              const metricValue =
                typeof item.usage_count === "number" ? item.usage_count : 0;
              const percent = Math.min(100, (metricValue / hashtagMax) * 100);
              return (
                <div
                  key={`${item.id}-${index}`}
                  className="rounded-2xl border border-border bg-bg px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {getHashtagLabel(item)}
                      </p>
                      <p className="text-xs text-text-light">Hashtag ID: {item.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-strong">
                        {formatNumber(metricValue)}
                      </p>
                      <p className="text-xs text-text-light">Uses</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-text-light">
                Hashtag filters
              </p>
              <label className="mt-3 block text-xs font-semibold uppercase text-text-light">
                Community ID (optional)
                <input
                  type="text"
                  value={hashtagCommunityId}
                  onChange={(event) => setHashtagCommunityId(event.target.value)}
                  placeholder="All communities"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary"
                />
              </label>
              <p className="mt-2 text-xs text-text-light">
                Leave blank for global ranking.
              </p>
            </div>
            <RangeFilter range={hashtagRange} setRange={setHashtagRange} />
          </aside>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">User stats</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">
              User growth and churn
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              See total users alongside new and deleted accounts.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(userRange)}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {userError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
                <p className="text-sm font-semibold text-text-primary">
                  Unable to load user stats.
                </p>
                <p className="mt-1 text-xs text-text-light">
                  Try adjusting the range or refresh.
                </p>
                <details className="mt-2 text-xs text-text-light">
                  <summary className="cursor-pointer">Details</summary>
                  <p className="mt-2 whitespace-pre-wrap">{userError}</p>
                </details>
              </div>
            )}
            {userLoading && !userStats && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                Loading user stats...
              </div>
            )}
            {!userLoading && !userStats && !userError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                No user stats available for the current range.
              </div>
            )}
            {userStats && (
              <>
                {userChartData.length > 0 && (
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">
                      User movement chart
                    </p>
                    <div className="mt-3 h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={userChartData}
                          margin={{ top: 4, right: 16, left: 12, bottom: 4 }}
                        >
                          <XAxis dataKey="name" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ fill: "rgba(234,64,74,0.08)" }} />
                          <Bar dataKey="value" fill="#ea404a" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">Total users</p>
                    <p className="mt-3 text-2xl font-semibold text-strong">
                      {formatNumber(userStats.total_users)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">New users</p>
                    <p className="mt-3 text-2xl font-semibold text-strong">
                      {formatNumber(userStats.new_users)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">
                      Deleted users
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-strong">
                      {formatNumber(userStats.deleted_users)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <aside>
            <RangeFilter range={userRange} setRange={setUserRange} />
          </aside>
        </div>
      </section>
    </div>
  );
}
