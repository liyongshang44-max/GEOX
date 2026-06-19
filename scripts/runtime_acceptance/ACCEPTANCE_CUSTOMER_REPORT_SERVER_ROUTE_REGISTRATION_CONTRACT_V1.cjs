// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_SERVER_ROUTE_REGISTRATION_CONTRACT_V1.cjs
// Purpose: verify customer report server routes are registered by the server startup path.
// Boundary: route files and projector contracts are insufficient if server startup no longer mounts them.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const SERVER_SRC_ROOT = "apps/server/src";
const PACKAGE_JSON_PATH = "package.json";
const SUITE_PATH = "scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_V1.cjs";

const SCRIPT_NAME = "ci:customer-report-server-route-registration-contract";
const SCRIPT_COMMAND =
  "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_SERVER_ROUTE_REGISTRATION_CONTRACT_V1.cjs";

const REQUIRED_ROUTE_MODULES = [
  {
    routePath: "apps/server/src/routes/reports_v1.ts",
    registerFunction: "registerReportsV1Routes",
    routeTokens: [
      "/api/v1/reports/operation/:operation_id",
      "/api/v1/reports/field/:field_id",
    ],
  },
  {
    routePath: "apps/server/src/routes/reports_dashboard_v1.ts",
    registerFunction: "registerReportsDashboardV1Routes",
    routeTokens: [
      "/api/v1/reports/customer-dashboard/aggregate",
    ],
  },
];

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

function walkTsFiles(absDir) {
  const out = [];

  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);

    if (entry.isDirectory()) {
      out.push(...walkTsFiles(abs));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(abs);
    }
  }

  return out;
}

function toRel(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, "/");
}

function readServerSources() {
  return walkTsFiles(path.join(ROOT, SERVER_SRC_ROOT)).map((absPath) => ({
    relPath: toRel(absPath),
    source: fs.readFileSync(absPath, "utf8").replace(/\r\n/g, "\n"),
  }));
}

function assertRouteModuleDefinition(routeModule) {
  const absPath = path.join(ROOT, routeModule.routePath);

  assert(fs.existsSync(absPath), "customer report route module missing", {
    routePath: routeModule.routePath,
  });

  const source = read(routeModule.routePath);

  assert(
    source.includes(routeModule.registerFunction),
    "customer report route module missing expected registration function",
    {
      routePath: routeModule.routePath,
      registerFunction: routeModule.registerFunction,
    }
  );

  for (const token of routeModule.routeTokens) {
    assert(source.includes(token), "customer report route module missing expected route token", {
      routePath: routeModule.routePath,
      token,
    });
  }
}

function assertRouteModuleRegistered(routeModule, serverSources) {
  const callPattern = new RegExp("\\b" + routeModule.registerFunction + "\\s*\\(");

  const nonDefinitionMatches = serverSources
    .filter((entry) => entry.relPath !== routeModule.routePath)
    .filter((entry) => callPattern.test(entry.source))
    .map((entry) => entry.relPath);

  assert(
    nonDefinitionMatches.length > 0,
    "customer report route registration function is not called outside its route module",
    {
      registerFunction: routeModule.registerFunction,
      routePath: routeModule.routePath,
      expected: "registered by server startup or route composition path",
    }
  );
}

function assertPackageScriptPinned() {
  const pkg = JSON.parse(read(PACKAGE_JSON_PATH));
  const actual = pkg.scripts && pkg.scripts[SCRIPT_NAME];

  assert(actual === SCRIPT_COMMAND, "customer report server route registration contract package script missing or drifted", {
    scriptName: SCRIPT_NAME,
    expected: SCRIPT_COMMAND,
    actual,
  });
}

function assertSuiteRunsThisGuard() {
  const suite = read(SUITE_PATH);

  assert(suite.includes(SCRIPT_NAME), "customer report server route registration contract is not wired into customer report boundary suite", {
    suitePath: SUITE_PATH,
    scriptName: SCRIPT_NAME,
  });

  assert(suite.includes(SCRIPT_COMMAND), "customer report server route registration contract suite command is missing or drifted", {
    suitePath: SUITE_PATH,
    expected: SCRIPT_COMMAND,
  });
}

function main() {
  const serverSources = readServerSources();

  for (const routeModule of REQUIRED_ROUTE_MODULES) {
    assertRouteModuleDefinition(routeModule);
    assertRouteModuleRegistered(routeModule, serverSources);
  }

  assertPackageScriptPinned();
  assertSuiteRunsThisGuard();

  console.log("[customer-report-server-route-registration-contract] PASS");
}

try {
  main();
} catch (error) {
  console.error("[customer-report-server-route-registration-contract] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
