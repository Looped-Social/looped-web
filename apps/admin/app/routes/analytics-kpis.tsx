import type { Route } from "./+types/analytics-kpis";

import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchAdminCommunity,
  fetchKpiActiveUsers,
  fetchKpiCommunitiesPostsPerActiveDaily,
  fetchKpiContentCreationDaily,
  fetchKpiCommunityHealthDaily,
  fetchKpiCommunityRetention,
  fetchKpiGrowthUsersDaily,
  fetchKpiGrowthUsersWeekly,
  fetchKpiModerationRepeatOffenders,
  fetchKpiNorthStarUniqueInteractions,
  fetchKpiPostsUniqueParticipants,
  fetchKpiRetentionByKind,
  fetchKpiSupportTickets,
  fetchKpiTrustSafety,
  fetchKpiUsersTimeToFirstActions,
  fetchKpiUsersVerificationToFirstActions,
} from "../lib/adminApi";
import type { AdminRouteContext } from "./admin";
import type {
  ActiveUsersKpiItem,
  CommunitiesPostsPerActiveDailyKpiItem,
  ContentCreationDailyKpiItem,
  CommunityHealthDailyKpiItem,
  CommunityRetentionKpiItem,
  GrowthUsersDailyKpiItem,
  GrowthUsersWeeklyKpiItem,
  ModerationRepeatOffendersKpiResponse,
  NorthStarUniqueInteractionsKpiResponse,
  PostsUniqueParticipantsKpiResponse,
  RetentionByKindKpiItem,
  SupportTicketsKpiResponse,
  TimeToFirstActionsKpiResponse,
  TrustSafetyKpiResponse,
  VerificationToFirstActionsKpiResponse,
} from "../types/admin";
import { AnalyticsSubnav } from "../components/AnalyticsSubnav/AnalyticsSubnav";

const kpiViewOptions = [
  { value: "all", label: "All dashboards" },
  { value: "active-users", label: "Active users (DAU/MAU)" },
  { value: "creation", label: "Content creation" },
  { value: "growth", label: "User growth & churn" },
  { value: "retention-by-kind", label: "Retention by kind" },
  { value: "trust-safety", label: "Trust & safety" },
  { value: "moderation", label: "Moderation (repeat offenders)" },
  { value: "time-to", label: "Time-to metrics" },
  { value: "north-star", label: "North star interactions" },
  { value: "support", label: "Support tickets (proxy)" },
  { value: "community", label: "Community KPIs" },
] as const;

type KpiView = (typeof kpiViewOptions)[number]["value"];

const rangePresets = [
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
  { value: "90d", label: "Past 90 days" },
  { value: "365d", label: "Past 365 days" },
] as const;

type BaseRangePreset = (typeof rangePresets)[number]["value"];
type RangePreset = BaseRangePreset | "custom";

type DateRange = {
  preset: RangePreset;
  from: string;
  to: string;
};

type HealthSeriesKey = "posts" | "engagement" | "unique" | "ratio";

function formatNumber(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeRate(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value > 1) return value / 100;
  if (value < 0) return 0;
  return value;
}

function formatPercent(value?: number | null, digits = 1) {
  const normalized = normalizeRate(value);
  if (normalized === null) return "N/A";
  return `${(normalized * 100).toFixed(digits)}%`;
}

function formatDecimal(value?: number | null, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(digits);
}

function formatDurationSeconds(seconds?: number | null) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return "N/A";
  if (seconds < 0) return "N/A";
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  if (days >= 2) return `${days.toFixed(1)}d`;
  if (hours >= 2) return `${hours.toFixed(1)}h`;
  if (minutes >= 2) return `${minutes.toFixed(0)}m`;
  return `${seconds.toFixed(0)}s`;
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

function parseKpiView(value: string | null): KpiView {
  const candidate = value?.trim() ?? "";
  if (!candidate) return "all";
  const allowed = new Set<string>(kpiViewOptions.map((option) => option.value));
  return allowed.has(candidate) ? (candidate as KpiView) : "all";
}

function createRange(preset: BaseRangePreset): DateRange {
  const today = getUtcToday();
  const days =
    preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
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

function getRangeParamsInclusive(range: DateRange) {
  const from = range.from || undefined;
  const to = range.to || undefined;
  return { from, to };
}

function validateRangeMaxDays(range: DateRange, maxDays: number) {
  if (!range.from || !range.to) return null;
  const fromDate = parseDateInput(range.from);
  const toDate = parseDateInput(range.to);
  if (!fromDate || !toDate) return null;
  const diffDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  if (diffDays <= maxDays) return null;
  return `Max range is ${maxDays} days (currently ${diffDays} days).`;
}

function formatDayTick(value: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return value;
  return `${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${String(
    parsed.getUTCDate()
  ).padStart(2, "0")}`;
}

function getTrustSafetyGroups(res: TrustSafetyKpiResponse | null) {
  if (!res) return null;
  const anyRes = res as unknown as Record<string, unknown>;
  const verified =
    (anyRes.verified as Record<string, unknown> | undefined) ??
    (anyRes.verification as Record<string, unknown> | undefined) ??
    res;
  const participation =
    (anyRes.participation as Record<string, unknown> | undefined) ??
    (anyRes.anonymous_participation as Record<string, unknown> | undefined) ??
    (anyRes.anonymous_vs_identified_participation as Record<string, unknown> | undefined) ??
    res;
  const appeals =
    (anyRes.appeals as Record<string, unknown> | undefined) ??
    (anyRes.appeal as Record<string, unknown> | undefined) ??
    res;

  return { verified, participation, appeals };
}

function RangeFilter({
  label,
  range,
  setRange,
}: {
  label: string;
  range: DateRange;
  setRange: (next: DateRange) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-muted/30 p-3">
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
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
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
          onClick={() => setRange({ ...range, preset: "custom" })}
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
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
              setRange({ ...range, preset: "custom", from: event.target.value })
            }
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium text-text-primary"
          />
        </label>
        <label className="text-xs font-semibold uppercase text-text-light">
          To
          <input
            type="date"
            value={range.to}
            onChange={(event) =>
              setRange({ ...range, preset: "custom", to: event.target.value })
            }
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium text-text-primary"
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-text-light">End date is inclusive (UTC).</p>
    </div>
  );
}

function CompactRangeControl({
  label,
  range,
  setRange,
}: {
  label: string;
  range: DateRange;
  setRange: (next: DateRange) => void;
}) {
  const presetValue = range.preset === "custom" ? "custom" : range.preset;
  return (
    <div className="rounded-2xl border border-border bg-bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="min-w-[220px] flex-1 text-xs font-semibold uppercase text-text-light">
          {label}
          <select
            value={presetValue}
            onChange={(event) => {
              const next = event.target.value as RangePreset;
              if (next === "custom") {
                setRange({ ...range, preset: "custom" });
                return;
              }
              setRange(createRange(next as BaseRangePreset));
            }}
            className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm font-semibold text-text-primary"
          >
            {rangePresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </label>
        <div className="text-xs text-text-light">{rangeSummary(range)}</div>
      </div>
      {presetValue === "custom" ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase text-text-light">
            From
            <input
              type="date"
              value={range.from}
              onChange={(event) => setRange({ ...range, preset: "custom", from: event.target.value })}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm font-medium text-text-primary"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-text-light">
            To
            <input
              type="date"
              value={range.to}
              onChange={(event) => setRange({ ...range, preset: "custom", to: event.target.value })}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm font-medium text-text-primary"
            />
          </label>
        </div>
      ) : null}
      <p className="mt-1 text-xs text-text-light">End date is inclusive (UTC).</p>
    </div>
  );
}

function ErrorCard({ title, message, details }: { title: string; message: string; details?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-xs text-text-light">{message}</p>
      {details ? (
        <details className="mt-2 text-xs text-text-light">
          <summary className="cursor-pointer">Details</summary>
          <p className="mt-2 whitespace-pre-wrap">{details}</p>
        </details>
      ) : null}
    </div>
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped Admin KPIs" },
    { name: "description", content: "Looped admin KPI dashboards" },
  ];
}

