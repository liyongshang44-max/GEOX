// scripts/ACCEPTANCE_SERIES_ROUTE_WIRING_V0_RUNNER.cjs
// 目的：防止 /api/series 出现“同名重复实现 + 只有一个生效”的回归（server.ts 内联 vs routes/series.ts 插件）。

const fs = require("node:fs"); // 读取源文件内容（静态检查）。
const path = require("node:path"); // 组装文件路径。

function die(msg) { // 统一失败出口：退出码非 0。
  // eslint-disable-next-line no-console
  console.error(String(msg)); // 输出错误信息，便于 CI/本地定位。
  process.exit(2); // 非 0 退出码代表 FAIL。
}

function mustInclude(text, needle, hint) { // 断言 text 必须包含 needle。
  if (!text.includes(needle)) die(`MISSING: ${needle} :: ${hint}`); // 缺失则 FAIL。
}

function mustNotInclude(text, needle, hint) { // 断言 text 必须不包含 needle。
  if (text.includes(needle)) die(`FORBIDDEN: ${needle} :: ${hint}`); // 存在则 FAIL。
}

function main() { // 主入口：执行静态断言。
  const repoRoot = process.cwd(); // 当前工作目录即仓库根（由 .ps1 设置）。

  const serverTs = path.join(repoRoot, "apps", "server", "src", "server.ts"); // server.ts 路径。
  const seriesRouteTs = path.join(repoRoot, "apps", "server", "src", "routes", "series.ts"); // routes/series.ts 路径。

  if (!fs.existsSync(serverTs)) die(`NOT_FOUND: ${serverTs}`); // server.ts 必须存在。
  if (!fs.existsSync(seriesRouteTs)) die(`NOT_FOUND: ${seriesRouteTs}`); // routes/series.ts 必须存在。

  const server = fs.readFileSync(serverTs, "utf8"); // 读取 server.ts 内容。
  const series = fs.readFileSync(seriesRouteTs, "utf8"); // 读取 routes/series.ts 内容。

  // 1) server.ts 不得再内联实现 /api/series（避免和插件重复）。
  mustNotInclude(server, 'app.get("/api/series"', "server.ts must not inline /api/series"); // 禁止内联路由。
  mustNotInclude(server, "app.get('/api/series'", "server.ts must not inline /api/series"); // 兼容单引号写法。

  // 2) server.ts 必须注册 routes/series.ts 插件（确保 /api/series 实际生效）。
  mustInclude(server, "buildSeriesRoutes", "server.ts must import/build series plugin"); // 必须引用 buildSeriesRoutes。
  mustInclude(server, "app.register(buildSeriesRoutes(pool))", "server.ts must register buildSeriesRoutes(pool)"); // 必须 register。

  // 3) routes/series.ts 必须声明 /api/series 路由（确保路由确实落在 routes 文件里）。
  mustInclude(series, "/api/series", "routes/series.ts must contain /api/series route"); // 必须包含 /api/series 文本。
  mustInclude(series, "app.get(\"/api/series\"", "routes/series.ts must register GET /api/series"); // 必须注册 GET。

  // eslint-disable-next-line no-console
  console.log("[OK] series route wiring v0"); // 输出 OK 标记。
}

main(); // 运行入口。
