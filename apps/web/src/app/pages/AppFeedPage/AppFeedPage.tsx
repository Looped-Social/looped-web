import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { MenuDots, PlaceholderIcon, ProfileIcon } from "@/app/components/AppIcons/AppIcons";
import { PostCard, type PostData } from "@/app/components/PostCard/PostCard";

const feedTabs = [
  { id: "for-you", label: "For You", active: true },
  { id: "latest", label: "Latest", active: false },
];

const filters = [
  { id: "all", label: "All Loops", active: true },
  { id: "unc", label: "University of North Carolina at Chapel Hill", active: false },
  { id: "tech", label: "Tech", active: false },
  { id: "new", label: "New Posts", active: false },
];

const composerActions = [
  { id: "photo", label: "Photo" },
  { id: "poll", label: "Poll" },
  { id: "event", label: "Event" },
  { id: "gif", label: "GIF" },
];

const posts: PostData[] = [
  {
    id: "post-1",
    author: "William Mullen",
    subtitle: "University of North Carolina at Chapel Hill",
    context: "in University of North Carolina at Chapel Hill",
    content: "This is a new post that was endured",
    time: "4 days ago",
    stats: { likes: 1, comments: 3, shares: 0 },
    isAnonymous: false,
  },
  {
    id: "post-2",
    author: "Anonymous",
    subtitle: "University of North Carolina at Chapel Hill",
    context: "in University of North Carolina at Chapel Hill",
    content: "Hello this is anonymous",
    time: "3 days ago",
    stats: { likes: 1, comments: 0, shares: 0 },
    isAnonymous: true,
  },
  {
    id: "post-3",
    author: "William Mullen",
    subtitle: "University of North Carolina at Chapel Hill",
    context: "in University of North Carolina at Chapel Hill",
    content: "This is media upload",
    time: "1 day ago",
    stats: { likes: 0, comments: 0, shares: 0 },
    isAnonymous: false,
  },
];

const trendingTopics = [
  { id: "trend-1", label: "UNC Chapel Hill", meta: "2,431 posts" },
  { id: "trend-2", label: "Hiring freezes", meta: "1,034 posts" },
  { id: "trend-3", label: "Intern season", meta: "842 posts" },
];

const suggestedCommunities = [
  { id: "community-1", label: "Carolina Alumni", meta: "12.4k members" },
  { id: "community-2", label: "Product Designers", meta: "8.2k members" },
  { id: "community-3", label: "Early Career", meta: "6.1k members" },
];

export function AppFeedPage() {
  const rightRail = (
    <>
      <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Search</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-bg px-3 py-2 text-text-secondary">
          <PlaceholderIcon className="h-4 w-4" />
          <input
            type="text"
            placeholder="Search Looped"
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-light"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-strong">Trending</h3>
          <button className="text-xs font-semibold text-brand" type="button">
            See all
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {trendingTopics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className="flex w-full items-start justify-between rounded-xl border border-border/60 bg-bg px-3 py-2 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-strong">{topic.label}</p>
                <p className="text-xs text-text-secondary">{topic.meta}</p>
              </div>
              <MenuDots className="h-4 w-4 text-text-light" />
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-strong">Suggested communities</h3>
          <button className="text-xs font-semibold text-brand" type="button">
            Browse
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {suggestedCommunities.map((community) => (
            <div key={community.id} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-strong">{community.label}</p>
                <p className="text-xs text-text-secondary">{community.meta}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border/70 bg-bg px-3 py-1 text-xs font-semibold text-text-secondary transition hover:text-strong"
              >
                Join
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <AppLayout activeNavId="home" rightRail={rightRail}>
      <AppMobileHeader />

      <section className="rounded-2xl border border-border/70 bg-bg shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <h1 className="text-lg font-semibold text-strong">Home</h1>
          <div className="flex items-center gap-6 text-sm font-semibold text-text-secondary">
            {feedTabs.map((tab) => (
              <button
                key={tab.id}
                className={`relative pb-1 transition ${
                  tab.active ? "text-brand" : "text-text-secondary hover:text-strong"
                }`}
                type="button"
              >
                {tab.label}
                {tab.active ? <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-brand" /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-bg text-text-secondary">
              <ProfileIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm text-text-light">
                What's happening in your community?
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-text-secondary">
                  {composerActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-bg px-3 py-1.5 transition hover:text-strong"
                    >
                      <PlaceholderIcon className="h-4 w-4" />
                      {action.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-brand/90"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {filters.map((filter) => (
              <button
                key={filter.id}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter.active
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-bg text-text-secondary hover:text-strong"
                }`}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <button
        className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-[0_12px_24px_rgba(234,64,74,0.3)] transition hover:scale-105 lg:hidden"
        type="button"
        aria-label="Create post"
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    </AppLayout>
  );
}
