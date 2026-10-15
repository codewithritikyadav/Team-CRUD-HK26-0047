import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { Badge, COLORS, Empty, fmt, inr, PageHead, Stat, useAction } from "./ui.jsx";

const CAT_COLORS = { lighting: "#e8b923", cooling: "#2563a8", computing: "#6b5bd2", appliance: "#1b7a5a", other: "#8a9aa3" };

function Assumptions({ facility, refresh }) {
  const [v, setV] = useState(facility);
  const { error, run, busy } = useAction();
  useEffect(() => setV(facility), [facility]);
  const { id, sections, ...rest } = v;
  const save = () => run(async () => { await api.updateFacility(facility.id, { ...rest, tariff_per_kwh: +v.tariff_per_kwh, emissions_factor: +v.emissions_factor }); await refresh(); });
  const dirty = +v.tariff_per_kwh !== facility.tariff_per_kwh || +v.emissions_factor !== facility.emissions_factor || v.emissions_factor_source !== facility.emissions_factor_source;
  return (
    <div className="card">
      <div className="row between"><h2>Assumptions</h2><Badge kind="estimated">user-editable</Badge></div>
      {error && <div className="err">{error}</div>}
      <div className="form" style={{ marginTop: 10 }}>
        <label className="f">Tariff (₹/kWh)<input type="number" step="0.1" value={v.tariff_per_kwh} onChange={(e) => setV({ ...v, tariff_per_kwh: e.target.value })} /></label>
        <label className="f">Emissions factor (kg CO₂/kWh)<input type="number" step="0.001" value={v.emissions_factor} onChange={(e) => setV({ ...v, emissions_factor: e.target.value })} /></label>
        <label className="f" style={{ gridColumn: "span 2" }}>Factor source<input value={v.emissions_factor_source} onChange={(e) => setV({ ...v, emissions_factor_source: e.target.value })} /></label>
        <button className="btn" disabled={busy || !dirty} onClick={save}>Update</button>
      </div>
    </div>
  );
}

