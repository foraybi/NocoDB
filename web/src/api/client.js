import { CONFIG } from "../lib/config.js";

const BASE = CONFIG.API_BASE || "";

export async function apiGet(path) {
  const r = await fetch(BASE + path, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

export async function apiPost(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} -> ${r.status}`);
  return r.json();
}
