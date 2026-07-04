import { useState, useEffect, useCallback, useRef } from "react";

// Live global event intelligence, modeled on PYTHIA's engine
// (https://github.com/jangles-byte/Pythia). PYTHIA fuses free, keyless world
// feeds into one ranked stream of located events; this hook does the same
// client-side — USGS earthquakes, NASA EONET disasters, and GDELT news — and
// can also read a running PYTHIA engine's Agent API (`/agent/view`) when
// EXPO_PUBLIC_PYTHIA_URL is set.

export type WorldCategory =
  | "seismic"
  | "wildfire"
  | "storm"
  | "disaster"
  | "geopolitical"
  | "gold"
  | "forecast";

export interface WorldEvent {
  id: string;
  title: string;
  summary: string;
  category: WorldCategory;
  source: string;
  lat: number;
  lng: number;
  salience: number; // 0–1, drives marker size + ranking
  ts: number; // epoch ms
  url?: string;
}

export const CATEGORY_META: Record<
  WorldCategory,
  { label: string; color: string }
> = {
  gold: { label: "Gold", color: "#FFD700" },
  geopolitical: { label: "Geopolitics", color: "#FF9F0A" },
  seismic: { label: "Earthquakes", color: "#FF6482" },
  storm: { label: "Storms", color: "#64D2FF" },
  wildfire: { label: "Wildfires", color: "#FF453A" },
  disaster: { label: "Disasters", color: "#30D158" },
  forecast: { label: "Forecasts", color: "#BF5AF2" },
};

// Salience keywords ported from PYTHIA's engine (osiris_intake._HOT):
// words that raise an event's importance score.
const HOT: Record<string, number> = {
  war: 1.0, attack: 0.9, strike: 0.8, missile: 0.95, killed: 0.85,
  coup: 0.95, invasion: 1.0, nuclear: 1.0, explosion: 0.8, protest: 0.6,
  riot: 0.7, election: 0.7, ceasefire: 0.85, sanction: 0.7, default: 0.7,
  collapse: 0.8, resign: 0.7, earthquake: 0.7, outbreak: 0.8, crisis: 0.75,
  hurricane: 0.9, typhoon: 0.9, cyclone: 0.9, tornado: 0.8, storm: 0.7,
  flood: 0.8, volcano: 0.9, eruption: 0.9, tsunami: 1.0, wildfire: 0.8,
  breach: 0.75, ransomware: 0.8, famine: 0.85, drought: 0.7, evacuat: 0.85,
  "central bank": 0.75, tariff: 0.7, inflation: 0.65,
};

function salience(text: string, floor = 0.4): number {
  const t = text.toLowerCase();
  let score = floor;
  for (const [word, weight] of Object.entries(HOT)) {
    if (t.includes(word)) score = Math.max(score, weight);
  }
  return Math.round(Math.min(1, score) * 100) / 100;
}

function validCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    isFinite(lat) &&
    isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

async function getJson(url: string, timeoutMs = 20000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---- Feeds (all free & keyless, the same sources PYTHIA watches) ----------

// USGS — earthquakes M2.5+ in the last 24h.
async function fetchEarthquakes(): Promise<WorldEvent[]> {
  const data = await getJson(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
  );
  const out: WorldEvent[] = [];
  for (const f of data?.features ?? []) {
    const p = f?.properties ?? {};
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c) || !validCoord(c[1], c[0])) continue;
    const mag = typeof p.mag === "number" ? p.mag : 0;
    if (mag < 4.0) continue; // keep the map to meaningful quakes
    out.push({
      id: `usgs-${f.id ?? p.code ?? out.length}`,
      title: `M${mag.toFixed(1)} — ${p.place ?? "unknown location"}`,
      summary: p.title ?? "",
      category: "seismic",
      source: "usgs",
      lat: c[1],
      lng: c[0],
      // M4 → 0.45, M6 → 0.7, M8+ → ~1
      salience: Math.round(Math.min(1, 0.45 + (mag - 4) * 0.13) * 100) / 100,
      ts: typeof p.time === "number" ? p.time : Date.now(),
      url: p.url,
    });
  }
  return out;
}

