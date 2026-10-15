import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead, useAction } from "./ui.jsx";

const TYPES = [
  ["household", "Household", "Rooms like bedroom, kitchen, living room"],
  ["institution", "Educational institution", "Classrooms, labs, offices, seminar halls"],
  ["office", "Office", "Departments, floors and meeting rooms"],
];
const EF_SOURCE = "CEA CO2 Baseline Database (India grid average) - verify the latest published value";

export default function Setup({ open, facility }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", facility_type: "institution", tariff_per_kwh: 8, emissions_factor: 0.716, emissions_factor_source: EF_SOURCE });
  const { error, busy, run } = useAction();
  const load = () => api.facilities().then(setList);
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = () => run(async () => {
    const f = await api.createFacility({ ...form, tariff_per_kwh: +form.tariff_per_kwh, emissions_factor: +form.emissions_factor });
    open(f.id, "inventory");
  });
  const demo = () => run(async () => { const f = await api.demo(); open(f.id, "dashboard"); });
  const remove = (id) => run(async () => { await api.deleteFacility(id); load(); });

  return (
    <div className="stack">
      <PageHead title="Know where your electricity goes" sub="Enter appliances and schedules. WattWise estimates energy, cost and CO₂, then lets you test savings. All numbers are estimates until compared with real meter readings." />
      {error && <div className="err">{error}</div>}

      <div className="card hero" style={{ background: "var(--ink)" }}>
        <div className="row between">
          <div><h2>Try it with a sample campus</h2><p className="small" style={{ color: "#a9c0cf", margin: "4px 0 0" }}>Classrooms, labs, offices and a seminar hall with 12 months of simulated readings.</p></div>
          <button className="btn" style={{ background: "#6fd3a8", color: "#10293a", borderColor: "#6fd3a8" }} disabled={busy} onClick={demo}>Load demo institution</button>
        </div>
      </div>

      <div className="card stack">
        <h2>New facility</h2>
        <div className="types">
          {TYPES.map(([k, t, d]) => (
            <button key={k} className={`type ${form.facility_type === k ? "on" : ""}`} onClick={() => setForm({ ...form, facility_type: k })}>
              <b>{t}</b><span className="muted small">{d}</span>
            </button>
          ))}
        </div>
        <div className="form">
          <label className="f">Facility name<input value={form.name} onChange={set("name")} placeholder="e.g. Block A" /></label>
          <label className="f">Tariff assumption (₹/kWh)<input type="number" step="0.1" min="0" value={form.tariff_per_kwh} onChange={set("tariff_per_kwh")} /></label>
          <label className="f">Emissions factor (kg CO₂/kWh)<input type="number" step="0.001" min="0" value={form.emissions_factor} onChange={set("emissions_factor")} /></label>
        </div>
        <label className="f">Emissions factor source<input value={form.emissions_factor_source} onChange={set("emissions_factor_source")} /></label>
        <div><button className="btn" disabled={busy || !form.name.trim()} onClick={create}>Create and add appliances</button></div>
      </div>

      {list.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 10 }}>Saved facilities</h2>
          {list.map((f) => (
            <div key={f.id} className="row between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span><b>{f.name}</b> <span className="muted small">{f.facility_type}{facility?.id === f.id ? " · open" : ""}</span></span>
              <span className="row"><button className="btn sm ghost" onClick={() => open(f.id)}>Open</button><button className="btn sm danger" onClick={() => confirm(`Delete ${f.name}?`) && remove(f.id)}>Delete</button></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
