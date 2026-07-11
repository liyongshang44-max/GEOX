#!/usr/bin/env node
const { spawnSync } = require("child_process");

const SCAN_PATHS = ["apps/web/src", "apps/server/src", "apps/server/scripts"];

const FORBIDDEN_ROUTES = [
  {
    route: "/api/telemetry/v1/query",
    successor: "/api/v1/operations/* 或 operation_state 主链 read model",
  },
  {
    route: "/api/v1/telemetry/latest",
    successor: "/api/v1/operations/* 或 operation_state 主链 read model",
  },
  {
    route: "/api/v1/telemetry/series",
    successor: "/api/v1/operations/* 或 operation_state 主链 read model",
  },
  {
    route: "/api/v1/telemetry/metrics",
    successor: "/api/v1/operations/* 或 operation_state 主链 read model",
  },
  {
    route: "/api/control/ao_act/task",
    successor: "/api/v1/actions/* 与 operation_state 主链 read model",
  },
  {
    route: "/api/control/ao_act/receipt",
    successor: "/api/v1/actions/* 与 operation_state 主链 read model",
  },
  {
    route: "/api/control/ao_act/index",
    successor: "/api/v1/actions/* 与 operation_state 主链 read model",
  },
];

const ALLOWLIST_PATH_PATTERNS = [
  /^apps\/server\/src\/routes\/legacy\//, // legacy 路由自身实现
  /^apps\/server\/src\/routes\/v1\/.*compat/i, // 显式兼容入口
  /^apps\/server\/src\/routes\/.*(?:legacy|compat|compatibility|migration).*\.ts$/i, // 迁移/兼容适配文件
];

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return { ok: false, stdout: result.stdout || "", stderr: result.stderr || "" };
  }
  return { ok: true, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function resolveDiffBase() {
  const baseRefFromCi = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null;
  const candidates = [baseRefFromCi, "origin/main", "main", "HEAD~1"].filter(Boolean);
  for (const candidate of candidates) {
    const verify = runGit(["rev-parse", "--verify", candidate]);
    if (!verify.ok) continue;
    if (candidate === "HEAD~1") return candidate;
    const mergeBase = runGit(["merge-base", "HEAD", candidate]);
    if (mergeBase.ok) return mergeBase.stdout.trim();
  }
  return "HEAD~1";
}

function parseUnifiedPatch(patchText) {
  const entries = [];
  let file = null;
  let nextNewLine = 0;
  for (const rawLine of patchText.split("\n")) {
    if (rawLine.startsWith("+++ b/")) {
      file = rawLine.slice("+++ b/".length).trim();
      continue;
    }
    const hunk = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      nextNewLine = Number.parseInt(hunk[1], 10);
      continue;
    }
    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      if (file) entries.push({ file, line: nextNewLine, text: rawLine.slice(1) });
      nextNewLine += 1;
      continue;
    }
    if (rawLine.startsWith(" ") || rawLine.startsWith("-")) {
      if (!rawLine.startsWith("-")) nextNewLine += 1;
      continue;
    }
  }
  return entries;
}

function loadAddedLines(baseRef) {
  const diff = runGit(["diff", "--unified=0", `${baseRef}...HEAD`, "--", ...SCAN_PATHS]);
  if (!diff.ok) {
    const showHead = runGit(["show", "--unified=0", "--format=", "HEAD", "--", ...SCAN_PATHS]);
    if (!showHead.ok) {
      console.error("[route-dependency-guard] 无法获取 git diff。");
      process.stderr.write(diff.stderr);
      process.exit(2);
    }
    console.warn("[route-dependency-guard] 警告：无法解析 diff base，已回退为仅检查 HEAD 提交新增行。");
    return parseUnifiedPatch(showHead.stdout);
  }
  return parseUnifiedPatch(diff.stdout);
}

function isAllowlisted(file) {
  return ALLOWLIST_PATH_PATTERNS.some((pattern) => pattern.test(file));
}

const diffBase = resolveDiffBase();
const addedLines = loadAddedLines(diffBase);
const violations = [];

for (const entry of addedLines) {
  if (isAllowlisted(entry.file)) continue;
  for (const item of FORBIDDEN_ROUTES) {
    if (!entry.text.includes(item.route)) continue;
    violations.push({ ...entry, route: item.route, successor: item.successor });
  }
}

if (violations.length > 0) {
  console.error("[route-dependency-guard] 检查失败：发现新增 compatibility/legacy route 依赖。");
  for (const v of violations) {
    console.error(`${v.file}:${v.line} 新增依赖 ${v.route}`);
    console.error("该接口属于 Compatibility API");
    console.error(`新流应改为依赖 ${v.successor}`);
  }
  process.exit(1);
}

console.log(`[route-dependency-guard] 检查通过：未发现新增 compatibility/legacy route 依赖（diff base: ${diffBase}）。`);
