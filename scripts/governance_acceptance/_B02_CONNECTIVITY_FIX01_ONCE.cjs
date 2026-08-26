#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const targetRoot = path.resolve(process.argv[2] || ".");
const baseDir = path.join(targetRoot, "docs/architecture/semantic_convergence");
const registerPath = path.join(baseDir, "GEOX-SEMANTIC-OWNERSHIP-REGISTER-V1.json");
const graphPath = path.join(baseDir, "GEOX-PARALLEL-AUTHORITY-GRAPH-V1.json");

const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
let fixedProducer = false;
for (const semantic of register.semantics || []) {
  for (const producer of semantic.registered_producers || []) {
    if (producer.producer_id === "derived-sensing-state-service") {
      producer.grandfathered_runtime_consumers = Array.from(new Set([
        ...(producer.grandfathered_runtime_consumers || []),
        "decision-engine-state",
      ]));
      producer.new_runtime_consumer_creation = "FORBIDDEN";
      fixedProducer = true;
    }
  }
}
if (!fixedProducer) throw new Error("FIX01_DERIVED_SENSING_PRODUCER_NOT_FOUND");
fs.writeFileSync(registerPath, JSON.stringify(register, null, 2) + "\n");

const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const edge = (graph.current_connectivity_edges || []).find((x) => x.edge_id === "C-027");
if (!edge) throw new Error("FIX01_C027_NOT_FOUND");
edge.evidence.callee_path = "apps/server/src/services/derived_sensing_state_v1.ts";
edge.evidence.fingerprint = "getLatestDerivedSensingStatesByFieldV1 imported via emitted .js specifier from the TypeScript source";
fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + "\n");

console.log("B02_CONNECTIVITY_FIX01_APPLIED");
