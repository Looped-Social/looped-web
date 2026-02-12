import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { Logo } from '@looped/ui';

import { MenuDots, ProfileIcon } from '@/app/components/AppIcons/AppIcons';
import { useCurrentUserStore } from '@/stores/currentUserStore';

const DEFAULT_PROFILE_IMAGE_SRC = '/ios-icons/pfp2.svg';

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
    id: 'create',
    label: 'Create',
    href: '/app/create',
    iconSrc: '/ios-icons/create-action.svg',
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/app/profile',
    iconSrc: '/ios-icons/nav-profile.svg',
    activeIconSrc: '/ios-icons/nav-profile-active.svg',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/app/settings',
    iconSrc: '/ios-icons/nav-settings.svg',
    activeIconSrc: '/ios-icons/nav-settings-active.svg',
  },
];

type AppLayoutProps = {
  activeNavId?: string;
  children: ReactNode;
  rightRail?: ReactNode;
};

type RailFooterSection = {
  id: string;
  label: string;
  links: Array<{ label: string; to: string }>;
};

const railFooterSections: RailFooterSection[] = [
  {
    id: 'company',
    label: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    id: 'program',
    label: 'Program',
    links: [
      { label: 'FAQ', to: '/faq' },
      { label: 'Community Request', to: '/community-request' },
    ],
  },
  {
    id: 'terms',
    label: 'Terms & Policies',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Cookie Policy', to: '/cookies' },
      { label: 'User Agreement', to: '/terms' },
      { label: 'Content Policy', to: '/community-rules' },
      { label: 'Attributions', to: '/attributions' },
    ],
  },
];

