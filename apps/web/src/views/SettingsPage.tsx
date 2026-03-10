import React from "react";
import { fetchAuthMe, type AuthMe } from "../lib/api";

const TOKEN_KEY = "geox_ao_act_token";
const ADMIN_FALLBACK = "geox_dev_MqF24b9NHfB6AkBNjKJaxP_T0CnL0XZykhdmSyoQvg4";
const OPERATOR_FALLBACK = "geox_op_tenantA_3n2QnT9Yj0F6mXcR8LkP4sVuWbHdZe7q1aBcDfGhJkM";

function readToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || ADMIN_FALLBACK; } catch { return ADMIN_FALLBACK; }
}

export default function SettingsPage(): React.ReactElement {
  const [token, setToken] = React.useState<string>(() => readToken());
  const [session, setSession] = React.useState<AuthMe | null>(null);
  const [status, setStatus] = React.useState<string>("");

  async function refresh(nextToken = token): Promise<void> {
    setStatus("正在读取当前会话...");
    try {
      const me = await fetchAuthMe(nextToken);
      setSession(me);
      setStatus(`当前角色：${me.role === "admin" ? "管理员" : "操作员"}`);
    } catch (e: any) {
      setSession(null);
      setStatus(`读取失败：${e?.message || String(e)}`);
    }
  }

  function persist(next: string): void {
    setToken(next);
    try { localStorage.setItem(TOKEN_KEY, next); } catch {}
  }

  React.useEffect(() => { void refresh(); }, []);

  const roleLabel = session?.role === "admin" ? "管理员" : session?.role === "operator" ? "操作员" : "-";

  return (
    <div className="consolePage">
      <section className="hero card compactHero">
        <div>
          <div className="eyebrow">Settings</div>
          <h2 className="heroTitle">系统设置</h2>
          <p className="heroText">R1 先交付最小角色门禁与会话查看，不引入完整用户管理后台。</p>
        </div>
      </section>

      <div className="contentGridTwo">
        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">当前会话</div><div className="sectionDesc">可在此切换管理员 / 操作员令牌，验证页面和接口门禁。</div></div></div>
          <div className="formGrid twoCols">
            <label className="field">访问令牌<input className="input" value={token} onChange={(e) => persist(e.target.value)} /></label>
            <div className="field fieldAction">会话操作<div className="row" style={{gap:8, flexWrap:'wrap'}}>
              <button className="btn" onClick={() => { persist(ADMIN_FALLBACK); void refresh(ADMIN_FALLBACK); }}>切换为管理员示例</button>
              <button className="btn" onClick={() => { persist(OPERATOR_FALLBACK); void refresh(OPERATOR_FALLBACK); }}>切换为操作员示例</button>
              <button className="btn primary" onClick={() => void refresh()}>刷新会话</button>
            </div></div>
          </div>
          <div className="kv"><span className="k">状态消息</span><span className="v">{status || '-'}</span></div>
        </section>

        <section className="card sectionBlock">
          <div className="sectionHeader"><div><div className="sectionTitle">角色摘要</div><div className="sectionDesc">最小角色仅区分管理员与操作员。</div></div></div>
          <div className="kv"><span className="k">角色</span><span className="v">{roleLabel}</span></div>
          <div className="kv"><span className="k">tenant_id</span><span className="v">{session?.tenant_id || '-'}</span></div>
          <div className="kv"><span className="k">project_id</span><span className="v">{session?.project_id || '-'}</span></div>
          <div className="kv"><span className="k">group_id</span><span className="v">{session?.group_id || '-'}</span></div>
          <div className="kv"><span className="k">actor_id</span><span className="v">{session?.actor_id || '-'}</span></div>
        </section>
      </div>

      <section className="card sectionBlock">
        <div className="sectionHeader"><div><div className="sectionTitle">门禁说明</div><div className="sectionDesc">后端强校验与前端中文提示同时存在。</div></div></div>
        <div className="bulletList">
          <div>管理员：可审批、可签发 / 撤销设备凭据、可生成全租户证据包。</div>
          <div>操作员：可查看审计、设备、田块、告警，可做对象级导出，但不能审批、不能签发凭据、不能做全租户导出。</div>
          <div>角色控制不会替代 scope；二者同时生效。</div>
        </div>
        <div className="scopeWrap">{(session?.scopes || []).map((s) => <span className="pill" key={s}>{s}</span>)}</div>
      </section>
    </div>
  );
}
