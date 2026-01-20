import fs from "node:fs";
import path from "node:path";

export function checkServerInvariants(repoRoot: string): string[] {
  const hits: string[] = [];
  const serverPath = path.join(repoRoot, "apps", "server", "src", "server.ts");
  if (!fs.existsSync(serverPath)) {
    hits.push(`missing server.ts at ${serverPath}`);
    return hits;
  }
  const txt = fs.readFileSync(serverPath, "utf-8");

  // No mutation routes for raw
  const forbiddenRoute = /(put|patch|delete)\s*\(\s*["']\/api\/raw["']/i;
  if (forbiddenRoute.test(txt)) hits.push("server.ts: forbidden PUT/PATCH/DELETE /api/raw");

  // No update/delete in SQL for raw_samples
  const forbiddenSql = /(UPDATE\s+raw_samples|DELETE\s+FROM\s+raw_samples)/i;
  if (forbiddenSql.test(txt)) hits.push("server.ts: forbidden UPDATE/DELETE on raw_samples");

  return hits;
}
