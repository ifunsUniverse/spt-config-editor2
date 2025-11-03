import JSON5 from "json5";

export interface ConfigValue {
  key: string;
  value: any;
  type: "boolean" | "string" | "number" | "select" | "keybind";
  description?: string;
  options?: string[];
}

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

export const jsonToConfigValues = (json: any, prefix = ""): ConfigValue[] => {
  const vals: ConfigValue[] = [];
  for (const [key, value] of Object.entries(json)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "boolean") {
      vals.push({ key: fullKey, value, type: "boolean" });
    } else if (typeof value === "number") {
      vals.push({ key: fullKey, value, type: "number" });
    } else if (typeof value === "string") {
      vals.push({ key: fullKey, value, type: "string" });
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      vals.push(...jsonToConfigValues(value, fullKey));
    }
  }
  return vals;
};
