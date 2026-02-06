import { useState } from "react";
import { Link } from "react-router";

import { PageShell } from "@/marketing/components/PageShell/PageShell";
import { AuthCard } from "@/marketing/components/Auth/AuthCard";
import { useUserSession } from "@/hooks/useUserSession";
import {
  CommunityApiError,
  submitCommunityRequest,
  uploadCommunityImage,
  type CommunityRequestPayload,
} from "@/lib/communityApi";

const requestTypes: Array<{ value: CommunityRequestPayload["type"]; label: string; helper?: string }> = [
  { value: "company", label: "Company" },
  { value: "school", label: "School" },
  { value: "sector", label: "Field" },
  { value: "profession", label: "Profession", helper: "Treated as a field" },
];

export function CommunityRequestPage() {
  const { status, user, error: authError } = useUserSession();
  const [name, setName] = useState("");
  const [type, setType] = useState<CommunityRequestPayload["type"]>("company");
  const [about, setAbout] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ id: number; status: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!name.trim()) {
      setSubmitError("Enter a community name.");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageKey: string | undefined;
      if (imageFile) {
        imageKey = await uploadCommunityImage(imageFile);
      }

      const response = await submitCommunityRequest({
        name: name.trim(),
        type,
        about: about.trim() || undefined,
        imageKey,
      });

      setSubmitSuccess(response);
      setName("");
      setType("company");
      setAbout("");
      setImageFile(null);
    } catch (err) {
      setSubmitError(getCommunityErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading" || status === "checking") {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-2xl justify-center">
          <AuthCard title="Checking your session" description="One moment while we verify your sign-in." />
        </div>
      </PageShell>
    );
  }

  if (status !== "authenticated") {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-2xl justify-center">
          <AuthCard
            title="Sign in required"
            description="You must be signed in to request a new community."
          >
            <div className="space-y-4">
              {authError && <p className="text-sm text-brand">{authError}</p>}
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90"
              >
                Go to sign in
              </Link>
            </div>
          </AuthCard>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Community request</p>
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            Request a new Looped community
          </h1>
          <p className="text-lg leading-8 text-text-secondary">
            Tell us the company, school, or field you want to see on Looped.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <form
            className="rounded-2xl border border-border bg-bg p-6 shadow-sm"
            onSubmit={handleSubmit}
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary" htmlFor="community-name">
                  Community name
                </label>
                <input
                  id="community-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Acme Inc."
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary" htmlFor="community-type">
                  Community type
                </label>
                <select
                  id="community-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as CommunityRequestPayload["type"])}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  {requestTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-light">
                  {requestTypes.find((option) => option.value === type)?.helper ?? ""}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary" htmlFor="community-about">
                  Description (optional)
                </label>
                <textarea
                  id="community-about"
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                  className="min-h-[120px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Tell us a little about the community."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary" htmlFor="community-image">
                  Optional image
                </label>
                <input
                  id="community-image"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  className="w-full text-sm text-text-secondary file:mr-4 file:rounded-full file:border-0 file:bg-bg-muted file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-primary hover:file:bg-bg-muted/70"
                />
                {imageFile && (
                  <p className="text-xs text-text-light">Selected: {imageFile.name}</p>
                )}
              </div>

              {submitError && (
                <div className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Request received. Status: {submitSuccess.status}. We'll review it soon.
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </form>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-bg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-strong">Signed in</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Requests are tied to your verified account. We will contact you if we need more details.
              </p>
              <p className="mt-3 text-sm font-semibold text-strong">{user?.email ?? "Signed in"}</p>
            </div>

            <div className="rounded-2xl border border-border bg-bg-muted p-6">
              <h3 className="text-lg font-semibold text-strong">What happens next?</h3>
              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                <li>We review community requests in the order they are received.</li>
                <li>Approved communities appear in Looped once verified.</li>
                <li>You'll get an update by email if we need more info.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function getCommunityErrorMessage(error: unknown): string {
  if (error instanceof CommunityApiError) {
    const detail = (error.details || error.message || "").toString();
    const parsed = parseErrorCode(detail);
    const code = parsed ?? detail;

    const mapping: Record<string, string> = {
      request_already_pending: "You already have a pending request for this community.",
      community_exists: "That community already exists on Looped.",
      invalid_kind: "Select a valid community type.",
      name_required: "Enter a community name.",
      invalid_image: "That image could not be processed. Try another file.",
      image_not_owned: "We could not verify ownership of that image.",
      user_not_provisioned: "Your account is not ready for requests yet. Try again later.",
    };

    const matched = Object.keys(mapping).find((key) => code.includes(key));
    if (matched) {
      return mapping[matched];
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to submit your request. Please try again.";
}

function parseErrorCode(detail: string): string | null {
  try {
    const parsed = JSON.parse(detail) as { code?: string; error?: string; message?: string };
    return parsed.code ?? parsed.error ?? parsed.message ?? null;
  } catch {
    return null;
  }
}
