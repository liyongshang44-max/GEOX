import test from "node:test";
import assert from "node:assert/strict";

import { deriveDefaultSlaDueAt, isSlaBreached } from "./alert_sla";

test("deriveDefaultSlaDueAt: derives due time by severity", () => {
  const triggeredAt = Date.UTC(2026, 0, 1, 0, 0, 0);

  assert.equal(deriveDefaultSlaDueAt({ severity: "CRITICAL", triggeredAt }), triggeredAt + 4 * 60 * 60 * 1000);
  assert.equal(deriveDefaultSlaDueAt({ severity: "HIGH", triggeredAt }), triggeredAt + 12 * 60 * 60 * 1000);
  assert.equal(deriveDefaultSlaDueAt({ severity: "MEDIUM", triggeredAt }), triggeredAt + 24 * 60 * 60 * 1000);
  assert.equal(deriveDefaultSlaDueAt({ severity: "LOW", triggeredAt }), triggeredAt + 72 * 60 * 60 * 1000);
});

test("deriveDefaultSlaDueAt: falls back to LOW for unknown severity", () => {
  const triggeredAt = Date.UTC(2026, 0, 1, 0, 0, 0);
  assert.equal(deriveDefaultSlaDueAt({ severity: "UNKNOWN", triggeredAt }), triggeredAt + 72 * 60 * 60 * 1000);
});

test("isSlaBreached: returns whether current time exceeds due time", () => {
  const dueAt = Date.UTC(2026, 0, 1, 12, 0, 0);
  assert.equal(isSlaBreached({ slaDueAt: dueAt, now: dueAt }), false);
  assert.equal(isSlaBreached({ slaDueAt: dueAt, now: dueAt + 1 }), true);
  assert.equal(isSlaBreached({ slaDueAt: null, now: dueAt + 1 }), false);
});
