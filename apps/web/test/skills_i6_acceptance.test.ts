import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const skillApiPath = resolve("apps/web/src/api/skills.ts");
const skillBindingsPagePath = resolve("apps/web/src/features/skills/pages/SkillBindingsPage.tsx");
const skillRegistryPagePath = resolve("apps/web/src/features/skills/pages/SkillRegistryPage.tsx");
const skillsRoutesPath = resolve("apps/server/src/routes/skills_v1.ts");
const skillsRulesRoutesPath = resolve("apps/server/src/routes/skills_rules_v1.ts");

test("I6: Skill 管理中心仅保留 bindings 与 bindings/override 主流程入口", () => {
  const source = readFileSync(skillApiPath, "utf8");
  assert.ok(source.includes("/api/v1/skills/bindings"));
  assert.ok(source.includes("/api/v1/skills/bindings/override"));
  assert.equal(source.includes("/api/v1/skills/rules/switch"), false);
  assert.equal(source.includes("switchSkillRule("), false);
  assert.equal(source.includes("listSkillRules("), false);
});

test("I6: 页面主流程不展示旧入口调用方式", () => {
  const bindingsPage = readFileSync(skillBindingsPagePath, "utf8");
  const registryPage = readFileSync(skillRegistryPagePath, "utf8");
  const legacyHints = ["/api/v1/skills/rules/switch", "/api/v1/skills/:id/enable", "/api/v1/skills/:id/disable"];

  for (const hint of legacyHints) {
    assert.equal(bindingsPage.includes(hint), false, `bindings page should not mention ${hint}`);
    assert.equal(registryPage.includes(hint), false, `registry page should not mention ${hint}`);
  }
});

test("I6: 旧入口返回包含 deprecated=true", () => {
  const rulesRoutesSource = readFileSync(skillsRulesRoutesPath, "utf8");
  assert.ok(rulesRoutesSource.includes('app.post("/api/v1/skills/rules/switch"'));
  assert.ok(rulesRoutesSource.includes("deprecated: true as const"));

  const routesSource = readFileSync(skillsRoutesPath, "utf8");
  assert.ok(routesSource.includes('app.post("/api/v1/skills/:skill_id/enable"'));
  assert.ok(routesSource.includes('app.post("/api/v1/skills/:skill_id/disable"'));
  assert.ok(routesSource.includes("deprecated: true"));
});
