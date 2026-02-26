import { useMemo } from "react";

import { splitTextIntoSegments } from "@/lib/textEntities";

type EntityTextProps = {
  text: string;
  className?: string;
  hashtagClassName?: string;
  mentionClassName?: string;
  urlClassName?: string;
  onHashtagPress?: (value: string) => void | Promise<void>;
  onMentionPress?: (value: string) => void | Promise<void>;
};

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter((value): value is string => Boolean(value && value.trim().length > 0)).join(" ");
}

export function EntityText({
  text,
  className,
  hashtagClassName = "text-brand",
  mentionClassName = "text-brand",
  urlClassName = "text-brand underline underline-offset-2",
  onHashtagPress,
  onMentionPress,
}: EntityTextProps) {
  const segments = useMemo(() => splitTextIntoSegments(text), [text]);

  if (!text) return null;

  return (
    <p className={joinClasses("min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]", className)}>
      {segments.map((segment, index) => {
        const key = `${segment.type}-${index}`;

        if (segment.type === "text") {
          return <span key={key}>{segment.text}</span>;
        }

        const entity = segment.entity;
        if (entity.type === "url") {
          return (
            <a
              key={key}
              href={entity.text}
              className={joinClasses("font-[inherit]", urlClassName)}
              target="_blank"
              rel="noreferrer noopener"
            >
              {entity.text}
            </a>
          );
        }

        if (entity.type === "hashtag") {
          if (!onHashtagPress) {
            return (
              <span key={key} className={joinClasses("break-words [overflow-wrap:anywhere]", hashtagClassName)}>
                {entity.text}
              </span>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                void onHashtagPress(entity.text);
              }}
              className={joinClasses(
                "inline max-w-full cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] leading-[inherit] whitespace-normal break-words [overflow-wrap:anywhere]",
                hashtagClassName
              )}
            >
              {entity.text}
            </button>
          );
        }

        if (!onMentionPress) {
          return (
            <span key={key} className={joinClasses("break-words [overflow-wrap:anywhere]", mentionClassName)}>
              {entity.text}
            </span>
          );
        }

        return (
          <button
            key={key}
          type="button"
          onClick={() => {
            void onMentionPress(entity.text);
          }}
          className={joinClasses(
            "inline max-w-full cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] leading-[inherit] whitespace-normal break-words [overflow-wrap:anywhere]",
            mentionClassName
          )}
        >
          {entity.text}
        </button>
        );
      })}
    </p>
  );
}
