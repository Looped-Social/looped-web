import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { PlaceholderIcon, ProfileIcon } from "@/app/components/AppIcons/AppIcons";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";

const profileTabs = [
  { id: "posts", label: "Posts", active: true },
  { id: "replies", label: "Replies", active: false },
  { id: "saved", label: "Saved", active: false },
];

const profileDetails = [
  { id: "tenure", label: "1 year in the Loop" },
  { id: "member", label: "Member at University of North Carolina at Chapel Hill" },
];

const profileStats = [
  { id: "following", label: "Following", value: "0" },
  { id: "followers", label: "Followers", value: "0" },
];

const profilePosts: PostData[] = [
  {
    id: "profile-post-1",
    author: "William Mullen",
    subtitle: "Member at University of North Carolina",
    context: "in University of North Carolina at Chapel Hill",
    content: "This is media upload",
    time: "1 day ago",
    stats: { likes: 0, comments: 0, shares: 0 },
    isAnonymous: false,
  },
  {
    id: "profile-post-2",
    author: "William Mullen",
    subtitle: "Member at University of North Carolina",
    context: "in University of North Carolina at Chapel Hill",
    content: "Debug modal",
    time: "3 days ago",
    stats: { likes: 0, comments: 0, shares: 0 },
    isAnonymous: false,
  },
];

const profileHighlights = [
  { id: "highlight-1", label: "Top communities", value: "UNC Chapel Hill, Early Career" },
  { id: "highlight-2", label: "Visibility", value: "Anonymous by default" },
  { id: "highlight-3", label: "Member since", value: "2024" },
];

export function AppProfilePage() {
  const rightRail = (
    <>
      <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-strong">Profile snapshot</h3>
        <div className="mt-4 space-y-3">
          {profileHighlights.map((highlight) => (
            <div key={highlight.id} className="rounded-xl border border-border/60 bg-bg px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-light">{highlight.label}</p>
              <p className="mt-1 text-sm font-semibold text-strong">{highlight.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-strong">Quick actions</h3>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            className="w-full rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
          >
            Share profile
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
          >
            Edit profile
          </button>
        </div>
      </div>
    </>
  );

  return (
    <AppLayout activeNavId="profile" rightRail={rightRail}>
      <AppMobileHeader title="Profile" showAction={false} />

      <section className="rounded-2xl border border-border/70 bg-bg shadow-sm">
        <div className="border-b border-border/70 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white">
                <ProfileIcon className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xl font-semibold text-strong">William Mullen</p>
                <p className="text-sm text-text-secondary">@willymilly</p>
              </div>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-bg text-text-secondary transition hover:text-strong"
              aria-label="Settings"
            >
              <PlaceholderIcon className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-sm text-text-secondary">No bio yet</p>

          <div className="mt-4 space-y-2 text-sm text-text-secondary">
            {profileDetails.map((detail) => (
              <div key={detail.id} className="flex items-center gap-2">
                <PlaceholderIcon className="h-4 w-4" />
                <span>{detail.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-text-secondary">
            {profileStats.map((stat) => (
              <div key={stat.id} className="flex items-center gap-2">
                <span className="text-sm font-semibold text-strong">{stat.value}</span>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
            >
              Edit profile
            </button>
            <button
              type="button"
              className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
            >
              Anonymous
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 px-4 py-3 text-sm font-semibold text-text-secondary">
          {profileTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`relative pb-1 transition ${tab.active ? "text-brand" : "hover:text-strong"}`}
            >
              {tab.label}
              {tab.active ? <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-brand" /> : null}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        {profilePosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </AppLayout>
  );
}
