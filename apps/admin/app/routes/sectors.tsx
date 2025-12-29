import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router";

import {
  addAdminCommunityDomain,
  addAdminSectorCompany,
  createAdminSector,
  deleteAdminCommunityDomain,
  deleteAdminSector,
  deleteAdminSectorCompany,
  fetchAdminCommunities,
  fetchAdminCommunityDomains,
  fetchAdminSectorCompanies,
  fetchAdminSectors,
  importAdminCommunitiesCsv,
} from "../lib/adminApi";
import type { AdminCommunity, AdminSector } from "../types/admin";
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

export default function SectorsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canCreate = admin.permissions.includes("create_community");

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminSector[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSector, setSelectedSector] = useState<AdminSector | null>(null);
  const [sectorCompanies, setSectorCompanies] = useState<AdminCommunity[]>([]);
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<AdminCommunity[]>([]);
  const [directDomains, setDirectDomains] = useState<string[]>([]);
  const [inheritedDomains, setInheritedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createImageUrl, setCreateImageUrl] = useState("");
  const [createTtlDays, setCreateTtlDays] = useState("");
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const runSearch = async (overrideQuery?: string) => {
    const nextQuery = (overrideQuery ?? query).trim();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminSectors(nextQuery || undefined);
      setItems(res.items);
      setNextCursor(res.next_cursor ?? null);
      setSelectedId(res.items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sectors.");
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
      const res = await fetchAdminSectors(query.trim() || undefined, nextCursor);
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more sectors.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSectorDetail = async (sectorId: number) => {
    setIsDetailLoading(true);
    setActionError(null);
    setDomainError(null);
    setDomainInput("");
    setCompanyQuery("");
    setCompanyResults([]);
    try {
      const item = items.find((sector) => sector.id === sectorId) ?? null;
      setSelectedSector(item);
      const [companiesRes, directRes, combinedRes] = await Promise.all([
        fetchAdminSectorCompanies(sectorId),
        fetchAdminCommunityDomains(sectorId, false),
        fetchAdminCommunityDomains(sectorId, true),
      ]);
      setSectorCompanies(companiesRes.items ?? []);
      const direct = directRes.items ?? [];
      const combined = combinedRes.items ?? [];
      const directSet = new Set(direct);
      const inherited = combined.filter((domain) => !directSet.has(domain));
      setDirectDomains(direct);
      setInheritedDomains(inherited);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to load sector details.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!canCreate) return;
    void runSearch();
  }, [canCreate]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedSector(null);
      setSectorCompanies([]);
      setDirectDomains([]);
      setInheritedDomains([]);
      return;
    }
    void fetchSectorDetail(selectedId);
  }, [selectedId, items]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setCreateSuccess(null);

    if (!createName.trim()) {
      setActionError("Sector name is required.");
      return;
    }

    const ttlValue = createTtlDays.trim();
    let ttlNumber: number | undefined;
    if (ttlValue) {
      const parsed = Number(ttlValue);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setActionError("Verification TTL must be a positive number of days.");
        return;
      }
      ttlNumber = parsed;
    }

    setIsSaving(true);
    try {
      const response = await createAdminSector({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        imageUrl: createImageUrl.trim() || undefined,
        verificationTtlDays: ttlNumber,
      });
      setCreateSuccess(`Created sector #${response.id}.`);
      setCreateName("");
      setCreateDescription("");
      setCreateImageUrl("");
      setCreateTtlDays("");
      await runSearch();
      if (response.id) {
        setSelectedId(response.id);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to create sector.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSector = async () => {
    if (!selectedId) return;
    if (!window.confirm("Delete this sector? This cannot be undone.")) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await deleteAdminSector(selectedId);
      setItems((prev) => prev.filter((item) => item.id !== selectedId));
      setSelectedId(null);
      setSelectedSector(null);
      setSectorCompanies([]);
      setDirectDomains([]);
      setInheritedDomains([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to delete sector.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompanySearch = async () => {
    const nextQuery = companyQuery.trim();
    if (!nextQuery) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const res = await fetchAdminCommunities(nextQuery);
      const filtered = res.items.filter((item) => item.kind === "company");
      setCompanyResults(filtered);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to search companies.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkCompany = async (companyId: number) => {
    if (!selectedId) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await addAdminSectorCompany(selectedId, companyId);
      const matched = companyResults.find((item) => item.id === companyId);
      if (matched && !sectorCompanies.find((item) => item.id === companyId)) {
        setSectorCompanies((prev) => [...prev, matched]);
      }
      await fetchSectorDetail(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to link company.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlinkCompany = async (companyId: number) => {
    if (!selectedId) return;
    if (!window.confirm(`Remove company #${companyId} from this sector? This cannot be undone.`)) {
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await deleteAdminSectorCompany(selectedId, companyId);
      setSectorCompanies((prev) => prev.filter((item) => item.id !== companyId));
      await fetchSectorDetail(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to remove company.");
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
    setDomainError(null);
    setIsSaving(true);
    try {
      await addAdminCommunityDomain(selectedId, trimmed);
      setDomainInput("");
      await fetchSectorDetail(selectedId);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Unable to add domain.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!selectedId) return;
    if (!window.confirm(`Remove ${domain} from this sector? This cannot be undone.`)) return;
    setIsSaving(true);
    setDomainError(null);
    try {
      await deleteAdminCommunityDomain(selectedId, domain);
      await fetchSectorDetail(selectedId);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Unable to remove domain.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportStatus("uploading");
    setImportMessage(null);
    try {
      await importAdminCommunitiesCsv(importFile);
      setImportStatus("success");
      setImportMessage("Import complete. Refreshing sector list.");
      await runSearch();
      setImportFile(null);
    } catch (err) {
      setImportStatus("error");
      setImportMessage(err instanceof Error ? err.message : "Import failed.");
    }
  };

  if (!canCreate) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6">
        <h1 className="text-2xl font-semibold text-strong">Sectors</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to manage sectors.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-text-light">Sectors</p>
          <h1 className="mt-2 text-2xl font-semibold text-strong">Manage sectors and company links</h1>
        </div>
        <Link to="/communities" className="text-sm font-semibold text-brand hover:text-brand/90">
          Manage communities
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-4 rounded-2xl border border-border bg-bg p-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-text-light" htmlFor="sector-search">
              Search sectors
            </label>
            <div className="flex gap-2">
              <input
                id="sector-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
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
            <p className="text-sm text-text-secondary">Loading sectors...</p>
          )}
          {!isLoading && items.length === 0 && (
            <p className="text-sm text-text-secondary">No sectors found.</p>
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
                    <p className="text-xs text-text-light">#{item.id}</p>
                  </div>
                  <span className="text-xs text-text-light">
                    TTL {item.verification_ttl_days ?? "none"}
                  </span>
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
            <h2 className="text-lg font-semibold text-strong">Create sector</h2>
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-sector-name">
                  Name
                </label>
                <input
                  id="create-sector-name"
                  type="text"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Retailing"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-sector-description">
                  Description (optional)
                </label>
                <textarea
                  id="create-sector-description"
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  className="min-h-[90px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-sector-image">
                  Image URL (optional)
                </label>
                <input
                  id="create-sector-image"
                  type="url"
                  value={createImageUrl}
                  onChange={(event) => setCreateImageUrl(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light" htmlFor="create-sector-ttl">
                  Verification TTL (days)
                </label>
                <input
                  id="create-sector-ttl"
                  type="number"
                  value={createTtlDays}
                  onChange={(event) => setCreateTtlDays(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="90"
                  min={1}
                />
              </div>

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
                {isSaving ? "Creating..." : "Create sector"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-border bg-bg p-6">
            <h2 className="text-lg font-semibold text-strong">Bulk import (CSV)</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Upload the official dataset CSV with headers:
            </p>
            <p className="mt-2 rounded-lg bg-bg-muted px-3 py-2 text-xs text-text-secondary">
              community_type,display_name,sector,authorized_domains,description,website,rank,source
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="w-full text-sm text-text-secondary file:mr-4 file:rounded-full file:border-0 file:bg-bg-muted file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-primary hover:file:bg-bg-muted/70"
              />
              {importMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    importStatus === "error"
                      ? "border-brand/30 bg-brand/10 text-brand"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {importMessage}
                </div>
              )}
              <button
                type="button"
                onClick={handleImport}
                disabled={!importFile || importStatus === "uploading"}
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importStatus === "uploading" ? "Uploading..." : "Upload CSV"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-bg p-6">
            <h2 className="text-lg font-semibold text-strong">Sector details</h2>
            {isDetailLoading && (
              <p className="mt-3 text-sm text-text-secondary">Loading sector...</p>
            )}
            {!isDetailLoading && !selectedSector && (
              <p className="mt-3 text-sm text-text-secondary">Select a sector to manage.</p>
            )}
            {selectedSector && (
              <div className="mt-4 space-y-4 text-sm text-text-secondary">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-strong">{selectedSector.name}</p>
                    <p className="text-xs text-text-light">#{selectedSector.id}</p>
                  </div>
                  <span className="text-xs text-text-light">
                    TTL {selectedSector.verification_ttl_days ?? "none"}
                  </span>
                </div>

                {selectedSector.description && (
                  <p className="text-sm text-text-secondary">{selectedSector.description}</p>
                )}

                <p className="text-xs text-text-light">
                  Created {formatDate(selectedSector.created_at)}
                </p>

                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-strong">Linked companies</h3>
                  {sectorCompanies.length === 0 && (
                    <p className="text-xs text-text-light">No companies linked yet.</p>
                  )}
                  <div className="space-y-2">
                    {sectorCompanies.map((company) => (
                      <div
                        key={company.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs text-text-secondary"
                      >
                        <span>
                          {company.name} #{company.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnlinkCompany(company.id)}
                          className="text-xs font-semibold text-brand hover:text-brand/90"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-2">
                    <label className="text-xs font-semibold uppercase text-text-light" htmlFor="company-search">
                      Add company
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="company-search"
                        type="text"
                        value={companyQuery}
                        onChange={(event) => setCompanyQuery(event.target.value)}
                        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        placeholder="Search companies"
                      />
                      <button
                        type="button"
                        onClick={handleCompanySearch}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                      >
                        Search
                      </button>
                    </div>
                    <div className="space-y-2">
                      {companyResults.map((company) => (
                        <div
                          key={company.id}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs text-text-secondary"
                        >
                          <span>
                            {company.name} #{company.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleLinkCompany(company.id)}
                            className="text-xs font-semibold text-brand hover:text-brand/90"
                          >
                            Link
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-strong">Domains</h3>
                  <p className="text-xs text-text-light">
                    Inherited domains come from linked companies and cannot be edited here.
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-text-light" htmlFor="domain-input">
                      Add domain
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="domain-input"
                        type="text"
                        value={domainInput}
                        onChange={(event) => setDomainInput(event.target.value)}
                        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        placeholder="sector.com"
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
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-text-light">Direct domains</p>
                    {directDomains.length === 0 && (
                      <p className="text-xs text-text-light">No direct domains yet.</p>
                    )}
                    {directDomains.map((domain) => (
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

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-text-light">Inherited domains</p>
                    {inheritedDomains.length === 0 && (
                      <p className="text-xs text-text-light">No inherited domains.</p>
                    )}
                    {inheritedDomains.map((domain) => (
                      <div
                        key={domain}
                        className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary"
                      >
                        {domain}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteSector}
                  className="w-full rounded-lg border border-brand/40 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10"
                >
                  Delete sector
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
