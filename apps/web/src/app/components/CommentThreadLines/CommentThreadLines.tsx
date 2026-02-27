import React from "react";

type CommentThreadLinesProps = {
  depth: number;
  ancestorHasNext: boolean[];
  isLast: boolean;
  avatarSizePx: number;
  rowTopInsetPx?: number;
  gutterPx?: number;
  columnPx?: number;
  maxColumns?: number;
  gapPx?: number;
  className?: string;
};

const DEFAULT_GUTTER_PX = 40;
const DEFAULT_COLUMN_PX = 8;
const DEFAULT_MAX_COLUMNS = 4;
const DEFAULT_GAP_PX = 10;
const DEFAULT_ELBOW_PX = 12;

function clampDepthToColumn(depthIndex: number, maxColumns: number) {
  return Math.min(depthIndex, Math.max(maxColumns - 1, 0));
}

function computeColumnX(columnIndex: number, columnPx: number, gutterPx: number, maxColumns: number) {
  // Right-align the depth columns so depth increases toward the avatar.
  // col(max-1) is closest to the avatar, col(0) is farthest left.
  const clamped = clampDepthToColumn(columnIndex, maxColumns);
  const rightMostX = gutterPx - columnPx / 2;
  return rightMostX - (maxColumns - 1 - clamped) * columnPx;
}

export function CommentThreadRails({
  depth,
  ancestorHasNext,
  isLast,
  avatarSizePx,
  rowTopInsetPx = 0,
  showChildTrunk = false,
  gutterPx = DEFAULT_GUTTER_PX,
  columnPx = DEFAULT_COLUMN_PX,
  maxColumns = DEFAULT_MAX_COLUMNS,
  gapPx = DEFAULT_GAP_PX,
}: Omit<CommentThreadLinesProps, "className"> & { showChildTrunk?: boolean }) {
  if (depth <= 0) return null;

  const normalizedMaxColumns = Math.max(1, maxColumns);
  const normalizedDepth = Math.max(1, depth);
  const currentColumn = clampDepthToColumn(normalizedDepth - 1, normalizedMaxColumns);
  const elbowY = rowTopInsetPx + avatarSizePx / 2;
  const elbowSize = Math.min(DEFAULT_ELBOW_PX, Math.max(6, Math.floor(avatarSizePx / 2)));
  const elbowTop = Math.max(0, elbowY - elbowSize);

  const columnHasAncestorLine: boolean[] = Array.from({ length: normalizedMaxColumns }, () => false);
  for (let ancestorIndex = 0; ancestorIndex < ancestorHasNext.length; ancestorIndex += 1) {
    if (!ancestorHasNext[ancestorIndex]) continue;
    const col = clampDepthToColumn(ancestorIndex, normalizedMaxColumns);
    columnHasAncestorLine[col] = true;
  }

  const railsBottom = isLast ? 0 : -gapPx;
  // Join into the avatar's left edge so the branch "stems" from the profile image.
  const avatarJoinX = gutterPx + 2;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0"
      style={{ width: gutterPx + avatarSizePx, bottom: railsBottom }}
    >
      {columnHasAncestorLine.map((active, colIndex) => {
        if (!active) return null;
        const x = computeColumnX(colIndex, columnPx, gutterPx, normalizedMaxColumns);
        return (
          <span
            key={`ancestor-${colIndex}`}
            className="absolute top-0 bottom-0 w-px bg-border/60"
            style={{ left: x }}
          />
        );
      })}

      {(() => {
        const x = computeColumnX(currentColumn, columnPx, gutterPx, normalizedMaxColumns);

        const segments: Array<React.ReactNode> = [];
        segments.push(
          <span key="seg-top" className="absolute w-px bg-border/60" style={{ left: x, top: 0, height: elbowTop }} />
        );

        const elbowWidth = Math.max(0, avatarJoinX - x);
        segments.push(
          <span
            key="elbow"
            className="absolute border-b border-l border-border/60"
            style={{
              left: x,
              top: elbowTop,
              width: elbowWidth,
              height: elbowSize,
              borderBottomLeftRadius: Math.min(8, Math.floor(elbowSize / 1.6)),
            }}
          />
        );

        if (!isLast) {
          segments.push(
            <span
              key="seg-bottom"
              className="absolute w-px bg-border/60"
              style={{ left: x, top: elbowY, bottom: 0 }}
            />
          );
        }

        return segments;
      })()}

      {showChildTrunk
        ? (() => {
          const childColumn = clampDepthToColumn(normalizedDepth, normalizedMaxColumns);
            const x = computeColumnX(childColumn, columnPx, gutterPx, normalizedMaxColumns);
            const parentX = computeColumnX(currentColumn, columnPx, gutterPx, normalizedMaxColumns);
            const joinLeft = Math.min(parentX, x);
            const joinWidth = Math.abs(parentX - x);

            return (
              <>
                {joinWidth > 0 ? (
                  <span
                    className="absolute h-px bg-border/60"
                    style={{ left: joinLeft, top: elbowY, width: joinWidth }}
                  />
                ) : null}
                <span className="absolute w-px bg-border/60" style={{ left: x, top: elbowY, bottom: 0 }} />
              </>
            );
          })()
        : null}
    </div>
  );
}

export function CommentThreadGutter({
  depth,
  ancestorHasNext,
  avatarSizePx,
  gutterPx = DEFAULT_GUTTER_PX,
  columnPx = DEFAULT_COLUMN_PX,
  maxColumns = DEFAULT_MAX_COLUMNS,
  className,
}: Omit<CommentThreadLinesProps, "gapPx" | "isLast">) {
  if (depth <= 0) return null;

  const normalizedMaxColumns = Math.max(1, maxColumns);
  const normalizedDepth = Math.max(1, depth);
  const currentColumn = clampDepthToColumn(normalizedDepth - 1, normalizedMaxColumns);
  const elbowY = avatarSizePx / 2;

  // If multiple depths collapse into the last column, keep the elbow on the last column
  // and show an ancestor line there if any ancestor needs it.
  const hasCollapsedAncestors =
    ancestorHasNext.length > normalizedMaxColumns &&
    ancestorHasNext.slice(normalizedMaxColumns - 1).some((value) => Boolean(value));
  const showCollapsedHint = hasCollapsedAncestors && currentColumn === normalizedMaxColumns - 1;

  const x = computeColumnX(currentColumn, columnPx, gutterPx, normalizedMaxColumns);

  return (
    <div aria-hidden="true" className={`relative shrink-0 ${className ?? ""}`} style={{ width: gutterPx }}>
      <span className="absolute h-px bg-border/60" style={{ left: x, top: elbowY, right: 0 }} />
      {showCollapsedHint ? (
        <span
          className="absolute h-1.5 w-1.5 rounded-full bg-border/70"
          style={{ left: x - 0.75, top: elbowY - 0.75 }}
        />
      ) : null}
    </div>
  );
}
