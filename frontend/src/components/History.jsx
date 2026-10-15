import { useEffect, useRef, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { Badge, COLORS, Empty, fmt, PageHead, Stat, useAction } from "./ui.jsx";

const today = () => new Date().toISOString().slice(0, 10);

function AddRecord({ facility, onAdded }) {
  const blank = { period_start: "", period_end: "", energy_kwh: "", cost: "", source_type: "meter", meter_id: "", section_id: "" };
  const [v, setV] = useState(blank);
  const { error, run, busy } = useAction();
  const s = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const add = () => run(async () => {
    await api.addRecord(facility.id, { ...v, energy_kwh: +v.energy_kwh, cost: v.cost === "" ? null : +v.cost, meter_id: v.meter_id || null, section_id: v.section_id ? +v.section_id : null });
    setV(blank); await onAdded();
  });
  return (
    <div className="card">
      <h2 style={{ marginBottom: 10 }}>Add a reading</h2>
      {error && <div className="err">{error}</div>}
      <div className="form">
        <label className="f">Period start<input type="date" value={v.period_start} onChange={s("period_start")} /></label>
        <label className="f">Period end<input type="date" value={v.period_end} onChange={s("period_end")} /></label>
        <label className="f">Energy (kWh)<input type="number" min="0" value={v.energy_kwh} onChange={s("energy_kwh")} /></label>
        <label className="f">Cost (₹, optional)<input type="number" min="0" value={v.cost} onChange={s("cost")} /></label>
        <label className="f">Source<select value={v.source_type} onChange={s("source_type")}><option value="meter">Meter reading</option><option value="bill">Electricity bill</option><option value="simulated">Simulated</option></select></label>
        <label className="f">Covers<select value={v.section_id} onChange={s("section_id")}><option value="">Whole facility</option>{facility.sections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <button className="btn" disabled={busy || !v.period_start || !v.period_end || !v.energy_kwh} onClick={add}>Save reading</button>
      </div>
    </div>
  );
}

function CsvImport({ fid, onDone }) {
  const ref = useRef();
  const [res, setRes] = useState(null);
  const { error, run } = useAction();
  const upload = (e) => { const file = e.target.files[0]; if (!file) return; run(async () => { setRes(await api.importCsv(fid, file)); await onDone(); }); e.target.value = ""; };
  return (
    <div className="card">
      <div className="row between"><div><h2>Import CSV</h2><span className="muted small">Columns: period_start, period_end, energy_kwh, cost (optional), source_type (optional), meter_id (optional). Dates as YYYY-MM-DD.</span></div>
        <button className="btn ghost" onClick={() => ref.current.click()}>Choose CSV file</button></div>
      <input ref={ref} type="file" accept=".csv" hidden onChange={upload} />
      {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
      {res && <div className={res.errors.length ? "note" : "ok"} style={{ marginTop: 10 }}>{res.added} record(s) added.{res.errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
    </div>
  );
}

export default function History({ facility, refresh, fid }) {
  const [h, setH] = useState(null);
  const { error, run } = useAction();
  const load = () => api.history(fid).then(setH);
  useEffect(() => { load(); }, [fid]);
  const reload = async () => { await load(); await refresh(); };
  if (!h) return null;

  const sum = h.summary, obs = h.observed_savings;
  const fac = h.records.filter((r) => r.section_id === null);
  const secName = (id) => facility.sections.find((s) => s.id === id)?.name;
  const setAction = (d) => run(async () => { const { id, sections, ...rest } = facility; await api.updateFacility(id, { ...rest, action_date: d || null }); await reload(); });

  return (
    <div className="stack">
      <PageHead title="Past data" sub="Compare appliance-based estimates with real records. Missing months are never filled in or treated as zero." />
      {error && <div className="err">{error}</div>}
      <div className="grid g4">
        <Stat label="Records" value={sum.records} />
        <Stat label="Avg gap vs estimate" value={sum.avg_gap_pct === null ? "–" : `${sum.avg_gap_pct > 0 ? "+" : ""}${sum.avg_gap_pct}%`} badge="measured" />
        <Stat label="Recorded CO₂" value={fmt(sum.total_co2_kg)} unit="kg" color={COLORS.co2} />
        <Stat label="Unusual readings" value={sum.anomaly_count} unit={sum.anomaly_status === "ok" ? "" : "(not enough data)"} color={sum.anomaly_count ? COLORS.bad : undefined} />
      </div>
      <div className="note">{sum.explanation}</div>

      {fac.length === 0 ? <Empty>No facility-level records yet. Add readings below or import a CSV.</Empty> : (
        <>
          <div className="card">
            <h2>Recorded vs estimated energy (kWh per 30 days)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={fac}><CartesianGrid stroke={COLORS.grid} vertical={false} /><XAxis dataKey="period_start" fontSize={12} tickFormatter={(d) => d.slice(0, 7)} /><YAxis fontSize={12} width={60} /><Tooltip /><Legend />
                <Bar dataKey="actual_monthly_kwh" name="Recorded" radius={[4, 4, 0, 0]}>{fac.map((r) => <Cell key={r.id} fill={r.anomaly ? COLORS.bad : COLORS.cost} />)}</Bar>
                <Line dataKey="estimate_monthly_kwh" name="Appliance estimate" stroke={COLORS.kwh} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <span className="muted small">Red bars are statistically unusual readings - worth investigating, not proof of waste.</span>
          </div>
          <div className="card">
            <h2>Carbon trend from recorded energy (kg CO₂)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={fac}><CartesianGrid stroke={COLORS.grid} vertical={false} /><XAxis dataKey="period_start" fontSize={12} tickFormatter={(d) => d.slice(0, 7)} /><YAxis fontSize={12} width={60} /><Tooltip /><Line dataKey="co2_kg" name="CO₂ (kg)" stroke={COLORS.co2} strokeWidth={2.5} dot /></LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="card">
        <div className="row between"><h2>Observed savings</h2><Badge kind="observed" /></div>
        <div className="form" style={{ margin: "10px 0" }}>
          <label className="f">Date energy-saving actions began<input type="date" max={today()} defaultValue={facility.action_date || ""} key={facility.action_date} onBlur={(e) => e.target.value !== (facility.action_date || "") && setAction(e.target.value)} /></label>
        </div>
        {obs.available ? (
          <div className="grid g4">
            <Stat label={`Before (${obs.n_before} readings)`} value={fmt(obs.before_avg_kwh)} unit="kWh/mo" />
            <Stat label={`After (${obs.n_after} readings)`} value={fmt(obs.after_avg_kwh)} unit="kWh/mo" />
            <Stat label="Change" value={`${obs.change_pct}%`} unit={`(${fmt(obs.change_kwh)} kWh)`} color={obs.change_kwh >= 0 ? COLORS.co2 : COLORS.bad} />
            <Stat label="CO₂ change" value={fmt(obs.co2_change_kg)} unit="kg/mo" color={COLORS.co2} />
            <div className="note" style={{ gridColumn: "1 / -1" }}>{obs.caveat}</div>
          </div>
        ) : <p className="muted">{obs.reason}</p>}
      </div>

      <AddRecord facility={facility} onAdded={reload} />
      <CsvImport fid={fid} onDone={reload} />

      {h.records.length > 0 && (
        <div className="card scroll">
          <h2 style={{ marginBottom: 8 }}>All readings</h2>
          <table><thead><tr><th>Period</th><th>Covers</th><th>Source</th><th className="num">kWh</th><th className="num">Days</th><th className="num">Estimate (30d)</th><th className="num">Gap</th><th className="num">CO₂ kg</th><th /></tr></thead>
            <tbody>{h.records.map((r) => (
              <tr key={r.id}><td>{r.period_start} → {r.period_end}</td><td>{r.section_id ? secName(r.section_id) : "Whole facility"}</td><td><Badge kind={r.label} /></td>
                <td className="num">{fmt(r.actual_kwh, 1)}</td><td className="num">{r.days}</td><td className="num">{r.estimate_monthly_kwh ?? "–"}</td>
                <td className={`num ${r.anomaly ? "bad" : ""}`}>{r.gap_pct === null ? "–" : `${r.gap_pct > 0 ? "+" : ""}${r.gap_pct}%`}{r.anomaly && " ⚠"}</td>
                <td className="num">{fmt(r.co2_kg, 1)}</td><td><button className="btn sm danger" onClick={() => run(async () => { await api.deleteRecord(fid, r.id); await reload(); })}>✕</button></td></tr>))}</tbody></table>
        </div>
      )}
    </div>
  );
}
