import { useEffect, useState } from "react";
import { api } from "../api.js";
import { fmt, PageHead, useAction, Empty } from "./ui.jsx";

const CATS = ["lighting", "cooling", "computing", "appliance", "other"];

function ApplianceRow({ a, rooms, onChange, onDelete }) {
  const [v, setV] = useState(a);
  const { error, run } = useAction();
  useEffect(() => setV(a), [a]);
  const kwh = (v.quantity_per_room * rooms * v.rated_power_watts * v.hours_per_day / 1000) * v.days_per_month;
  const save = () => {
    if (JSON.stringify(v) === JSON.stringify(a)) return;
    run(async () => { await api.updateAppliance(a.id, { ...v, quantity_per_room: +v.quantity_per_room, rated_power_watts: +v.rated_power_watts, hours_per_day: +v.hours_per_day, days_per_month: +v.days_per_month }); await onChange(); });
  };
  const f = (k, w) => <input type={k === "name" ? "text" : "number"} className={k === "name" ? "name" : ""} style={w ? { width: w } : undefined} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} onBlur={save} aria-label={k} />;
  return (
    <>
      <tr>
        <td>{f("name")}</td>
        <td><select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} onBlur={save}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></td>
        <td>{f("quantity_per_room", 70)}</td><td className="num">{fmt(v.quantity_per_room * rooms)}</td>
        <td>{f("rated_power_watts", 80)}</td><td>{f("hours_per_day", 70)}</td><td>{f("days_per_month", 70)}</td>
        <td className="num"><b>{fmt(kwh, 1)}</b></td>
        <td><button className="btn sm danger" onClick={onDelete} aria-label="Remove appliance">✕</button></td>
      </tr>
      {error && <tr><td colSpan={9}><div className="err">{error}</div></td></tr>}
    </>
  );
}

function AddAppliance({ section, presets, onAdded }) {
  const blank = { name: "", category: "other", quantity_per_room: 1, rated_power_watts: 100, hours_per_day: 8, days_per_month: section.operating_days };
  const [v, setV] = useState(blank);
  const { error, run, busy } = useAction();
  const pick = (e) => {
    const p = presets.find((x) => x.name === e.target.value);
    if (p) setV({ ...v, name: p.name, category: p.category, rated_power_watts: p.watts, hours_per_day: p.hours });
  };
  const add = () => run(async () => {
    await api.addAppliance(section.id, { ...v, quantity_per_room: +v.quantity_per_room, rated_power_watts: +v.rated_power_watts, hours_per_day: +v.hours_per_day, days_per_month: +v.days_per_month });
    setV(blank); await onAdded();
  });
  const s = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <div style={{ marginTop: 12 }}>
      {error && <div className="err">{error}</div>}
      <div className="form">
        <label className="f">Preset<select value="" onChange={pick}><option value="">Choose…</option>{presets.map((p) => <option key={p.name}>{p.name}</option>)}</select></label>
        <label className="f">Name<input value={v.name} onChange={s("name")} /></label>
        <label className="f">Qty per room<input type="number" min="1" value={v.quantity_per_room} onChange={s("quantity_per_room")} /></label>
        <label className="f">Watts each<input type="number" min="1" value={v.rated_power_watts} onChange={s("rated_power_watts")} /></label>
        <label className="f">Hours/day<input type="number" min="0" max="24" step="0.5" value={v.hours_per_day} onChange={s("hours_per_day")} /></label>
        <label className="f">Days/month<input type="number" min="1" max="31" value={v.days_per_month} onChange={s("days_per_month")} /></label>
        <button className="btn" disabled={busy || !v.name.trim()} onClick={add}>Add appliance</button>
      </div>
    </div>
  );
}

function AddSection({ fid, onAdded }) {
  const [v, setV] = useState({ name: "", section_type: "Room", room_count: 1, operating_days: 26, start_time: "09:00", end_time: "17:00" });
  const { error, run, busy } = useAction();
  const s = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const add = () => run(async () => { await api.addSection(fid, { ...v, room_count: +v.room_count, operating_days: +v.operating_days }); setV({ ...v, name: "" }); await onAdded(); });
  return (
    <div className="card">
      <h2 style={{ marginBottom: 10 }}>Add section</h2>
      {error && <div className="err">{error}</div>}
      <div className="form">
        <label className="f">Section name<input value={v.name} onChange={s("name")} placeholder="Computer labs" /></label>
        <label className="f">Type<input value={v.section_type} onChange={s("section_type")} /></label>
        <label className="f">Number of rooms<input type="number" min="1" value={v.room_count} onChange={s("room_count")} /></label>
        <label className="f">Operating days/month<input type="number" min="1" max="31" value={v.operating_days} onChange={s("operating_days")} /></label>
        <label className="f">Opens<input type="time" value={v.start_time} onChange={s("start_time")} /></label>
        <label className="f">Closes<input type="time" value={v.end_time} onChange={s("end_time")} /></label>
        <button className="btn" disabled={busy || !v.name.trim()} onClick={add}>Add section</button>
      </div>
    </div>
  );
}

export default function Inventory({ facility, summary, refresh, fid, setTab }) {
  const [presets, setPresets] = useState([]);
  const { error, run } = useAction();
  useEffect(() => { api.presets().then(setPresets); }, []);
  const secKwh = Object.fromEntries((summary?.sections || []).map((s) => [s.id, s.kwh]));

  return (
    <div className="stack">
      <PageHead title="Appliance inventory" sub="Quantity is per room and is multiplied by the room count once. Change any preset wattage to match your model.">
        <button className="btn" onClick={() => setTab("dashboard")} disabled={!summary?.totals.kwh}>View dashboard</button>
      </PageHead>
      {error && <div className="err">{error}</div>}
      {facility.sections.length === 0 && <Empty>No sections yet. Add one below - for a household, a section is a room.</Empty>}
      {facility.sections.map((s) => (
        <div className="card" key={s.id}>
          <div className="row between">
            <div><h2>{s.name}</h2><span className="muted small">{s.section_type} · {s.room_count} room{s.room_count > 1 ? "s" : ""} · {s.operating_days} days/month · {s.start_time}–{s.end_time}</span></div>
            <div className="row"><b>{fmt(secKwh[s.id], 1)} kWh/month</b><button className="btn sm danger" onClick={() => confirm(`Delete ${s.name}?`) && run(async () => { await api.deleteSection(s.id); await refresh(); })}>Delete section</button></div>
          </div>
          <div className="scroll" style={{ marginTop: 10 }}>
            {s.appliances.length > 0 && (
              <table>
                <thead><tr><th>Appliance</th><th>Category</th><th>Qty/room</th><th className="num">Total qty</th><th>Watts</th><th>Hours/day</th><th>Days/mo</th><th className="num">kWh/month</th><th /></tr></thead>
                <tbody>{s.appliances.map((a) => <ApplianceRow key={a.id} a={a} rooms={s.room_count} onChange={refresh} onDelete={() => run(async () => { await api.deleteAppliance(a.id); await refresh(); })} />)}</tbody>
              </table>
            )}
          </div>
          <AddAppliance section={s} presets={presets} onAdded={refresh} />
        </div>
      ))}
      <AddSection fid={fid} onAdded={refresh} />
    </div>
  );
}
