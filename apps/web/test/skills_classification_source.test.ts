import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const skillApiPath = resolve("apps/web/src/api/skills.ts");

function loadSkillApiExports() {
  const source = readFileSync(skillApiPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: skillApiPath,
  });

  const moduleObj = { exports: {} as Record<string, unknown> };
  const sandbox: any = {
    module: moduleObj,
    exports: moduleObj.exports,
    require: (id: string) => {
      if (id === "./client") {
        return {
          apiRequestOptional: async () => null,
          requestJson: async () => null,
          withQuery: (u: string) => u,
        };
      }
      throw new Error(`Unexpected import in skills.ts test harness: ${id}`);
    },
  };

  vm.runInNewContext(transpiled.outputText, sandbox, { filename: skillApiPath });
  return moduleObj.exports;
}

test("skills classification source priority: category > skill_type > classification", () => {
  const source = readFileSync(skillApiPath, "utf8");
  const categoryIndex = source.indexOf("input?.category");
  const skillTypeIndex = source.indexOf("input?.skill_type");
  const classificationIndex = source.indexOf("input?.classification");

  assert.ok(categoryIndex >= 0);
  assert.ok(skillTypeIndex >= 0);
  assert.ok(classificationIndex >= 0);
  assert.ok(categoryIndex < skillTypeIndex);
  assert.ok(skillTypeIndex < classificationIndex);
});

test("dashboard seed skills should not all resolve to unknown", () => {
  const { resolveSkillClassification } = loadSkillApiExports();
  assert.equal(typeof resolveSkillClassification, "function");

  const seedSkills = [
    { skill_id: "seed.sensing", category: "sensing" },
    { skill_id: "seed.agronomy", category: "agronomy" },
    { skill_id: "seed.device", skill_type: "device" },
    { skill_id: "seed.acceptance", skill_type: "acceptance" },
  ];

  const classifications = seedSkills.map((item) => resolveSkillClassification(item));
  assert.equal(classifications.every((v) => v === "unknown"), false, `all unknown: ${classifications.join(",")}`);
  assert.deepEqual(classifications, ["sensing", "agronomy", "device", "acceptance"]);
});
