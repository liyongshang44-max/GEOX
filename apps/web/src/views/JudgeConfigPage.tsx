// GEOX/apps/web/src/views/JudgeConfigPage.tsx

import React from "react";

import {
  ApiError,
  fetchJudgeConfigManifest,
  postJudgeConfigPatch,
  type JudgeConfigManifestItemV1,
  type JudgeConfigManifestResponseV1,
  type JudgeConfigPatchOpV1,
  type JudgeConfigPatchV1,
} from "../lib/api";

import { loadSavedPatch, savePatch, clearSavedPatch } from "../lib/judge_config_patch_store";


// FieldError 表示某个 path 上的服务端校验错误（用于 UI 定位）。
type FieldError = { code: string; message: string };

// groupKey 将 path 按第一段分组（如 qc.* / reference.*）。
function groupKey(path: string): string {
  const idx = path.indexOf(".");
  return idx >= 0 ? path.slice(0, idx) : path;
}


// groupLabel 将一级分组 key 映射为中文标题（仅 UI，不影响语义）。
function groupLabel(g: string): string {
  if (g === "sufficiency") return "样本充足性 (sufficiency)";
  if (g === "time_coverage") return "时间覆盖 (time_coverage)";
  if (g === "qc") return "质量控制 (qc)";
  if (g === "reference") return "参考对照 (reference)";
  if (g === "conflict") return "冲突判定 (conflict)";
  return g;
}