// NASA EONET — open natural-hazard events (storms, wildfires, volcanoes…).
const EONET_CATEGORY: Record<string, WorldCategory> = {
  severeStorms: "storm",
  wildfires: "wildfire",
  volcanoes: "disaster",
  earthquakes: "seismic",
  floods: "disaster",
  drought: "disaster",
  landslides: "disaster",
  seaLakeIce: "disaster",
  snow: "storm",
  dustHaze: "disaster",
};

async function fetchEonet(): Promise<WorldEvent[]> {
  const data = await getJson(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=120",
  );
  const out: WorldEvent[] = [];
  for (const ev of data?.events ?? []) {
    const geoms = Array.isArray(ev?.geometry) ? ev.geometry : [];
    const last = geoms[geoms.length - 1];
    let lat: number | undefined;
    let lng: number | undefined;
    const coords = last?.coordinates;
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number") {
        [lng, lat] = coords; // Point
      } else {
        const ring = coords?.[0]; // Polygon — take the first vertex
        if (Array.isArray(ring?.[0])) [lng, lat] = ring[0];
      }
    }
    if (!validCoord(lat, lng)) continue;
    const catId = ev?.categories?.[0]?.id ?? "";
    const title: string = ev?.title ?? "";
    out.push({
      id: `eonet-${ev.id ?? out.length}`,
      title,
      summary: ev?.categories?.[0]?.title ?? "",
      category: EONET_CATEGORY[catId] ?? "disaster",
      source: "eonet",
      lat: lat as number,
      lng: lng as number,
      salience: salience(`${title} ${catId}`, 0.5),
      ts: last?.date ? Date.parse(last.date) : Date.now(),
      url: ev?.sources?.[0]?.url,
    });
  }
  return out;
}

// GDELT GEO 2.0 — where the world's news is happening right now.
// Two lenses: global geopolitics, and gold-market-moving coverage.
function gdeltUrl(query: string): string {
  return (
    "https://api.gdeltproject.org/api/v2/geo/geo?query=" +
    encodeURIComponent(query) +
    "&format=GeoJSON&timespan=1d"
  );
}

function parseGdelt(
  data: any,
  category: WorldCategory,
  idPrefix: string,
  floor: number,
): WorldEvent[] {
  const out: WorldEvent[] = [];
  for (const f of data?.features ?? []) {
    const p = f?.properties ?? {};
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c) || !validCoord(c[1], c[0])) continue;
    const name = String(p.name ?? "").trim();
    if (!name) continue;
    const count = typeof p.count === "number" ? p.count : 1;
    // strip HTML that GDELT packs into the popup field, keep the first headline
    const html = String(p.html ?? "");
    const firstHeadline =
      html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    const title = `${name} — ${count} article${count === 1 ? "" : "s"}`;
    out.push({
      id: `${idPrefix}-${name}-${out.length}`,
      title,
      summary: firstHeadline,
      category,
      source: "gdelt",
      lat: c[1],
      lng: c[0],
      salience: Math.max(
        salience(`${name} ${firstHeadline}`, floor),
        Math.min(1, floor + Math.log10(Math.max(count, 1)) * 0.15),
      ),
      ts: Date.now(),
    });
  }
  // densest news locations first, cap so GDELT can't drown the other feeds
  return out.sort((a, b) => b.salience - a.salience).slice(0, 40);
}

async function fetchGeopolitics(): Promise<WorldEvent[]> {
  const data = await getJson(
    gdeltUrl(
      '(war OR conflict OR missile OR invasion OR coup OR sanctions OR ceasefire) sourcelang:eng',
    ),
  );
  return parseGdelt(data, "geopolitical", "geo", 0.45);
}

async function fetchGoldSignals(): Promise<WorldEvent[]> {
  const data = await getJson(
    gdeltUrl(
      '(gold OR bullion OR "gold price" OR "central bank gold" OR "gold reserves") sourcelang:eng',
    ),
  );
  return parseGdelt(data, "gold", "gold", 0.5);
}

