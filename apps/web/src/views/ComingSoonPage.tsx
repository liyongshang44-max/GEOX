import React from "react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  summary: string;
  bullets: string[];
  nextLink?: { to: string; label: string };
};

export default function ComingSoonPage({ title, summary, bullets, nextLink }: Props): React.ReactElement {
  return (
    <div className="consolePage">
      <section className="hero card">
        <div>
          <div className="eyebrow">规划中的业务模块</div>
          <h2 className="heroTitle">{title}</h2>
          <p className="heroText">{summary}</p>
        </div>
        {nextLink ? <Link className="btn primary" to={nextLink.to}>{nextLink.label}</Link> : null}
      </section>

      <section className="card sectionBlock">
        <div className="sectionTitle">本轮计划</div>
        <ul className="checkList">
          {bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
      </section>
    </div>
  );
}
