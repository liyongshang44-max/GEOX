import React from "react";

type Props = {
  skillBindingIds: string[];
  skillRunIds: string[];
};

export default function SkillAssemblyCard({ skillBindingIds, skillRunIds }: Props): React.ReactElement {
  return (
    <section className="flight-card flight-mini-card">
      <h3>技能装配</h3>
      <p className="flight-muted">FT-D 才执行技能绑定与 failure lane。A0 只展示 manifest 计数。</p>
      <dl>
        <dt>绑定</dt><dd>{skillBindingIds.length}</dd>
        <dt>运行</dt><dd>{skillRunIds.length}</dd>
      </dl>
    </section>
  );
}
