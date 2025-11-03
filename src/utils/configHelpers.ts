import JSON5 from "json5";

export interface ConfigFormField {
  key: string;
  value: any;
  type: "boolean" | "number" | "string" | "select";
  description?: string;
  options?: string[];
}

export const parseConfigWithMetadata = (rawText: string): any => {
  const lines = rawText.split("\n");

  const commentMap: Record<string, string> = {};
  let lastComment: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("//")) {
      lastComment.push(trimmed.replace("//", "").trim());
    } else {
      // ex:   "lootMultiplier": 10,
      const keyMatch = trimmed.match(/"(.+?)"\s*:/);
      if (keyMatch && lastComment.length > 0) {
        commentMap[keyMatch[1]] = lastComment.join(" ");
        lastComment = [];
      }
    }
  });

  const parsed = JSON5.parse(rawText);
  return { parsed, metadata: commentMap };
};
