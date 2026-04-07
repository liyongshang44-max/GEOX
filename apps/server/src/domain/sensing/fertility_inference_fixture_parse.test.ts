import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const contractModule = require("../../../../../packages/contracts/src/schema/fertility_inference_v1.js");
const fixturesDir = path.resolve(__dirname, "../../../../../packages/contracts/fixtures");

const fixtureFiles = [
  "fertility_inference_v1_normal.json",
  "fertility_inference_v1_dry.json",
  "fertility_inference_v1_high_salinity.json",
];

test("fertility inference fixtures can be parsed by shared contracts schema", () => {
  const schema = contractModule.FertilityInferenceV1ResultSchema;
  assert.ok(schema, "FertilityInferenceV1ResultSchema should be exported");
  for (const file of fixtureFiles) {
    const fullPath = path.join(fixturesDir, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = schema.safeParse(JSON.parse(raw));
    assert.equal(parsed.success, true, `fixture parse failed: ${file}`);
  }
});