// Optional: a running PYTHIA engine. Point EXPO_PUBLIC_PYTHIA_URL at it
// (default engine port is 8088) and the map ingests its fused world view
// and swarm forecasts directly.
const PYTHIA_URL = (process.env.EXPO_PUBLIC_PYTHIA_URL ?? "").replace(/\/+$/, "");

const PYTHIA_DOMAIN_CATEGORY: Record<string, WorldCategory> = {
  seismic: "seismic",
  wildfire: "wildfire",
  weather: "storm",
  conflict: "geopolitical",
  geopolitical: "geopolitical",
  news: "geopolitical",
  markets: "gold",
  "market-odds": "gold",
};

async function fetchPythia(): Promise<WorldEvent[]> {
  if (!PYTHIA_URL) return [];
  const view = await getJson(`${PYTHIA_URL}/agent/view`, 15000);
  const out: WorldEvent[] = [];
  const byDomain = view?.events_by_domain ?? {};
  for (const [domain, events] of Object.entries(byDomain)) {
    if (!Array.isArray(events)) continue;
    for (const ev of events as any[]) {
      if (!validCoord(ev?.lat, ev?.lng)) continue;
      out.push({
        id: `pythia-${domain}-${out.length}`,
        title: String(ev.title ?? "").slice(0, 240),
        summary: String(ev.summary ?? ""),
        category: PYTHIA_DOMAIN_CATEGORY[domain] ?? "disaster",
        source: `pythia:${ev.source ?? domain}`,
        lat: ev.lat,
        lng: ev.lng,
        salience: typeof ev.salience === "number" ? ev.salience : 0.5,
        ts: typeof ev.ts === "number" ? ev.ts : Date.now(),
        url: ev.url,
      });
    }
  }
  for (const p of view?.predictions ?? []) {
    if (!validCoord(p?.lat, p?.lng)) continue;
    out.push({
      id: `pythia-forecast-${out.length}`,
      title: `${Math.round((p.probability ?? 0) * 100)}% — ${p.statement ?? ""}`.slice(0, 240),
      summary: String(p.reasoning ?? ""),
      category: "forecast",
      source: "pythia:oracle",
      lat: p.lat,
      lng: p.lng,
      salience: typeof p.probability === "number" ? p.probability : 0.5,
      ts: Date.now(),
    });
  }
  return out;
}

// ---- Fuse: concurrent fetch, dedupe by title, rank by salience ------------

const FEEDS: Array<() => Promise<WorldEvent[]>> = [
  fetchEarthquakes,
  fetchEonet,
  fetchGeopolitics,
  fetchGoldSignals,
  fetchPythia,
];

async function fetchWorld(): Promise<{ events: WorldEvent[]; feedsOnline: number }> {
  const results = await Promise.allSettled(FEEDS.map((f) => f()));
  const all: WorldEvent[] = [];
  let feedsOnline = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value.length > 0) feedsOnline++;
      all.push(...r.value);
    }
  }
  // dedupe by lowercased title, keep highest salience (as PYTHIA's intake does)
  const seen = new Map<string, WorldEvent>();
  for (const ev of all) {
    const key = ev.title.toLowerCase().slice(0, 80);
    const prev = seen.get(key);
    if (!prev || ev.salience > prev.salience) seen.set(key, ev);
  }
  const events = [...seen.values()].sort((a, b) => b.salience - a.salience);
  return { events, feedsOnline };
}

const REFRESH_MS = 3 * 60 * 1000;

export function useWorldEvents() {
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [feedsOnline, setFeedsOnline] = useState(0);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { events: fresh, feedsOnline: online } = await fetchWorld();
      if (fresh.length > 0) {
        setEvents(fresh);
        setLastUpdated(Date.now());
      }
      setFeedsOnline(online);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  return { events, isLoading, lastUpdated, feedsOnline, refresh: load };
}