function BackIcon({ className }: { className?: string }) {
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
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ProfileNavAvatar({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [fallback, setFallback] = useState(false);

  return (
    <img
      src={fallback ? DEFAULT_PROFILE_IMAGE_SRC : src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => setFallback(true)}
    />
  );
}

export function AppLayout({ activeNavId = 'home', children, rightRail }: AppLayoutProps) {
  const location = useLocation();
  const { user } = useCurrentUserStore({ autoLoad: true });
  const profileImageUrl = user?.profileImageUrl;
  const [expandedRailSectionId, setExpandedRailSectionId] = useState<string | null>(null);
  const pathname = location.pathname;

  const hideMobileBottomNav =
    /^\/app\/post\/[^/]+\/comments$/.test(pathname) ||
    /^\/app\/messages\/(conversation|channel)\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-screen bg-shell-bg">
      <div className="mx-auto w-full">
        <div className="grid w-full gap-x-6 lg:grid-cols-[minmax(220px,1fr)_560px_minmax(220px,1fr)] xl:grid-cols-[minmax(260px,1fr)_560px_minmax(320px,1fr)]">
          <aside className="hidden lg:block lg:w-[240px] lg:justify-self-start lg:pl-3 xl:w-[280px]">
            <div className="sticky top-3 py-3">
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2">
                  <Logo imageClassName="h-16 w-auto" to="/app" />
                </div>

                <nav className="space-y-1.5">
                  {navItems.map((item) => {
                    const isActive = item.id === activeNavId;
                    const className = `flex w-full items-center gap-4 rounded-xl px-3 py-3 text-[1.13rem] transition ${
                      isActive ? 'font-semibold text-brand' : 'font-medium text-shell-text hover:text-shell-text'
                    }`;

                    const iconSrc = isActive ? (item.activeIconSrc ?? item.iconSrc) : item.iconSrc;
                    const icon =
                      item.id === 'profile' && profileImageUrl ? (
                        <ProfileNavAvatar
                          src={profileImageUrl}
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                        />
                      ) : item.id === 'create' ? (
                        <span
                          className="h-7 w-7 shrink-0 bg-current [mask-image:url('/ios-icons/create-action.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/ios-icons/create-action.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
                          aria-hidden="true"
                        />
                      ) : iconSrc ? (
                        <img src={iconSrc} alt="" className="h-7 w-7 shrink-0" aria-hidden="true" />
                      ) : (
                        <MenuDots className="h-7 w-7 shrink-0 text-shell-text-muted" />
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

                <div className="mt-2 border-t border-border/70 pt-4">
                  <div className="space-y-2.5">
                    {railFooterSections.map((section) => {
                      const expanded = expandedRailSectionId === section.id;
                      return (
                        <div key={section.id}>
                          <button
                            type="button"
                            className={`w-full text-left text-[0.95rem] font-semibold transition ${
                              expanded ? 'text-strong' : 'text-text-light hover:text-text-secondary'
                            }`}
                            aria-expanded={expanded}
                            aria-controls={`rail-footer-${section.id}`}
                            onClick={() =>
                              setExpandedRailSectionId((previous) => (previous === section.id ? null : section.id))
                            }
                          >
                            {section.label}
                          </button>

                          {expanded ? (
                            <div
                              id={`rail-footer-${section.id}`}
                              className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[0.88rem] text-text-light"
                            >
                              {section.links.map((link) => (
                                <Link
                                  key={`${section.id}-${link.to}`}
                                  to={link.to}
                                  className="transition hover:text-text-secondary"
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[0.82rem] text-text-light">© 2026 Looped Social</p>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 lg:col-start-2">
            <div
              className={`w-full bg-bg lg:min-h-screen lg:border-x lg:border-border/70 ${
                hideMobileBottomNav ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0'
              }`}
            >
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
      {!hideMobileBottomNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-bg/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-1 px-2">
            {navItems.map((item) => {
              const isActive = item.id === activeNavId;
              const iconSrc = isActive ? (item.activeIconSrc ?? item.iconSrc) : item.iconSrc;
              const baseClass = `inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
                isActive ? 'text-brand' : 'text-shell-text-muted'
              }`;
              const icon =
                item.id === 'profile' && profileImageUrl ? (
                  <ProfileNavAvatar
                    src={profileImageUrl}
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : item.id === 'create' ? (
                  <span
                    className="h-7 w-7 shrink-0 bg-current [mask-image:url('/ios-icons/create-action.svg')] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] [-webkit-mask-image:url('/ios-icons/create-action.svg')] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain]"
                    aria-hidden="true"
                  />
                ) : iconSrc ? (
                  <img src={iconSrc} alt="" className="h-7 w-7 shrink-0" aria-hidden="true" />
                ) : (
                  <MenuDots className="h-7 w-7 shrink-0 text-shell-text-muted" />
                );

              if (!item.href) return null;

              return (
                <Link
                  key={`mobile-${item.id}`}
                  to={item.href}
                  className={baseClass}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {icon}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

type AppMobileHeaderProps = {
  title?: string;
  actionHref?: string;
  showAction?: boolean;
  showBack?: boolean;
  backHref?: string;
  showBorder?: boolean;
};

export function AppMobileHeader({
  title = 'Looped',
  actionHref = '/app/profile',
  showAction = true,
  showBack = false,
  backHref = '/app',
  showBorder = true,
}: AppMobileHeaderProps) {
  const navigate = useNavigate();
  const { user } = useCurrentUserStore({ autoLoad: true });
  const profileImageUrl = user?.profileImageUrl;

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(backHref, { replace: true });
  };

  return (
    <div
      className={`flex items-center justify-between bg-bg px-4 py-3 lg:hidden ${
        showBorder ? 'border-b border-border/70' : ''
      }`}
    >
      {showBack ? (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-strong"
          aria-label="Go back"
        >
          <BackIcon className="h-5 w-5" />
          <span>{title}</span>
        </button>
      ) : title === 'Looped' ? (
        <Logo imageClassName="h-8 w-auto" to="/app" />
      ) : (
        <span className="text-lg font-semibold">{title}</span>
      )}
      <div className="flex items-center gap-2">
        {showAction ? (
          <Link
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand text-white"
            to={actionHref}
            aria-label="Profile"
          >
            {profileImageUrl ? (
              <ProfileNavAvatar src={profileImageUrl} className="h-full w-full object-cover" />
            ) : (
              <ProfileIcon className="h-4 w-4" />
            )}
          </Link>
        ) : (
          <div className="h-9 w-9" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
