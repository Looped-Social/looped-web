export type PostPollOption = {
  id: string;
  text: string;
  voteCount: number;
  votePercent: number;
};

export type PostPollViewer = {
  hasVoted: boolean;
  selectedOptionIds: string[];
  canChangeVote: boolean;
};

export type PostPoll = {
  id: string;
  postId?: string;
  question: string;
  maxSelections: number;
  closesAt?: string;
  status: string;
  options: PostPollOption[];
  totalVotes: number;
  viewer: PostPollViewer;
  updatedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
}

function normalizeOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asId(value: unknown): string | undefined {
  return normalizeOptional(value);
}

function asOption(value: unknown): PostPollOption | null {
  if (!isRecord(value)) return null;
  const id = asId(value.id ?? value.option_id ?? value.optionId);
  const text = normalizeOptional(value.text ?? value.label ?? value.option_text ?? value.optionText);
  if (!id || !text) return null;
  return {
    id,
    text,
    voteCount: getNumber(value.vote_count ?? value.voteCount ?? value.votes) ?? 0,
    votePercent: getNumber(value.vote_percent ?? value.votePercent ?? value.percent) ?? 0,
  };
}

export function normalizePoll(value: unknown): PostPoll | undefined {
  if (!isRecord(value)) return undefined;

  const id = asId(value.id ?? value.poll_id ?? value.pollId);
  const question = normalizeOptional(value.question);
  if (!id || !question) return undefined;

  const optionsRaw = Array.isArray(value.options) ? value.options : [];
  const options = optionsRaw.map(asOption).filter((option): option is PostPollOption => Boolean(option));
  if (options.length === 0) return undefined;

  const viewerNode = isRecord(value.viewer) ? value.viewer : {};
  const selectedRaw = viewerNode.selectedOptionIds ?? viewerNode.selected_option_ids;
  const selectedOptionIds = Array.isArray(selectedRaw)
    ? selectedRaw
        .map((entry: unknown) => asId(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  const totalVotesFallback = options.reduce((sum, option) => sum + option.voteCount, 0);

  return {
    id,
    postId: asId(value.postId ?? value.post_id),
    question,
    maxSelections: Math.max(1, getNumber(value.maxSelections ?? value.max_selections) ?? 1),
    closesAt: normalizeOptional(value.closesAt ?? value.closes_at),
    status: normalizeOptional(value.status)?.toUpperCase() ?? "OPEN",
    options,
    totalVotes: getNumber(value.totalVotes ?? value.total_votes) ?? totalVotesFallback,
    viewer: {
      hasVoted: getBoolean(viewerNode.hasVoted ?? viewerNode.has_voted) ?? selectedOptionIds.length > 0,
      selectedOptionIds,
      canChangeVote: getBoolean(viewerNode.canChangeVote ?? viewerNode.can_change_vote) ?? false,
    },
    updatedAt: normalizeOptional(value.updatedAt ?? value.updated_at),
  };
}

export function normalizePostPoll(source: Record<string, unknown>): PostPoll | undefined {
  return normalizePoll(source.poll);
}
