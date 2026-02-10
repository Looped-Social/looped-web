function asMediaId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function readMediaArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const id = asMediaId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function extractMediaAssetIds(source: Record<string, unknown>): string[] {
  const snake = readMediaArray(source.media_asset_ids);
  const camel = readMediaArray(source.mediaAssetIds);
  const fromArray = snake.length > 0 ? snake : camel;

  const collected: string[] = [];
  const seen = new Set<string>();

  for (const id of fromArray) {
    if (seen.has(id)) continue;
    seen.add(id);
    collected.push(id);
  }

  const single =
    asMediaId(source.media_asset_id) ??
    asMediaId(source.mediaAssetId);
  if (single && !seen.has(single)) {
    collected.push(single);
  }

  return collected;
}
