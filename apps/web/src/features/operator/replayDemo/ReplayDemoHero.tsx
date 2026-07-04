// apps/web/src/features/operator/replayDemo/ReplayDemoHero.tsx
// Purpose: render the first-screen H61 replay-backed demo identity.
// Boundary: this hero states replay identity and nonclaims; it does not assert production operation.

import React from "react";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoHeroProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoHero({ vm }: ReplayDemoHeroProps): React.ReactElement {
  return (
    <section className="operatorReplayDemo__hero" aria-label="Replay Demo Hero">
      <p className="operatorReplayDemo__eyebrow">Replay-backed Demo</p>
      <h1 className="operatorReplayDemo__title">Replay-backed Gateway Demo</h1>
      <p className="operatorReplayDemo__lead">This page renders a checked-in P51 gateway-path snapshot as a product demo. It shows how device-path evidence can be mapped, deduplicated, time-bounded, and traced back.</p>
      <p className="operatorReplayDemo__lead">This is not a live gateway, not a real-device proof, not Runtime Health, and not an execution or dispatch surface.</p>
      <p className="operatorReplayDemo__lead">这是一个回放支撑的 gateway-path 产品演示页。它展示的是静态快照中的证据链、标准映射、去重、时间窗口与可追溯性。</p>
      <dl className="operatorReplayDemo__meta" aria-label="Replay demo identity">
        <div><dt>Mode</dt><dd>{vm.mode}</dd></div>
        <div><dt>Source</dt><dd>checked-in P51 gateway viewer snapshot</dd></div>
        <div><dt>Route</dt><dd>{vm.route}</dd></div>
        <div><dt>Read-only</dt><dd>{vm.boundary.readOnly ? "true" : "false"}</dd></div>
      </dl>
    </section>
  );
}
