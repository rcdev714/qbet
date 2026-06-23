/**
 * Compute SHA-256 content_hash values for policy_versions rows.
 * Run: npm run policy:hashes
 */
import { POLICY_DOCUMENTS_BY_JURISDICTION } from "../lib/legal/policy-content";
import { EC_SPANISH_POLICY_DOCUMENTS } from "../lib/legal/policy-content-es-ec";
import { US_SPANISH_POLICY_DOCUMENTS } from "../lib/legal/policy-content-es-us";
import { computePolicyContentHashSync } from "../lib/legal/policy-hash";

function printHashes(label: string, docs: Record<string, { kind: string; title: string; version: string; route: string; jurisdiction: string }>) {
  console.log(`\n# ${label}\n`);
  for (const doc of Object.values(docs)) {
    const hash = computePolicyContentHashSync(doc as any);
    console.log(
      `  ('${doc.kind}', '${doc.version}', '${doc.title.replace(/'/g, "''")}', '${doc.route}', '${hash}', true, now(), '${doc.jurisdiction}'),`,
    );
  }
}

printHashes("US English policies", POLICY_DOCUMENTS_BY_JURISDICTION.US);
printHashes("EC Spanish policies", EC_SPANISH_POLICY_DOCUMENTS);
printHashes("US Spanish policies", US_SPANISH_POLICY_DOCUMENTS);
