import { MenuDots, PlaceholderIcon, ProfileIcon } from "@/app/components/AppIcons/AppIcons";

export type PostData = {
  id: string;
  author: string;
  subtitle: string;
  context: string;
  content: string;
  time: string;
  stats: {
    likes: number;
    comments: number;
    shares: number;
  };
  isAnonymous: boolean;
};

type PostCardProps = {
  post: PostData;
};

type ActionButtonProps = {
  count: number;
  label: string;
};

function ActionButton({ count, label }: ActionButtonProps) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-bg hover:text-strong"
      aria-label={label}
      type="button"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-bg">
        <PlaceholderIcon className="h-4 w-4" />
      </span>
      <span className="text-xs font-medium">{count}</span>
    </button>
  );
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="rounded-2xl border border-border/70 bg-bg p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-bg text-text-secondary">
          <ProfileIcon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-sm font-semibold ${post.isAnonymous ? "text-secondary" : "text-strong"}`}>
                  {post.author}
                </p>
                <span className="text-xs text-text-light">-</span>
                <p className="text-xs text-text-secondary">{post.subtitle}</p>
              </div>
              <p className="text-xs text-text-light">{post.context}</p>
            </div>
            <button className="text-text-light transition hover:text-strong" type="button" aria-label="Post options">
              <MenuDots className="h-5 w-5" />
            </button>
          </div>

          <p className="mt-3 text-sm text-text-primary">{post.content}</p>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ActionButton count={post.stats.likes} label="Like" />
              <ActionButton count={post.stats.comments} label="Comment" />
              <ActionButton count={post.stats.shares} label="Share" />
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-bg text-text-secondary transition hover:text-strong"
              type="button"
              aria-label="Save"
            >
              <PlaceholderIcon className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 text-xs text-text-light">{post.time}</p>
        </div>
      </div>
    </article>
  );
}
