// GEOX/apps/web/src/views/SimConfigPage.tsx
//
// Simulator Config (manifest-driven) editor.
//
// Goals:
// - 编辑能力严格来自后端 /api/sim/config 的 manifest.editable
// - 前端只产生 replace-only patch；权威校验在后端 /api/sim/config/patch
// - 提供可复制的 CLI 命令（--config-b64）来运行 scripts/sim_sensor_stream.mjs

import React, { useEffect, useMemo, useState } from "react";

import { fetchSimConfigManifest, postSimConfigPatch } from "../lib/api";
import { clearSavedSimPatch, loadSavedSimPatch, saveSimPatch, type SimConfigPatchV1 } from "../lib/sim_config_patch_store";

type EditableItem = {
  path: string;
  type: "int" | "number" | "bool" | "string" | "string_list";
  min?: number;
  max?: number;
  conditional?: string;
  description?: string;
};

type SimConfigManifest = {
  ssot: { source: string; schema_version: string; ssot_hash: string; updated_at_ts: number };
  patch: { patch_version: string; op_allowed: string[]; unknown_keys_policy: string };
  editable: EditableItem[];
  defaults: Record<string, any>;
  read_only_hints: string[];
};

type PreviewResponse = {
  ok: boolean;
  ssot_hash?: string;
  effective_hash?: string;
  changed_paths?: string[];
  effective_config?: any;
  // 后端生成的 base64(JSON)；用于命令行脚本 --config-b64
  effective_config_b64?: string;
  errors?: any[];
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toNumberLoose(v: string): number {
  // 允许用户输入逗号小数（兼容部分输入法/区域设置）。
  const norm = v.replace(",", ".");
  return Number(norm);
}

function base64Utf8(s: string): string {
  // 浏览器 btoa 仅支持 Latin1，这里先 UTF-8 编码再 btoa。
  return btoa(unescape(encodeURIComponent(s)));
}

function stringifyPretty(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export default function SimConfigPage(): JSX.Element {
  const [manifest, setManifest] = useState<SimConfigManifest | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<boolean>(false);
  const [auditText, setAuditText] = useState<string>("");
  const [lastEffectiveConfig, setLastEffectiveConfig] = useState<any>(null);
  const [lastEffectiveHash, setLastEffectiveHash] = useState<string>("");
  const [lastEffectiveB64, setLastEffectiveB64] = useState<string>("");

  async function refresh(): Promise<void> {
    const m = (await fetchSimConfigManifest()) as SimConfigManifest;
    setManifest(m);
    setValues(m.defaults ?? {});
    setDirtyPaths(new Set());
    setSaved(false);
    setAuditText("");
    setLastEffectiveConfig(null);
    setLastEffectiveHash("");

    // 尝试加载与 ssot_hash 绑定的本地 patch
    const sp = loadSavedSimPatch(m.ssot.ssot_hash);
    if (sp && Array.isArray(sp.ops)) {
      const next: Record<string, any> = { ...(m.defaults ?? {}) };
      const dp = new Set<string>();
      for (const op of sp.ops) {
        next[op.path] = op.value;
        dp.add(op.path);
      }
      setValues(next);
      setDirtyPaths(dp);
      setSaved(true);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editableGroups = useMemo(() => {
    const groups: Record<string, EditableItem[]> = {};
    for (const item of manifest?.editable ?? []) {
      const prefix = item.path.split(".")[0] || "root";
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(item);
    }
    for (const k of Object.keys(groups)) {
      groups[k].sort((a, b) => a.path.localeCompare(b.path));
    }
    return groups;
  }, [manifest]);

  function setPathValue(path: string, value: any): void {
    setValues((prev) => ({ ...prev, [path]: value }));
    setDirtyPaths((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
    setSaved(false);
  }

  function buildPatch(ssotHash: string): SimConfigPatchV1 {
    const ops = Array.from(dirtyPaths)
      .sort()
      .map((p) => ({ op: "replace" as const, path: p, value: values[p] }));
    return {
      patch_version: "1.0.0",
      base: { ssot_hash: ssotHash },
      ops,
    };
  }

  async function previewOrSave(dryRun: boolean): Promise<void> {
    if (!manifest) return;

    const patch = buildPatch(manifest.ssot.ssot_hash);
    const req = {
      base: { ssot_hash: manifest.ssot.ssot_hash },
      patch,
      dryRun,
    };

    const resp = (await postSimConfigPatch(req)) as PreviewResponse;
    setAuditText(stringifyPretty(resp));
    if (resp.ok) {
      setLastEffectiveConfig(resp.effective_config ?? null);
      setLastEffectiveHash(String(resp.effective_hash ?? ""));
      // 优先使用后端提供的 b64（减少前端重复编码逻辑）
      setLastEffectiveB64(String(resp.effective_config_b64 ?? ""));
      if (!dryRun) {
        saveSimPatch(patch);
        setSaved(true);
      }
    }
  }

  function resetToDefaults(): void {
    if (!manifest) return;
    setValues(manifest.defaults ?? {});
    setDirtyPaths(new Set());
    setSaved(false);
    setAuditText("");
    setLastEffectiveConfig(null);
    setLastEffectiveHash("");
    setLastEffectiveB64("");
  }

  function resetAndClearSaved(): void {
    if (!manifest) return;
    clearSavedSimPatch(manifest.ssot.ssot_hash);
    resetToDefaults();
  }

  const commandSnippet = useMemo(() => {
    if (!lastEffectiveConfig || !isNonEmptyString(lastEffectiveHash)) return "";
    // 优先使用后端的 b64（若后端还未提供，则回退到前端编码）
    const b64 = isNonEmptyString(lastEffectiveB64) ? lastEffectiveB64 : base64Utf8(JSON.stringify(lastEffectiveConfig));
    return [
      `# 1) 在 GEOX 仓库根目录运行（确保已设置 DATABASE_URL）`,
      `# 2) 该命令会按 effective_config 运行模拟器（可复现，对账 hash=${lastEffectiveHash})`,
      `node scripts/sim_sensor_stream.mjs --config-b64 "${b64}"`,
    ].join("\n");
  }, [lastEffectiveConfig, lastEffectiveHash, lastEffectiveB64]);

  return (
    <div style={{ padding: 16, maxWidth: 980 }}>
      <h2>监测器配置</h2>
      <div style={{ marginBottom: 12, color: "#555" }}>
        由 Manifest 驱动的编辑器（replace-only）。SSOT：{manifest?.ssot.source ?? "-"}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ fontFamily: "monospace", fontSize: 12 }}>
          ssot_hash: {manifest?.ssot.ssot_hash ?? "-"}
        </div>
        <button onClick={() => refresh()}>刷新</button>
        <button onClick={() => resetToDefaults()}>重置</button>
        <button onClick={() => resetAndClearSaved()}>重置并清空本地保存</button>
        <button onClick={() => previewOrSave(true)}>预览（dryRun）</button>
        <button onClick={() => previewOrSave(false)}>保存到本地</button>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#555" }}>
          dirty_ops: {dirtyPaths.size}；saved_patch: {saved ? "是" : "否"}
        </div>
      </div>

      {!manifest ? (
        <div>加载中...</div>
      ) : (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 560px", minWidth: 420 }}>
            {Object.keys(editableGroups).length === 0 ? (
              <div style={{ color: "#b00" }}>manifest.editable 为空：这通常表示 SSOT 未加载或后端未暴露可编辑项。</div>
            ) : null}

            {Object.entries(editableGroups).map(([group, items]) => (
              <div key={group} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 8px 0" }}>{group}</h3>

                {items.map((it) => {
                  const cur = values[it.path];
                  const metaLine =
                    it.type === "int" || it.type === "number"
                      ? `type: ${it.type}  min: ${it.min}  max: ${it.max}`
                      : `type: ${it.type}`;

                  return (
                    <div key={it.path} style={{ padding: "8px 0", borderTop: "1px solid #eee" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontFamily: "monospace" }}>{it.path}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>{metaLine}</div>
                          {it.conditional ? (
                            <div style={{ fontSize: 12, color: "#666" }}>conditional: {it.conditional}</div>
                          ) : null}
                          {it.description ? (
                            <div style={{ fontSize: 12, color: "#666" }}>{it.description}</div>
                          ) : null}
                        </div>

                        <div style={{ minWidth: 260 }}>
                          {it.type === "bool" ? (
                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={Boolean(cur)}
                                onChange={(e) => setPathValue(it.path, e.target.checked)}
                              />
                              <span>{Boolean(cur) ? "开启" : "关闭"}</span>
                            </label>
                          ) : null}

                          {(it.type === "int" || it.type === "number") ? (
                            <input
                              // 使用 text 以避免部分输入法下 number 无法输入小数点的问题。
                              type="text"
                              value={cur == null ? "" : String(cur)}
                              onChange={(e) => {
                                const s = e.target.value;
                                if (s.trim() === "") {
                                  setPathValue(it.path, "");
                                  return;
                                }
                                const n = toNumberLoose(s);
                                setPathValue(it.path, n);
                              }}
                              placeholder={String(manifest.defaults?.[it.path] ?? "")}
                              style={{ width: "100%" }}
                            />
                          ) : null}

                          {it.type === "string" ? (
                            <input
                              type="text"
                              value={cur == null ? "" : String(cur)}
                              onChange={(e) => setPathValue(it.path, e.target.value)}
                              placeholder={String(manifest.defaults?.[it.path] ?? "")}
                              style={{ width: "100%" }}
                            />
                          ) : null}

                          {it.type === "string_list" ? (
                            <textarea
                              value={Array.isArray(cur) ? cur.join("\n") : ""}
                              onChange={(e) => {
                                const lines = e.target.value
                                  .split(/\r?\n/)
                                  .map((x) => x.trim())
                                  .filter(Boolean);
                                setPathValue(it.path, lines);
                              }}
                              placeholder={Array.isArray(manifest.defaults?.[it.path]) ? (manifest.defaults?.[it.path] ?? []).join("\n") : ""}
                              style={{ width: "100%", minHeight: 80 }}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ flex: "1 1 360px", minWidth: 320 }}>
            <h3>只读区块提示</h3>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              这些路径/区块不提供编辑入口（闭合性护栏）：
            </div>
            <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              {(manifest.read_only_hints ?? []).join("\n")}
            </pre>

            <h3 style={{ marginTop: 16 }}>上一次预览/保存响应（审计）</h3>
            <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              {auditText || "(暂无)"}
            </pre>

            <h3 style={{ marginTop: 16 }}>可复制运行命令</h3>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
              该命令使用后端返回的 effective_config（与 effective_hash 对账）。
            </div>
            <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              {commandSnippet || "(先点 预览（dryRun） 生成 effective_config)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
