# WattWise AI

Energy estimation, carbon footprint, past-data comparison and a what-if optimizer.
Stack: **FastAPI + SQLite** (backend) · **React + Vite + Recharts** (frontend).

## Run it

```bash
# Terminal 1 - backend (http://127.0.0.1:8000, docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 2 - frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Click **Load demo institution** on the first screen for a full sample (all data labelled *simulated*).
Tests: `cd backend && pip install pytest httpx && pytest`

## Structure

```
backend/app
  engine.py           <- ONE calculation engine (kWh, cost, CO2, scenario compare). Everything calls this.
  analytics.py        <- past-data comparison, anomaly flags, observed before/after savings
  recommendations.py  <- rule-based suggestions; impact numbers come from engine.compare()
  models.py / schemas.py / database.py   <- SQLite tables, validation, session
  routers/            <- facilities (CRUD), analysis (summary, simulate, report), history (records, CSV)
  seed.py / presets.py <- demo data, appliance presets
frontend/src
  api.js              <- every backend call
  App.jsx             <- shell + shared state
  components/         <- Setup, Inventory, Dashboard, History, Recommendations, Simulator
```

## Rules baked in (from the PRD)

- Quantity is **per room**; rooms are multiplied exactly once (`engine.appliance_energy`).
- Values are labelled **estimated / measured / simulated**; savings are "potential", never "achieved".
- Missing history is never zero-filled; anomalies need >= 6 readings and are "investigate", not "waste".
- Observed savings use only real before/after records around the action date.

## Before you present

- The default emissions factor (0.716 kg CO2/kWh) and tariff (INR 8/kWh) are **placeholders**.
  Look up the current CEA CO2 Baseline Database value, update it in Dashboard > Assumptions, and cite it.
- Rated watts are not real draw; say so in the pitch.
