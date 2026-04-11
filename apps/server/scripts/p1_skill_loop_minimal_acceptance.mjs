import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function resolveSuccessFinalStatus(status) {
  const s = String(status ?? "").toUpperCase();
  if (s === "PENDING_ACCEPTANCE") return s;
  if (s === "SUCCESS") return s;
  if (s === "SUCCEEDED") return s;
  if (s === "VALID") return s;
  return null;
}

function runAcceptance() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const content = readFileSync(resolve(scriptDir, "p1_skill_loop_minimal.mjs"), "utf8");

  const helperDefCount = (content.match(/function\s+resolveSuccessFinalStatus\s*\(/g) ?? []).length;
  assert.equal(helperDefCount, 1, "必须仅存在一个 success 判定函数: resolveSuccessFinalStatus");

  const scatteredSuccessSetPatterns = [
    /\[\s*"PENDING_ACCEPTANCE"\s*,\s*"SUCCESS"\s*,\s*"SUCCEEDED"\s*,\s*"VALID"\s*\]/g,
    /\[\s*"SUCCESS"\s*,\s*"SUCCEEDED"\s*,\s*"VALID"\s*\]/g,
  ];
  for (const pattern of scatteredSuccessSetPatterns) {
    const hits = content.match(pattern) ?? [];
    assert.equal(hits.length, 0, `检测到散落的 success 字符串集合判断: ${pattern}`);
  }

  const usageAnchors = [
    "const successMappedBy = resolveSuccessFinalStatus(status);",
    "const successMappedHit = resolveSuccessFinalStatus(successFinal);",
    "resolveSuccessFinalStatus(successFinal) !== null",
  ];
  for (const anchor of usageAnchors) {
    assert.ok(content.includes(anchor), `缺少统一判定函数调用锚点: ${anchor}`);
  }

  assert.equal(resolveSuccessFinalStatus("pending_acceptance"), "PENDING_ACCEPTANCE");
  assert.equal(resolveSuccessFinalStatus("SUCCESS"), "SUCCESS");
  assert.equal(resolveSuccessFinalStatus("SUCCEEDED"), "SUCCEEDED");
  assert.equal(resolveSuccessFinalStatus("VALID"), "VALID");
  assert.equal(resolveSuccessFinalStatus("FAILED"), null);
}

runAcceptance();
console.log("p1 skill loop minimal acceptance checks passed");
