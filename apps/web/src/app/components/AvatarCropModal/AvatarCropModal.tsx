import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const CROP_SIZE = 248;
const OUTPUT_SIZE = 1024;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type AvatarCropModalProps = {
  open: boolean;
  imageSrc: string | null;
  title?: string;
  isApplying?: boolean;
  onCancel: () => void;
  onApply: (file: File, previewUrl: string) => void | Promise<void>;
};

type DragState = {
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
} | null;

export function AvatarCropModal({
  open,
  imageSrc,
  title = "Adjust photo",
  isApplying = false,
  onCancel,
  onApply,
}: AvatarCropModalProps) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const dragStateRef = useRef<DragState>(null);

  useEffect(() => {
    if (!open) return;
    setNaturalSize(null);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open || !imageSrc) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const width = Number.isFinite(image.naturalWidth) ? image.naturalWidth : 0;
      const height = Number.isFinite(image.naturalHeight) ? image.naturalHeight : 0;
      if (width > 0 && height > 0) {
        setNaturalSize({ width, height });
      }
    };
    image.src = imageSrc;
    return () => {
      active = false;
    };
  }, [imageSrc, open]);

  const baseScale = useMemo(() => {
    if (!naturalSize) return 1;
    return Math.max(CROP_SIZE / naturalSize.width, CROP_SIZE / naturalSize.height);
  }, [naturalSize]);

  const renderScale = baseScale * zoom;
  const renderedWidth = naturalSize ? naturalSize.width * renderScale : CROP_SIZE;
  const renderedHeight = naturalSize ? naturalSize.height * renderScale : CROP_SIZE;

  const maxOffsetX = Math.max(0, (renderedWidth - CROP_SIZE) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - CROP_SIZE) / 2);

  const clampOffsets = useCallback(
    (x: number, y: number) => ({
      x: clamp(x, -maxOffsetX, maxOffsetX),
      y: clamp(y, -maxOffsetY, maxOffsetY),
    }),
    [maxOffsetX, maxOffsetY]
  );

  useEffect(() => {
    const next = clampOffsets(offsetX, offsetY);
    if (next.x !== offsetX) setOffsetX(next.x);
    if (next.y !== offsetY) setOffsetY(next.y);
  }, [clampOffsets, offsetX, offsetY]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
    };
  }, [offsetX, offsetY]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;
    const next = clampOffsets(dragStateRef.current.startOffsetX + deltaX, dragStateRef.current.startOffsetY + deltaY);
    setOffsetX(next.x);
    setOffsetY(next.y);
  }, [clampOffsets]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    try {
      (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
    } catch {
      // Ignore capture release failures.
    }
    dragStateRef.current = null;
  }, []);

  const handleApply = useCallback(async () => {
    if (!imageSrc || !naturalSize) return;
    const image = new Image();
    image.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const outputScale = OUTPUT_SIZE / CROP_SIZE;
      const drawWidth = naturalSize.width * renderScale * outputScale;
      const drawHeight = naturalSize.height * renderScale * outputScale;
      const drawX = (OUTPUT_SIZE - drawWidth) / 2 + offsetX * outputScale;
      const drawY = (OUTPUT_SIZE - drawHeight) / 2 + offsetY * outputScale;

      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      canvas.toBlob(
        async (blob) => {
          if (!blob) return;
          const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
          const previewUrl = URL.createObjectURL(blob);
          await onApply(file, previewUrl);
        },
        "image/jpeg",
        0.9
      );
    };
    image.src = imageSrc;
  }, [imageSrc, naturalSize, offsetX, offsetY, onApply, renderScale]);

  if (!open || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-border/70 bg-bg p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-strong">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">Drag and zoom to frame your profile photo.</p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative h-[280px] w-[280px] overflow-hidden touch-none rounded-2xl bg-black/75"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              src={imageSrc}
              alt="Crop preview"
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              draggable={false}
              style={{
                width: `${renderedWidth}px`,
                height: `${renderedHeight}px`,
                transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
              }}
            />

            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute left-1/2 top-1/2 rounded-full border-2 border-white/90"
                style={{
                  width: `${CROP_SIZE}px`,
                  height: `${CROP_SIZE}px`,
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-light" htmlFor="avatar-crop-zoom">
            Zoom
          </label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
            className="w-full accent-brand"
            disabled={isApplying}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="rounded-xl border border-border/70 px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={isApplying}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplying ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