export default function Dashboard({ facility, summary, refresh, fid, setTab }) {
  const [hist, setHist] = useState(null);
  useEffect(() => { api.history(fid).then(setHist); }, [fid, facility]);
  if (!summary) return null;
  const t = summary.totals;
  if (!t.kwh) return <Empty>No estimate yet. Add appliances in Inventory first.<br /><button className="btn" style={{ marginTop: 12 }} onClick={() => setTab("inventory")}>Go to inventory</button></Empty>;

  const top = [...summary.sections].sort((a, b) => b.kwh - a.kwh)[0];
  const secData = summary.sections.map((s) => ({ name: s.name, kwh: +s.kwh.toFixed(1), co2: +s.co2_kg.toFixed(1) }));
  const appData = summary.appliances_ranked.slice(0, 8).map((a) => ({ name: `${a.name} (${a.section_name})`, kwh: +a.kwh.toFixed(1) }));
  const histData = (hist?.records || []).filter((r) => r.section_id === null);

  return (
    <div className="stack">
      <PageHead title={facility.name} sub={`${facility.facility_type} · ${facility.reporting_period} estimate`}>
        <a className="btn ghost" href={api.reportUrl(fid)}>Download CSV report</a>
      </PageHead>

      <div className="grid g3">
        <div className="card stat hero">
          <div className="row between"><span className="l">Electricity-related CO₂</span><Badge kind="estimated" /></div>
          <div className="v">{fmt(t.co2_kg)} <span className="l">kg / month</span></div>
          <div className="small">≈ {fmt(t.annual_co2_kg / 1000, 1)} tonnes per year at {facility.emissions_factor} kg/kWh</div>
        </div>
        <Stat label="Energy" value={fmt(t.kwh)} unit="kWh / month" badge="estimated" color={COLORS.kwh} />
        <Stat label="Energy cost" value={inr(t.cost)} unit="/ month" badge="estimated" color={COLORS.cost} />
      </div>

      <div className="note">Estimates use rated power × hours × days. Cost is energy charge only at ₹{facility.tariff_per_kwh}/kWh (an assumption). CO₂ covers electricity only. Source of factor: {facility.emissions_factor_source}.</div>

      <div className="card"><b>{top.name}</b> is the largest estimated consumer at <b>{fmt(top.share_pct)}%</b> of usage ({fmt(top.kwh)} kWh, {fmt(top.co2_kg)} kg CO₂ per month).</div>

      <div className="grid g2">
        <div className="card">
          <h2>Energy and carbon by section</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={secData}><CartesianGrid stroke={COLORS.grid} vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis yAxisId="l" fontSize={12} unit=" kWh" width={70} /><YAxis yAxisId="r" orientation="right" fontSize={12} unit=" kg" width={60} />
              <Tooltip /><Legend />
              <Bar yAxisId="l" dataKey="kwh" name="Energy (kWh)" fill={COLORS.kwh} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="r" dataKey="co2" name="CO₂ (kg)" fill={COLORS.co2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Where the energy goes (by category)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart><Pie data={summary.by_category} dataKey="kwh" nameKey="category" innerRadius={55} outerRadius={95} label={(e) => `${e.category} ${fmt(e.share_pct)}%`}>
              {summary.by_category.map((c) => <Cell key={c.category} fill={CAT_COLORS[c.category]} />)}
            </Pie><Tooltip formatter={(v) => `${fmt(v, 1)} kWh`} /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Top appliance contributions (kWh / month)</h2>
        <ResponsiveContainer width="100%" height={Math.max(220, appData.length * 36)}>
          <BarChart data={appData} layout="vertical" margin={{ left: 40 }}><CartesianGrid stroke={COLORS.grid} horizontal={false} /><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="name" width={200} fontSize={12} /><Tooltip /><Bar dataKey="kwh" name="kWh" fill={COLORS.kwh} radius={[0, 4, 4, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="row between"><h2>Estimate vs past readings</h2>{histData.length > 0 && <span className="row">{[...new Set(histData.map((r) => r.label))].map((l) => <Badge key={l} kind={l} />)}</span>}</div>
        {histData.length === 0 ? <p className="muted">No facility-level past records yet. <button className="btn sm ghost" onClick={() => setTab("history")}>Add past data</button></p> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={histData}><CartesianGrid stroke={COLORS.grid} vertical={false} /><XAxis dataKey="period_start" fontSize={12} tickFormatter={(d) => d.slice(0, 7)} /><YAxis fontSize={12} width={60} /><Tooltip /><Legend />
              <Bar dataKey="actual_monthly_kwh" name="Recorded (30-day kWh)" fill={COLORS.cost} radius={[4, 4, 0, 0]} />
              <Line dataKey="estimate_monthly_kwh" name="Appliance estimate" stroke={COLORS.kwh} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card scroll">
        <h2 style={{ marginBottom: 8 }}>Section breakdown</h2>
        <table><thead><tr><th>Section</th><th className="num">Rooms</th><th className="num">kWh</th><th className="num">Share</th><th className="num">Cost</th><th className="num">CO₂ (kg)</th><th style={{ width: 120 }} /></tr></thead>
          <tbody>{summary.sections.map((s) => <tr key={s.id}><td>{s.name}</td><td className="num">{s.room_count}</td><td className="num">{fmt(s.kwh, 1)}</td><td className="num">{fmt(s.share_pct, 1)}%</td><td className="num">{inr(s.cost)}</td><td className="num">{fmt(s.co2_kg, 1)}</td><td><div className="bar"><i style={{ width: `${s.share_pct}%` }} /></div></td></tr>)}
            <tr><td><b>Total</b></td><td /><td className="num"><b>{fmt(t.kwh, 1)}</b></td><td className="num">100%</td><td className="num"><b>{inr(t.cost)}</b></td><td className="num"><b>{fmt(t.co2_kg, 1)}</b></td><td /></tr></tbody></table>
      </div>

      <Assumptions facility={facility} refresh={refresh} />
    </div>
  );
}
