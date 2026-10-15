import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Setup from "./components/Setup.jsx";
import Inventory from "./components/Inventory.jsx";
import Dashboard from "./components/Dashboard.jsx";
import History from "./components/History.jsx";
import Recommendations from "./components/Recommendations.jsx";
import Simulator from "./components/Simulator.jsx";

const TABS = [
  ["setup", "Setup"], ["inventory", "Inventory"], ["dashboard", "Dashboard"],
  ["history", "Past data"], ["recs", "Recommendations"], ["sim", "What-if simulator"],
];

export default function App() {
  const [tab, setTab] = useState("setup");
  const [fid, setFid] = useState(() => Number(localStorage.getItem("fid")) || null);
  const [facility, setFacility] = useState(null);
  const [summary, setSummary] = useState(null);
  const [scenario, setScenario] = useState({ appliances: {}, sections: {} }); // shared so Recommendations can pre-fill the simulator

  const refresh = useCallback(async () => {
    if (!fid) { setFacility(null); setSummary(null); return; }
    try {
      const [f, s] = await Promise.all([api.facility(fid), api.summary(fid)]);
      setFacility(f); setSummary(s);
    } catch { setFid(null); localStorage.removeItem("fid"); }
  }, [fid]);

  useEffect(() => { refresh(); }, [refresh]);

  const open = (id, nextTab = "dashboard") => {
    localStorage.setItem("fid", id); setFid(id); setScenario({ appliances: {}, sections: {} }); setTab(nextTab);
  };
  const close = () => { localStorage.removeItem("fid"); setFid(null); setTab("setup"); };
  const testScenario = (sc) => { setScenario({ appliances: sc.appliances || {}, sections: sc.sections || {} }); setTab("sim"); };

  const ctx = { fid, facility, summary, refresh, open, close, setTab };
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">Watt<span>Wise</span> AI</div>
        <small>{facility ? facility.name : "No facility open"}</small>
        <nav className="nav">
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? "on" : ""} disabled={k !== "setup" && !facility} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
      </aside>
      <main className="main">
        {tab === "setup" && <Setup {...ctx} />}
        {facility && tab === "inventory" && <Inventory {...ctx} />}
        {facility && tab === "dashboard" && <Dashboard {...ctx} />}
        {facility && tab === "history" && <History {...ctx} />}
        {facility && tab === "recs" && <Recommendations {...ctx} testScenario={testScenario} />}
        {facility && tab === "sim" && <Simulator {...ctx} scenario={scenario} setScenario={setScenario} />}
      </main>
    </div>
  );
}
