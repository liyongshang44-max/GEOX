import React from "react";
import { useSettings } from "../hooks/useSettings";

export default function SettingsPage(): React.ReactElement {
  const { session, status, loading, tokenPreview, refresh } = useSettings();
  const roleLabel = session?.role === "admin" ? "管理员" : session?.role === "operator" ? "操作员" : "-";

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Settings</div>
          <h2 className="heroTitle">系统设置</h2>
          <p className="heroText">展示当前用户、会话信息与模式偏好。</p>
        </div>
      </section>

      <div className="contentGridTwo">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">当前用户</div><div className="sectionDesc">由统一会话注入 + auth/me 接口读取。</div></div></div>
          <div className="kv"><span className="k">角色</span><span className="v">{roleLabel}</span></div>
          <div className="kv"><span className="k">actor_id</span><span className="v">{session?.actor_id || "-"}</span></div>
          <div className="kv"><span className="k">tenant_id</span><span className="v">{session?.tenant_id || "-"}</span></div>
          <div className="kv"><span className="k">project_id</span><span className="v">{session?.project_id || "-"}</span></div>
          <div className="kv"><span className="k">group_id</span><span className="v">{session?.group_id || "-"}</span></div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">会话 / 偏好</div><div className="sectionDesc">页面不再直接编辑 token。</div></div></div>
          <div className="kv"><span className="k">token 预览</span><span className="v mono">{tokenPreview}</span></div>
          <div className="kv"><span className="k">状态消息</span><span className="v">{loading ? "同步中..." : (status || "-")}</span></div>
          <div className="kv"><span className="k">模式</span><span className="v">商业控制台模式</span></div>
          <div style={{ marginTop: 10 }}><button className="btn primary" onClick={() => void refresh()} disabled={loading}>刷新会话</button></div>
        </section>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">Scopes</div><div className="sectionDesc">后端返回的权限范围。</div></div></div>
        <div className="scopeWrap">{(session?.scopes || []).map((s) => <span className="pill" key={s}>{s}</span>)}</div>
      </section>
    </div>
  );
}
