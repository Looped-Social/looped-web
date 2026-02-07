import { useMemo, useState } from "react";

export type FilterOption = {
  id: string;
  label: string;
};

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
  filters?: FilterOption[];
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
        active ? "bg-brand text-white" : "border border-border/70 bg-bg text-strong hover:bg-bg-muted"
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
  filters = defaultFilters,
}: AppSearchPanelProps) {
  const [uncontrolledQuery, setUncontrolledQuery] = useState(defaultQuery);
  const [uncontrolledActiveFilterId, setUncontrolledActiveFilterId] = useState(defaultActiveFilterId);

  const currentQuery = query ?? uncontrolledQuery;
  const currentActiveFilterId = activeFilterId ?? uncontrolledActiveFilterId;

  const handleQueryChange = (value: string) => {
    if (onQueryChange) {
      onQueryChange(value);
      return;
    }
    setUncontrolledQuery(value);
  };

  const handleFilterChange = (filterId: string) => {
    if (onActiveFilterIdChange) {
      onActiveFilterIdChange(filterId);
      return;
    }
    setUncontrolledActiveFilterId(filterId);
  };

  const visibleFilters = useMemo(() => {
    const trimmed = currentQuery.trim().toLowerCase();
    if (!trimmed) return filters;
    return filters.filter((filter) => filter.label.toLowerCase().includes(trimmed));
  }, [currentQuery, filters]);

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
        <span className="shrink-0 text-xs font-semibold text-white/90">Click to filter</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleFilters.map((filter) => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            active={filter.id === currentActiveFilterId}
            onClick={() => handleFilterChange(filter.id)}
          />
        ))}
      </div>
    </div>
  );
}
