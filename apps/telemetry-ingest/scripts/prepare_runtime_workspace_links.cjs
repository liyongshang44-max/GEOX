const fs = require("node:fs");
const path = require("node:path");

/**
 * B-04b4r1 packaging bridge.
 *
 * telemetry-ingest still imports a bounded server sensing pipeline while the
 * semantic convergence work is additive. The emitted server modules require
 * @geox/device-skills at runtime, but changing pnpm-lock.yaml would mutate an
 * MCFT-frozen dependency-graph input.
 *
 * Keep that cross-package runtime dependency explicit inside the emitted
 * telemetry artifact without changing repository dependency authority.
 */
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const geoxRuntimeModules = path.join(appRoot, "dist", "node_modules", "@geox");

fs.mkdirSync(geoxRuntimeModules, { recursive: true });

const links = [
  {
    name: "device-skills",
    target: path.join(repoRoot, "packages", "device-skills"),
  },
];

for (const entry of links) {
  const linkPath = path.join(geoxRuntimeModules, entry.name);
  fs.rmSync(linkPath, { recursive: true, force: true });
  const target = process.platform === "win32"
    ? entry.target
    : path.relative(path.dirname(linkPath), entry.target);
  fs.symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}

console.log("TELEMETRY_RUNTIME_WORKSPACE_LINKS_READY", links.map((x) => x.name).join(","));
