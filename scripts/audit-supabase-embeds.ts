#!/usr/bin/env npx tsx
/**
 * Flags PostgREST `.select()` embeds that omit explicit FK hints on ambiguous relations.
 * Run: npx tsx scripts/audit-supabase-embeds.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".expo",
  "coverage",
]);

/** Tables with multiple FKs to the same relation (must use !foreign_key_name). */
const AMBIGUOUS = [
  { table: "messages", relation: "users" },
  { table: "market_chat_messages", relation: "users" },
  { table: "messages", relation: "groups" },
  { table: "market_chat_messages", relation: "groups" },
  { table: "user_follows", relation: "users" },
  { table: "invites", relation: "users" },
  { table: "market_compliance_reviews", relation: "users" },
];

const RISKY_PATTERNS: { re: RegExp; message: string }[] = [
  {
    re: /creator:users\s*\(/,
    message: "Use creator:users!markets_creator_id_fkey(...) — import MARKET_WITH_CREATOR_SELECT",
  },
  {
    re: /(?<!:)\busers\s*\(\s*\*\s*\)/,
    message: "Use users:users!group_members_user_id_fkey(*) — import GROUP_MEMBERS_WITH_USER_SELECT",
  },
  {
    re: /follower:users!follower_id\b/,
    message: "Use follower:users!user_follows_follower_id_fkey(...) — import USER_FOLLOWS_FOLLOWER_SELECT",
  },
  {
    re: /:users\s*\([^)]*\)(?![^"']*!.*_fkey)/,
    message: "users embed without !*_fkey hint — check for ambiguous FK paths",
  },
  {
    re: /\.select\(\s*["'`][^"'`]*\bmarkets\s*\(\s*\*\s*\)/,
    message: "Prefer markets!bets_market_id_fkey(*) when selecting from bets",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (SKIP_DIRS.has(name)) continue;
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) {
      out.push(path);
    }
  }
  return out;
}

const findings: { file: string; line: number; message: string; snippet: string }[] = [];

for (const file of walk(ROOT)) {
  if (file.endsWith("lib/supabase-embeds.ts")) continue;
  if (file.endsWith("scripts/audit-supabase-embeds.ts")) continue;

  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    if (!line.includes(".select") && !line.includes("users(") && !line.includes("creator:users")) {
      return;
    }
    for (const { re, message } of RISKY_PATTERNS) {
      if (re.test(line)) {
        findings.push({
          file: relative(ROOT, file),
          line: index + 1,
          message,
          snippet: line.trim().slice(0, 120),
        });
      }
    }
  });
}

if (findings.length === 0) {
  console.log("audit-supabase-embeds: no risky embed patterns found.");
  process.exit(0);
}

console.error("audit-supabase-embeds: risky PostgREST embed patterns found:\n");
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}`);
  console.error(`    ${f.message}`);
  console.error(`    ${f.snippet}\n`);
}

console.error(
  "Ambiguous tables to watch when adding new FK columns:\n" +
    AMBIGUOUS.map((a) => `  - ${a.table} → ${a.relation}`).join("\n"),
);

process.exit(1);