export default function AnalyticsKpisRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canView = admin.permissions.includes("view_reports");

  const [searchParams, setSearchParams] = useSearchParams();
  const view = useMemo(() => parseKpiView(searchParams.get("view")), [searchParams]);
  const setView = (next: KpiView) => {
    const params = new URLSearchParams(searchParams);
    if (next === "all") {
      params.delete("view");
    } else {
      params.set("view", next);
    }
    setSearchParams(params);
  };

  const wantsActiveUsers = view === "all" || view === "active-users";
  const wantsCreation = view === "all" || view === "creation";
  const wantsGrowth = view === "all" || view === "growth";
  const wantsRetentionByKind = view === "all" || view === "retention-by-kind";
  const wantsTrustSafety = view === "all" || view === "trust-safety";
  const wantsModeration = view === "all" || view === "moderation";
  const wantsTimeTo = view === "all" || view === "time-to";
  const wantsNorthStar = view === "all" || view === "north-star";
  const wantsSupport = view === "all" || view === "support";
  const wantsCommunity = view === "all" || view === "community";

  const [globalRange, setGlobalRange] = useState<DateRange>(() => createRange("30d"));
  const globalRangeError = validateRangeMaxDays(globalRange, 366);

  const [activeUsersItems, setActiveUsersItems] = useState<ActiveUsersKpiItem[]>([]);
  const [activeUsersLoading, setActiveUsersLoading] = useState(false);
  const [activeUsersError, setActiveUsersError] = useState<string | null>(null);

  const [contentCreationItems, setContentCreationItems] = useState<ContentCreationDailyKpiItem[]>(
    []
  );
  const [contentCreationLoading, setContentCreationLoading] = useState(false);
  const [contentCreationError, setContentCreationError] = useState<string | null>(null);

  const [growthDailyItems, setGrowthDailyItems] = useState<GrowthUsersDailyKpiItem[]>([]);
  const [growthDailyLoading, setGrowthDailyLoading] = useState(false);
  const [growthDailyError, setGrowthDailyError] = useState<string | null>(null);

  const [growthWeeklyItems, setGrowthWeeklyItems] = useState<GrowthUsersWeeklyKpiItem[]>([]);
  const [growthWeeklyLoading, setGrowthWeeklyLoading] = useState(false);
  const [growthWeeklyError, setGrowthWeeklyError] = useState<string | null>(null);

  const [trustSafety, setTrustSafety] = useState<TrustSafetyKpiResponse | null>(null);
  const [trustSafetyLoading, setTrustSafetyLoading] = useState(false);
  const [trustSafetyError, setTrustSafetyError] = useState<string | null>(null);

  const [repeatOffenders, setRepeatOffenders] =
    useState<ModerationRepeatOffendersKpiResponse | null>(null);
  const [repeatOffendersLoading, setRepeatOffendersLoading] = useState(false);
  const [repeatOffendersError, setRepeatOffendersError] = useState<string | null>(null);

  const [timeToFirst, setTimeToFirst] = useState<TimeToFirstActionsKpiResponse | null>(null);
  const [timeToFirstLoading, setTimeToFirstLoading] = useState(false);
  const [timeToFirstError, setTimeToFirstError] = useState<string | null>(null);

  const [verificationToFirst, setVerificationToFirst] =
    useState<VerificationToFirstActionsKpiResponse | null>(null);
  const [verificationToFirstLoading, setVerificationToFirstLoading] = useState(false);
  const [verificationToFirstError, setVerificationToFirstError] = useState<string | null>(null);

  const [supportTickets, setSupportTickets] = useState<SupportTicketsKpiResponse | null>(null);
  const [supportTicketsLoading, setSupportTicketsLoading] = useState(false);
  const [supportTicketsError, setSupportTicketsError] = useState<string | null>(null);

  const [communityIdInput, setCommunityIdInput] = useState("");
  const communityId = useMemo(() => {
    const parsed = Number.parseInt(communityIdInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [communityIdInput]);

  const [communityLabel, setCommunityLabel] = useState<string | null>(null);
  const [communityLookupLoading, setCommunityLookupLoading] = useState(false);

  const [healthRange, setHealthRange] = useState<DateRange>(() => createRange("30d"));
  const healthRangeError = validateRangeMaxDays(healthRange, 366);
  const [healthSeriesKey, setHealthSeriesKey] = useState<HealthSeriesKey>("posts");
  const [healthItems, setHealthItems] = useState<CommunityHealthDailyKpiItem[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [postsPerActiveKind, setPostsPerActiveKind] = useState("company");
  const [postsPerActiveItems, setPostsPerActiveItems] =
    useState<CommunitiesPostsPerActiveDailyKpiItem[]>([]);
  const [postsPerActiveLoading, setPostsPerActiveLoading] = useState(false);
  const [postsPerActiveError, setPostsPerActiveError] = useState<string | null>(null);

  const [uniqueParticipants, setUniqueParticipants] =
    useState<PostsUniqueParticipantsKpiResponse | null>(null);
  const [uniqueParticipantsLoading, setUniqueParticipantsLoading] = useState(false);
  const [uniqueParticipantsError, setUniqueParticipantsError] = useState<string | null>(null);

  const [retentionRange, setRetentionRange] = useState<DateRange>(() => createRange("90d"));
  const retentionRangeError = validateRangeMaxDays(retentionRange, 366);
  const [retentionItems, setRetentionItems] = useState<CommunityRetentionKpiItem[]>([]);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const [showAllCohorts, setShowAllCohorts] = useState(false);

  const retentionKindsOptions = ["company", "school", "sector", "specialization"] as const;
  const [retentionKinds, setRetentionKinds] = useState<string[]>(["company", "school"]);
  const [retentionByKindItems, setRetentionByKindItems] = useState<RetentionByKindKpiItem[]>([]);
  const [retentionByKindLoading, setRetentionByKindLoading] = useState(false);
  const [retentionByKindError, setRetentionByKindError] = useState<string | null>(null);
  const [retentionByKindSelected, setRetentionByKindSelected] = useState<string>("company");

  const [northStarUseCommunity, setNorthStarUseCommunity] = useState(false);
  const [northStar, setNorthStar] = useState<NorthStarUniqueInteractionsKpiResponse | null>(null);
  const [northStarLoading, setNorthStarLoading] = useState(false);
  const [northStarError, setNorthStarError] = useState<string | null>(null);

  useEffect(() => {
    if (!communityId) {
      setCommunityLabel(null);
      return;
    }
    let active = true;
    setCommunityLookupLoading(true);
    fetchAdminCommunity(communityId)
      .then((community) => {
        if (!active) return;
        setCommunityLabel(`${community.name} (${community.kind})`);
      })
      .catch(() => {
        if (!active) return;
        setCommunityLabel(null);
      })
      .finally(() => {
        if (!active) return;
        setCommunityLookupLoading(false);
      });
    return () => {
      active = false;
    };
  }, [communityId]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsActiveUsers) return;
    if (globalRangeError) {
      setActiveUsersItems([]);
      setActiveUsersError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setActiveUsersLoading(true);
    setActiveUsersError(null);
    fetchKpiActiveUsers({ from, to })
      .then((res) => {
        if (!active) return;
        setActiveUsersItems(res.items ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setActiveUsersError(
          error instanceof Error ? error.message : "Unable to load active user KPIs."
        );
        setActiveUsersItems([]);
      })
      .finally(() => {
        if (!active) return;
        setActiveUsersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsActiveUsers]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsCreation) return;
    if (globalRangeError) {
      setContentCreationItems([]);
      setContentCreationError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setContentCreationLoading(true);
    setContentCreationError(null);
    fetchKpiContentCreationDaily({ from, to })
      .then((res) => {
        if (!active) return;
        setContentCreationItems(res.items ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setContentCreationError(
          error instanceof Error ? error.message : "Unable to load content creation KPIs."
        );
        setContentCreationItems([]);
      })
      .finally(() => {
        if (!active) return;
        setContentCreationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsCreation]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsGrowth) return;
    if (globalRangeError) {
      setGrowthDailyItems([]);
      setGrowthDailyError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setGrowthDailyLoading(true);
    setGrowthDailyError(null);
    fetchKpiGrowthUsersDaily({ from, to })
      .then((res) => {
        if (!active) return;
        setGrowthDailyItems(res.items ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setGrowthDailyError(
          error instanceof Error ? error.message : "Unable to load daily user growth KPIs."
        );
        setGrowthDailyItems([]);
      })
      .finally(() => {
        if (!active) return;
        setGrowthDailyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsGrowth]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsGrowth) return;
    if (globalRangeError) {
      setGrowthWeeklyItems([]);
      setGrowthWeeklyError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setGrowthWeeklyLoading(true);
    setGrowthWeeklyError(null);
    fetchKpiGrowthUsersWeekly({ from, to })
      .then((res) => {
        if (!active) return;
        setGrowthWeeklyItems(res.items ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setGrowthWeeklyError(
          error instanceof Error ? error.message : "Unable to load weekly user growth KPIs."
        );
        setGrowthWeeklyItems([]);
      })
      .finally(() => {
        if (!active) return;
        setGrowthWeeklyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsGrowth]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsTrustSafety) return;
    if (globalRangeError) {
      setTrustSafety(null);
      setTrustSafetyError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setTrustSafetyLoading(true);
    setTrustSafetyError(null);
    fetchKpiTrustSafety({ from, to })
      .then((res) => {
        if (!active) return;
        setTrustSafety(res);
      })
      .catch((error) => {
        if (!active) return;
        setTrustSafetyError(
          error instanceof Error ? error.message : "Unable to load trust & safety KPIs."
        );
        setTrustSafety(null);
      })
      .finally(() => {
        if (!active) return;
        setTrustSafetyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsTrustSafety]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsModeration) return;
    if (globalRangeError) {
      setRepeatOffenders(null);
      setRepeatOffendersError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setRepeatOffendersLoading(true);
    setRepeatOffendersError(null);
    fetchKpiModerationRepeatOffenders({ from, to })
      .then((res) => {
        if (!active) return;
        setRepeatOffenders(res);
      })
      .catch((error) => {
        if (!active) return;
        setRepeatOffendersError(
          error instanceof Error ? error.message : "Unable to load moderation KPIs."
        );
        setRepeatOffenders(null);
      })
      .finally(() => {
        if (!active) return;
        setRepeatOffendersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsModeration]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsTimeTo) return;
    if (globalRangeError) {
      setTimeToFirst(null);
      setTimeToFirstError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setTimeToFirstLoading(true);
    setTimeToFirstError(null);
    fetchKpiUsersTimeToFirstActions({ from, to })
      .then((res) => {
        if (!active) return;
        setTimeToFirst(res);
      })
      .catch((error) => {
        if (!active) return;
        setTimeToFirstError(
          error instanceof Error ? error.message : "Unable to load time-to-first-action KPIs."
        );
        setTimeToFirst(null);
      })
      .finally(() => {
        if (!active) return;
        setTimeToFirstLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsTimeTo]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsTimeTo) return;
    if (globalRangeError) {
      setVerificationToFirst(null);
      setVerificationToFirstError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setVerificationToFirstLoading(true);
    setVerificationToFirstError(null);
    fetchKpiUsersVerificationToFirstActions({ from, to })
      .then((res) => {
        if (!active) return;
        setVerificationToFirst(res);
      })
      .catch((error) => {
        if (!active) return;
        setVerificationToFirstError(
          error instanceof Error
            ? error.message
            : "Unable to load verification-to-first-action KPIs."
        );
        setVerificationToFirst(null);
      })
      .finally(() => {
        if (!active) return;
        setVerificationToFirstLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsTimeTo]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsSupport) return;
    if (globalRangeError) {
      setSupportTickets(null);
      setSupportTicketsError(globalRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setSupportTicketsLoading(true);
    setSupportTicketsError(null);
    fetchKpiSupportTickets({ from, to })
      .then((res) => {
        if (!active) return;
        setSupportTickets(res);
      })
      .catch((error) => {
        if (!active) return;
        setSupportTicketsError(
          error instanceof Error ? error.message : "Unable to load support ticket KPIs."
        );
        setSupportTickets(null);
      })
      .finally(() => {
        if (!active) return;
        setSupportTicketsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, globalRange, globalRangeError, wantsSupport]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsNorthStar) return;
    if (globalRangeError) {
      setNorthStar(null);
      setNorthStarError(globalRangeError);
      return;
    }
    const shouldUseCommunity = northStarUseCommunity && typeof communityId === "number";
    let active = true;
    const { from, to } = getRangeParamsInclusive(globalRange);
    setNorthStarLoading(true);
    setNorthStarError(null);
    fetchKpiNorthStarUniqueInteractions({
      communityId: shouldUseCommunity ? communityId : undefined,
      from,
      to,
    })
      .then((res) => {
        if (!active) return;
        setNorthStar(res);
      })
      .catch((error) => {
        if (!active) return;
        setNorthStarError(
          error instanceof Error ? error.message : "Unable to load north star KPIs."
        );
        setNorthStar(null);
      })
      .finally(() => {
        if (!active) return;
        setNorthStarLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    canView,
    communityId,
    globalRange,
    globalRangeError,
    northStarUseCommunity,
    wantsNorthStar,
  ]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsCommunity) return;
    if (!communityId) return;
    if (healthRangeError) {
      setHealthItems([]);
      setHealthError(healthRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(healthRange);
    setHealthLoading(true);
    setHealthError(null);
    fetchKpiCommunityHealthDaily({ communityId, from, to })
      .then((res) => {
        if (!active) return;
        setHealthItems(res.items ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setHealthError(
          error instanceof Error ? error.message : "Unable to load community health KPIs."
        );
        setHealthItems([]);
      })
      .finally(() => {
        if (!active) return;
        setHealthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, communityId, healthRange, healthRangeError, wantsCommunity]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsCommunity) return;
    if (healthRangeError) {
      setPostsPerActiveItems([]);
      setPostsPerActiveError(healthRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(healthRange);
    setPostsPerActiveLoading(true);
    setPostsPerActiveError(null);
    fetchKpiCommunitiesPostsPerActiveDaily({ kind: postsPerActiveKind, from, to })
      .then((res) => {
        if (!active) return;
        setPostsPerActiveItems(res.items ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setPostsPerActiveError(
          error instanceof Error
            ? error.message
            : "Unable to load posts-per-active-community KPIs."
        );
        setPostsPerActiveItems([]);
      })
      .finally(() => {
        if (!active) return;
        setPostsPerActiveLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, healthRange, healthRangeError, postsPerActiveKind, wantsCommunity]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsCommunity) return;
    if (!communityId) return;
    if (healthRangeError) {
      setUniqueParticipants(null);
      setUniqueParticipantsError(healthRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(healthRange);
    setUniqueParticipantsLoading(true);
    setUniqueParticipantsError(null);
    fetchKpiPostsUniqueParticipants({ communityId, from, to })
      .then((res) => {
        if (!active) return;
        setUniqueParticipants(res);
      })
      .catch((error) => {
        if (!active) return;
        setUniqueParticipantsError(
          error instanceof Error ? error.message : "Unable to load unique participant KPIs."
        );
        setUniqueParticipants(null);
      })
      .finally(() => {
        if (!active) return;
        setUniqueParticipantsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, communityId, healthRange, healthRangeError, wantsCommunity]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsCommunity) return;
    if (!communityId) return;
    if (retentionRangeError) {
      setRetentionItems([]);
      setRetentionError(retentionRangeError);
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(retentionRange);
    setRetentionLoading(true);
    setRetentionError(null);
    fetchKpiCommunityRetention({ communityId, from, to })
      .then((res) => {
        if (!active) return;
        setRetentionItems(res.items ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setRetentionError(
          error instanceof Error ? error.message : "Unable to load community retention KPIs."
        );
        setRetentionItems([]);
      })
      .finally(() => {
        if (!active) return;
        setRetentionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, communityId, retentionRange, retentionRangeError, wantsCommunity]);

  useEffect(() => {
    if (!canView) return;
    if (!wantsRetentionByKind) return;
    if (retentionRangeError) {
      setRetentionByKindItems([]);
      setRetentionByKindError(retentionRangeError);
      return;
    }
    if (retentionKinds.length === 0) {
      setRetentionByKindItems([]);
      setRetentionByKindError("Select at least one kind.");
      return;
    }
    let active = true;
    const { from, to } = getRangeParamsInclusive(retentionRange);
    setRetentionByKindLoading(true);
    setRetentionByKindError(null);
    fetchKpiRetentionByKind({ kinds: retentionKinds, from, to })
      .then((res) => {
        if (!active) return;
        setRetentionByKindItems(res.items ?? []);
      })
      .catch((error) => {
        if (!active) return;
        setRetentionByKindError(
          error instanceof Error ? error.message : "Unable to load retention by kind KPIs."
        );
        setRetentionByKindItems([]);
      })
      .finally(() => {
        if (!active) return;
        setRetentionByKindLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, retentionKinds, retentionRange, retentionRangeError, wantsRetentionByKind]);

  const activeUsersLatest = activeUsersItems.length
    ? activeUsersItems[activeUsersItems.length - 1]
    : null;
  const activeUsersAvgRatio = useMemo(() => {
    const ratios = activeUsersItems
      .map((item) => item.dau_mau_ratio)
      .map((value) => normalizeRate(value))
      .filter((value): value is number => typeof value === "number");
    if (ratios.length === 0) return null;
    return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  }, [activeUsersItems]);

  const activeUsersRatioChartData = useMemo(
    () =>
      activeUsersItems.map((item) => ({
        ...item,
        dau_mau_ratio_rate: normalizeRate(item.dau_mau_ratio),
      })),
    [activeUsersItems]
  );

  const creatorRateChartData = useMemo(
    () =>
      contentCreationItems.map((item) => ({
        ...item,
        creator_rate_rate: normalizeRate(item.creator_rate),
      })),
    [contentCreationItems]
  );

  const growthDailyTotals = useMemo(() => {
    const sum = (key: keyof GrowthUsersDailyKpiItem) =>
      growthDailyItems.reduce((acc, item) => {
        const next = item[key];
        return acc + (typeof next === "number" ? next : 0);
      }, 0);
    return { newUsers: sum("new_users"), deletedUsers: sum("deleted_users") };
  }, [growthDailyItems]);

  const postsPerActiveAverages = useMemo(() => {
    const ratios = postsPerActiveItems
      .map((item) => item.posts_per_active_community)
      .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    if (ratios.length === 0) return null;
    return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  }, [postsPerActiveItems]);

  const healthTotals = useMemo(() => {
    const sum = (key: keyof CommunityHealthDailyKpiItem) =>
      healthItems.reduce((acc, item) => {
        const next = item[key];
        return acc + (typeof next === "number" ? next : 0);
      }, 0);
    const posts = sum("posts_count");
    const comments = sum("comments_count");
    const ratio = posts > 0 ? comments / posts : 0;
    return {
      posts,
      comments,
      likes: sum("post_likes_count"),
      shares: sum("post_shares_count"),
      ratio,
    };
  }, [healthItems]);

  const retentionAverages = useMemo(() => {
    const avg = (key: keyof CommunityRetentionKpiItem) => {
      const values = retentionItems
        .map((item) => item[key])
        .map((value) => normalizeRate(typeof value === "number" ? value : null))
        .filter((value): value is number => typeof value === "number");
      if (values.length === 0) return null;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };
    return {
      d1: avg("retention_d1"),
      d7: avg("retention_d7"),
      d30: avg("retention_d30"),
    };
  }, [retentionItems]);

  const healthChartConfig = useMemo(() => {
    if (healthSeriesKey === "posts") {
      return {
        title: "Posts & comments",
        lines: [
          { key: "posts_count", label: "Posts", color: "#ea404a" },
          { key: "comments_count", label: "Comments", color: "#0ea5e9" },
        ] as const,
        yFormatter: formatNumber,
      };
    }
    if (healthSeriesKey === "engagement") {
      return {
        title: "Likes & shares",
        lines: [
          { key: "post_likes_count", label: "Likes", color: "#ea404a" },
          { key: "post_shares_count", label: "Shares", color: "#22c55e" },
        ] as const,
        yFormatter: formatNumber,
      };
    }
    if (healthSeriesKey === "unique") {
      return {
        title: "Unique actors",
        lines: [
          { key: "unique_posters", label: "Posters", color: "#ea404a" },
          { key: "unique_commenters", label: "Commenters", color: "#0ea5e9" },
          { key: "unique_post_likers", label: "Likers", color: "#a855f7" },
          { key: "unique_post_sharers", label: "Sharers", color: "#22c55e" },
        ] as const,
        yFormatter: formatNumber,
      };
    }
    return {
      title: "Comment → post ratio",
      lines: [{ key: "comment_to_post_ratio", label: "Ratio", color: "#ea404a" }] as const,
      yFormatter: (value?: number | null) => {
        if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
        return value.toFixed(2);
      },
    };
  }, [healthSeriesKey]);

  const cohortsForTable = useMemo(() => {
    const items = [...retentionItems].sort((a, b) => a.cohort_day.localeCompare(b.cohort_day));
    if (showAllCohorts) return items;
    return items.slice(Math.max(0, items.length - 45));
  }, [retentionItems, showAllCohorts]);

  const retentionRateChartData = useMemo(
    () =>
      retentionItems.map((item) => ({
        ...item,
        retention_d1_rate: normalizeRate(item.retention_d1),
        retention_d7_rate: normalizeRate(item.retention_d7),
        retention_d30_rate: normalizeRate(item.retention_d30),
      })),
    [retentionItems]
  );

  const retentionByKindAverages = useMemo(() => {
    const grouped: Record<string, { d1: number[]; d7: number[]; d30: number[] }> = {};
    for (const item of retentionByKindItems) {
      const kind = item.kind ?? "unknown";
      if (!grouped[kind]) grouped[kind] = { d1: [], d7: [], d30: [] };
      const d1 = normalizeRate(item.retention_d1);
      const d7 = normalizeRate(item.retention_d7);
      const d30 = normalizeRate(item.retention_d30);
      if (typeof d1 === "number") grouped[kind].d1.push(d1);
      if (typeof d7 === "number") grouped[kind].d7.push(d7);
      if (typeof d30 === "number") grouped[kind].d30.push(d30);
    }
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return Object.entries(grouped)
      .map(([kind, values]) => ({ kind, avgD1: avg(values.d1), avgD7: avg(values.d7), avgD30: avg(values.d30) }))
      .sort((a, b) => a.kind.localeCompare(b.kind));
  }, [retentionByKindItems]);

  const retentionByKindChartData = useMemo(() => {
    return retentionByKindItems
      .filter((item) => item.kind === retentionByKindSelected)
      .map((item) => ({
        ...item,
        retention_d1_rate: normalizeRate(item.retention_d1),
        retention_d7_rate: normalizeRate(item.retention_d7),
        retention_d30_rate: normalizeRate(item.retention_d30),
      }))
      .sort((a, b) => a.cohort_day.localeCompare(b.cohort_day));
  }, [retentionByKindItems, retentionByKindSelected]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <AnalyticsSubnav active="kpis" />
        <section className="rounded-3xl border border-border bg-bg p-6">
          <p className="text-xs font-semibold uppercase text-text-light">KPIs</p>
          <h2 className="mt-2 text-2xl font-semibold text-strong">Access required</h2>
          <p className="mt-2 text-sm text-text-secondary">
            You need the <span className="font-semibold text-text-primary">view_reports</span>{" "}
            permission to view KPI dashboards.
          </p>
        </section>
      </div>
    );
  }

  const trustSafetyGroups = getTrustSafetyGroups(trustSafety);
  const viewTitle =
    view === "all"
      ? "KPI dashboards"
      : kpiViewOptions.find((option) => option.value === view)?.label ?? "KPI dashboards";
  const showGlobalRangeControl =
    view === "all" ||
    view === "active-users" ||
    view === "creation" ||
    view === "growth" ||
    view === "trust-safety" ||
    view === "moderation" ||
    view === "time-to" ||
    view === "north-star" ||
    view === "support";
  const showRetentionRangeControl = view === "retention-by-kind";

  return (
    <div className="space-y-6">
      <AnalyticsSubnav active="kpis" />

      <div className="rounded-2xl border border-border bg-bg px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">KPIs</p>
            <h1 className="mt-1 text-3xl font-semibold text-strong">{viewTitle}</h1>
            <p className="mt-1 text-sm text-text-secondary">
              UTC day boundaries. End date is inclusive.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold uppercase text-text-light">
              View
              <select
                value={view}
                onChange={(event) => setView(event.target.value as KpiView)}
                className="mt-1 h-9 min-w-[220px] rounded-lg border border-border bg-bg px-3 text-sm font-semibold text-text-primary"
              >
                {kpiViewOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {showGlobalRangeControl ? (
            <CompactRangeControl label="Global range" range={globalRange} setRange={setGlobalRange} />
          ) : null}
          {showRetentionRangeControl ? (
            <CompactRangeControl
              label="Retention cohort range"
              range={retentionRange}
              setRange={setRetentionRange}
            />
          ) : null}
          {view === "community" ? (
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-3 text-sm text-text-secondary">
              Community KPIs use the community-specific filters and ranges in the Community section.
            </div>
          ) : null}
        </div>
      </div>

      {wantsActiveUsers && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Active users</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Action-based DAU / MAU</h2>
            <p className="mt-1 text-sm text-text-secondary">
              A user is active on a day if they take any server-recorded action (post, comment,
              like, share, follow, join, or verify).
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(globalRange)}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {activeUsersError && (
              <ErrorCard
                title="Unable to load active users"
                message="Try adjusting the date range."
                details={activeUsersError}
              />
            )}
            {activeUsersLoading && activeUsersItems.length === 0 && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                Loading active user KPIs...
              </div>
            )}
            {!activeUsersLoading && activeUsersItems.length === 0 && !activeUsersError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                No DAU/MAU data for the selected range.
              </div>
            )}

            {activeUsersItems.length > 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">Latest DAU</p>
                    <p className="mt-3 text-2xl font-semibold text-strong">
                      {formatNumber(activeUsersLatest?.dau)}
                    </p>
                    <p className="mt-1 text-xs text-text-light">{activeUsersLatest?.day}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">
                      Latest MAU (30d)
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-strong">
                      {formatNumber(activeUsersLatest?.mau_30d)}
                    </p>
                    <p className="mt-1 text-xs text-text-light">{activeUsersLatest?.day}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">
                      Latest DAU/MAU
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-strong">
                      {formatPercent(activeUsersLatest?.dau_mau_ratio, 1)}
                    </p>
                    <p className="mt-1 text-xs text-text-light">{activeUsersLatest?.day}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">
                      Avg DAU/MAU
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-strong">
                      {formatPercent(activeUsersAvgRatio, 1)}
                    </p>
                    <p className="mt-1 text-xs text-text-light">Across range</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                  <p className="text-xs font-semibold uppercase text-text-light">Daily counts</p>
                  <div className="mt-3 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activeUsersItems} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                        <XAxis dataKey="day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                        <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value as number)} width={56} />
                        <Tooltip
                          formatter={(value: unknown, name: unknown) => {
                            const label = name === "dau" ? "DAU" : name === "mau_30d" ? "MAU (30d)" : String(name);
                            const numberValue = typeof value === "number" ? value : null;
                            return [formatNumber(numberValue), label];
                          }}
                          labelFormatter={(label) => `Day: ${label}`}
                          cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                        />
                        <Line type="monotone" dataKey="mau_30d" name="mau_30d" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="dau" name="dau" stroke="#ea404a" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                  <p className="text-xs font-semibold uppercase text-text-light">DAU / MAU ratio</p>
                  <div className="mt-3 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activeUsersRatioChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                        <XAxis dataKey="day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                        <YAxis tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(value) => formatPercent(Number(value), 0)} width={56} />
                        <Tooltip
                          formatter={(value: unknown) => {
                            const numberValue = typeof value === "number" ? value : null;
                            return [formatPercent(numberValue, 1), "DAU/MAU"];
                          }}
                          labelFormatter={(label) => `Day: ${label}`}
                          cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                        />
                        <Line type="monotone" dataKey="dau_mau_ratio_rate" name="dau_mau_ratio_rate" stroke="#ea404a" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-text-light">Notes</p>
              <ul className="mt-3 space-y-2 text-xs text-text-secondary">
                <li>MAU is a rolling 30-day window ending on each day (inclusive).</li>
                <li>Anonymous actions are excluded because they have no user id.</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
      )}

      {wantsCreation && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Creation</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Content creation (daily)</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Creator = authored a post or comment that day.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(globalRange)}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {contentCreationError && (
            <ErrorCard
              title="Unable to load creation KPIs"
              message="Try adjusting the date range."
              details={contentCreationError}
            />
          )}
          {contentCreationLoading && contentCreationItems.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Loading content creation KPIs...
            </div>
          )}
          {!contentCreationLoading && contentCreationItems.length === 0 && !contentCreationError && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No content creation data for the selected range.
            </div>
          )}

          {contentCreationItems.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                  <p className="text-xs font-semibold uppercase text-text-light">
                    Total active users
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-strong">
                    {formatNumber(
                      contentCreationItems.reduce(
                        (acc, item) =>
                          acc + (typeof item.active_users === "number" ? item.active_users : 0),
                        0
                      )
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                  <p className="text-xs font-semibold uppercase text-text-light">Total creators</p>
                  <p className="mt-3 text-2xl font-semibold text-strong">
                    {formatNumber(
                      contentCreationItems.reduce(
                        (acc, item) =>
                          acc + (typeof item.creators === "number" ? item.creators : 0),
                        0
                      )
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                  <p className="text-xs font-semibold uppercase text-text-light">Avg creator rate</p>
                  <p className="mt-3 text-2xl font-semibold text-strong">
                    {formatPercent(
                      (() => {
                        const values = creatorRateChartData
                          .map((item) => item.creator_rate_rate)
                          .filter((value): value is number => typeof value === "number");
                        if (!values.length) return null;
                        return values.reduce((sum, value) => sum + value, 0) / values.length;
                      })(),
                      1
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Creators vs active</p>
                <div className="mt-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={contentCreationItems} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                      <XAxis dataKey="day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value as number)} width={56} />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => {
                          const label =
                            name === "active_users"
                              ? "Active users"
                              : name === "creators"
                                ? "Creators"
                                : String(name);
                          const numberValue = typeof value === "number" ? value : null;
                          return [formatNumber(numberValue), label];
                        }}
                        labelFormatter={(label) => `Day: ${label}`}
                        cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                      />
                      <Line type="monotone" dataKey="active_users" name="active_users" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="creators" name="creators" stroke="#ea404a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Creator rate</p>
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={creatorRateChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                      <XAxis dataKey="day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(value) => formatPercent(Number(value), 0)} width={56} />
                      <Tooltip
                        formatter={(value: unknown) => {
                          const numberValue = typeof value === "number" ? value : null;
                          return [formatPercent(numberValue, 1), "Creator rate"];
                        }}
                        labelFormatter={(label) => `Day: ${label}`}
                        cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                      />
                      <Line type="monotone" dataKey="creator_rate_rate" name="creator_rate_rate" stroke="#ea404a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
      )}

      {wantsGrowth && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Growth</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">User growth and churn</h2>
            <p className="mt-1 text-sm text-text-secondary">
              New users and deleted users (daily + weekly).
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(globalRange)}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {growthDailyError && (
            <ErrorCard
              title="Unable to load daily growth KPIs"
              message="Try adjusting the date range."
              details={growthDailyError}
            />
          )}
          {growthWeeklyError && (
            <ErrorCard
              title="Unable to load weekly growth KPIs"
              message="Try adjusting the date range."
              details={growthWeeklyError}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-bg px-4 py-4">
              <p className="text-xs font-semibold uppercase text-text-light">New users (total)</p>
              <p className="mt-3 text-2xl font-semibold text-strong">
                {formatNumber(growthDailyTotals.newUsers)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-bg px-4 py-4">
              <p className="text-xs font-semibold uppercase text-text-light">
                Deleted users (total)
              </p>
              <p className="mt-3 text-2xl font-semibold text-strong">
                {formatNumber(growthDailyTotals.deletedUsers)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-bg px-4 py-4">
              <p className="text-xs font-semibold uppercase text-text-light">Daily</p>
              {growthDailyLoading && growthDailyItems.length === 0 ? (
                <div className="mt-3 rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                  Loading daily growth KPIs...
                </div>
              ) : growthDailyItems.length === 0 ? (
                <div className="mt-3 rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                  No daily growth data for the selected range.
                </div>
              ) : (
                <div className="mt-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthDailyItems} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                      <XAxis dataKey="day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value as number)} width={56} />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => {
                          const label =
                            name === "new_users"
                              ? "New users"
                              : name === "deleted_users"
                                ? "Deleted users"
                                : String(name);
                          const numberValue = typeof value === "number" ? value : null;
                          return [formatNumber(numberValue), label];
                        }}
                        labelFormatter={(label) => `Day: ${label}`}
                        cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                      />
                      <Line type="monotone" dataKey="new_users" name="new_users" stroke="#ea404a" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="deleted_users" name="deleted_users" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-bg px-4 py-4">
              <p className="text-xs font-semibold uppercase text-text-light">Weekly</p>
              {growthWeeklyLoading && growthWeeklyItems.length === 0 ? (
                <div className="mt-3 rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                  Loading weekly growth KPIs...
                </div>
              ) : growthWeeklyItems.length === 0 ? (
                <div className="mt-3 rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                  No weekly growth data for the selected range.
                </div>
              ) : (
                <div className="mt-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthWeeklyItems} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                      <XAxis dataKey="week_start" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value as number)} width={56} />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => {
                          const label =
                            name === "new_users"
                              ? "New users"
                              : name === "deleted_users"
                                ? "Deleted users"
                                : String(name);
                          const numberValue = typeof value === "number" ? value : null;
                          return [formatNumber(numberValue), label];
                        }}
                        labelFormatter={(label) => `Week of: ${label}`}
                        cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                      />
                      <Line type="monotone" dataKey="new_users" name="new_users" stroke="#ea404a" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="deleted_users" name="deleted_users" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {wantsRetentionByKind && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Retention</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Retention by community kind</h2>
            <p className="mt-1 text-sm text-text-secondary">
              D1/D7/D30 retention aggregated across communities of each kind (Jobs vs College cut).
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Cohorts: {rangeSummary(retentionRange)}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {retentionByKindError && (
              <ErrorCard
                title="Unable to load retention by kind"
                message="Try adjusting the cohort range or kinds."
                details={retentionByKindError}
              />
            )}
            {retentionByKindLoading && retentionByKindItems.length === 0 && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                Loading retention by kind KPIs...
              </div>
            )}
            {!retentionByKindLoading && retentionByKindItems.length === 0 && !retentionByKindError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                No retention-by-kind data for the selected cohort range.
              </div>
            )}

            {retentionByKindAverages.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-border bg-bg">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Averages</p>
                  <p className="text-xs text-text-light">Across selected cohort days.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-bg-muted/30 text-xs font-semibold uppercase text-text-light">
                      <tr>
                        <th className="px-4 py-3">Kind</th>
                        <th className="px-4 py-3">Avg D1</th>
                        <th className="px-4 py-3">Avg D7</th>
                        <th className="px-4 py-3">Avg D30</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {retentionByKindAverages.map((row) => (
                        <tr key={row.kind} className="text-text-secondary">
                          <td className="px-4 py-3 font-medium text-text-primary">{row.kind}</td>
                          <td className="px-4 py-3">{formatPercent(row.avgD1, 1)}</td>
                          <td className="px-4 py-3">{formatPercent(row.avgD7, 1)}</td>
                          <td className="px-4 py-3">{formatPercent(row.avgD30, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {retentionByKindChartData.length > 0 && (
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Retention rate by cohort day ({retentionByKindSelected})
                </p>
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={retentionByKindChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                      <XAxis dataKey="cohort_day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(value) => formatPercent(Number(value), 0)} width={56} />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => {
                          const numberValue = typeof value === "number" ? value : null;
                          const label =
                            name === "retention_d1_rate"
                              ? "D1"
                              : name === "retention_d7_rate"
                                ? "D7"
                                : name === "retention_d30_rate"
                                  ? "D30"
                                  : String(name);
                          return [formatPercent(numberValue, 1), label];
                        }}
                        labelFormatter={(label) => `Cohort: ${label}`}
                        cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                      />
                      <Line type="monotone" dataKey="retention_d30_rate" name="retention_d30_rate" stroke="#a855f7" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="retention_d7_rate" name="retention_d7_rate" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="retention_d1_rate" name="retention_d1_rate" stroke="#ea404a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <RangeFilter
              label="Retention cohorts range"
              range={retentionRange}
              setRange={setRetentionRange}
            />
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-text-light">Kinds</p>
              <p className="mt-2 text-xs text-text-light">Select one or more.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {retentionKindsOptions.map((kind) => {
                  const checked = retentionKinds.includes(kind);
                  return (
                    <label
                      key={kind}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        checked
                          ? "border-brand bg-brand text-white"
                          : "border-border bg-bg text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setRetentionKinds((prev) =>
                            prev.includes(kind) ? prev.filter((item) => item !== kind) : [...prev, kind]
                          )
                        }
                        className="hidden"
                      />
                      {kind}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-text-light">Chart</p>
              <label className="mt-3 block text-xs font-semibold uppercase text-text-light">
                Kind
                <select
                  value={retentionByKindSelected}
                  onChange={(event) => setRetentionByKindSelected(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary"
                >
                  {Array.from(new Set(retentionByKindItems.map((item) => item.kind ?? "unknown")))
                    .sort((a, b) => a.localeCompare(b))
                    .map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </aside>
        </div>
      </section>
      )}

      {wantsTrustSafety && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Trust & safety</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Verification and participation</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Summary across the selected range.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(globalRange)}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {trustSafetyError && (
            <ErrorCard
              title="Unable to load trust & safety KPIs"
              message="Try adjusting the date range."
              details={trustSafetyError}
            />
          )}
          {trustSafetyLoading && !trustSafety && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Loading trust & safety KPIs...
            </div>
          )}
          {!trustSafetyLoading && !trustSafety && !trustSafetyError && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No trust & safety data for the selected range.
            </div>
          )}

          {trustSafety && trustSafetyGroups && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Verified users</p>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-text-secondary">Total users</span>
                    <span className="text-lg font-semibold text-strong">
                      {formatNumber(trustSafetyGroups.verified.total_users as number | null)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-text-secondary">Verified (global)</span>
                    <span className="text-lg font-semibold text-strong">
                      {formatNumber(trustSafetyGroups.verified.verified_users_global as number | null)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-text-secondary">Verified (any community)</span>
                    <span className="text-lg font-semibold text-strong">
                      {formatNumber(
                        trustSafetyGroups.verified.verified_users_any_community as number | null
                      )}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 rounded-xl bg-bg-muted/30 p-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-text-secondary">Verified % (global)</span>
                      <span className="font-semibold text-strong">
                        {formatPercent(trustSafetyGroups.verified.verified_percent_global as number | null, 1)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-text-secondary">Verified % (any community)</span>
                      <span className="font-semibold text-strong">
                        {formatPercent(
                          trustSafetyGroups.verified.verified_percent_any_community as number | null,
                          1
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Anonymous participation</p>
                <div className="mt-4 grid gap-4">
                  <div className="rounded-xl bg-bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase text-text-light">Posts</p>
                    <p className="mt-2 text-lg font-semibold text-strong">
                      {formatPercent(
                        trustSafetyGroups.participation.posts_anon_rate as number | null,
                        1
                      )}
                      <span className="ml-2 text-xs font-medium text-text-light">
                        ({formatNumber(
                          trustSafetyGroups.participation.posts_anon as number | null
                        )}{" "}
                        /{" "}
                        {formatNumber(
                          trustSafetyGroups.participation.posts_total as number | null
                        )})
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase text-text-light">Comments</p>
                    <p className="mt-2 text-lg font-semibold text-strong">
                      {formatPercent(
                        trustSafetyGroups.participation.comments_anon_rate as number | null,
                        1
                      )}
                      <span className="ml-2 text-xs font-medium text-text-light">
                        ({formatNumber(
                          trustSafetyGroups.participation.comments_anon as number | null
                        )}{" "}
                        /{" "}
                        {formatNumber(
                          trustSafetyGroups.participation.comments_total as number | null
                        )})
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase text-text-light">Likes</p>
                    <p className="mt-2 text-lg font-semibold text-strong">
                      {formatPercent(
                        trustSafetyGroups.participation.likes_anon_rate as number | null,
                        1
                      )}
                      <span className="ml-2 text-xs font-medium text-text-light">
                        ({formatNumber(
                          trustSafetyGroups.participation.likes_anon as number | null
                        )}{" "}
                        /{" "}
                        {formatNumber(
                          trustSafetyGroups.participation.likes_total as number | null
                        )})
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Appeals</p>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-text-secondary">Reviewed</span>
                    <span className="text-lg font-semibold text-strong">
                      {formatNumber(trustSafetyGroups.appeals.appeals_reviewed as number | null)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-text-secondary">Approved</span>
                    <span className="text-lg font-semibold text-strong">
                      {formatNumber(trustSafetyGroups.appeals.appeals_approved as number | null)}
                    </span>
                  </div>
                  <div className="mt-2 rounded-xl bg-bg-muted/30 p-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-text-secondary">Success rate</span>
                      <span className="font-semibold text-strong">
                        {formatPercent(
                          trustSafetyGroups.appeals.appeal_success_rate as number | null,
                          1
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {wantsModeration && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Moderation</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Repeat offenders</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Repeat offender rate based on user bans + post removals in range.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(globalRange)}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {repeatOffendersError && (
            <ErrorCard
              title="Unable to load moderation KPIs"
              message="Try adjusting the date range."
              details={repeatOffendersError}
            />
          )}
          {repeatOffendersLoading && !repeatOffenders && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Loading moderation KPIs...
            </div>
          )}
          {!repeatOffendersLoading && !repeatOffenders && !repeatOffendersError && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No moderation data for the selected range.
            </div>
          )}

          {repeatOffenders && (
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Repeat offender rate</p>
                <p className="mt-3 text-2xl font-semibold text-strong">
                  {formatPercent(repeatOffenders.repeat_offender_rate, 1)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Repeat offenders</p>
                <p className="mt-3 text-2xl font-semibold text-strong">
                  {formatNumber(repeatOffenders.repeat_offenders)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Total offenders</p>
                <p className="mt-3 text-2xl font-semibold text-strong">
                  {formatNumber(repeatOffenders.total_offenders)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Signals</p>
                <p className="mt-3 text-sm font-semibold text-strong">
                  Bans: {formatNumber(repeatOffenders.bans_total)}
                </p>
                <p className="mt-1 text-sm font-semibold text-strong">
                  Post removals: {formatNumber(repeatOffenders.post_removals_total)}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {wantsTimeTo && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Time-to</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Activation speed</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Server-time based (not time on app).
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(globalRange)}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-border bg-bg px-4 py-4">
            <p className="text-xs font-semibold uppercase text-text-light">Users → first actions</p>
            {timeToFirstError && (
              <ErrorCard
                title="Unable to load time-to-first-action KPIs"
                message="Try adjusting the date range."
                details={timeToFirstError}
              />
            )}
            {timeToFirstLoading && !timeToFirst && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                Loading time-to-first-action KPIs...
              </div>
            )}
            {!timeToFirstLoading && !timeToFirst && !timeToFirstError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                No time-to-first-action data for the selected range.
              </div>
            )}
            {timeToFirst && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">P50 → first action</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatDurationSeconds(timeToFirst.p50_seconds_to_first_action)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">P90 → first action</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatDurationSeconds(timeToFirst.p90_seconds_to_first_action)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">P50 → verification</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatDurationSeconds(timeToFirst.p50_seconds_to_first_verification)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">P90 → verification</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatDurationSeconds(timeToFirst.p90_seconds_to_first_verification)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-bg px-4 py-4">
            <p className="text-xs font-semibold uppercase text-text-light">
              Verification → first actions
            </p>
            {verificationToFirstError && (
              <ErrorCard
                title="Unable to load verification-to-first-action KPIs"
                message="Try adjusting the date range."
                details={verificationToFirstError}
              />
            )}
            {verificationToFirstLoading && !verificationToFirst && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                Loading verification-to-first-action KPIs...
              </div>
            )}
            {!verificationToFirstLoading && !verificationToFirst && !verificationToFirstError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                No verification-to-first-action data for the selected range.
              </div>
            )}
            {verificationToFirst && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Like (P50 / P90)</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatDurationSeconds(verificationToFirst.p50_seconds_to_first_like)}
                  </p>
                  <p className="mt-1 text-xs text-text-light">
                    P90: {formatDurationSeconds(verificationToFirst.p90_seconds_to_first_like)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Comment (P50 / P90)</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatDurationSeconds(verificationToFirst.p50_seconds_to_first_comment)}
                  </p>
                  <p className="mt-1 text-xs text-text-light">
                    P90: {formatDurationSeconds(verificationToFirst.p90_seconds_to_first_comment)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Post (P50 / P90)</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatDurationSeconds(verificationToFirst.p50_seconds_to_first_post)}
                  </p>
                  <p className="mt-1 text-xs text-text-light">
                    P90: {formatDurationSeconds(verificationToFirst.p90_seconds_to_first_post)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {wantsNorthStar && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">North star</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Unique interactions</h2>
            <p className="mt-1 text-sm text-text-secondary">
              User↔user interaction edges (excludes anonymous principals): likes, comments, shares to another user’s post, plus follows.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(globalRange)}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {northStarError && (
              <ErrorCard
                title="Unable to load north star KPIs"
                message="Try adjusting the date range."
                details={northStarError}
              />
            )}
            {northStarLoading && !northStar && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                Loading north star KPIs...
              </div>
            )}
            {!northStarLoading && !northStar && !northStarError && (
              <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                No north star data for the selected range.
              </div>
            )}
            {northStar && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                  <p className="text-xs font-semibold uppercase text-text-light">Interactions</p>
                  <p className="mt-3 text-2xl font-semibold text-strong">
                    {formatNumber(northStar.unique_interactions ?? northStar.interaction_edges)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                  <p className="text-xs font-semibold uppercase text-text-light">Unique users</p>
                  <p className="mt-3 text-2xl font-semibold text-strong">
                    {formatNumber(northStar.unique_users)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                  <p className="text-xs font-semibold uppercase text-text-light">Edges</p>
                  <p className="mt-3 text-2xl font-semibold text-strong">
                    {formatNumber(northStar.interaction_edges ?? northStar.unique_interactions)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-text-light">Scope</p>
              <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={northStarUseCommunity}
                  onChange={(event) => setNorthStarUseCommunity(event.target.checked)}
                  disabled={!communityId}
                />
                Use selected community ID
              </label>
              <p className="mt-2 text-xs text-text-light">
                {communityId ? (
                  <>
                    Current community ID:{" "}
                    <span className="font-semibold text-text-primary">{communityId}</span>
                  </>
                ) : (
                  "Enter a community ID below to enable community scoping."
                )}
              </p>
            </div>
          </aside>
        </div>
      </section>
      )}

      {wantsSupport && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Support</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Tickets (proxy)</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Uses feedback rows as a proxy; displayed as per-1000-users rate.
            </p>
          </div>
          <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
            Range: {rangeSummary(globalRange)}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {supportTicketsError && (
            <ErrorCard
              title="Unable to load support ticket KPIs"
              message="Try adjusting the date range."
              details={supportTicketsError}
            />
          )}
          {supportTicketsLoading && !supportTickets && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Loading support ticket KPIs...
            </div>
          )}
          {!supportTicketsLoading && !supportTickets && !supportTicketsError && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No support ticket data for the selected range.
            </div>
          )}
          {supportTickets && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Tickets</p>
                <p className="mt-3 text-2xl font-semibold text-strong">
                  {formatNumber(supportTickets.tickets_total)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Per 1,000 users</p>
                <p className="mt-3 text-2xl font-semibold text-strong">
                  {formatDecimal(supportTickets.tickets_per_1000_users, 2)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase text-text-light">Users (denominator)</p>
                <p className="mt-3 text-2xl font-semibold text-strong">
                  {formatNumber(supportTickets.users_total)}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {wantsCommunity && (
      <section className="rounded-3xl border border-border bg-bg p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">Community KPIs</p>
            <h2 className="mt-2 text-2xl font-semibold text-strong">Health and retention</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Pick a community to see daily activity and strict day-based retention.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-text-light">Community</p>
              <label className="mt-3 block text-xs font-semibold uppercase text-text-light">
                Community ID
                <input
                  type="text"
                  value={communityIdInput}
                  onChange={(event) => setCommunityIdInput(event.target.value)}
                  placeholder="e.g. 123"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary"
                />
              </label>
              <div className="mt-2 text-xs text-text-light">
                {communityLookupLoading ? (
                  <span>Looking up community…</span>
                ) : communityLabel ? (
                  <span className="text-text-secondary">
                    Selected: <span className="font-semibold text-text-primary">{communityLabel}</span>
                  </span>
                ) : communityId ? (
                  <span>Community not found.</span>
                ) : (
                  <span>Enter a community ID to load charts.</span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-text-light">Kind KPIs</p>
              <label className="mt-3 block text-xs font-semibold uppercase text-text-light">
                Community kind
                <select
                  value={postsPerActiveKind}
                  onChange={(event) => setPostsPerActiveKind(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary"
                >
                  <option value="company">company</option>
                  <option value="school">school</option>
                  <option value="sector">sector</option>
                  <option value="specialization">specialization</option>
                </select>
              </label>
              <p className="mt-2 text-xs text-text-light">Used for posts-per-active-community.</p>
            </div>
            <RangeFilter label="Health range" range={healthRange} setRange={setHealthRange} />
            <RangeFilter
              label="Retention cohorts range"
              range={retentionRange}
              setRange={setRetentionRange}
            />
          </aside>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-bg px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-text-light">
                    Posts per active community (by kind)
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    “Active community” = community with ≥1 post on that day.
                  </p>
                </div>
                <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
                  Kind: {postsPerActiveKind}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Avg posts / active</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {postsPerActiveAverages === null ? "N/A" : postsPerActiveAverages.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Days</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatNumber(postsPerActiveItems.length)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Range</p>
                  <p className="mt-2 text-sm font-semibold text-strong">
                    {rangeSummary(healthRange)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {postsPerActiveError && (
                  <ErrorCard
                    title="Unable to load posts-per-active-community"
                    message="Check the kind and date range."
                    details={postsPerActiveError}
                  />
                )}
                {postsPerActiveLoading && postsPerActiveItems.length === 0 && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    Loading posts-per-active-community KPIs...
                  </div>
                )}
                {!postsPerActiveLoading && postsPerActiveItems.length === 0 && !postsPerActiveError && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    No posts-per-active-community data for the selected range.
                  </div>
                )}
                {postsPerActiveItems.length > 0 && (
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">Daily</p>
                    <div className="mt-3 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={postsPerActiveItems} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                          <XAxis dataKey="day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value as number)} width={56} />
                          <Tooltip
                            formatter={(value: unknown, name: unknown) => {
                              const label =
                                name === "posts_count"
                                  ? "Posts"
                                  : name === "active_communities"
                                    ? "Active communities"
                                    : name === "posts_per_active_community"
                                      ? "Posts / active"
                                      : String(name);
                              const numberValue = typeof value === "number" ? value : null;
                              const display =
                                name === "posts_per_active_community"
                                  ? formatDecimal(numberValue, 2)
                                  : formatNumber(numberValue);
                              return [display, label];
                            }}
                            labelFormatter={(label) => `Day: ${label}`}
                            cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                          />
                          <Line type="monotone" dataKey="posts_count" name="posts_count" stroke="#ea404a" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="active_communities" name="active_communities" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="posts_per_active_community" name="posts_per_active_community" stroke="#22c55e" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-bg px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-text-light">Community health</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Daily posts, comments, engagement, and unique actors.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "posts", label: "Posts/comments" },
                      { key: "engagement", label: "Likes/shares" },
                      { key: "unique", label: "Unique actors" },
                      { key: "ratio", label: "Ratio" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setHealthSeriesKey(option.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        healthSeriesKey === option.key
                          ? "border-brand bg-brand text-white"
                          : "border-border bg-bg text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-5">
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Posts</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatNumber(healthTotals.posts)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Comments</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatNumber(healthTotals.comments)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Likes</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatNumber(healthTotals.likes)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Shares</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatNumber(healthTotals.shares)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">C/P ratio</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {healthTotals.ratio.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {communityId === null && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    Enter a community ID to load health KPIs.
                  </div>
                )}
                {healthError && (
                  <ErrorCard
                    title="Unable to load community health"
                    message="Check the community ID and date range."
                    details={healthError}
                  />
                )}
                {healthLoading && healthItems.length === 0 && communityId !== null && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    Loading community health KPIs...
                  </div>
                )}
                {!healthLoading && healthItems.length === 0 && !healthError && communityId !== null && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    No community health data for the selected range.
                  </div>
                )}

                {healthItems.length > 0 && (
                  <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-text-light">
                      {healthChartConfig.title}
                    </p>
                    <div className="mt-3 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={healthItems} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                          <XAxis dataKey="day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) =>
                              healthChartConfig.yFormatter(typeof value === "number" ? value : null)
                            }
                            width={56}
                          />
                          <Tooltip
                            formatter={(value: unknown, name: unknown) => {
                              const numberValue = typeof value === "number" ? value : null;
                              const line = healthChartConfig.lines.find((line) => line.key === name);
                              const label = line?.label ?? String(name);
                              return [healthChartConfig.yFormatter(numberValue), label];
                            }}
                            labelFormatter={(label) => `Day: ${label}`}
                            cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                          />
                          {healthChartConfig.lines.map((line) => (
                            <Line
                              key={line.key}
                              type="monotone"
                              dataKey={line.key}
                              name={line.key}
                              stroke={line.color}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-bg px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-text-light">
                    Unique participants per post
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Participants = distinct principals among author/commenters/likers/sharers on each post.
                  </p>
                </div>
                <div className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">
                  Range: {rangeSummary(healthRange)}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {communityId === null && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    Enter a community ID to load this KPI.
                  </div>
                )}
                {uniqueParticipantsError && (
                  <ErrorCard
                    title="Unable to load unique participant KPIs"
                    message="Check the community ID and date range."
                    details={uniqueParticipantsError}
                  />
                )}
                {uniqueParticipantsLoading && communityId !== null && !uniqueParticipants && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    Loading unique participant KPIs...
                  </div>
                )}
                {!uniqueParticipantsLoading &&
                  communityId !== null &&
                  !uniqueParticipants &&
                  !uniqueParticipantsError && (
                    <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                      No unique participant data for the selected range.
                    </div>
                  )}

                {uniqueParticipants && (
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="rounded-xl bg-bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase text-text-light">Posts</p>
                      <p className="mt-2 text-lg font-semibold text-strong">
                        {formatNumber(uniqueParticipants.posts_count)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase text-text-light">Avg</p>
                      <p className="mt-2 text-lg font-semibold text-strong">
                        {formatDecimal(uniqueParticipants.avg_unique_participants_per_post, 2)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase text-text-light">P50</p>
                      <p className="mt-2 text-lg font-semibold text-strong">
                        {formatDecimal(uniqueParticipants.p50_unique_participants_per_post, 2)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase text-text-light">P90</p>
                      <p className="mt-2 text-lg font-semibold text-strong">
                        {formatDecimal(uniqueParticipants.p90_unique_participants_per_post, 2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-bg px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-text-light">Retention</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Strict day-based retention (D1 / D7 / D30) for cohorts in this community.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllCohorts((prev) => !prev)}
                  className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
                >
                  {showAllCohorts ? "Show last 45" : "Show all"}
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Avg D1</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatPercent(retentionAverages.d1, 1)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Avg D7</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatPercent(retentionAverages.d7, 1)}
                  </p>
                </div>
                <div className="rounded-xl bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Avg D30</p>
                  <p className="mt-2 text-lg font-semibold text-strong">
                    {formatPercent(retentionAverages.d30, 1)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {communityId === null && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    Enter a community ID to load retention KPIs.
                  </div>
                )}
                {retentionError && (
                  <ErrorCard
                    title="Unable to load retention"
                    message="Check the community ID and cohort range."
                    details={retentionError}
                  />
                )}
                {retentionLoading && retentionItems.length === 0 && communityId !== null && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    Loading retention KPIs...
                  </div>
                )}
                {!retentionLoading && retentionItems.length === 0 && !retentionError && communityId !== null && (
                  <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
                    No retention data for the selected cohort range.
                  </div>
                )}

                {retentionItems.length > 0 && (
                  <>
                    <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                      <p className="text-xs font-semibold uppercase text-text-light">
                        Retention rate by cohort day
                      </p>
                      <div className="mt-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={retentionRateChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
                            <XAxis dataKey="cohort_day" tickFormatter={formatDayTick} tickLine={false} axisLine={false} minTickGap={18} />
                            <YAxis tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(value) => formatPercent(Number(value), 0)} width={56} />
                            <Tooltip
                              formatter={(value: unknown, name: unknown) => {
                                const numberValue = typeof value === "number" ? value : null;
                                const label =
                                  name === "retention_d1_rate"
                                    ? "D1"
                                    : name === "retention_d7_rate"
                                      ? "D7"
                                      : name === "retention_d30_rate"
                                        ? "D30"
                                        : String(name);
                                return [formatPercent(numberValue, 1), label];
                              }}
                              labelFormatter={(label) => `Cohort: ${label}`}
                              cursor={{ stroke: "rgba(234,64,74,0.18)" }}
                            />
                            <Line type="monotone" dataKey="retention_d30_rate" name="retention_d30_rate" stroke="#a855f7" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="retention_d7_rate" name="retention_d7_rate" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="retention_d1_rate" name="retention_d1_rate" stroke="#ea404a" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border bg-bg">
                      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <p className="text-xs font-semibold uppercase text-text-light">
                          Cohorts ({cohortsForTable.length})
                        </p>
                        <p className="text-xs text-text-light">Showing {showAllCohorts ? "all" : "last 45"} cohorts.</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="bg-bg-muted/30 text-xs font-semibold uppercase text-text-light">
                            <tr>
                              <th className="px-4 py-3">Cohort day</th>
                              <th className="px-4 py-3">Size</th>
                              <th className="px-4 py-3">D1</th>
                              <th className="px-4 py-3">D7</th>
                              <th className="px-4 py-3">D30</th>
                              <th className="px-4 py-3">Retained D1</th>
                              <th className="px-4 py-3">Retained D7</th>
                              <th className="px-4 py-3">Retained D30</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {cohortsForTable.map((item) => (
                              <tr key={item.cohort_day} className="text-text-secondary">
                                <td className="px-4 py-3 font-medium text-text-primary">{item.cohort_day}</td>
                                <td className="px-4 py-3">{formatNumber(item.cohort_size)}</td>
                                <td className="px-4 py-3">{formatPercent(item.retention_d1, 1)}</td>
                                <td className="px-4 py-3">{formatPercent(item.retention_d7, 1)}</td>
                                <td className="px-4 py-3">{formatPercent(item.retention_d30, 1)}</td>
                                <td className="px-4 py-3">{formatNumber(item.retained_d1)}</td>
                                <td className="px-4 py-3">{formatNumber(item.retained_d7)}</td>
                                <td className="px-4 py-3">{formatNumber(item.retained_d30)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
