import { useState } from "react";
import { useOutletContext } from "react-router";

import { fetchAdminPost, removeAdminPost, restoreAdminPost } from "../lib/adminApi";
import type { PostDetail } from "../types/admin";
import type { AdminRouteContext } from "./admin";

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function PostsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canRemove = admin.permissions.includes("remove_post");

  const [postId, setPostId] = useState("");
  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [removeReason, setRemoveReason] = useState("");

  const lookup = async () => {
    if (!postId.trim()) {
      setPost(null);
      return;
    }
    const id = Number(postId.trim());
    if (!Number.isFinite(id)) {
      setError("Enter a numeric post id.");
      setPost(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setPost(null);
    try {
      const result = await fetchAdminPost(id);
      setPost(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load post.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!post || !removeReason.trim()) {
      setActionError("Please add a removal reason.");
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await removeAdminPost(post.id, removeReason.trim());
      setPost({ ...post, removed_at: new Date().toISOString(), removed_reason: removeReason });
      setRemoveReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to remove post.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!post) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await restoreAdminPost(post.id);
      setPost({ ...post, removed_at: null, removed_reason: null });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to restore post.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canRemove) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Posts</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to remove posts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-text-light">Posts</p>
        <h1 className="mt-2 text-2xl font-semibold text-strong">Find and moderate posts</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Look up a post by id to review its content and remove or restore it.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg p-4 ">
        <input
          value={postId}
          onChange={(event) => setPostId(event.target.value)}
          placeholder="Enter post id"
          className="min-w-[200px] flex-1 rounded-full border border-border bg-bg px-4 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={isLoading}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white  transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Loading..." : "Lookup"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-brand">
          {error}
        </div>
      )}

      {!isLoading && !post && !error && (
        <div className="rounded-2xl border border-border bg-bg p-6 text-sm text-text-secondary">
          Enter a post id to review the post details.
        </div>
      )}

      {post && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-border bg-bg p-6 ">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-text-light">
                Post #{post.id}
              </p>
              <span className="rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-text-primary">
                {post.removed_at ? "removed" : "active"}
              </span>
            </div>
            <p className="mt-4 text-base text-text-primary">
              {post.content ?? "No content returned from API."}
            </p>
            <div className="mt-4 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
              <div>Author ID: {post.author_id ?? "N/A"}</div>
              <div>Company ID: {post.company_id ?? "N/A"}</div>
              <div>Created: {formatDate(post.created_at)}</div>
              <div>Removed: {formatDate(post.removed_at)}</div>
            </div>
            {post.removed_reason && (
              <div className="mt-4 rounded-xl border border-border bg-bg-muted/40 px-3 py-2 text-xs text-text-secondary">
                Removal reason: {post.removed_reason}
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-border bg-bg p-5 ">
            <h2 className="text-lg font-semibold text-strong">Moderation</h2>
            <div className="mt-4 space-y-3 text-sm text-text-secondary">
              <label className="text-xs font-semibold uppercase text-text-light">
                Removal reason
              </label>
              <textarea
                value={removeReason}
                onChange={(event) => setRemoveReason(event.target.value)}
                rows={3}
                placeholder="Explain why the post is removed..."
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {actionError && <p className="text-sm text-brand">{actionError}</p>}
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isSaving}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white  transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Remove post"}
                </button>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={isSaving || !post.removed_at}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Restore post
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
