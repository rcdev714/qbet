export type MentionQueryState = {
  active: boolean;
  query: string;
  triggerStart: number;
};

export function detectMentionQuery(text: string, cursorPosition?: number): MentionQueryState | null {
  const cursor = cursorPosition ?? text.length;
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");

  if (atIndex === -1) {
    return null;
  }

  const charBefore = atIndex > 0 ? beforeCursor[atIndex - 1] : " ";
  if (charBefore.trim().length > 0 && charBefore !== "\n") {
    return null;
  }

  const query = beforeCursor.slice(atIndex + 1);
  if (query.includes("\n") || query.includes(" ")) {
    return null;
  }

  return {
    active: true,
    query,
    triggerStart: atIndex,
  };
}

export function stripMentionTrigger(text: string, triggerStart: number): string {
  const atEnd = triggerStart + 1;
  let end = atEnd;
  while (end < text.length && text[end] !== " " && text[end] !== "\n") {
    end += 1;
  }
  return `${text.slice(0, triggerStart)}${text.slice(end)}`;
}
