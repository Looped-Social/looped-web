import { useEffect, useMemo, useState } from "react";

import type { VerificationDocument } from "../../types/admin";

type VerificationDocumentGalleryProps = {
  documents: VerificationDocument[];
};

function formatDocumentKind(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function getDocumentKey(doc: VerificationDocument) {
  return `${doc.kind}:${doc.key}`;
}

export function VerificationDocumentGallery({ documents }: VerificationDocumentGalleryProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [lightboxDoc, setLightboxDoc] = useState<VerificationDocument | null>(null);

  const activeDoc = useMemo(() => {
    if (!documents.length) return null;
    if (!activeKey) return documents[0] ?? null;
    return documents.find((doc) => getDocumentKey(doc) === activeKey) ?? documents[0] ?? null;
  }, [activeKey, documents]);

  useEffect(() => {
    if (!documents.length) {
      setActiveKey(null);
      return;
    }

    setActiveKey((prev) => {
      if (prev && documents.some((doc) => getDocumentKey(doc) === prev)) return prev;
      return getDocumentKey(documents[0]);
    });
  }, [documents]);

  useEffect(() => {
    if (!lightboxDoc) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxDoc(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxDoc]);

  if (!activeDoc) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setLightboxDoc(activeDoc)}
        className="group relative w-full overflow-hidden rounded-xl border border-border bg-bg"
      >
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-bg-muted/30">
          <img
            src={activeDoc.download_url}
            alt={activeDoc.kind}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 text-left text-xs text-white opacity-0 transition group-hover:opacity-100">
          <span className="font-semibold">{formatDocumentKind(activeDoc.kind)}</span>
          <span className="text-[11px]">Click to enlarge</span>
        </div>
      </button>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-text-primary">{formatDocumentKind(activeDoc.kind)}</p>
        <a
          href={activeDoc.download_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold uppercase text-brand"
        >
          Open
        </a>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {documents.map((doc) => {
          const key = getDocumentKey(doc);
          const isActive = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveKey(key)}
              className={`flex w-24 flex-shrink-0 flex-col gap-1 rounded-xl border p-2 text-left transition ${
                isActive
                  ? "border-brand/60 bg-brand/5"
                  : "border-border bg-bg hover:border-brand/40"
              }`}
            >
              <div className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-bg-muted/30">
                <img
                  src={doc.download_url}
                  alt={doc.kind}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="truncate text-[11px] font-semibold text-text-secondary">
                {formatDocumentKind(doc.kind)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-text-light">Expires in {activeDoc.expires_in_seconds}s</p>

      {lightboxDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Verification document preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxDoc(null)}
        >
          <div
            className="relative max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-hidden rounded-2xl bg-bg shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-text-primary">
                {formatDocumentKind(lightboxDoc.kind)}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxDoc.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxDoc(null)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex max-h-[calc(100vh-8rem)] items-center justify-center bg-black/10 p-4">
              <img
                src={lightboxDoc.download_url}
                alt={lightboxDoc.kind}
                className="max-h-[calc(100vh-10rem)] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
