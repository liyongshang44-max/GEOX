import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { createProgram } from "../../../api/programs";
import { fetchFields } from "../../../api/fields";

type CropCode = "corn" | "tomato";
type TemplateType = "basic" | "water_saving" | "cost_control";

type FormState = {
  field_id: string;
  crop_code: CropCode;
  variety: string;
  target_yield: string;
  template: TemplateType;
  constraints_notes: string;
  season_start: string;
  season_end: string;
};

const INITIAL_FORM: FormState = {
  field_id: "",
  crop_code: "corn",
  variety: "",
  target_yield: "",
  template: "basic",
  constraints_notes: "",
  season_start: "",
  season_end: "",
};

function parseSchemaErrors(error: unknown): string[] {
  if (!(error instanceof ApiError)) return ["创建失败，请稍后重试"];
  try {
    const body = JSON.parse(error.bodyText || "{}");
    if (!Array.isArray(body?.details)) return [String(body?.error || "创建失败")];
    return body.details.map((item: any) => `${Array.isArray(item?.path) ? item.path.join(".") : "字段"}: ${String(item?.message || "格式错误")}`);
  } catch {
    return [error.bodyText || "创建失败"];
  }
}

export default function ProgramCreatePage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [fields, setFields] = React.useState<Array<{ field_id: string; name?: string }>>([]);
  const [fieldsLoadFailed, setFieldsLoadFailed] = React.useState(false);

  React.useEffect(() => {
    const fieldFromQuery = String(searchParams.get("field_id") ?? "").trim();
    if (fieldFromQuery) setForm((prev) => ({ ...prev, field_id: fieldFromQuery }));
  }, [searchParams]);

  React.useEffect(() => {
    let mounted = true;
    void fetchFields().then((items) => {
      if (!mounted) return;
      const normalized = (items ?? [])
        .map((item: any) => ({ field_id: String(item?.field_id ?? "").trim(), name: typeof item?.name === "string" ? item.name : undefined }))
        .filter((item) => item.field_id);
      setFieldsLoadFailed(false);
      setFields(normalized);
      if (!form.field_id && normalized.length === 1) setForm((prev) => ({ ...prev, field_id: normalized[0].field_id }));
    }).catch(() => {
      if (!mounted) return;
      setFields([]);
      setFieldsLoadFailed(true);
    });
    return () => { mounted = false; };
  }, []);

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (evt: React.FormEvent): Promise<void> => {
    evt.preventDefault();
    if (!form.field_id.trim()) {
      setErrors(["请选择关联田块"]);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    try {
      const seasonId = `season_${form.season_start || new Date().toISOString().slice(0, 10)}_${form.crop_code}`;
      const notes = [
        `template=${form.template}`,
        form.variety ? `variety=${form.variety}` : "",
        form.target_yield ? `target_yield=${form.target_yield}` : "",
        form.constraints_notes ? `constraints=${form.constraints_notes}` : "",
        form.season_start ? `start=${form.season_start}` : "",
        form.season_end ? `end=${form.season_end}` : "",
      ].filter(Boolean).join("; ");
      const result = await createProgram({
        program_name: `${form.field_id}_${form.crop_code}_init`,
        field_id: form.field_id,
        season_id: seasonId,
        crop_code: form.crop_code,
        goal_quality: "medium",
        goal_yield: "medium",
        constraints_notes: notes,
      });
      navigate(`/programs/${encodeURIComponent(result.program_id)}?created=1`);
    } catch (error) {
      setErrors(parseSchemaErrors(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="demoDashboardPage">
      <section className="card detailHeroCard programCreateCard">
        <div className="demoSectionHeader">
          <div className="sectionTitle">初始化经营</div>
          <div className="sectionDesc">使用模板快速创建首个 Program：无需填写复杂农学策略字段。</div>
        </div>
        <div className="programTemplateHint" style={{ marginBottom: 10 }}>
          首轮只需填写田块、作物、目标产量和模板，复杂策略字段由系统按模板生成。
        </div>
        <form className="decisionList" onSubmit={onSubmit}>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">关联田块</div>
            {fields.length > 0 ? (
              <select className="select" value={form.field_id} onChange={(e) => onChange("field_id", e.target.value)} required>
                <option value="">请选择田块</option>
                {fields.map((item) => <option key={item.field_id} value={item.field_id}>{item.name || item.field_id}</option>)}
              </select>
            ) : (
              <input className="input" value={form.field_id} onChange={(e) => onChange("field_id", e.target.value)} placeholder="field_demo_001" required />
            )}
          </label>

          {fields.length === 0 ? (
            <div className="decisionItemStatic">
              {fieldsLoadFailed ? "暂无田块可选，请稍后刷新重试" : "暂无田块可选"}
            </div>
          ) : null}

          <label className="decisionItemStatic">
            <div className="decisionItemTitle">作物</div>
            <select className="select" value={form.crop_code} onChange={(e) => onChange("crop_code", e.target.value as CropCode)}>
              <option value="corn">corn</option>
              <option value="tomato">tomato</option>
            </select>
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">品种（可选）</div>
            <input className="input" value={form.variety} onChange={(e) => onChange("variety", e.target.value)} placeholder="例如：甜玉米 608" />
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">目标产量</div>
            <input className="input" value={form.target_yield} onChange={(e) => onChange("target_yield", e.target.value)} placeholder="例如：9000 kg/ha" />
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">策略模板</div>
            <select className="select" value={form.template} onChange={(e) => onChange("template", e.target.value as TemplateType)}>
              <option value="basic">基础模板</option>
              <option value="water_saving">节水优先</option>
              <option value="cost_control">成本优先</option>
            </select>
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">限制条件（可选）</div>
            <textarea className="input" value={form.constraints_notes} onChange={(e) => onChange("constraints_notes", e.target.value)} placeholder="例如：禁止夜间灌溉，需人工复核农药动作" />
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">周期信息（可选）</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input className="input" type="date" value={form.season_start} onChange={(e) => onChange("season_start", e.target.value)} />
              <input className="input" type="date" value={form.season_end} onChange={(e) => onChange("season_end", e.target.value)} />
            </div>
          </label>

          {errors.length > 0 ? <div className="decisionItemStatic"><ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((item, idx) => <li key={`${item}_${idx}`}>{item}</li>)}</ul></div> : null}

          <div className="operationsSummaryActions">
            <button className="btn primary" type="submit" disabled={submitting}>{submitting ? "创建中..." : "创建经营方案"}</button>
            <Link className="btn" to="/programs">返回方案列表</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
