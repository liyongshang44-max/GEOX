#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function findBuiltLifecycleFile(root) {
  const wanted = "mcft_cap09_production_process_lifecycle_v1.js";
  const hits = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name === wanted) hits.push(p);
    }
  }

  walk(path.join(root, "apps", "server", "dist"));

  if (hits.length !== 1) {
    throw new Error(`BUILT_LIFECYCLE_FILE_CARDINALITY:${hits.length}:${hits.join(",")}`);
  }

  return hits[0];
}

async function main() {
  const built = findBuiltLifecycleFile(process.cwd());
  const mod = await import(pathToFileURL(built).href);
  const classifier = new mod.McftCap09ProductionEvidenceFailureClassifierV1();

  const cases = [
    {
      token: "MCFT_CAP09_KBS_RAW_HOURLY_NON_CSV_PAYLOAD:GRIB",
      expected: "ATTEMPT_REJECTED",
    },
    {
      token: "MCFT_CAP09_KBS_RAW_HOURLY_INVALID_UTF8",
      expected: "ATTEMPT_REJECTED",
    },
  ];

  for (const item of cases) {
    const err = new Error(item.token);
    err.failure_token = item.token;
    err.diagnostic_token = item.token;
    err.code = "MCFT_CAP09_KBS_SCIENTIFIC_SUBPROCESS_FAILED";

    const actual = classifier.classify(err);

    console.log(JSON.stringify({
      token: item.token,
      classification: actual,
      expected: item.expected,
    }));

    assert.equal(actual, item.expected);
  }

  console.log(JSON.stringify({
    acceptance: "PASS",
    contract: "MCFT_CAP09_KBS_NON_CSV_CLASSIFIER_REPLAY_V1",
    process_fatal: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
