import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const operationsApiSource = readFileSync(resolve("apps/web/src/api/operations.ts"), "utf8");
const operationsPageSource = readFileSync(resolve("apps/web/src/features/operations/pages/OperationsPage.tsx"), "utf8");

test("manual operation API uses POST /api/v1/operations/manual with dedupe", () => {
  assert.match(operationsApiSource, /createManualOperation\(/);
  assert.match(operationsApiSource, /"\/api\/v1\/operations\/manual"/);
  assert.match(operationsApiSource, /method:\s*"POST"/);
  assert.match(operationsApiSource, /dedupe:\s*true/);
});

test("operations page keeps stable command_id and blocks no-command_id submit path", () => {
  assert.match(operationsPageSource, /useState\(\(\) => uuidv4\(\)\)/);
  assert.match(operationsPageSource, /if \(!normalizedCommandId\)/);
  assert.match(operationsPageSource, /command_id:\s*normalizedCommandId/);
});

test("double click is guarded by in-flight state so only one create runs at a time", () => {
  assert.match(operationsPageSource, /if \(isCreating\) return;/);
  assert.match(operationsPageSource, /setIsCreating\(true\)/);
  assert.match(operationsPageSource, /setIsCreating\(false\)/);
});
