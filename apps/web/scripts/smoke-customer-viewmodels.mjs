import { execSync } from "node:child_process";

const tests = [
  "src/viewmodels/customerDashboardVm.test.ts",
  "src/viewmodels/fieldReportVm.test.ts",
  "src/viewmodels/operationReportVm.test.ts",
];

execSync("node apps/web/scripts/smoke-customer-routes.mjs", { stdio: "inherit" });

for (const file of tests) {
  execSync(`pnpm -w exec tsx apps/web/${file}`, { stdio: "inherit" });
}

console.log("all customer viewmodel smokes passed");
