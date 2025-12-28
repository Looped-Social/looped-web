import { useState } from "react";
import { useOutletContext } from "react-router";

import { sendAdminAnnouncement } from "../lib/adminApi";
import type { AdminRouteContext } from "./admin";

export default function AnnouncementsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canSend = admin.permissions.includes("send_announcements");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deeplink, setDeeplink] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const handleSend = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const trimmedDeeplink = deeplink.trim();

    setError(null);
    if (!trimmedTitle || !trimmedBody) {
      setError("Title and message are required.");
      return;
    }

    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }

    setIsSending(true);
    try {
      const response = await sendAdminAnnouncement({
        title: trimmedTitle,
        body: trimmedBody,
        deeplink: trimmedDeeplink || undefined,
      });
      setSentCount(response.sent ?? 0);
      setConfirmSend(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send announcement.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setTitle("");
    setBody("");
    setDeeplink("");
    setConfirmSend(false);
    setError(null);
    setSentCount(null);
  };

  if (!canSend) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Announcements</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to send announcements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-text-light">
          Announcements
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-strong">
          Send company-wide announcements
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Deliver a broadcast message to every member of the company.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-border bg-bg p-5">
          <div className="space-y-4 text-sm text-text-secondary">
            <label className="text-xs font-semibold uppercase text-text-light">
              Title
            </label>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setConfirmSend(false);
              }}
              placeholder="Announcement title"
              className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />

            <label className="text-xs font-semibold uppercase text-text-light">
              Message
            </label>
            <textarea
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setConfirmSend(false);
              }}
              rows={5}
              placeholder="Share the update with your team..."
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />

            <label className="text-xs font-semibold uppercase text-text-light">
              Deep link (optional)
            </label>
            <input
              value={deeplink}
              onChange={(event) => setDeeplink(event.target.value)}
              placeholder="e.g. looped://announcements/123"
              className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />

            {error && (
              <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-brand">
                {error}
              </p>
            )}

            {sentCount !== null && !error && (
              <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
                Announcement sent to {sentCount} recipients.
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending
                  ? "Sending..."
                  : confirmSend
                    ? "Confirm send"
                    : "Send announcement"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={isSending}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            </div>
            {confirmSend && (
              <button
                type="button"
                onClick={() => setConfirmSend(false)}
                className="w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
              >
                Cancel
              </button>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-border bg-bg p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold text-strong">Delivery notes</h2>
          <div className="mt-4 space-y-3 text-sm text-text-secondary">
            <p>
              Announcements create in-app notifications for everyone who allows them.
            </p>
            <p>
              Push notifications are only delivered if the iOS push queue and worker are
              configured.
            </p>
            <p>
              Recipients can opt out of announcement pushes in their notification preferences.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
