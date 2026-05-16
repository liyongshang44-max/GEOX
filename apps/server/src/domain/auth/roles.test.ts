import test from "node:test";
import assert from "node:assert/strict";

import { isScopeAllowedForRoleV1 } from "./roles.js";

test("executor role allows ao_act.receipt.write", () => {
  assert.equal(isScopeAllowedForRoleV1("executor", "ao_act.receipt.write"), true);
});

test("executor role does not gain unrelated privileged scopes", () => {
  assert.equal(isScopeAllowedForRoleV1("executor", "ao_act.task.write"), false);
  assert.equal(isScopeAllowedForRoleV1("executor", "approval.decide"), false);
});
