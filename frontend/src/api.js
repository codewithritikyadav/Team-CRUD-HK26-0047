// All backend calls live here. Throws Error(message) with the API's validation text.
async function req(path, opts = {}) {
  const res = await fetch("/api" + path, {
    headers: opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    ...opts,
    body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = Array.isArray(j.detail) ? j.detail.map((d) => `${d.loc.slice(1).join(".")}: ${d.msg}`).join("; ") : j.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.headers.get("content-type")?.includes("json") ? res.json() : res.text();
}

export const api = {
  presets: () => req("/presets"),
  demo: () => req("/demo", { method: "POST" }),
  facilities: () => req("/facilities"),
  facility: (id) => req(`/facilities/${id}`),
  createFacility: (b) => req("/facilities", { method: "POST", body: b }),
  updateFacility: (id, b) => req(`/facilities/${id}`, { method: "PUT", body: b }),
  deleteFacility: (id) => req(`/facilities/${id}`, { method: "DELETE" }),
  addSection: (fid, b) => req(`/facilities/${fid}/sections`, { method: "POST", body: b }),
  deleteSection: (id) => req(`/sections/${id}`, { method: "DELETE" }),
  addAppliance: (sid, b) => req(`/sections/${sid}/appliances`, { method: "POST", body: b }),
  updateAppliance: (id, b) => req(`/appliances/${id}`, { method: "PUT", body: b }),
  deleteAppliance: (id) => req(`/appliances/${id}`, { method: "DELETE" }),
  summary: (fid) => req(`/facilities/${fid}/summary`),
  simulate: (fid, b) => req(`/facilities/${fid}/simulate`, { method: "POST", body: b }),
  recommendations: (fid) => req(`/facilities/${fid}/recommendations`),
  history: (fid) => req(`/facilities/${fid}/history/analysis`),
  addRecord: (fid, b) => req(`/facilities/${fid}/history`, { method: "POST", body: b }),
  deleteRecord: (fid, id) => req(`/facilities/${fid}/history/${id}`, { method: "DELETE" }),
  importCsv: (fid, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return req(`/facilities/${fid}/history/csv`, { method: "POST", body: fd });
  },
  reportUrl: (fid) => `/api/facilities/${fid}/report.csv`,
};
