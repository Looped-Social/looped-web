import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import type { ResolvedMediaAsset } from "@/lib/mediaApi";

type PostMediaGridProps = {
  attachments: ResolvedMediaAsset[];
  className?: string;
  viewerHeader?: ReactNode;
  viewerFooter?: ReactNode;
};

const MUTE_ICON_SRC = "/video-icons/mute-icon.svg";
const VOLUME_ICON_SRC = "/video-icons/volume-one.svg";
const PLAY_ICON_SRC = "/video-icons/play-button.svg";
const PAUSE_ICON_SRC = "/video-icons/pause-button.svg";
const MINIMIZE_ICON_SRC = "/video-icons/minizmize.svg";

function isVideo(asset: ResolvedMediaAsset): boolean {
  if (asset.mimeType?.toLowerCase().startsWith("video/")) return true;
  return asset.durationSeconds !== undefined && asset.durationSeconds > 0;
}

function normalizedAttachments(input: ResolvedMediaAsset[]): ResolvedMediaAsset[] {
  const unique: ResolvedMediaAsset[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    if (!entry?.id || !entry.cdnUrl || seen.has(entry.id)) continue;
    seen.add(entry.id);
    unique.push(entry);
  }

  const clipped = unique.slice(0, 4);
  const firstVideo = clipped.find(isVideo);
  if (firstVideo) return [firstVideo];
  return clipped;
}

