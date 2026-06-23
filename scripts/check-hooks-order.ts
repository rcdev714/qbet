/**
 * Sanity check: no React component calls hooks after a top-level early return.
 * Catches the MarketScreen-class bug (hooks after `if (loading) return ...`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SCAN_DIRS = ["screens", "app", "components", "contexts"];

const HOOK =
  /\b(React\.)?(use(?:State|Effect|Memo|Callback|Ref|Reducer|LayoutEffect|InsertionEffect|Id|DeferredValue|Transition|SyncExternalStore)|use(?:FocusEffect|Market|Group|Messages|Wallet|Auth|Theme|AppLocale|PremiumNavigation|GroupMarkets|GroupMembers))\s*\(/;

const COMPONENT_START =
  /^(export )?(default )?(function \w+|const \w+ = .*=> \{)/;

type Violation = {
  file: string;
  component: string;
  earlyReturnLine: number;
  hooksAfter: { line: number; hook: string }[];
};

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...walkTsx(path));
    } else if (entry.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

function scanFile(filePath: string): Violation[] {
  const rel = filePath.replace(`${ROOT}/`, "");
  const lines = readFileSync(filePath, "utf8").split("\n");
  const violations: Violation[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!COMPONENT_START.test(line.trim()) && !line.includes("export function")) {
      i += 1;
      continue;
    }

    const component = line.trim().slice(0, 72);
    let j = i;
    while (j < lines.length && !lines[j].includes("{")) j += 1;
    if (j >= lines.length) {
      i += 1;
      continue;
    }

    let depth = 0;
    const hooks: { line: number; hook: string }[] = [];
    const earlyReturns: number[] = [];
    let k = j;

    while (k < lines.length) {
      const l = lines[k];
      for (const ch of l) {
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
      }

      if (depth === 1) {
        const hookMatch = HOOK.exec(l);
        if (hookMatch) {
          hooks.push({ line: k + 1, hook: hookMatch[0].replace("React.", "").replace("(", "") });
        }
        const stripped = l.trim();
        if (stripped.startsWith("if ")) {
          for (let m = k; m < Math.min(k + 6, lines.length); m += 1) {
            if (/^\s+return\s+[<(]/.test(lines[m])) {
              earlyReturns.push(k + 1);
              break;
            }
          }
        }
      }

      if (depth === 0 && k > j) break;
      k += 1;
    }

    if (earlyReturns.length > 0) {
      const lastEarly = Math.max(...earlyReturns);
      const hooksAfter = hooks.filter((h) => h.line > lastEarly);
      if (hooksAfter.length > 0) {
        violations.push({
          file: rel,
          component,
          earlyReturnLine: lastEarly,
          hooksAfter,
        });
      }
    }

    i = k > i ? k : i + 1;
  }

  return violations;
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walkTsx(join(ROOT, d)));
  const all = files.flatMap(scanFile);

  if (all.length === 0) {
    console.log(`hooks-order: OK (${files.length} files scanned, no violations)`);
    return;
  }

  console.error("hooks-order: FAILED — hooks called after component early returns:\n");
  for (const v of all) {
    console.error(`  ${v.file}`);
    console.error(`    ${v.component}`);
    console.error(`    early return near line ${v.earlyReturnLine}`);
    for (const h of v.hooksAfter) {
      console.error(`    hook after return: line ${h.line} (${h.hook})`);
    }
    console.error("");
  }
  process.exit(1);
}

main();
