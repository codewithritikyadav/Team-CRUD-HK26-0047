import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { Badge, COLORS, fmt, inr, PageHead } from "./ui.jsx";

const EMPTY = { appliances: {}, sections: {} };

export default function Simulator({ fid, facility, scenario, setScenario }) {
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");

  // Recalculate on every change (debounced). Same backend engine as the dashboard.
  useEffect(() => {
    const t = setTimeout(() => api.simulate(fid, scenario).then((r) => { setRes(r); setError(""); }).catch((e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [fid, scenario, facility]);

  // Store only fields that differ from baseline, so "reset a field" = move it back.
  const setApp = (a, key, value) => {
    const cur = { ...(scenario.appliances[a.id] || {}) };
    if (value === a[key] || (key === "efficiency_gain_pct" && value === 0)) delete cur[key]; else cur[key] = value;
    const apps = { ...scenario.appliances };
    if (Object.keys(cur).length) apps[a.id] = cur; else delete apps[a.id];
    setScenario({ ...scenario, appliances: apps });
  };
  const setSec = (id, key, value, base) => {
    const cur = { ...(scenario.sections[id] || {}) };
    if (value === base) delete cur[key]; else cur[key] = value;
    const secs = { ...scenario.sections };
    if (Object.keys(cur).length) secs[id] = cur; else delete secs[id];
    setScenario({ ...scenario, sections: secs });
  };
  const changed = Object.keys(scenario.appliances).length + Object.keys(scenario.sections).length;

  const exportCsv = () => {
    const rows = [["Section", "Baseline kWh", "Scenario kWh", "Saving kWh (potential)"], ...res.per_section.map((s) => [s.name, s.baseline_kwh.toFixed(2), s.scenario_kwh.toFixed(2), s.saving_kwh.toFixed(2)]),
      [], ["Potential monthly saving", `${res.savings.kwh.toFixed(2)} kWh`, `INR ${res.savings.cost.toFixed(0)}`, `${res.savings.co2_kg.toFixed(2)} kg CO2`], ["Label", "SIMULATED - projected, not achieved"]];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "wattwise_scenario.csv" }).click();
    URL.revokeObjectURL(url);
  };

  const b = res?.baseline.totals, sc = res?.scenario.totals, sv = res?.savings;
  const chart = res?.per_section.map((s) => ({ name: s.name, Baseline: +s.baseline_kwh.toFixed(1), Scenario: +s.scenario_kwh.toFixed(1) }));

  return (
    <div className="stack">
      <PageHead title="What-if simulator" sub="Change hours, quantities or efficiency and see projected energy, cost and CO₂ against your baseline.">
        <button className="btn ghost" disabled={!changed} onClick={() => setScenario(EMPTY)}>Reset scenario</button>
        <button className="btn ghost" disabled={!res} onClick={exportCsv}>Export comparison</button>
      </PageHead>
      {error && <div className="err">{error}</div>}

      {res && (
        <>
          <div className="grid g4">
            <div className="card stat hero">
              <div className="row between"><span className="l">Potential CO₂ saving</span><Badge kind="simulated" /></div>
              <div className="v">{fmt(sv.co2_kg, 1)} <span className="l">kg / month</span></div>
              <div className="small">{fmt(sv.annual_co2_kg / 1000, 2)} tonnes per year if realised</div>
            </div>
            <Compare label="Energy" base={fmt(b.kwh)} scen={fmt(sc.kwh)} unit="kWh" save={fmt(sv.kwh, 1)} pct={sv.pct} />
            <Compare label="Cost" base={inr(b.cost)} scen={inr(sc.cost)} unit="" save={inr(sv.cost)} pct={sv.pct} />
            <Compare label="Per year" base={inr(b.annual_cost)} scen={inr(sc.annual_cost)} unit="" save={inr(sv.annual_cost)} pct={sv.pct} />
          </div>
          <div className="note">These are <b>projected</b> savings from the values you changed, not savings that have been achieved. Verify with real readings in Past data after acting.</div>
          <div className="card">
            <h2>Energy by section: baseline vs scenario (kWh/month)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart}><CartesianGrid stroke={COLORS.grid} vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} width={60} /><Tooltip /><Legend />
                <Bar dataKey="Baseline" fill="#9db0ba" radius={[4, 4, 0, 0]} /><Bar dataKey="Scenario" fill={COLORS.sim} radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {facility.sections.map((s) => {
        const so = scenario.sections[s.id] || {};
        const scale = so.hours_scale ?? 1;
        return (
          <div className="card" key={s.id}>
            <div className="row between">
              <div><h2>{s.name}</h2><span className="muted small">{s.room_count} room(s)</span></div>
              <label className="f" style={{ width: 260 }}>All hours in this section: {Math.round(scale * 100)}% of baseline
                <input type="range" min="0.4" max="1.2" step="0.05" value={scale} onChange={(e) => setSec(s.id, "hours_scale", +e.target.value, 1)} /></label>
            </div>
            <div className="scroll"><table>
              <thead><tr><th>Appliance</th><th style={{ width: 230 }}>Hours/day</th><th>Qty/room</th><th style={{ width: 200 }}>Efficiency gain</th><th className="num">Scenario kWh</th></tr></thead>
              <tbody>{s.appliances.map((a) => {
                const o = scenario.appliances[a.id] || {};
                const hours = o.hours_per_day ?? a.hours_per_day, eff = o.efficiency_gain_pct ?? 0;
                const row = res?.scenario.sections.find((x) => x.id === s.id)?.appliances.find((x) => x.id === a.id);
                const was = res?.baseline.sections.find((x) => x.id === s.id)?.appliances.find((x) => x.id === a.id);
                return (
                  <tr key={a.id}>
                    <td>{a.name}<div className="muted small">{a.rated_power_watts} W each</div></td>
                    <td><div className="row" style={{ flexWrap: "nowrap" }}><input type="range" min="0" max="24" step="0.5" value={hours} onChange={(e) => setApp(a, "hours_per_day", +e.target.value)} /><b style={{ width: 44 }}>{hours}h</b></div></td>
                    <td><input type="number" min="0" style={{ width: 70 }} value={o.quantity_per_room ?? a.quantity_per_room} onChange={(e) => setApp(a, "quantity_per_room", Math.max(0, parseInt(e.target.value) || 0))} /></td>
                    <td><div className="row" style={{ flexWrap: "nowrap" }}><input type="range" min="0" max="60" step="5" value={eff} onChange={(e) => setApp(a, "efficiency_gain_pct", +e.target.value)} /><b style={{ width: 44 }}>{eff}%</b></div></td>
                    <td className="num">{row ? <><b>{fmt(row.kwh, 1)}</b> <span className="muted small">/ {fmt(was.kwh, 1)}</span></> : "–"}</td>
                  </tr>);
              })}</tbody>
            </table></div>
          </div>
        );
      })}
    </div>
  );
}

function Compare({ label, base, scen, unit, save, pct }) {
  return (
    <div className="card stat">
      <div className="row between"><span className="l">{label}</span><Badge kind="simulated" /></div>
      <div className="v" style={{ color: COLORS.sim }}>{scen} <span className="l">{unit}</span></div>
      <div className="small muted">baseline {base}</div>
      <div className="small good">saves {save} ({fmt(pct, 1)}%)</div>
    </div>
  );
}
