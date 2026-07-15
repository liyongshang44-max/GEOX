const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");
const webSourceRoot = path.join(repoRoot, "apps/web/src");
const prototypeRoot = path.join(webSourceRoot, "prototypes/controlled-pilot");
const routeEntry = path.join(webSourceRoot, "routes/App.tsx");

function fail(message) {
  throw new Error(`[CONTROLLED_PILOT_PROTOTYPE_ISOLATION] ${message}`);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

if (!fs.existsSync(prototypeRoot)) fail("prototype directory is missing");

const prototypeFiles = walk(prototypeRoot).filter((filePath) => /\.(ts|tsx|css)$/.test(filePath));
if (prototypeFiles.length < 4) fail("expected isolated page, data, index, and stylesheet files");

const forbiddenImportFragments = [
  "/features/",
  "/app/",
  "/auth/",
  "/layouts/",
  "/shared/",
  "/views/",
  "@geox/contracts",
];

for (const filePath of prototypeFiles.filter((candidate) => /\.(ts|tsx)$/.test(candidate))) {
  const source = read(filePath);
  for (const fragment of forbiddenImportFragments) {
    if (source.includes(fragment)) fail(`${path.relative(repoRoot, filePath)} imports production boundary ${fragment}`);
  }
  if (/fetch\s*\(\s*["'`]\/api\//.test(source)) {
    fail(`${path.relative(repoRoot, filePath)} calls a formal API directly`);
  }
}

const routeSource = read(routeEntry);
if (!routeSource.includes('path="/prototype/controlled-pilot/*"')) fail("isolated prototype route is missing");
if (!routeSource.includes('React.lazy(() => import("../prototypes/controlled-pilot"))')) fail("prototype must remain lazy-loaded");
if (!routeSource.includes('<Route path="*" element={<CoreApp />} />')) fail("formal application fallback route is missing");

const externalReferences = walk(webSourceRoot)
  .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
  .filter((filePath) => !filePath.startsWith(prototypeRoot))
  .filter((filePath) => filePath !== routeEntry)
  .filter((filePath) => read(filePath).includes("prototypes/controlled-pilot"));

if (externalReferences.length > 0) {
  fail(`production source references prototype: ${externalReferences.map((filePath) => path.relative(repoRoot, filePath)).join(", ")}`);
}

const stylesheets = prototypeFiles.filter((filePath) => filePath.endsWith(".css")).map(read);
const combinedStyles = stylesheets.join("\n");
if (!combinedStyles.includes(".geox-prototype")) fail("scoped stylesheet root is missing");
if (/(^|\n)\s*(html|body|:root|\*)\s*\{/.test(combinedStyles)) fail("prototype stylesheet contains an unscoped global selector");

console.log("CONTROLLED PILOT PROTOTYPE ISOLATION: PASS");
console.log(`prototype files: ${prototypeFiles.length}`);
console.log("formal app integration: routes/App.tsx only");
console.log("formal API writes: none");
