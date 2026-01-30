import * as fs from "node:fs"; // fs：读取 fixture 文件（避免 tsconfig resolveJsonModule 依赖）
import * as path from "node:path"; // path：构造跨平台路径
import { validateControlRuleSetV0 } from "../ruleset/control_ruleset_v0_validator"; // 引入：admission validator

function readFixtureJson(relPathFromTestDir: string): unknown {
  const abs = path.resolve(__dirname, relPathFromTestDir); // 以 __dirname 为锚点，避免 pnpm -C 改变 cwd
  const raw = fs.readFileSync(abs, "utf8"); // 读取 fixture 原文
  return JSON.parse(raw); // 解析 JSON
}

const ok = readFixtureJson("../../fixtures/ruleset_ok_001.json"); // 正向样例：必须通过
const badAction = readFixtureJson("../../fixtures/ruleset_bad_action_001.json"); // 负向：未知 action_code
const badPath = readFixtureJson("../../fixtures/ruleset_bad_path_001.json"); // 负向：inputs_used 含未知 path
const badTemplate = readFixtureJson("../../fixtures/ruleset_bad_template_001.json"); // 负向：rule 使用未允许模板
const badImplicit = readFixtureJson("../../fixtures/ruleset_bad_implicitdep_001.json"); // 负向：expr 引用未声明 inputs_used

function expectOk(name: string, obj: unknown): void {
  validateControlRuleSetV0(obj); // 通过则不抛错
  console.log(`[OK] ${name}`); // 输出通过信息
}

function expectFail(name: string, obj: unknown): void {
  try {
    validateControlRuleSetV0(obj); // 预期抛错
  } catch (e) {
    console.log(`[FAIL-AS-EXPECTED] ${name}: ${(e as Error).message}`); // 输出失败原因
    return; // 失败符合预期
  }
  throw new Error(`expected fail but passed: ${name}`); // 未抛错则测试失败
}

expectOk("ruleset_ok_001", ok); // 正向：必须通过
expectFail("ruleset_bad_action_001", badAction); // 负向：必须失败
expectFail("ruleset_bad_path_001", badPath); // 负向：必须失败
expectFail("ruleset_bad_template_001", badTemplate); // 负向：必须失败
expectFail("ruleset_bad_implicitdep_001", badImplicit); // 负向：必须失败

console.log("control-constitution-validator tests ok"); // 总结输出
