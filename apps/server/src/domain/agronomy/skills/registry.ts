// Legacy compatibility bridge only.
// Runtime must not load this unless explicitly opting in for migration/backfill.
if (process.env.GEOX_DISABLE_LEGACY_SKILLS !== "false") {
  throw new Error("DO_NOT_USE_LEGACY_AGRONOMY_SKILLS_IN_RUNTIME");
}

export * from "../../skill_registry/agronomy_rule_registry.js";
