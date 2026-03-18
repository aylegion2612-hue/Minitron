import crypto from "node:crypto";
import { db } from "../db/client";
import type { ParsedRule } from "./parser";

export function createRule(name: string, parsedRule: ParsedRule): string {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO rules (id, name, rule_type, scope, value, enabled)
     VALUES (@id, @name, @type, @scope, @value, 1)`,
  ).run({
    id,
    name,
    type: parsedRule.type,
    scope: parsedRule.scope,
    value: parsedRule.value,
  });

  return id;
}

export type StoredRule = {
  id: string;
  name: string;
  rule_type: "block" | "confirm" | "log" | "allow";
  scope: "all" | "file" | "network" | "exec" | "payment";
  value: string;
  enabled: number;
};

export function listEnabledRules(): StoredRule[] {
  return db
    .prepare("SELECT id, name, rule_type, scope, value, enabled FROM rules WHERE enabled = 1")
    .all() as StoredRule[];
}

export function listRules(): StoredRule[] {
  return db
    .prepare("SELECT id, name, rule_type, scope, value, enabled FROM rules ORDER BY created_at DESC")
    .all() as StoredRule[];
}

export function updateRule(
  id: string,
  updates: Partial<{
    name: string;
    ruleType: StoredRule["rule_type"];
    scope: StoredRule["scope"];
    value: string;
    enabled: number;
  }>,
): boolean {
  const current = db
    .prepare("SELECT id, name, rule_type, scope, value, enabled FROM rules WHERE id = ?")
    .get(id) as StoredRule | undefined;

  if (!current) {
    return false;
  }

  const next = {
    name: updates.name ?? current.name,
    rule_type: updates.ruleType ?? current.rule_type,
    scope: updates.scope ?? current.scope,
    value: updates.value ?? current.value,
    enabled: updates.enabled ?? current.enabled,
  };

  db.prepare(
    `UPDATE rules
     SET name = @name, rule_type = @rule_type, scope = @scope, value = @value, enabled = @enabled
     WHERE id = @id`,
  ).run({
    id,
    ...next,
  });

  return true;
}