function aspectRatioFor(asset: ResolvedMediaAsset): string {
  if (asset.width && asset.height && asset.width > 0 && asset.height > 0) {
    return `${asset.width} / ${asset.height}`;
  }
  return "16 / 9";
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const whole = Math.floor(seconds);
  const hrs = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function ImageIconButton({
  src,
  alt,
  onClick,
  className,
}: {
  src: string;
  alt: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 transition hover:bg-black/65 ${className ?? ""}`}
      aria-label={alt}
    >
      <img src={src} alt="" className="h-5 w-5 object-contain" loading="lazy" />
    </button>
  );
}

function MediaTile({
  asset,
  className,
  onOpen,
}: {
  asset: ResolvedMediaAsset;
  className?: string;
  onOpen: () => void;
}) {
  const video = isVideo(asset);
  const [muted, setMuted] = useState(true);
  const [posterFailed, setPosterFailed] = useState(false);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const poster = !posterFailed ? asset.thumbnailUrl : undefined;

  useEffect(() => {
    setMuted(true);
    setPosterFailed(false);
  }, [asset.id]);

  useEffect(() => {
    if (!video) return;
    const node = previewRef.current;
    if (!node) return;
    const playResult = node.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {
        // autoplay can be blocked on some devices; user can still open fullscreen.
      });
    }
  }, [asset.cdnUrl, video]);

  return (
    <div
      className={`group relative overflow-hidden rounded-xl bg-bg-muted ${className ?? ""}`}
      style={{ aspectRatio: aspectRatioFor(asset) }}
    >
      {video ? (
        <video
          ref={previewRef}
          src={asset.cdnUrl}
          poster={poster ?? asset.cdnUrl}
          className="h-full w-full object-cover"
          autoPlay
          muted={muted}
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <img src={asset.cdnUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      )}

      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 z-10"
        aria-label={video ? "Open video" : "Open image"}
      />

      {video ? (
        <ImageIconButton
          src={muted ? MUTE_ICON_SRC : VOLUME_ICON_SRC}
          alt={muted ? "Unmute video" : "Mute video"}
          onClick={() => setMuted((value) => !value)}
          className="absolute bottom-3 right-3 z-20"
        />
      ) : null}
    </div>
  );
}

export function PostMediaGrid({ attachments, className, viewerHeader, viewerFooter }: PostMediaGridProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerMuted, setViewerMuted] = useState(true);
  const [viewerPlaying, setViewerPlaying] = useState(true);
  const [viewerCurrentTime, setViewerCurrentTime] = useState(0);
  const [viewerDuration, setViewerDuration] = useState(0);
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const media = useMemo(() => normalizedAttachments(attachments), [attachments]);
  const viewerAsset = viewerIndex !== null && media[viewerIndex] ? media[viewerIndex] : null;
  const viewerIsVideo = viewerAsset ? isVideo(viewerAsset) : false;

  useEffect(() => {
    if (!viewerAsset || !viewerIsVideo) return;
    setViewerMuted(true);
    setViewerPlaying(true);
    setViewerCurrentTime(0);
    setViewerDuration(0);
  }, [viewerAsset, viewerIsVideo]);

  useEffect(() => {
    if (!viewerAsset || !viewerIsVideo) return;
    const node = viewerVideoRef.current;
    if (!node) return;
    node.muted = viewerMuted;
  }, [viewerAsset, viewerIsVideo, viewerMuted]);

  useEffect(() => {
    if (!viewerAsset || !viewerIsVideo) return;
    const node = viewerVideoRef.current;
    if (!node) return;
    if (viewerPlaying) {
      const playResult = node.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(() => {
          setViewerPlaying(false);
        });
      }
      return;
    }
    node.pause();
  }, [viewerAsset, viewerIsVideo, viewerPlaying]);

  const closeViewer = () => {
    setViewerIndex(null);
    setViewerPlaying(false);
    setViewerCurrentTime(0);
    setViewerDuration(0);
  };

  const openViewerAt = (index: number) => {
    setViewerIndex(index);
    setViewerPlaying(true);
  };

  const handleSeek = (nextValue: number) => {
    const node = viewerVideoRef.current;
    if (!node) return;
    node.currentTime = nextValue;
    setViewerCurrentTime(nextValue);
  };

  if (media.length === 0) return null;

  return (
    <>
      <div className={className}>
        {media.length === 1 ? (
          <MediaTile asset={media[0]} onOpen={() => openViewerAt(0)} className="w-full" />
        ) : media.length === 2 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {media.map((asset, index) => (
              <MediaTile key={asset.id} asset={asset} onOpen={() => openViewerAt(index)} className="w-full" />
            ))}
          </div>
        ) : media.length === 3 ? (
          <div className="grid grid-cols-2 grid-rows-2 gap-1.5">
            <MediaTile asset={media[0]} onOpen={() => openViewerAt(0)} className="row-span-2 h-full" />
            <MediaTile asset={media[1]} onOpen={() => openViewerAt(1)} />
            <MediaTile asset={media[2]} onOpen={() => openViewerAt(2)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {media.map((asset, index) => (
              <MediaTile key={asset.id} asset={asset} onOpen={() => openViewerAt(index)} />
            ))}
          </div>
        )}
      </div>

      {viewerAsset ? (
        <div
          className="fixed inset-0 z-50 bg-white/72 px-2 py-3 text-text-primary backdrop-blur-[1px] dark:bg-black/72 dark:text-white"
          onClick={closeViewer}
        >
          <div
            className="mx-auto flex h-full max-h-[94vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.28)] dark:bg-black dark:shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between px-4 pb-2 pt-4">
              <div className="min-w-0 flex-1">{viewerHeader}</div>
              <button
                type="button"
                onClick={closeViewer}
                className="ml-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 transition hover:bg-black/55"
                aria-label="Close media"
              >
                <img src={MINIMIZE_ICON_SRC} alt="" className="h-5 w-5 object-contain" loading="lazy" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-2 pt-1">
              {viewerIsVideo ? (
                <video
                  ref={viewerVideoRef}
                  src={viewerAsset.cdnUrl}
                  poster={viewerAsset.thumbnailUrl ?? viewerAsset.cdnUrl}
                  playsInline
                  autoPlay
                  muted={viewerMuted}
                  className="h-full max-h-full w-full max-w-[640px] object-contain"
                  onLoadedMetadata={(event) => {
                    setViewerDuration(event.currentTarget.duration || 0);
                    setViewerCurrentTime(event.currentTarget.currentTime || 0);
                  }}
                  onTimeUpdate={(event) => {
                    setViewerCurrentTime(event.currentTarget.currentTime || 0);
                    setViewerDuration(event.currentTarget.duration || 0);
                  }}
                  onPlay={() => setViewerPlaying(true)}
                  onPause={() => setViewerPlaying(false)}
                  onEnded={() => setViewerPlaying(false)}
                  onClick={() => setViewerPlaying((value) => !value)}
                />
              ) : (
                <img
                  src={viewerAsset.cdnUrl}
                  alt=""
                  className="h-full max-h-full w-full max-w-[680px] object-contain"
                />
              )}
            </div>

            {viewerIsVideo ? (
              <div className="mx-auto w-full max-w-[640px] px-4 pb-3 pt-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setViewerPlaying((value) => !value)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                    aria-label={viewerPlaying ? "Pause video" : "Play video"}
                  >
                    <img
                      src={viewerPlaying ? PAUSE_ICON_SRC : PLAY_ICON_SRC}
                      alt=""
                      className="h-5 w-5 object-contain"
                      loading="lazy"
                    />
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={Math.max(viewerDuration, 0.01)}
                    step={0.1}
                    value={Math.min(viewerCurrentTime, Math.max(viewerDuration, 0.01))}
                    onChange={(event) => handleSeek(Number(event.currentTarget.value))}
                    className="h-1.5 w-full cursor-pointer accent-white"
                    aria-label="Seek video"
                  />

                  <span className="min-w-[110px] text-right text-[21px] font-medium tabular-nums text-white">
                    {formatClock(viewerCurrentTime)}/{formatClock(viewerDuration)}
                  </span>

                  <button
                    type="button"
                    onClick={() => setViewerMuted((value) => !value)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                    aria-label={viewerMuted ? "Unmute video" : "Mute video"}
                  >
                    <img
                      src={viewerMuted ? MUTE_ICON_SRC : VOLUME_ICON_SRC}
                      alt=""
                      className="h-5 w-5 object-contain"
                      loading="lazy"
                    />
                  </button>
                </div>
              </div>
            ) : null}

            {viewerFooter ? <div className="mx-auto w-full max-w-[640px] px-4 pb-6">{viewerFooter}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
