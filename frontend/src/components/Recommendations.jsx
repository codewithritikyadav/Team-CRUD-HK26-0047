import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Badge, Empty, fmt, inr, PageHead } from "./ui.jsx";

export default function Recommendations({ fid, facility, testScenario }) {
  const [recs, setRecs] = useState(null);
  useEffect(() => { api.recommendations(fid).then(setRecs); }, [fid, facility]);
  if (!recs) return null;
  return (
    <div className="stack">
      <PageHead title="Recommendations" sub="Each suggestion comes from your inputs. Savings are projections from stated assumptions, not achieved results. Never cut essential cooling, ventilation or safety equipment." />
      {recs.length === 0 && <Empty>Nothing stands out for the current inventory. Add more data or past readings for deeper checks.</Empty>}
      {recs.map((r) => (
        <div key={r.id} className={`card rec ${r.severity}`}>
          <div className="row between"><h2>{r.title}</h2><Badge kind={r.severity}>{r.severity}</Badge></div>
          <p style={{ margin: "8px 0 4px" }}><b>Why:</b> {r.reason}</p>
          <p style={{ margin: "4px 0" }}><b>Suggested action:</b> {r.action}</p>
          {r.affected && <p style={{ margin: "4px 0" }} className="muted small">Affects: {r.affected}</p>}
          {r.impact && (
            <div className="row" style={{ margin: "8px 0" }}>
              <Badge kind="simulated">potential</Badge>
              <span><b>{fmt(r.impact.kwh)} kWh</b> · <b>{inr(r.impact.cost)}</b> · <b>{fmt(r.impact.co2_kg)} kg CO₂</b> per month</span>
            </div>
          )}
          {r.assumptions && <p className="muted small" style={{ margin: "4px 0 10px" }}>Assumption: {r.assumptions}</p>}
          {r.scenario && <button className="btn" onClick={() => testScenario(r.scenario)}>Test in simulator</button>}
        </div>
      ))}
    </div>
  );
}
