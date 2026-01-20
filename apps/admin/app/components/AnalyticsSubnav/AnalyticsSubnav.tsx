import { NavLink } from "react-router";

type AnalyticsSubnavProps = {
  active?: "leaderboards" | "kpis";
};

export function AnalyticsSubnav({ active }: AnalyticsSubnavProps) {
  const items = [
    { label: "Leaderboards", to: "/analytics", key: "leaderboards" as const },
    { label: "KPIs", to: "/analytics/kpis", key: "kpis" as const },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-bg p-2">
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.to === "/analytics"}
          className={() =>
            `rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active === item.key
                ? "bg-brand text-white"
                : "text-text-secondary hover:bg-bg-muted/70 hover:text-text-primary"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

