import { useState } from "react";

export const fmt = (n, d = 0) => (n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
export const inr = (n) => "₹" + fmt(n);
export const COLORS = { kwh: "#d98a1d", cost: "#2563a8", co2: "#1b7a5a", sim: "#6b5bd2", bad: "#b4372d", grid: "#dbe4e0" };

export const Badge = ({ kind, children }) => <span className={`badge ${kind}`}>{children || kind}</span>;

export const Stat = ({ label, value, unit, badge, color, className = "" }) => (
  <div className={`card stat ${className}`}>
    <div className="row between"><span className="l">{label}</span>{badge && <Badge kind={badge} />}</div>
    <div className="v" style={color ? { color } : undefined}>{value} <span className="l">{unit}</span></div>
  </div>
);

export const PageHead = ({ title, sub, children }) => (
  <div className="head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="row">{children}</div></div>
);

export const Empty = ({ children }) => <div className="card empty">{children}</div>;

// Runs an async action and exposes {busy, error, run}. Keeps every form's error handling identical.
export function useAction() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true); setError("");
    try { return await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return { error, busy, run, setError };
}
