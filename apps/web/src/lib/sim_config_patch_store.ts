// GEOX/apps/web/src/lib/sim_config_patch_store.ts
//
// LocalStorage storage for Simulator Config Patch.
// Keyed by ssot_hash to avoid drift.

export type SimConfigPatchV1 = {
  patch_version: "1.0.0";
  base: {
    ssot_hash: string;
  };
  ops: Array<{ op: "replace"; path: string; value: unknown }>;
};

const KEY_PREFIX = "geox_sim_config_patch_v1__";

function key(ssotHash: string): string {
  return `${KEY_PREFIX}${ssotHash}`;
}

export function loadSavedSimPatch(ssotHash: string): SimConfigPatchV1 | null {
  try {
    const raw = localStorage.getItem(key(ssotHash));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.patch_version !== "1.0.0") return null;
    if (!obj.base || obj.base.ssot_hash !== ssotHash) return null;
    if (!Array.isArray(obj.ops)) return null;
    return obj as SimConfigPatchV1;
  } catch {
    return null;
  }
}

export function saveSimPatch(patch: SimConfigPatchV1): void {
  localStorage.setItem(key(patch.base.ssot_hash), JSON.stringify(patch));
}

export function clearSavedSimPatch(ssotHash: string): void {
  localStorage.removeItem(key(ssotHash));
}
