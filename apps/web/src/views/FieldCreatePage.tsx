import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createField } from "../api/fields";

type FieldCreateForm = {
  field_id: string;
  name: string;
  area_ha: string;
  crop_code: string;
  location_text: string;
  group_id: string;
};

const INITIAL_FORM: FieldCreateForm = {
  field_id: "",
  name: "",
  area_ha: "",
  crop_code: "",
  location_text: "",
  group_id: "",
};

export default function FieldCreatePage(): React.ReactElement {
  const navigate = useNavigate();
  const [form, setForm] = React.useState<FieldCreateForm>(INITIAL_FORM);
  const [status, setStatus] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const update = <K extends keyof FieldCreateForm>(key: K, value: FieldCreateForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (evt: React.FormEvent): Promise<void> => {
    evt.preventDefault();
    if (!form.field_id.trim() || !form.name.trim()) {
      setStatus("请至少填写田块ID与田块名称。");
      return;
    }
    setSubmitting(true);
    setStatus("正在创建田块...");
    try {
      const res = await createField({
        field_id: form.field_id.trim(),
        name: form.name.trim(),
        area_ha: form.area_ha.trim() ? Number(form.area_ha) : null,
        crop_code: form.crop_code.trim() || null,
        location_text: form.location_text.trim() || null,
        group_id: form.group_id.trim() || null,
        boundary_geojson: null,
      });
      if (res?.ok && res.field_id) {
        navigate(`/fields/${encodeURIComponent(res.field_id)}?created=1`);
        return;
      }
      setStatus(`创建失败：${res?.error ?? "UNKNOWN_ERROR"}`);
    } catch (e: any) {
      setStatus(`创建失败：${e?.bodyText || e?.message || String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="demoDashboardPage">
      <section className="card detailHeroCard">
        <div className="demoSectionHeader">
          <div className="sectionTitle">新建田块</div>
          <div className="sectionDesc">边界可后续补充：即使暂无 GeoJSON 也可先完成创建并继续开局流程。</div>
        </div>
        <form className="decisionList" onSubmit={onSubmit}>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">田块名称</div>
            <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="例如：南区示范田A" required />
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">田块ID</div>
            <input className="input" value={form.field_id} onChange={(e) => update("field_id", e.target.value)} placeholder="field_demo_001" required />
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">面积（ha）</div>
            <input className="input" value={form.area_ha} onChange={(e) => update("area_ha", e.target.value)} placeholder="12.5" />
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">当前/计划作物</div>
            <input className="input" value={form.crop_code} onChange={(e) => update("crop_code", e.target.value)} placeholder="corn / tomato" />
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">地理位置说明（可选）</div>
            <input className="input" value={form.location_text} onChange={(e) => update("location_text", e.target.value)} placeholder="江苏省宿迁市..." />
          </label>
          <label className="decisionItemStatic">
            <div className="decisionItemTitle">所属经营分组（可选）</div>
            <input className="input" value={form.group_id} onChange={(e) => update("group_id", e.target.value)} placeholder="group_demo_01" />
          </label>
          <div className="decisionItemStatic">
            <div className="decisionItemTitle">地理边界</div>
            <div className="decisionItemMeta">当前支持后补。创建后可在田块详情补充边界数据。</div>
          </div>
          {status ? <div className="decisionItemStatic">{status}</div> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" type="submit" disabled={submitting}>{submitting ? "创建中..." : "创建田块"}</button>
            <Link className="btn" to="/fields">取消</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
