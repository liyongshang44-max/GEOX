// apps/web/src/features/operator/fieldRuntime/fieldRuntimeHealthAdapter.ts
// Purpose: H62 runtime health local metadata adapter shell.

export type FieldRuntimeHealthLoadState = {
  status: "ready";
};

export function buildFieldRuntimeHealth(): FieldRuntimeHealthLoadState {
  return { status: "ready" };
}
