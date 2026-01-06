import type { ReactNode } from "react";
import { Link } from "react-router";

import { Logo } from "@looped/ui";

import { PlaceholderIcon, ProfileIcon } from "@/app/components/AppIcons/AppIcons";

type NavItem = {
  id: string;
  label: string;
  href?: string;
  icon?: "profile";
};

const navItems: NavItem[] = [
  { id: "home", label: "Home", href: "/app" },
  { id: "communities", label: "Communities" },
  { id: "explore", label: "Explore" },
  { id: "messages", label: "Messages" },
  { id: "notifications", label: "Notifications" },
  { id: "saved", label: "Saved" },
  { id: "profile", label: "Profile", href: "/app/profile", icon: "profile" },
];

type AppLayoutProps = {
  activeNavId?: string;
  children: ReactNode;
  rightRail?: ReactNode;
};

export function AppLayout({ activeNavId = "home", children, rightRail }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="w-full px-4 py-6 lg:pl-6 lg:pr-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="hidden lg:flex lg:flex-col">
            <div className="sticky top-6 space-y-6">
              <Logo imageClassName="h-9 w-auto" to="/app" />

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon === "profile" ? ProfileIcon : PlaceholderIcon;
                  const isActive = item.id === activeNavId;
                  const className = `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive ? "text-brand font-semibold" : "text-text-secondary hover:text-strong"
                  }`;

                  if (item.href) {
                    return (
                      <Link key={item.id} to={item.href} className={className} aria-current={isActive ? "page" : undefined}>
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  }

                  return (
                    <button key={item.id} type="button" className={className}>
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand/90"
              >
                Post
              </button>

              <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-bg text-text-secondary">
                    <ProfileIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-strong">William Mullen</p>
                    <p className="text-xs text-text-secondary">@willm</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-bg px-3 py-2 text-xs text-text-secondary">
                  UNC Chapel Hill - Computer Science
                </div>
              </div>
            </div>
          </aside>

          <main className="space-y-4 lg:justify-self-center lg:w-full lg:max-w-[680px]">{children}</main>

          {rightRail ? (
            <aside className="hidden xl:flex xl:flex-col">
              <div className="sticky top-6 space-y-4">{rightRail}</div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type AppMobileHeaderProps = {
  title?: string;
  actionHref?: string;
  showAction?: boolean;
};

export function AppMobileHeader({
  title = "Looped",
  actionHref = "/app/profile",
  showAction = true,
}: AppMobileHeaderProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-bg px-4 py-3 shadow-sm lg:hidden">
      {title === "Looped" ? (
        <Logo imageClassName="h-8 w-auto" to="/app" />
      ) : (
        <span className="text-lg font-semibold text-strong">{title}</span>
      )}
      {showAction ? (
        <Link
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow-sm"
          to={actionHref}
          aria-label="Profile"
        >
          <ProfileIcon className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
