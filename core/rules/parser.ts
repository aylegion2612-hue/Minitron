export type ParsedRule = {
  type: "block" | "confirm" | "log" | "allow";
  scope: "all" | "file" | "network" | "exec" | "payment";
  value: string;
};

export function parseNaturalLanguageRule(input: string): ParsedRule {
  const normalized = input.trim();
  const lower = normalized.toLowerCase();
  const words = lower.split(/\s+/);

  const typeWord = words.find((word) => ["block", "confirm", "log", "allow"].includes(word));
  const type = (typeWord as ParsedRule["type"] | undefined) ?? "block";

  const scopeWord = words.find((word) => ["all", "file", "network", "exec", "payment"].includes(word));
  const scope = (scopeWord as ParsedRule["scope"] | undefined) ?? "all";

  const quotedMatch = normalized.match(/"([^"]+)"/);
  const colonIndex = normalized.indexOf(":");

  let value = "*";
  if (quotedMatch?.[1]) {
    value = quotedMatch[1].trim();
  } else if (colonIndex >= 0) {
    value = normalized.slice(colonIndex + 1).trim() || "*";
  } else {
    const leadingDirective = new RegExp(
      `^(?:${type})(?:\\s+${scope})?\\s*`,
      "i",
    );
    value = normalized.replace(leadingDirective, "").trim() || "*";
  }

  return { type, scope, value };
}
