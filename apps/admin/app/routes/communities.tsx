import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";

import {
  addAdminCommunityDomain,
  callbackAdminCommunityLogo,
  createAdminCommunity,
  deleteAdminCommunity,
  deleteAdminCommunityDomain,
  fetchAdminCommunities,
  fetchAdminCommunity,
  fetchAdminCommunityDomains,
  fetchAdminCommunityLogos,
  presignAdminCommunityLogo,
  selectAdminCommunityLogo,
  updateAdminCommunity,
} from "../lib/adminApi";
import type {
  AdminCommunity,
  AdminCommunityLogoListResponse,
  AdminCommunityLogoUpload,
} from "../types/admin";
import type { AdminRouteContext } from "./admin";

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatKindLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatCommunityKindLabel(community: AdminCommunity) {
  if (community.kind === "specialization") {
    if (community.specialization_type === "major") return "Major";
    if (community.specialization_type === "department") return "Department";
    return "Specialization";
  }
  if (community.kind === "major") return "Major";
  if (community.kind === "department") return "Department";
  return formatKindLabel(community.kind);
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://");
  return hasProtocol ? trimmed.replace(/\/$/, "") : `https://${trimmed.replace(/\/$/, "")}`;
}

function resolveUploadUrl(upload: AdminCommunityLogoUpload) {
  if (upload.cdn_url) return upload.cdn_url;
  if (upload.image_url) return upload.image_url;
  if (upload.url) return upload.url;
  if (!upload.key) return null;
  const base = normalizeBaseUrl(
    (import.meta.env.VITE_CLOUDFRONT_DOMAIN as string | undefined) ??
      (import.meta.env.VITE_CLOUDFRONT_URL as string | undefined) ??
      ""
  );
  if (!base) return null;
  const safeKey = upload.key.replace(/^\/+/, "");
  return `${base}/${safeKey}`;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      // Fallback to Image when createImageBitmap fails for a file type.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image dimensions."));
    };
    image.src = url;
  });
}

