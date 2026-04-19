import fs from "node:fs";
import path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const appRoot = path.resolve(scriptDir, "..");

const targetFiles = [
  "src/views/CustomerDashboardPage.tsx",
  "src/features/fields/pages/FieldDetailPage.tsx",
  "src/features/operations/pages/OperationDetailPage.tsx",
];

const forbiddenTokens = [
  "field_sensing_overview_v1",
  "field_fertility_state_v1",
  "source_observation_ids",
  "execution_trace",
  "skill_trace",
  "trace_gap",
  "/api/v1/",
];

const highWeightLinePattern = /(title\s*=|sectionTitle|decisionItemTitle|decisionItemMeta|<h[1-6]|eyebrow\s*=|description\s*=)/;
const offenders = [];

for (const relativeFile of targetFiles) {
  const fullPath = path.join(appRoot, relativeFile);
  if (!fs.existsSync(fullPath)) {
    offenders.push({
      file: relativeFile,
      line: 0,
      token: "<missing-file>",
      snippet: "Target file does not exist",
    });
    continue;
  }

  const lines = fs.readFileSync(fullPath, "utf8").split("\n");

  lines.forEach((lineText, index) => {
    if (!highWeightLinePattern.test(lineText)) return;

    for (const token of forbiddenTokens) {
      if (!lineText.includes(token)) continue;
      offenders.push({
        file: relativeFile,
        line: index + 1,
        token,
        snippet: lineText.trim(),
      });
    }
  });
}

if (offenders.length > 0) {
  console.error("❌ Customer-facing boundary check failed:");
  console.error("   Do not expose internal object names in customer-facing high-weight fields.");
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} [${offender.token}] ${offender.snippet}`);
  }
  process.exit(1);
}

console.log("✅ Customer-facing boundary check passed.");
