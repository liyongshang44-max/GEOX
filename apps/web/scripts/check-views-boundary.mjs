import fs from "node:fs";
import path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(scriptDir, "..");
const routeDir = path.join(repoRoot, "src/app/routes");
const routeFiles = fs.readdirSync(routeDir).filter((name) => name.endsWith(".tsx") || name.endsWith(".ts"));
const offenders = [];

for (const file of routeFiles) {
  const full = path.join(routeDir, file);
  const text = fs.readFileSync(full, "utf8");
  if (/from\s+["']\.\.\/\.\.\/views\//.test(text) || /import\(\s*["']\.\.\/\.\.\/views\//.test(text)) {
    offenders.push(path.relative(repoRoot, full));
  }
}

if (offenders.length > 0) {
  console.error("❌ Detected forbidden imports from src/views in app/routes:");
  for (const file of offenders) console.error(` - ${file}`);
  process.exit(1);
}

const appFile = path.join(repoRoot, "src/app/App.tsx");
const appText = fs.readFileSync(appFile, "utf8");
const legacyViewImportMatches = [...appText.matchAll(/const\s+(\w+)\s*=\s*React\.lazy\(\(\)\s*=>\s*import\(["']\.\.\/views\//g)];
const legacyViewImportNames = new Set(legacyViewImportMatches.map((m) => m[1]));
const nonLegacyLegacyViewRoutes = [];

for (const match of appText.matchAll(/<Route\s+path=["']([^"']+)["']\s+element={<(\w+)/g)) {
  const [, routePath, elementName] = match;
  if (legacyViewImportNames.has(elementName) && !routePath.startsWith("/legacy/")) {
    nonLegacyLegacyViewRoutes.push(`${routePath} -> ${elementName}`);
  }
}

if (nonLegacyLegacyViewRoutes.length > 0) {
  console.error("❌ Non-legacy routes cannot render src/views/* pages in src/app/App.tsx:");
  for (const route of nonLegacyLegacyViewRoutes) console.error(` - ${route}`);
  process.exit(1);
}

console.log("✅ views boundary passed (non-legacy routes do not render src/views/* pages).");
