import { listEnabledRules } from "./store";

export type RuleDecision = {
  blocked: boolean;
  requiresConfirmation: boolean;
  reasons: string[];
  matchedRuleIds: string[];
};

type RuleEvalInput = {
  content: string;
  confirmedRuleIds?: string[];
};

export function evaluateRules(input: RuleEvalInput): RuleDecision {
  const confirmed = new Set(input.confirmedRuleIds ?? []);
  const rules = listEnabledRules();
  const reasons: string[] = [];
  const matchedRuleIds: string[] = [];
  let blocked = false;
  let requiresConfirmation = false;
  const content = input.content.toLowerCase();

  for (const rule of rules) {
    const matches =
      rule.value === "*" || content.includes(rule.value.toLowerCase());
    if (!matches) {
      continue;
    }

    reasons.push(`${rule.rule_type}:${rule.scope}:${rule.name}`);
    matchedRuleIds.push(rule.id);

    if (rule.rule_type === "block") {
      blocked = true;
    } else if (rule.rule_type === "confirm" && !confirmed.has(rule.id)) {
      requiresConfirmation = true;
    }
  }

  return { blocked, requiresConfirmation, reasons, matchedRuleIds };
}
