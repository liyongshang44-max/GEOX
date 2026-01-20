import fs from "node:fs";
import path from "node:path";

/**
 * Minimal "unit freeze" guard:
 * - docs must mention EC uses dS/m
 */
export function checkContractUnits(repoRoot: string): string[] {
  const hits: string[] = [];
  const doc = path.join(repoRoot, "docs", "Fact_Envelope_Contract_v1.md");
  if (!fs.existsSync(doc)) {
    hits.push(`missing contract doc: ${doc}`);
    return hits;
  }
  const txt = fs.readFileSync(doc, "utf-8");
  if (!txt.includes("dS/m")) hits.push("Contract doc must mention EC unit dS/m");
  return hits;
}
