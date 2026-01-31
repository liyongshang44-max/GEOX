// @geox/control-repo-const-harness
// Repo-Const harness (v0): explicit ruleset file loading + admission + kernel evaluation.
//
// Hard boundaries:
// - This package is CLI/test-only. It must NOT be imported by runtime modules (server/judge/agronomy/ao-act/ui).
// - File IO (fs) is allowed ONLY here; control-kernel must remain IO-free.

export * from "./ruleset_file_harness";
