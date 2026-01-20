// GEOX/apps/web/src/routes/App.tsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import GroupListPage from "../views/GroupListPage";
import GroupTimelinePage from "../views/GroupTimelinePage";
import JudgeRunPage from "../views/JudgeRunPage";
import JudgeRecordsPage from "../views/JudgeRecordsPage";
import JudgeConfigPage from "../views/JudgeConfigPage";
import SimConfigPage from "../views/SimConfigPage";
import AdminHealthPage from "../views/AdminHealthPage";
import AdminImportPage from "../views/AdminImportPage";
import AdminAcceptancePage from "../views/AdminAcceptancePage";

export default function App(): React.ReactElement {
  const [expert, setExpert] = React.useState<boolean>(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("expert") === "1") {
        localStorage.setItem("geox_expert", "1");
        return true;
      }
      return localStorage.getItem("geox_expert") === "1";
    } catch {
      return false;
    }
  });

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <h1>GEOX</h1>
          <div className="sub">Apple I (Monitor) + Apple II (Judge)</div>
        </div>
        <div className="row">
          <Link className="btn ghost" to="/">Groups</Link>
          {expert ? (
            <>
              <Link className="btn ghost" to="/judge/run">Judge</Link>
              <Link className="btn ghost" to="/judge/records">Judge Records</Link>
              <Link className="btn ghost" to="/judge/config">Judge Config</Link>
              <Link className="btn ghost" to="/sim/config">监测器配置</Link>
              <Link className="btn ghost" to="/admin/healthz">Healthz</Link>
              <Link className="btn ghost" to="/admin/import">Import</Link>
              <Link className="btn ghost" to="/admin/acceptance">Acceptance</Link>
            </>
          ) : null}

          <button
            className={"btn ghost"}
            onClick={() => {
              const next = !expert;
              setExpert(next);
              try {
                if (next) localStorage.setItem("geox_expert", "1");
                else localStorage.removeItem("geox_expert");
              } catch {
                // ignore
              }
            }}
            title="Expert mode exposes debug/Judge pages"
          >
            {expert ? "Expert: On" : "Expert: Off"}
          </button>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<GroupListPage />} />
        <Route path="/group/:groupId" element={<GroupTimelinePage />} />
        <Route path="/judge/run" element={<JudgeRunPage />} />
        <Route path="/judge/records" element={<JudgeRecordsPage />} />
        <Route path="/judge/config" element={<JudgeConfigPage />} />
        <Route path="/sim/config" element={<SimConfigPage />} />
        <Route path="/admin/healthz" element={<AdminHealthPage />} />
        <Route path="/admin/import" element={<AdminImportPage />} />
        <Route path="/admin/acceptance" element={<AdminAcceptancePage />} />
      </Routes>
    </div>
  );
}
