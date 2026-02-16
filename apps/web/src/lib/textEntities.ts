export type TextEntityType = "hashtag" | "mention" | "url";

export type TextEntityMatch = {
  type: TextEntityType;
  start: number;
  end: number;
  text: string;
};

export type TextSegment =
  | {
      type: "text";
      text: string;
      start: number;
      end: number;
    }
  | {
      type: "entity";
      entity: TextEntityMatch;
    };

const HASHTAG_PATTERN = /#\w+/g;
const MENTION_PATTERN = /@[A-Za-z0-9_]+/g;
const URL_PATTERN = /https?:\/\/\S+/gi;
const WORD_CHAR_PATTERN = /\w/;
const URL_TRAILING_PUNCTUATION = /[),.!?:;\]]+$/;

function collectMatches(
  source: string,
  pattern: RegExp,
  type: TextEntityType,
  filter?: (match: RegExpExecArray) => boolean,
  transform?: (value: string) => string
): TextEntityMatch[] {
  const matches: TextEntityMatch[] = [];
  pattern.lastIndex = 0;

  let result = pattern.exec(source);
  while (result) {
    if (!filter || filter(result)) {
      const raw = result[0] ?? "";
      const transformed = transform ? transform(raw) : raw;
      const lengthDelta = raw.length - transformed.length;
      const start = result.index;
      const end = start + raw.length - lengthDelta;

      if (transformed.length > 0 && end > start) {
        matches.push({
          type,
          start,
          end,
          text: transformed,
        });
      }
    }
    result = pattern.exec(source);
  }

  return matches;
}

export function extractTextEntityMatches(source: string): TextEntityMatch[] {
  if (!source) return [];

  const urlMatches = collectMatches(
    source,
    URL_PATTERN,
    "url",
    undefined,
    (value) => value.replace(URL_TRAILING_PUNCTUATION, "")
  );

  const hashtagMatches = collectMatches(source, HASHTAG_PATTERN, "hashtag");

  const mentionMatches = collectMatches(
    source,
    MENTION_PATTERN,
    "mention",
    (match) => {
      const mentionStart = match.index;
      const previousChar = mentionStart > 0 ? source.charAt(mentionStart - 1) : "";
      return !WORD_CHAR_PATTERN.test(previousChar);
    }
  );

  const candidates = [...urlMatches, ...hashtagMatches, ...mentionMatches];
  candidates.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    const leftLength = left.end - left.start;
    const rightLength = right.end - right.start;
    return rightLength - leftLength;
  });

  const accepted: TextEntityMatch[] = [];
  let currentEnd = 0;

  for (const candidate of candidates) {
    if (candidate.start < currentEnd) continue;
    accepted.push(candidate);
    currentEnd = candidate.end;
  }

  return accepted;
}

export function splitTextIntoSegments(source: string): TextSegment[] {
  if (!source) return [];

  const entities = extractTextEntityMatches(source);
  if (entities.length === 0) {
    return [
      {
        type: "text",
        text: source,
        start: 0,
        end: source.length,
      },
    ];
  }

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const entity of entities) {
    if (entity.start > cursor) {
      segments.push({
        type: "text",
        text: source.slice(cursor, entity.start),
        start: cursor,
        end: entity.start,
      });
    }

    segments.push({
      type: "entity",
      entity,
    });

    cursor = entity.end;
  }

  if (cursor < source.length) {
    segments.push({
      type: "text",
      text: source.slice(cursor),
      start: cursor,
      end: source.length,
    });
  }

  return segments;
}

export function normalizeTappedHashtag(value: string): string {
  return value.trim().replace(/^#/, "").trim();
}

export function normalizeTappedMention(value: string): string {
  return value.trim().replace(/^@/, "").trim().toLowerCase();
}
