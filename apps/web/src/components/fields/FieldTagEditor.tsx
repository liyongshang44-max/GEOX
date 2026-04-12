import React from "react";
import { fetchAuthMe } from "../../api/auth";
import { addFieldTag, fetchFieldTags, removeFieldTag } from "../../api/fieldPortfolio";

type RoleType = "viewer" | "client" | "operator" | "admin" | "unknown";

function normalizeRole(role: string | null | undefined): RoleType {
  const value = String(role ?? "").trim().toLowerCase();
  if (value === "viewer" || value === "client" || value === "operator" || value === "admin") return value;
  return "unknown";
}

function canEdit(role: RoleType): boolean {
  return role === "operator" || role === "admin";
}

export default function FieldTagEditor({ fieldId }: { fieldId: string }): React.ReactElement {
  const [tags, setTags] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [role, setRole] = React.useState<RoleType>("unknown");

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchFieldTags(fieldId);
      setTags(next);
      setError("");
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : "标签加载失败"));
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  React.useEffect(() => {
    let alive = true;
    void fetchAuthMe().then((me) => {
      if (!alive) return;
      setRole(normalizeRole(me.role));
    }).catch(() => {
      if (!alive) return;
      setRole("unknown");
    });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const editable = canEdit(role);

  const onAdd = async (): Promise<void> => {
    const tag = input.trim();
    if (!tag) return;
    if (tags.includes(tag)) {
      setInput("");
      return;
    }
    setSaving(true);
    try {
      await addFieldTag(fieldId, tag);
      setInput("");
      await reload();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : "新增标签失败"));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (tag: string): Promise<void> => {
    setSaving(true);
    try {
      await removeFieldTag(fieldId, tag);
      await reload();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : "删除标签失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <div className="sectionHeader">
        <div>
          <div className="sectionTitle">Field Tags</div>
          <div className="sectionDesc">当前角色：{role}（{editable ? "可编辑" : "只读"}）</div>
        </div>
      </div>

      {editable ? (
        <div className="toolbarFilters" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="输入标签（例如：high_value）" value={input} onChange={(e) => setInput(e.target.value)} disabled={saving} />
          <button className="btn" onClick={() => void onAdd()} disabled={saving || !input.trim()}>{saving ? "提交中..." : "新增标签"}</button>
        </div>
      ) : null}

      {loading ? <div className="muted">标签加载中...</div> : (
        <div className="list">
          {tags.map((tag) => (
            <div key={tag} className="item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>{tag}</span>
              {editable ? <button className="btn" onClick={() => void onRemove(tag)} disabled={saving}>删除</button> : null}
            </div>
          ))}
          {!tags.length ? <div className="muted">暂无标签</div> : null}
        </div>
      )}

      {error ? <div className="muted" style={{ marginTop: 8 }}>{error}</div> : null}
    </section>
  );
}
