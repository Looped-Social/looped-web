import { useMemo, useState } from "react";

export type FilterOption = {
  id: string;
  label: string;
  longLabel?: string;
  subtitle?: string;
  description?: string;
  membersLabel?: string;
  kind?: string;
  icon?: string;
  imageUrl?: string;
};

export type PanelSearchStatus = "idle" | "loading" | "ready" | "error";

const defaultFilters: FilterOption[] = [
  { id: 'all', label: 'All Loops' },
  { id: 'finance', label: 'Finance' },
  { id: 'jp-morgan', label: 'JP Morgan' },
  { id: 'ib', label: 'IB' },
  { id: 'unc', label: 'UNC' },
  { id: 'pe', label: 'PE' },
  { id: 'goldman', label: 'Goldman' },
  { id: 'vc', label: 'VC' },
  { id: 'ncsu', label: 'NCSU' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'wf', label: 'WF' },
  { id: 'banking', label: 'Banking' },
];

type AppSearchPanelProps = {
  defaultQuery?: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  defaultActiveFilterId?: string;
  activeFilterId?: string;
  onActiveFilterIdChange?: (filterId: string) => void;
  onFilterSelect?: (filter: FilterOption) => void;
  filters?: FilterOption[];
  searchStatus?: PanelSearchStatus;
  searchError?: string | null;
  searchResults?: FilterOption[];
  minSearchLength?: number;
};

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

function normalizedOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function capitalize(value: string): string {
  if (!value) return "";
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

type FilterChipProps = {
  active?: boolean;
  label: string;
  onClick: () => void;
};

function FilterChip({ active = false, label, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-brand text-white" : "bg-bg-muted text-text-secondary hover:text-strong"
      }`}
    >
      {label}
    </button>
  );
}

export function AppSearchPanel({
  defaultQuery = '',
  query,
  onQueryChange,
  defaultActiveFilterId = "finance",
  activeFilterId,
  onActiveFilterIdChange,
  onFilterSelect,
  filters = defaultFilters,
  searchStatus,
  searchError,
  searchResults,
  minSearchLength = 2,
}: AppSearchPanelProps) {
  const [uncontrolledQuery, setUncontrolledQuery] = useState(defaultQuery);
  const [uncontrolledActiveFilterId, setUncontrolledActiveFilterId] = useState(defaultActiveFilterId);

  const currentQuery = query ?? uncontrolledQuery;
  const currentActiveFilterId = activeFilterId ?? uncontrolledActiveFilterId;
  const trimmedQuery = currentQuery.trim();
  const hasRemoteSearch = searchResults !== undefined || searchStatus !== undefined;

  const handleQueryChange = (value: string) => {
    if (onQueryChange) {
      onQueryChange(value);
      return;
    }
    setUncontrolledQuery(value);
  };

  const handleFilterChange = (filter: FilterOption) => {
    onFilterSelect?.(filter);

    if (onActiveFilterIdChange) {
      onActiveFilterIdChange(filter.id);
      return;
    }
    setUncontrolledActiveFilterId(filter.id);
  };

  const visibleFilters = useMemo(() => {
    const lowered = trimmedQuery.toLowerCase();
    if (!lowered) return filters;

    if (hasRemoteSearch) {
      if (lowered.length < minSearchLength) return [];
      return searchResults ?? [];
    }

    return filters.filter((filter) => filter.label.toLowerCase().includes(lowered));
  }, [filters, hasRemoteSearch, minSearchLength, searchResults, trimmedQuery]);
  const showResultRows = hasRemoteSearch && trimmedQuery.length >= minSearchLength;
  const shouldShowSearchMeta = hasRemoteSearch && trimmedQuery.length > 0;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 rounded-full bg-brand px-4 py-3 text-white">
        <SearchIcon className="h-5 w-5 shrink-0 text-white" />
        <input
          type="text"
          value={currentQuery}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search"
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-white/75"
          aria-label="Search"
        />
        <span className="shrink-0 text-xs font-semibold text-white/90">Filter posts by community</span>
      </div>

      {!showResultRows ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {visibleFilters.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              active={filter.id === currentActiveFilterId}
              onClick={() => handleFilterChange(filter)}
            />
          ))}
        </div>
      ) : null}

      {showResultRows && searchStatus !== "loading" && visibleFilters.length > 0 ? (
        <div className="mt-4 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-bg">
          {visibleFilters.map((filter) => {
            const hasLongLabel =
              normalizedOptional(filter.longLabel) && filter.longLabel?.toLowerCase() !== filter.label.toLowerCase();
            const normalizedKind = normalizedOptional(filter.kind);
            const metaParts = [
              hasLongLabel ? filter.longLabel : undefined,
              normalizedOptional(filter.subtitle),
              normalizedKind ? capitalize(normalizedKind.replaceAll("_", " ")) : undefined,
              normalizedOptional(filter.membersLabel),
            ].filter((part): part is string => Boolean(part));

            const icon = normalizedOptional(filter.icon);
            const imageUrl = normalizedOptional(filter.imageUrl);
            const iconDisplay = icon ?? initialsFromName(filter.label).slice(0, 1);
            const isImageIcon = /^https?:\/\//i.test(iconDisplay);

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => handleFilterChange(filter)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                  filter.id === currentActiveFilterId ? "bg-bg-muted/55" : "hover:bg-bg-muted/35"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-bg-muted text-base">
                  {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                  {!imageUrl && isImageIcon ? (
                    <img src={iconDisplay} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                  {!imageUrl && !isImageIcon ? <span>{iconDisplay}</span> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-strong">{filter.label}</p>
                  {metaParts.length > 0 ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{metaParts.join(" · ")}</p>
                  ) : null}
                  {filter.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-text-light">{filter.description}</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {shouldShowSearchMeta ? (
        <div className="mt-2 px-0.5 text-xs text-text-secondary">
          {trimmedQuery.length < minSearchLength ? (
            <p>Type at least {minSearchLength} characters.</p>
          ) : searchStatus === "loading" ? (
            <p>Searching communities...</p>
          ) : searchStatus === "error" ? (
            <p>{searchError ?? "Unable to search communities."}</p>
          ) : searchStatus === "ready" && visibleFilters.length === 0 ? (
            <p>No matches found.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