export default function CommunitiesRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canCreate = admin.permissions.includes("create_community");
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminCommunity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AdminCommunity | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [logos, setLogos] = useState<AdminCommunityLogoListResponse | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isLogoLoading, setIsLogoLoading] = useState(false);
  const [isLogoSaving, setIsLogoSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploadStatus, setLogoUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [logoUploadMessage, setLogoUploadMessage] = useState<string | null>(null);
  const [customLogoUrl, setCustomLogoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [createKind, setCreateKind] = useState<
    "company" | "school" | "sector" | "major" | "department"
  >("company");
  const [kindFilter, setKindFilter] = useState<
    "all" | "company" | "school" | "sector" | "major" | "department"
  >("all");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createImageUrl, setCreateImageUrl] = useState("");
  const [createTtlDays, setCreateTtlDays] = useState("");
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [ttlInput, setTtlInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");

  const paramId = useMemo(() => {
    const raw =
      searchParams.get("id") ??
      searchParams.get("communityId") ??
      searchParams.get("selected");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );
  const selectedLogoSource = logos?.selected_source ?? "none";
  const selectedLogoUrl = logos?.selected_image_url ?? null;
  const selectedUploadId = logos?.selected_upload_id ?? null;
  const logoDevUrl = logos?.logo_dev_url ?? null;
  const logoUploads = logos?.uploads ?? [];
  const isSector = selectedDetail?.kind === "sector";
  const isSpecialization =
    selectedDetail?.kind === "specialization" ||
    selectedDetail?.kind === "major" ||
    selectedDetail?.kind === "department" ||
    Boolean(selectedDetail?.specialization_type);
  const isCreateSpecialization = createKind === "major" || createKind === "department";
  const kindFilters = [
    { label: "All", value: "all" },
    { label: "Company", value: "company" },
    { label: "School", value: "school" },
    { label: "Sector", value: "sector" },
    { label: "Major", value: "major" },
    { label: "Department", value: "department" },
  ] as const;

  const runSearch = async (overrideQuery?: string) => {
    const nextQuery = (overrideQuery ?? query).trim();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminCommunities(
        nextQuery || undefined,
        undefined,
        30,
        kindFilter === "all" ? undefined : kindFilter
      );
      setItems(res.items);
      setNextCursor(res.next_cursor ?? null);
      if (paramId) {
        setSelectedId(paramId);
      } else {
        setSelectedId(res.items[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load communities.");
      setItems([]);
      setNextCursor(null);
      setSelectedId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetchAdminCommunities(
        query.trim() || undefined,
        nextCursor,
        30,
        kindFilter === "all" ? undefined : kindFilter
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more communities.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDetail = async (id: number) => {
    setSelectedDetail(null);
    setDomains([]);
    setDomainInput("");
    setDomainError(null);
    setActionError(null);
    setLogos(null);
    setLogoError(null);
    setLogoUploadStatus("idle");
    setLogoUploadMessage(null);
    setLogoFile(null);
    setCustomLogoUrl("");
    setIsDetailLoading(true);
    try {
      const detail = await fetchAdminCommunity(id);
      setSelectedDetail(detail);
      setTtlInput(detail.verification_ttl_days?.toString() ?? "");
      setDescriptionInput(detail.description ?? "");
      const domainRes = await fetchAdminCommunityDomains(id);
      setDomains(domainRes.items ?? []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to load community detail.");
    } finally {
      setIsDetailLoading(false);
    }

    await fetchLogos(id);
  };

  const fetchLogos = async (id: number) => {
    setIsLogoLoading(true);
    setLogoError(null);
    try {
      const response = await fetchAdminCommunityLogos(id);
      setLogos(response);
      if (response.selected_source === "custom") {
        setCustomLogoUrl(response.selected_image_url ?? "");
      }
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Unable to load community logos.");
      setLogos(null);
    } finally {
      setIsLogoLoading(false);
    }
  };

  useEffect(() => {
    if (!canCreate) return;
    const handle = window.setTimeout(() => {
      void runSearch();
    }, 300);
    return () => window.clearTimeout(handle);
  }, [canCreate, kindFilter, query]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      setDomains([]);
      setLogos(null);
      setLogoError(null);
      setLogoFile(null);
      setLogoUploadMessage(null);
      setLogoUploadStatus("idle");
      setCustomLogoUrl("");
      setDescriptionInput("");
      return;
    }
    void fetchDetail(selectedId);
  }, [selectedId]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setCreateSuccess(null);

    if (!createName.trim()) {
      setActionError("Community name is required.");
      return;
    }

    const ttlValue = createTtlDays.trim();
    let ttlNumber: number | undefined;
    if (ttlValue && !isCreateSpecialization) {
      const parsed = Number(ttlValue);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setActionError("Verification TTL must be a positive number of days.");
        return;
      }
      ttlNumber = parsed;
    }
    const createKindLabel = isCreateSpecialization
      ? createKind === "major"
        ? "Major"
        : "Department"
      : formatKindLabel(createKind);
    if (!window.confirm(`Create ${createKindLabel} community "${createName.trim()}"?`)) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await createAdminCommunity({
        kind: isCreateSpecialization ? "specialization" : createKind,
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        imageUrl: createImageUrl.trim() || undefined,
        verificationTtlDays: isCreateSpecialization ? undefined : ttlNumber,
        specializationType: isCreateSpecialization ? createKind : undefined,
      });
      setCreateSuccess(`Created community #${response.id}.`);
      setCreateName("");
      setCreateDescription("");
      setCreateImageUrl("");
      setCreateTtlDays("");
      await runSearch();
      if (response.id) {
        setSelectedId(response.id);
      }
      setIsCreateOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to create community.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTtl = async () => {
    if (!selectedId) return;
    const ttlValue = ttlInput.trim();
    if (!ttlValue) {
      setActionError("Enter a verification TTL in days.");
      return;
    }
    const parsed = Number(ttlValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setActionError("Verification TTL must be a positive number of days.");
      return;
    }
    if (!window.confirm(`Update verification TTL to ${parsed} days?`)) return;

    setIsSaving(true);
    setActionError(null);
    try {
      await updateAdminCommunity(selectedId, { verificationTtlDays: parsed });
      await fetchDetail(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update TTL.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDescription = async () => {
    if (!selectedId || !selectedDetail) return;
    const nextDescription = descriptionInput.trim();
    const currentDescription = (selectedDetail.description ?? "").trim();
    if (nextDescription === currentDescription) {
      setActionError("Bio is unchanged.");
      return;
    }
    if (
      !window.confirm(
        nextDescription ? "Update the community bio?" : "Clear the community bio?"
      )
    ) {
      return;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      await updateAdminCommunity(selectedId, { description: nextDescription });
      await fetchDetail(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update bio.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCommunity = async () => {
    if (!selectedId) return;
    if (!window.confirm("Delete this community? This cannot be undone.")) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await deleteAdminCommunity(selectedId);
      setItems((prev) => prev.filter((item) => item.id !== selectedId));
      setSelectedId(null);
      setSelectedDetail(null);
      setDomains([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to delete community.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDomain = async () => {
    if (!selectedId) return;
    const trimmed = domainInput.trim().toLowerCase();
    if (!trimmed) {
      setDomainError("Enter a domain.");
      return;
    }
    if (!window.confirm(`Add ${trimmed} to this community?`)) return;
    setDomainError(null);
    setIsSaving(true);
    try {
      await addAdminCommunityDomain(selectedId, trimmed);
      setDomains((prev) => [...prev, trimmed]);
      setDomainInput("");
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Unable to add domain.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!selectedId) return;
    if (!window.confirm(`Remove ${domain} from this community? This cannot be undone.`)) return;
    setIsSaving(true);
    setDomainError(null);
    try {
      await deleteAdminCommunityDomain(selectedId, domain);
      setDomains((prev) => prev.filter((item) => item !== domain));
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Unable to remove domain.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!selectedId || !logoFile) return;
    if (!window.confirm(`Upload "${logoFile.name}" as a community logo?`)) return;
    setLogoUploadStatus("uploading");
    setLogoUploadMessage(null);
    setLogoError(null);
    setIsLogoSaving(true);
    try {
      const contentType = logoFile.type || "application/octet-stream";
      const { width, height } = await getImageDimensions(logoFile);
      const presign = await presignAdminCommunityLogo(selectedId, {
        contentType,
        sizeBytes: logoFile.size,
      });
      const uploadUrl = presign.uploadUrl ?? presign.upload_url;
      if (!uploadUrl) {
        throw new Error("Upload URL missing from presign response.");
      }
      const uploadHeaders: Record<string, string> = { ...(presign.headers ?? {}) };
      const hasContentType = Object.keys(uploadHeaders).some(
        (key) => key.toLowerCase() === "content-type"
      );
      if (!hasContentType && contentType) {
        uploadHeaders["Content-Type"] = contentType;
      }
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: uploadHeaders,
        body: logoFile,
      });
      if (!uploadResponse.ok) {
        throw new Error("Logo upload failed.");
      }
      const callbackSignature = presign.callbackSignature ?? presign.callback_signature;
      await callbackAdminCommunityLogo(selectedId, {
        key: presign.key,
        mimeType: contentType,
        width,
        height,
      }, callbackSignature ?? undefined);
      setLogoUploadStatus("success");
      setLogoUploadMessage("Logo uploaded. Select it below to use it.");
      setLogoFile(null);
      await fetchLogos(selectedId);
    } catch (err) {
      setLogoUploadStatus("error");
      setLogoUploadMessage(err instanceof Error ? err.message : "Unable to upload logo.");
    } finally {
      setIsLogoSaving(false);
    }
  };

  const handleSelectLogoDev = async () => {
    if (!selectedId) return;
    if (!window.confirm("Use Logo.dev as the active community logo?")) return;
    setIsLogoSaving(true);
    setLogoError(null);
    try {
      await selectAdminCommunityLogo(selectedId, { useLogoDev: true });
      await fetchLogos(selectedId);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Unable to select Logo.dev.");
    } finally {
      setIsLogoSaving(false);
    }
  };

  const handleSelectUpload = async (upload: AdminCommunityLogoUpload) => {
    if (!selectedId || !upload.key) return;
    if (!window.confirm("Use this uploaded logo for the community?")) return;
    setIsLogoSaving(true);
    setLogoError(null);
    try {
      await selectAdminCommunityLogo(selectedId, { imageKey: upload.key });
      await fetchLogos(selectedId);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Unable to select uploaded logo.");
    } finally {
      setIsLogoSaving(false);
    }
  };

  const handleSelectCustom = async () => {
    if (!selectedId) return;
    const trimmed = customLogoUrl.trim();
    if (!trimmed) {
      setLogoError("Enter a custom logo URL.");
      return;
    }
    if (!window.confirm("Use this custom logo URL for the community?")) return;
    setIsLogoSaving(true);
    setLogoError(null);
    try {
      await selectAdminCommunityLogo(selectedId, { imageUrl: trimmed });
      await fetchLogos(selectedId);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Unable to select custom logo.");
    } finally {
      setIsLogoSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6">
        <h1 className="text-2xl font-semibold text-strong">Communities</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to manage communities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-text-light">Communities</p>
          <h1 className="mt-2 text-2xl font-semibold text-strong">Manage communities</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setCreateSuccess(null);
              setIsCreateOpen(true);
            }}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
          >
            Create community
          </button>
          <Link
            to="/community-requests"
            className="text-sm font-semibold text-brand hover:text-brand/90"
          >
            Review requests
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-4 rounded-2xl border border-border bg-bg p-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-text-light">Filter by type</p>
            <div className="flex flex-wrap gap-2">
              {kindFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setKindFilter(filter.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    kindFilter === filter.value
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-text-light" htmlFor="community-search">
              Search communities
            </label>
            <div className="flex gap-2">
              <input
                id="community-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void runSearch();
                  }
                }}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Search by name"
              />
              <button
                type="button"
                onClick={() => runSearch()}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
              >
                Search
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
              {error}
            </div>
          )}

          {isLoading && items.length === 0 && (
            <p className="text-sm text-text-secondary">Loading communities...</p>
          )}
          {!isLoading && items.length === 0 && (
            <p className="text-sm text-text-secondary">No communities found.</p>
          )}

          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  selectedId === item.id
                    ? "border-brand/40 bg-brand/5"
                    : "border-border hover:bg-bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-strong">{item.name}</p>
                    <p className="text-xs text-text-light">
                      {formatCommunityKindLabel(item)} · #{item.id}
                    </p>
                  </div>
                  <span className="text-xs text-text-light">{item.member_count ?? 0} members</span>
                </div>
              </button>
            ))}
          </div>

          {nextCursor && (
            <button
              type="button"
              onClick={loadMore}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
            >
              Load more
            </button>
          )}
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl border border-border bg-bg p-6">
            <h2 className="text-lg font-semibold text-strong">Community details</h2>
            {isDetailLoading && (
              <p className="mt-3 text-sm text-text-secondary">Loading community...</p>
            )}
            {!isDetailLoading && !selectedDetail && (
              <p className="mt-3 text-sm text-text-secondary">Select a community to manage.</p>
            )}
            {selectedDetail && (
              <div className="mt-4 space-y-4 text-sm text-text-secondary">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-strong">{selectedDetail.name}</p>
                    <p className="text-xs text-text-light">
                      {formatCommunityKindLabel(selectedDetail)} · #{selectedDetail.id}
                    </p>
                  </div>
                  <span className="text-xs text-text-light">
                    {selectedDetail.member_count ?? 0} members
                  </span>
                </div>

                {selectedDetail.description && (
                  <p className="text-sm text-text-secondary">{selectedDetail.description}</p>
                )}

                <p className="text-xs text-text-light">
                  Created {formatDate(selectedDetail.created_at)}
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-text-light" htmlFor="bio-update">
                    Community bio
                  </label>
                  <textarea
                    id="bio-update"
                    value={descriptionInput}
                    onChange={(event) => setDescriptionInput(event.target.value)}
                    className="min-h-[90px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="Write a short community bio..."
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUpdateDescription}
                      disabled={isSaving}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Update bio
                    </button>
                    <span className="text-xs text-text-light">Leave blank to clear.</span>
                  </div>
                </div>

                {!isSpecialization && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-text-light" htmlFor="ttl-update">
                      Verification TTL (days)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="ttl-update"
                        type="number"
                        value={ttlInput}
                        onChange={(event) => setTtlInput(event.target.value)}
                        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        min={1}
                      />
                      <button
                        type="button"
                        onClick={handleUpdateTtl}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-strong">Allowed domains</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(event) => setDomainInput(event.target.value)}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      placeholder="amazon.com"
                    />
                    <button
                      type="button"
                      onClick={handleAddDomain}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
                    >
                      Add
                    </button>
                  </div>
                  {domainError && <p className="text-xs text-brand">{domainError}</p>}
                  {domains.length === 0 && (
                    <p className="text-xs text-text-light">No domains added yet.</p>
                  )}
                  <div className="space-y-2">
                    {domains.map((domain) => (
                      <div
                        key={domain}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs text-text-secondary"
                      >
                        <span>{domain}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDomain(domain)}
                          className="text-xs font-semibold text-brand hover:text-brand/90"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-strong">Community logo</h3>
                    <p className="text-xs text-text-light">
                      Default icons come from Logo.dev for company and school communities.
                    </p>
                  </div>

                  {logoError && <p className="text-xs text-brand">{logoError}</p>}

                  {isLogoLoading ? (
                    <p className="text-xs text-text-light">Loading logos...</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-border bg-bg-muted/30 px-3 py-3 text-xs text-text-secondary">
                        <p className="text-xs font-semibold uppercase text-text-light">Current logo</p>
                        {selectedLogoUrl ? (
                          <div className="mt-2 flex items-center gap-3">
                            <img
                              src={selectedLogoUrl}
                              alt={`${selectedDetail.name} logo`}
                              className="h-12 w-12 rounded-full border border-border bg-white object-contain"
                            />
                            <div>
                              <p className="text-xs text-text-light">Source</p>
                              <p className="text-sm font-semibold text-text-primary">
                                {selectedLogoSource}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-text-light">No logo selected yet.</p>
                        )}
                      </div>

                      {logoDevUrl ? (
                        <div className="rounded-lg border border-border px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={logoDevUrl}
                                alt="Logo.dev preview"
                                className="h-12 w-12 rounded-full border border-border bg-white object-contain"
                              />
                              <div>
                                <p className="text-xs font-semibold text-text-primary">Logo.dev</p>
                                <p className="text-xs text-text-light">
                                  Auto-generated from the primary community domain.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleSelectLogoDev}
                              disabled={isLogoSaving || selectedLogoSource === "logo_dev"}
                              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {selectedLogoSource === "logo_dev" ? "Selected" : "Use Logo.dev"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-text-light">
                          {isSector || isSpecialization
                            ? "Logo.dev is only available for company or school communities."
                            : "Logo.dev appears once a domain is set for company or school communities."}
                        </p>
                      )}

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-text-light">Upload a logo</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => {
                              setLogoFile(event.target.files?.[0] ?? null);
                              setLogoUploadStatus("idle");
                              setLogoUploadMessage(null);
                            }}
                            className="w-full text-sm text-text-secondary file:mr-4 file:rounded-full file:border-0 file:bg-bg-muted file:px-4 file:py-2 file:text-xs file:font-semibold file:text-text-primary hover:file:bg-bg-muted/70 sm:w-auto"
                          />
                          <button
                            type="button"
                            onClick={handleLogoUpload}
                            disabled={!logoFile || isLogoSaving}
                            className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {logoUploadStatus === "uploading" ? "Uploading..." : "Upload"}
                          </button>
                        </div>
                        {logoUploadMessage && (
                          <p
                            className={`text-xs ${
                              logoUploadStatus === "error" ? "text-brand" : "text-text-light"
                            }`}
                          >
                            {logoUploadMessage}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-text-light">Uploaded logos</p>
                        {logoUploads.length === 0 && (
                          <p className="text-xs text-text-light">No uploaded logos yet.</p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          {logoUploads.map((upload, index) => {
                            const uploadUrl = resolveUploadUrl(upload);
                            const isSelected =
                              selectedLogoSource === "upload" &&
                              ((selectedUploadId && upload.id === selectedUploadId) ||
                                (Boolean(uploadUrl) && uploadUrl === selectedLogoUrl));
                            const uploadKey = upload.key ?? uploadUrl ?? `upload-${index}`;
                            return (
                              <div
                                key={uploadKey}
                                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary"
                              >
                                <div className="flex items-center gap-2">
                                  {uploadUrl ? (
                                    <img
                                      src={uploadUrl}
                                      alt="Uploaded logo"
                                      className="h-10 w-10 rounded-full border border-border bg-white object-contain"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-muted text-[10px] text-text-light">
                                      Logo
                                    </div>
                                  )}
                                  <span className="text-[10px] text-text-light">
                                    {upload.key ?? "Uploaded logo"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSelectUpload(upload)}
                                  disabled={isLogoSaving || isSelected || !upload.key}
                                  className="rounded-full border border-border px-3 py-1 text-[10px] font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isSelected ? "Selected" : "Use"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-text-light">Custom URL</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="url"
                            value={customLogoUrl}
                            onChange={(event) => setCustomLogoUrl(event.target.value)}
                            placeholder="https://example.com/logo.png"
                            className="w-full rounded-full border border-border bg-bg px-3 py-2 text-xs text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 sm:flex-1"
                          />
                          <button
                            type="button"
                            onClick={handleSelectCustom}
                            disabled={isLogoSaving}
                            className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Use custom URL
                          </button>
                        </div>
                        {selectedLogoSource === "custom" && selectedLogoUrl && (
                          <div className="flex items-center gap-2 text-xs text-text-light">
                            <img
                              src={selectedLogoUrl}
                              alt="Custom logo preview"
                              className="h-8 w-8 rounded-full border border-border bg-white object-contain"
                            />
                            <span>Custom logo selected.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleDeleteCommunity}
                  className="w-full rounded-lg border border-brand/40 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10"
                >
                  Delete community
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsCreateOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg p-6 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-strong">Create community</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
              >
                Close
              </button>
            </div>
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-kind">
                  Type
                </label>
                <select
                  id="create-kind"
                  value={createKind}
                  onChange={(event) =>
                    setCreateKind(
                      event.target.value as
                        | "company"
                        | "school"
                        | "sector"
                        | "major"
                        | "department"
                    )
                  }
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="company">Company</option>
                  <option value="school">School</option>
                  <option value="sector">Sector</option>
                  <option value="major">Major</option>
                  <option value="department">Department</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-name">
                  Name
                </label>
                <input
                  id="create-name"
                  type="text"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Community name"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-description">
                  Description (optional)
                </label>
                <textarea
                  id="create-description"
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  className="min-h-[90px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-image">
                  Image URL (optional)
                </label>
                <input
                  id="create-image"
                  type="url"
                  value={createImageUrl}
                  onChange={(event) => setCreateImageUrl(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="https://..."
                />
              </div>

              {!isCreateSpecialization && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-ttl">
                    Verification TTL (days)
                  </label>
                  <input
                    id="create-ttl"
                    type="number"
                    value={createTtlDays}
                    onChange={(event) => setCreateTtlDays(event.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="90"
                    min={1}
                  />
                </div>
              )}

              {actionError && (
                <div className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
                  {actionError}
                </div>
              )}

              {createSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {createSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Creating..." : "Create community"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
