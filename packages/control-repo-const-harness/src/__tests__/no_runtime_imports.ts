import fs from "node:fs"; // FS: read package.json files for structural dependency guard.
import path from "node:path"; // Path join/resolution.

const HARNESS_PKG = "@geox/control-repo-const-harness"; // Package name to forbid in runtime modules.

type PkgJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function readJson(p: string): PkgJson {
  const txt = fs.readFileSync(p, "utf8"); // Read file bytes.
  return JSON.parse(txt) as PkgJson; // Parse JSON.
}

function hasDep(pkg: PkgJson): boolean {
  return Boolean(
    (pkg.dependencies && pkg.dependencies[HARNESS_PKG]) ||
      (pkg.devDependencies && pkg.devDependencies[HARNESS_PKG]) ||
      (pkg.optionalDependencies && pkg.optionalDependencies[HARNESS_PKG]) ||
      (pkg.peerDependencies && pkg.peerDependencies[HARNESS_PKG])
  ); // Check any dependency section for harness.
}

function walk(dir: string, out: string[]): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "dist") continue; // Skip huge/irrelevant dirs.
    const full = path.join(dir, ent.name); // Build child path.
    if (ent.isDirectory()) walk(full, out); // Recurse.
    else if (ent.isFile() && ent.name === "package.json") out.push(full); // Collect package.json.
  }
}

export function assertNoRuntimeDependsOnHarness(): void {
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", ".."); // Go to repo root.
  const candidates: string[] = [];

  // Scan the obvious runtime roots.
  for (const top of ["apps", "packages"]) {
    const p = path.join(repoRoot, top);
    if (fs.existsSync(p)) walk(p, candidates);
  }

  const violations: string[] = [];
  for (const pj of candidates) {
    const pkg = readJson(pj);

    // Allow self-dependency for this harness package only.
    if (pkg.name === HARNESS_PKG) continue;

    if (hasDep(pkg)) violations.push(pj);
  }

  if (violations.length > 0) {
    throw new Error(`runtime dependency violation: ${HARNESS_PKG} referenced by: ${violations.join(", ")}`);
  }
}

// Execute immediately when imported by test runner.
assertNoRuntimeDependsOnHarness();
console.log("control-repo-const-harness negative guard ok: no runtime package depends on harness");
