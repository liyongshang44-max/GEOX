import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appTsx = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

const mustContain = [
  'path="/" element={<Navigate to="/customer/dashboard" replace />} ',
  'path="/customer/*"',
  '<Route path="dashboard" element={<CustomerDashboardPage />} />',
  '<Route path="export" element={<CustomerDashboardExportPage />} />',
  '<Route path="fields/:fieldId" element={<FieldReportPage />} />',
  '<Route path="fields/:fieldId/export" element={<FieldReportExportPage />} />',
  '<Route path="operations/:operationId" element={<OperationReportPage />} />',
  '<Route path="operations/:operationId/export" element={<CustomerReportExportPage />} />',
  '<Route path="*" element={<Navigate to="dashboard" replace />} />',
];

for (const item of mustContain) {
  assert.equal(appTsx.includes(item), true, `missing expected route snippet: ${item}`);
}

const customerRouteBlock = appTsx.match(/function CustomerRoutes\(\): React\.ReactElement \{[\s\S]*?<\/Routes>\n  \);\n\}/);
assert.ok(customerRouteBlock, "CustomerRoutes block not found");

const allowedPaths = new Set([
  'path="/"',
  'path="dashboard"',
  'path="export"',
  'path="fields/:fieldId"',
  'path="fields/:fieldId/export"',
  'path="operations/:operationId"',
  'path="operations/:operationId/export"',
  'path="*"',
]);

const routePathMatches = [...customerRouteBlock[0].matchAll(/path="([^"]+)"/g)].map((x) => `path="${x[1]}"`);
for (const found of routePathMatches) {
  assert.equal(allowedPaths.has(found), true, `unexpected customer route (outside P0): ${found}`);
}

console.log("customer routes smoke passed");
