// GEOX/apps/web/src/lib/judge_config_patch_store.ts

import type { JudgeConfigPatchV1 } from "./api";

// LOCAL_STORAGE_KEY_PREFIX 是 Judge Config Patch 在浏览器本地存储的 key 前缀（V1 不落库）。
const LOCAL_STORAGE_KEY_PREFIX = "geox_judge_config_patch_v1__";

// buildKey 基于 ssot_hash 生成 localStorage key，避免 SSOT 升级后误用旧 patch。
function buildKey(ssotHash: string): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}${ssotHash}`;
}

// loadSavedPatch 从 localStorage 读取与当前 ssot_hash 匹配的 patch（不存在则返回 null）。
export function loadSavedPatch(ssotHash: string): JudgeConfigPatchV1 | null {
  try {
    const key = buildKey(ssotHash);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.patch_version !== "1.0.0") return null;
    if (!parsed.base || typeof parsed.base.ssot_hash !== "string") return null;
    if (parsed.base.ssot_hash !== ssotHash) return null;
    if (!Array.isArray(parsed.ops)) return null;
    return parsed as JudgeConfigPatchV1;
  } catch {
    return null;
  }
}

// savePatch 将 patch 保存到 localStorage（以 ssot_hash 作为命名空间）。
export function savePatch(patch: JudgeConfigPatchV1): void {
  try {
    const ssotHash = patch.base.ssot_hash;
    const key = buildKey(ssotHash);
    localStorage.setItem(key, JSON.stringify(patch));
  } catch {
    // ignore
  }
}

// clearSavedPatch 清理当前 ssot_hash 对应的保存内容。
export function clearSavedPatch(ssotHash: string): void {
  try {
    const key = buildKey(ssotHash);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
