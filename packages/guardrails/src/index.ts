import path from "node:path";
import { checkForbiddenWords } from "./checks/check_forbidden_words";
import { checkServerInvariants } from "./checks/check_server_invariants";
import { checkContractUnits } from "./checks/check_contract_units";

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const hits = [
    ...checkForbiddenWords(repoRoot),
    ...checkServerInvariants(repoRoot),
    ...checkContractUnits(repoRoot),
  ];

  if (hits.length) {
    console.error("Guardrails FAILED:");
    for (const h of hits) console.error(" -", h);
    process.exit(1);
  }
  console.log("Guardrails OK");
}

if (require.main === module) main();
