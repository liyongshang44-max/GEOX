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

function hasNearby(lines, lineIndex, pattern, distance = 80) {
  const from = Math.max(0, lineIndex - distance);
  const to = Math.min(lines.length - 1, lineIndex + distance);
  for (let i = from; i <= to; i += 1) {
    if (pattern.test(lines[i])) return true;
  }
  return false;
}

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

  if (relativeFile === "src/features/operations/pages/OperationDetailPage.tsx") {
    lines.forEach((lineText, index) => {
      const trimmed = lineText.trim();

      const rollbackBlockedTokens = [
        "title=\"Skill Trace\"",
        ">Skill Trace<",
        "\"Skill Trace\"",
        "title=\"Detail Aside\"",
        ">Detail Aside<",
        "\"Detail Aside\"",
      ];
      for (const token of rollbackBlockedTokens) {
        if (!lineText.includes(token)) continue;
        offenders.push({
          file: relativeFile,
          line: index + 1,
          token,
          snippet: "Forbidden rollback token in OperationDetailPage",
        });
      }

      // 来源与解释 / 审计附录必须是折叠技术区内容，不允许普通 sectionTitle 直接上屏。
      if (trimmed.includes('<div className="sectionTitle">来源与解释</div>')) {
        offenders.push({
          file: relativeFile,
          line: index + 1,
          token: "来源与解释",
          snippet: "来源与解释 must be inside collapsed technical appendix",
        });
      }
      if (trimmed.includes('<div className="sectionTitle">审计附录</div>')) {
        offenders.push({
          file: relativeFile,
          line: index + 1,
          token: "审计附录",
          snippet: "审计附录 must be collapsed by default",
        });
      }

      // 技术对象应处于“技术附录（默认关闭）”附近。
      if (trimmed.includes("<OperationSkillTraceCard")) {
        const nearTechnicalAppendix = hasNearby(lines, index, /CollapsibleModule\s+title="技术附录（默认关闭）"/, 120);
        if (!nearTechnicalAppendix) {
          offenders.push({
            file: relativeFile,
            line: index + 1,
            token: "OperationSkillTraceCard",
            snippet: "OperationSkillTraceCard must stay inside collapsed technical appendix",
          });
        }
      }

      // Task ID 不允许在普通“执行过程”主区的 operationsSummaryMetric 中出现。
      if (trimmed.includes("Task ID")) {
        const nearTechnicalExecution = hasNearby(lines, index, /CollapsibleModule\s+title="执行过程（技术字段）"/, 60);
        const nearMainExecution = hasNearby(lines, index, /<div className="sectionTitle">执行过程<\/div>/, 60);
        if (!nearTechnicalExecution || nearMainExecution) {
          offenders.push({
            file: relativeFile,
            line: index + 1,
            token: "Task ID",
            snippet: "Task ID must be hidden in technical appendix only",
          });
        }
      }

      // 规则 ID / 规则版本只能作为折叠技术区字段展示，不可在主 sectionTitle 中出现。
      if ((trimmed.includes("规则 ID") || trimmed.includes("规则版本")) && trimmed.includes("sectionTitle")) {
        offenders.push({
          file: relativeFile,
          line: index + 1,
          token: trimmed.includes("规则 ID") ? "规则 ID" : "规则版本",
          snippet: "Rule identifiers/versions must not appear as main-view section titles",
        });
      }
    });
  }
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
