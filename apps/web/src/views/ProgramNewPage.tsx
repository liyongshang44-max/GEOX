import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { createProgram } from "../api/programs";
import { fetchFields } from "../api/fields";

type Priority = "low" | "medium" | "high";
type CropCode = "corn" | "tomato";

type FormState = {
  program_name: string;
  field_id: string;
  season_id: string;
  crop_code: CropCode;
  goal_quality: Priority;
  goal_yield: Priority;
};

const INITIAL_FORM: FormState = {
  program_name: "",
  field_id: "",
  season_id: "",
  crop_code: "corn",
  goal_quality: "high",
  goal_yield: "medium",
};

function parseSchemaErrors(error: unknown): string[] {
  if (!(error instanceof ApiError)) return ["创建失败，请稍后重试"];
  try {
    const body = JSON.parse(error.bodyText || "{}");
    if (!Array.isArray(body?.details)) return [String(body?.error || "创建失败")];
    return body.details.map((item: any) => {
      const path = Array.isArray(item?.path) ? item.path.join(".") : "";
      return `${path || "字段"}: ${String(item?.message || "格式错误")}`;
    });
  } catch {
    return [error.bodyText || "创建失败"];
  }
}

export default function ProgramNewPage(): React.ReactElement {
  const navigate = useNavigate();
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [fields, setFields] = React.useState<Array<{ field_id: string; name?: string }>>([]);

  React.useEffect(() => {
    let mounted = true;
    void fetchFields()
      .then((items) => {
        if (!mounted) return;
        const normalized = (items ?? []).map((item: any) => ({
          field_id: String(item?.field_id ?? "").trim(),
          name: typeof item?.name === "string" ? item.name : undefined,
        })).filter((item) => item.field_id);
        setFields(normalized);
        if (normalized.length === 1) setForm((prev) => ({ ...prev, field_id: normalized[0].field_id }));
      })
      .catch(() => setFields([]));
    return () => { mounted = false; };
  }, []);

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setSubmitting(true);
    setErrors([]);
    try {
      const result = await createProgram(form);
      navigate(`/programs/${encodeURIComponent(result.program_id)}`);
    } catch (error) {
      setErrors(parseSchemaErrors(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="demoDashboardPage">
      <section className="card detailHeroCard">
        <div className="demoSectionHeader">
          <div className="sectionTitle">新建方案</div>
          <div className="sectionDesc">创建可进入真实业务流的 Program，后续 recommendation 才能带入 crop_code。</div>
        </div>
        <form className="decisionList" onSubmit={onSubmit}>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">方案名称</div>
            <input className="input" value={form.program_name} onChange={(e) => onChange("program_name", e.target.value)} placeholder="例如：春季番茄示范方案" required />
          </label>

          <label className="decisionItemStatic">
            <div className="decisionItemTitle">field_id</div>
            {fields.length > 0 ? (
              <select className="select" value={form.field_id} onChange={(e) => onChange("field_id", e.target.value)} required>
                <option value="">请选择田块</option>
                {fields.map((item) => <option key={item.field_id} value={item.field_id}>{item.name || item.field_id}</option>)}
              </select>
            ) : (
              <input className="input" value={form.field_id} onChange={(e) => onChange("field_id", e.target.value)} placeholder="field_c8_demo" required />
            )}
          </label>

          <label className="decisionItemStatic">
            <div className="decisionItemTitle">season_id</div>
            <input className="input" value={form.season_id} onChange={(e) => onChange("season_id", e.target.value)} placeholder="season_demo_2026" required />
          </label>

          <label className="decisionItemStatic">
            <div className="decisionItemTitle">crop_code</div>
            <select className="select" value={form.crop_code} onChange={(e) => onChange("crop_code", e.target.value as CropCode)}>
              <option value="corn">corn</option>
              <option value="tomato">tomato</option>
            </select>
          </label>

          <label className="decisionItemStatic">
            <div className="decisionItemTitle">目标质量</div>
            <select className="select" value={form.goal_quality} onChange={(e) => onChange("goal_quality", e.target.value as Priority)}>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>

          <label className="decisionItemStatic">
            <div className="decisionItemTitle">目标产量</div>
            <select className="select" value={form.goal_yield} onChange={(e) => onChange("goal_yield", e.target.value as Priority)}>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>

          {errors.length > 0 ? (
            <div className="card" style={{ borderColor: "#ef4444", background: "#fff5f5" }}>
              <div className="decisionItemTitle">表单校验失败</div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                {errors.map((item, idx) => <li key={`${item}_${idx}`}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit" disabled={submitting}>{submitting ? "创建中..." : "创建方案"}</button>
            <Link className="btn" to="/programs">取消</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
