import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Logo, ThemeToggle } from '@looped/ui';

import { MenuDots, ProfileIcon } from '@/app/components/AppIcons/AppIcons';
import { ToastProvider, ToastViewport } from "@/app/components/AppToast/AppToast";

type NavItem = {
  id: string;
  label: string;
  href?: string;
  iconSrc: string;
  activeIconSrc?: string;
};

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/app',
    iconSrc: '/ios-icons/nav-home.svg',
    activeIconSrc: '/ios-icons/nav-home-active.svg',
  },
  {
    id: 'search',
    label: 'Search',
    href: '/app/search',
    iconSrc: '/ios-icons/nav-search.svg',
    activeIconSrc: '/ios-icons/nav-search-active.svg',
  },
  {
    id: 'messages',
    label: 'Messages',
    href: '/app/messages',
    iconSrc: '/ios-icons/nav-messages.svg',
    activeIconSrc: '/ios-icons/nav-messages-active.svg',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '/app/notifications',
    iconSrc: '/ios-icons/nav-notifications.svg',
    activeIconSrc: '/ios-icons/nav-notifications-active.svg',
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/app/profile',
    iconSrc: '/ios-icons/nav-profile.svg',
    activeIconSrc: '/ios-icons/nav-profile-active.svg',
  },
];

type AppLayoutProps = {
  activeNavId?: string;
  children: ReactNode;
  rightRail?: ReactNode;
};

function SearchRailIcon({ className }: { className?: string }) {
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

export function AppLayout({ activeNavId = 'home', children, rightRail }: AppLayoutProps) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-shell-bg">
        <div className="mx-auto w-full">
          <div className="grid w-full gap-x-6 lg:grid-cols-[minmax(220px,1fr)_560px_minmax(220px,1fr)] xl:grid-cols-[minmax(260px,1fr)_560px_minmax(320px,1fr)]">
            <aside className="hidden lg:block lg:w-[220px] lg:justify-self-end xl:w-[260px]">
              <div className="sticky top-3 py-3">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <Logo imageClassName="h-12 w-auto" to="/app" />
                    <ThemeToggle className="h-10 w-10 rounded-full border border-shell-border bg-bg text-shell-text-muted transition hover:text-shell-text" />
                  </div>

                  <Link
                    to="/app/search"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-bg-muted px-4 text-sm font-medium text-shell-text-muted transition hover:text-shell-text"
                  >
                    <SearchRailIcon className="h-4 w-4" />
                    <span>Search</span>
                  </Link>

                  <nav className="space-y-1.5">
                    {navItems.map((item) => {
                      const isActive = item.id === activeNavId;
                      const className = `flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-base font-semibold transition ${
                        isActive ? 'text-brand' : 'text-shell-text hover:text-shell-text'
                      }`;

                      const iconSrc = isActive ? (item.activeIconSrc ?? item.iconSrc) : item.iconSrc;
                      const icon = iconSrc ? (
                        <img src={iconSrc} alt="" className="h-6 w-6 shrink-0" aria-hidden="true" />
                      ) : (
                        <MenuDots className="h-6 w-6 shrink-0 text-shell-text-muted" />
                      );

                      if (item.href) {
                        return (
                          <Link
                            key={item.id}
                            to={item.href}
                            className={className}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            {icon}
                            <span>{item.label}</span>
                          </Link>
                        );
                      }

                      return (
                        <button key={item.id} type="button" className={className}>
                          {icon}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </aside>

            <main className="min-w-0 lg:col-start-2">
              <div className="w-full overflow-hidden bg-bg lg:min-h-screen lg:border-x lg:border-border/70">
                {children}
              </div>
            </main>

            {rightRail ? (
              <aside className="hidden xl:block xl:w-[320px] xl:justify-self-start">
                <div className="sticky top-3 py-3">{rightRail}</div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
      <ToastViewport />
    </ToastProvider>
  );
}

type AppMobileHeaderProps = {
  title?: string;
  actionHref?: string;
  showAction?: boolean;
};

export function AppMobileHeader({
  title = 'Looped',
  actionHref = '/app/profile',
  showAction = true,
}: AppMobileHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 bg-bg px-4 py-3 lg:hidden">
      {title === 'Looped' ? (
        <Logo imageClassName="h-7 w-auto" to="/app" />
      ) : (
        <span className="text-lg font-semibold">{title}</span>
      )}
      <div className="flex items-center gap-2">
        <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-text-secondary transition hover:text-strong" />
        {showAction ? (
          <Link
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white"
            to={actionHref}
            aria-label="Profile"
          >
            <ProfileIcon className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