// toNumberOrNaN 将输入字符串转换为 number；失败则 NaN（只用于提示）。
function toNumberOrNaN(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// normalizeDefaultTyped 从 defaults[path] 读取“用于比较/计算 hash 的权威默认值（类型化）”。
function normalizeDefaultTyped(item: JudgeConfigManifestItemV1, defaults: Record<string, unknown>): unknown {
  const raw = defaults[item.path];
  if (item.type === "bool") return typeof raw === "boolean" ? raw : false;
  if (item.type === "enum_list") return Array.isArray(raw) ? raw : [];
  if (item.type === "int") return typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : 0;
  if (item.type === "number") return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  return raw;
}

// normalizeDefaultForForm 生成“表单输入态”默认值：
// - 对 int/number 用 string 保存，避免输入过程中小数点被强制吞掉（受控组件常见坑）。
function normalizeDefaultForForm(item: JudgeConfigManifestItemV1, defaults: Record<string, unknown>): unknown {
  const def = normalizeDefaultTyped(item, defaults);
  if (item.type === "int" || item.type === "number") return String(def);
  return def;
}

// parseNumericFromForm 将表单输入态 string 转为 number：
// - int: 必须是有限整数
// - number: 必须是有限数值
function parseNumericFromForm(item: JudgeConfigManifestItemV1, raw: unknown): number {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return Number.NaN;
  if (item.type === "int") return Number.isInteger(n) ? n : Number.NaN;
  return n;
}

// buildOpsFromForm 只对“与 defaults 不同”的 path 生成 replace ops（replace-only）。
function buildOpsFromForm(
  manifest: JudgeConfigManifestResponseV1,
  form: Record<string, unknown>
): { ops: JudgeConfigPatchOpV1[]; localErrors: Array<{ path: string; message: string }> } {
  const ops: JudgeConfigPatchOpV1[] = [];
  const localErrors: Array<{ path: string; message: string }> = [];

  for (const item of manifest.editable) {
    // defTyped：用于“是否变更”的权威比较值（类型化）。
    const defTyped = normalizeDefaultTyped(item, manifest.defaults);

    // curRaw：表单输入态（对数值字段是 string）。
    const curRaw = form[item.path];

    // 针对数值字段：在提交/预览前才做数值解析，避免输入过程吞掉小数点。
    if (item.type === "int" || item.type === "number") {
      const curNum = parseNumericFromForm(item, curRaw);
      if (!Number.isFinite(curNum)) {
        localErrors.push({ path: item.path, message: "请输入合法的数值" });
        continue;
      }
      const same = typeof defTyped === "number" && Number.isFinite(defTyped) ? curNum === defTyped : false;
      if (same) continue;
      ops.push({ op: "replace", path: item.path, value: curNum });
      continue;
    }

    // 非数值字段：直接做结构比较。
    const same = JSON.stringify(curRaw) === JSON.stringify(defTyped);
    if (same) continue;
    ops.push({ op: "replace", path: item.path, value: curRaw });
  }

  return { ops, localErrors };
}


export default function JudgeConfigPage(): React.ReactElement {
  const [manifest, setManifest] = React.useState<JudgeConfigManifestResponseV1 | null>(null);
  const [form, setForm] = React.useState<Record<string, unknown>>({});
  const [saved, set保存d] = React.useState<JudgeConfigPatchV1 | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [globalErr, setGlobalErr] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, FieldError[]>>({});
  const [last预览校验, setLast预览校验] = React.useState<any>(null);

  // loadManifest 读取 manifest 并初始化表单。
  async function loadManifest(): Promise<void> {
    setBusy(true);
    setGlobalErr(null);
    try {
      const m = await fetchJudgeConfigManifest();
      setManifest(m);

      const nextForm: Record<string, unknown> = {};
      for (const item of m.editable) {
        nextForm[item.path] = normalizeDefaultForForm(item, m.defaults);
      }
      setForm(nextForm);

      // 从 localStorage 读取与当前 ssot_hash 匹配的已保存补丁（不存在则返回 null）。
      const loaded = loadSavedPatch(m.ssot.ssot_hash);
      set保存d(loaded);
      if (loaded) {
        const applied: Record<string, unknown> = { ...nextForm };
        for (const op of loaded.ops) {
          applied[op.path] = op.value;
        }
        setForm(applied);
      }
    } catch (e: any) {
      setGlobalErr(e?.bodyText ? String(e.bodyText) : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    void loadManifest();
  }, []);

  // on预览校验 调用后端 dryRun=true 做权威校验，并回显 errors。
  async function on预览校验(): Promise<void> {
    if (!manifest) return;
    setBusy(true);
    setGlobalErr(null);
    setFieldErrors({});
    try {
      const { ops, localErrors } = buildOpsFromForm(manifest, form);
      if (localErrors.length > 0) {
        // 本地只做提示：数值字段无法解析时，直接在 UI 显示错误，不发起请求。
        const fe: Record<string, FieldError[]> = {};
        for (const e of localErrors) fe[e.path] = [{ code: "CLIENT_INVALID_NUMBER", message: e.message }];
        setFieldErrors(fe);
        setBusy(false);
        return;
      }
      const patch: JudgeConfigPatchV1 = {
        patch_version: "1.0.0",
        base: { ssot_hash: manifest.ssot.ssot_hash },
        ops,
      };
      const res = await postJudgeConfigPatch({ base: { ssot_hash: manifest.ssot.ssot_hash }, patch, dryRun: true });
      setLast预览校验(res);

      const map: Record<string, FieldError[]> = {};
      for (const err of res.errors ?? []) {
        const p = typeof err.path === "string" ? err.path : "";
        if (!p) continue;
        if (!map[p]) map[p] = [];
        map[p].push({ code: String(err.code), message: String(err.message) });
      }
      setFieldErrors(map);
    } catch (e: any) {
      setGlobalErr(e?.bodyText ? String(e.bodyText) : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // on保存 先走 dryRun=false（与后端“静态拒绝”一致），成功后写 localStorage。
  async function on保存(): Promise<void> {
    if (!manifest) return;
    setBusy(true);
    setGlobalErr(null);
    setFieldErrors({});
    try {
      const { ops, localErrors } = buildOpsFromForm(manifest, form);
      if (localErrors.length > 0) {
        // 本地只做提示：数值字段无法解析时，直接在 UI 显示错误，不发起请求。
        const fe: Record<string, FieldError[]> = {};
        for (const e of localErrors) fe[e.path] = [{ code: "CLIENT_INVALID_NUMBER", message: e.message }];
        setFieldErrors(fe);
        setBusy(false);
        return;
      }
      const patch: JudgeConfigPatchV1 = {
        patch_version: "1.0.0",
        base: { ssot_hash: manifest.ssot.ssot_hash },
        ops,
      };

      const res = await postJudgeConfigPatch({ base: { ssot_hash: manifest.ssot.ssot_hash }, patch, dryRun: false });
      setLast预览校验(res);

      if (!res.ok) {
        const map: Record<string, FieldError[]> = {};
        for (const err of res.errors ?? []) {
          const p = typeof err.path === "string" ? err.path : "";
          if (!p) continue;
          if (!map[p]) map[p] = [];
          map[p].push({ code: String(err.code), message: String(err.message) });
        }
        setFieldErrors(map);
        return;
      }

      savePatch(patch);
      set保存d(patch);
    } catch (e: any) {
      setGlobalErr(e?.bodyText ? String(e.bodyText) : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // on重置 清空表单到 defaults，并可选清掉已保存 patch。
  function on重置(clear保存d: boolean): void {
    if (!manifest) return;
    const nextForm: Record<string, unknown> = {};
    for (const item of manifest.editable) {
      nextForm[item.path] = normalizeDefaultForForm(item, manifest.defaults);
    }
    setForm(nextForm);
    setFieldErrors({});
    setLast预览校验(null);
    if (clear保存d) {
      // 清除与当前 ssot_hash 绑定的已保存补丁。
      clearSavedPatch(manifest.ssot.ssot_hash);
      set保存d(null);
    }
  }

  if (!manifest) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Judge 配置</h2>
        <div className="sub" style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
          Loading manifest…
        </div>
        {globalErr ? (
          <pre className="card" style={{ padding: 12, marginTop: 12, whiteSpace: "pre-wrap" }}>
            {globalErr}
          </pre>
        ) : null}
      </div>
    );
  }

  const { ops, localErrors } = buildOpsFromForm(manifest, form);
  // localErrors 仅用于 UI 提示，不代表后端拒绝结果。
  const grouped = new Map<string, JudgeConfigManifestItemV1[]>();
  for (const item of manifest.editable) {
    const g = groupKey(item.path);
    const arr = grouped.get(g) ?? [];
    arr.push(item);
    grouped.set(g, arr);
  }

  return (
    <div className="grid">
      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Judge 配置</h2>
            <div className="sub" style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
              基于 Manifest 的编辑器（仅 replace）。SSOT： <span className="mono">{manifest.ssot.source}</span>
            </div>
            <div className="sub" style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>
              ssot_hash: <span className="mono">{manifest.ssot.ssot_hash}</span>
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <button className="btn ghost" onClick={() => void loadManifest()} disabled={busy}>
              刷新
            </button>
            <button className="btn ghost" onClick={() => on重置(false)} disabled={busy}>
              重置
            </button>
            <button className="btn ghost" onClick={() => on重置(true)} disabled={busy}>
              重置并清除已保存
            </button>
            <button className="btn" onClick={() => void on预览校验()} disabled={busy}>
              {busy ? "…" : "预览校验"}
            </button>
            <button className="btn primary" onClick={() => void on保存()} disabled={busy}>
              {busy ? "Saving…" : "保存"}
            </button>
          </div>
        </div>

        {globalErr ? (
          <div className="card" style={{ padding: 12, marginTop: 12, borderColor: "rgba(200,0,0,0.3)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "pre-wrap" }}>{globalErr}</div>
          </div>
        ) : null}

        <div className="sub" style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
          待提交变更: <span className="mono">{ops.length}</span>
          {saved ? (
            <span style={{ marginLeft: 10 }}>
              已保存补丁: <span className="mono">yes</span>
            </span>
          ) : (
            <span style={{ marginLeft: 10 }}>
              已保存补丁: <span className="mono">no</span>
            </span>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          {[...grouped.entries()].map(([g, items]) => (
            <details key={g} className="judgeDetails" open>
              <summary className="judgeSummary">{groupLabel(g)}</summary>
              <div className="grid" style={{ marginTop: 10 }}>
                {items.map((item) => {
                  const v = form[item.path];
                  const errs = fieldErrors[item.path] ?? [];
                  return (
                    <div key={item.path} className="card" style={{ padding: 12 }}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div>
                          <div className="mono" style={{ fontSize: 12 }}>{item.path}</div>
                          <div className="sub" style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>
                            类型： <span className="mono">{item.type}</span>
                            {typeof item.min === "number" ? (
                              <span style={{ marginLeft: 10 }}>
                                最小： <span className="mono">{String(item.min)}</span>
                              </span>
                            ) : null}
                            {typeof item.max === "number" ? (
                              <span style={{ marginLeft: 10 }}>
                                最大： <span className="mono">{String(item.max)}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        {item.type === "bool" ? (
                          <label className="pill">
                            值
                            <input
                              type="checkbox"
                              checked={Boolean(v)}
                              onChange={(e) => setForm((prev) => ({ ...prev, [item.path]: e.target.checked }))}
                            />
                          </label>
                        ) : null}

                        {item.type === "int" || item.type === "number" ? (
                          <label className="pill">
                            值
                            <input
                              className="input"
                              // 使用 text + inputMode，避免受控 number 输入在“0.”阶段吞掉小数点。
                              type="text"
                              inputMode={item.type === "int" ? "numeric" : "decimal"}
                              value={typeof v === "string" ? v : String(v ?? "")}
                              onChange={(e) => setForm((prev) => ({ ...prev, [item.path]: e.target.value }))}
                              style={{ width: 160 }}
                            />
                          </label>
                        ) : null}


                        {item.type === "enum_list" ? (
                          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                            {(item.enum ?? []).map((opt) => {
                              const arr = Array.isArray(v) ? v : [];
                              const checked = arr.includes(opt);
                              return (
                                <label key={opt} className="pill" title="enum_list option">
                                  <span className="mono" style={{ fontSize: 12 }}>{opt}</span>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...arr, opt]
                                        : arr.filter((x) => x !== opt);
                                      setForm((prev) => ({ ...prev, [item.path]: next }));
                                    }}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      {errs.length ? (
                        <div style={{ marginTop: 10 }}>
                          {errs.map((er, idx) => (
                            <div key={idx} className="mono" style={{ fontSize: 12, color: "rgba(220,70,70,1)" }}>
                              {er.code}: {er.message}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>

        {last预览校验 ? (
          <details className="judgeDetails" style={{ marginTop: 12 }}>
            <summary className="judgeSummary">最近一次预览/保存响应（审计）</summary>
            <pre className="card" style={{ padding: 12, overflow: "auto", maxHeight: 520, fontFamily: "var(--mono)", fontSize: 12 }}>
              {JSON.stringify(last预览校验, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
