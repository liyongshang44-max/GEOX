#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const webRoot = path.resolve(process.cwd());
const srcRoot = path.join(webRoot, "src");
const flightTableRoute = "/dev/flight-table";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(webRoot, relPath), "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".vite") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function rel(full) {
  return path.relative(webRoot, full).replace(/\\/g, "/");
}

function ensureNoFormalNavExposure(files) {
  const forbidden = [];
  for (const file of files) {
    const r = rel(file);
    if (!r.includes("src/features/customer") && !r.includes("src/features/operator") && !r.includes("src/app/routes/operatorRoutes")) continue;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes(flightTableRoute) || /FlightTablePage|flight-table/i.test(text)) forbidden.push(r);
  }
  assert(forbidden.length === 0, `/dev/flight-table must not enter customer/operator formal nav or feature pages: ${forbidden.join(", ")}`);
}

function ensureRouteOnlyInDevSurface() {
  const routeText = read("src/app/routes/dashboardRoutes.tsx");
  assert(routeText.includes(flightTableRoute), "dashboardRoutes must keep internal /dev/flight-table route registered");
  assert(routeText.includes("../../views/dev/FlightTablePage"), "FlightTablePage must live under views/dev");
}

function ensureNoCredentialSecret(files) {
  const allowedMaskedDisplay = new Set([
    "src/viewmodels/flightTableVm.ts",
    "src/api/flightTable.ts",
    "src/components/dev/flight-table/DeviceOnboardingWizard.tsx",
    "src/components/dev/flight-table/ManifestPanel.tsx",
  ]);
  const forbiddenSensitivePattern = new RegExp([
    "credential[_-]?secret",
    "raw[_-]?secret",
    "access[_-]?token",
    "private[_-]?key",
  ].join("|"), "i");
  const offenders = [];
  for (const file of files) {
    const r = rel(file);
    if (!r.includes("src/components/dev/flight-table") && !r.includes("src/views/dev") && !r.includes("src/api/flightTable") && !r.includes("src/viewmodels/flightTableVm")) continue;
    const text = fs.readFileSync(file, "utf8");
    if (forbiddenSensitivePattern.test(text)) offenders.push(r);
    if (/masked_secret/.test(text) && !allowedMaskedDisplay.has(r)) offenders.push(`${r} uses masked_secret outside approved adapter/viewmodel/manifest display boundary`);
  }
  assert(offenders.length === 0, `flight-table UI must not expose forbidden credential fields: ${offenders.join(", ")}`);

  const vm = read("src/viewmodels/flightTableVm.ts");
  assert(vm.includes('masked_secret: "****"'), "flightTableVm must mask credentials as ****");
  const api = read("src/api/flightTable.ts");
  assert(api.includes('masked_secret: "****"'), "flightTable API type must only expose masked_secret=****");
}

function ensureNoDebugRawSqlCalls(files) {
  const offenders = [];
  for (const file of files) {
    const r = rel(file);
    if (!r.includes("src/components/dev/flight-table") && !r.includes("src/views/dev") && !r.includes("src/api/flightTable")) continue;
    const text = fs.readFileSync(file, "utf8");
    if (/\/api\/v1\/(debug|admin|legacy|raw-sql|sql)|raw\s*sql/i.test(text)) offenders.push(r);
  }
  assert(offenders.length === 0, `flight-table UI must not call debug/admin/legacy/raw SQL APIs directly: ${offenders.join(", ")}`);
}

function ensureApiThroughFlightTableAdapters(files) {
  const offenders = [];
  for (const file of files) {
    const r = rel(file);
    if (!r.includes("src/components/dev/flight-table") && !r.includes("src/views/dev/FlightTablePage.tsx")) continue;
    const text = fs.readFileSync(file, "utf8");
    if (/\bfetch\s*\(/.test(text) || /apiRequest\s*</.test(text) || /axios\./.test(text)) offenders.push(r);
    if (/\/api\/v1\//.test(text)) offenders.push(`${r} contains raw /api/v1 path`);
  }
  assert(offenders.length === 0, `flight-table page/components must call APIs only through apps/web/src/api/flightTable* adapters: ${Array.from(new Set(offenders)).join(", ")}`);

  const apiFiles = [
    "src/api/flightTable.ts",
    "src/api/flightTableTelemetry.ts",
    "src/api/flightTableDecision.ts",
    "src/api/flightTableOperation.ts",
    "src/api/flightTableEvidence.ts",
    "src/api/flightTableReportLearning.ts",
  ];
  for (const r of apiFiles) {
    assert(fs.existsSync(path.join(webRoot, r)), `${r} must exist as flight-table adapter surface`);
  }
}

function main() {
  const files = walk(srcRoot);
  ensureRouteOnlyInDevSurface();
  ensureNoFormalNavExposure(files);
  ensureNoCredentialSecret(files);
  ensureNoDebugRawSqlCalls(files);
  ensureApiThroughFlightTableAdapters(files);
  console.log("flight-table frontend boundary check passed", {
    route: flightTableRoute,
    scanned_files: files.length,
  });
}

try {
  main();
} catch (error) {
  console.error("flight-table frontend boundary check failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
