// server.js
// Proxy + estáticos + guardado diario en Postgres (Railway-friendly)
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";
import { collectTodayForAllStations } from "./src/cron-daily.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Variables de entorno (admite nombres en español como fallback)
const WU_API_KEY =
  process.env.WU_API_KEY ||
  process.env.CLAVE_DE_API_WU ||
  process.env["CLAVE DE API WU"];

const DEFAULT_STATION_ID =
  process.env.STATION_ID ||
  process.env.ID_DE_ESTACION_WU ||
  process.env["ID DE ESTACIÓN WU"];

if (!WU_API_KEY) {
  console.warn("⚠️ Falta WU_API_KEY (o CLAVE DE API WU) en variables de entorno.");
}

// Desactivar caché para rutas API
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/history") {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});

// Servir /public como raíz
app.use(express.static(path.join(__dirname, "public")));

// Helper: YYYYMMDD -> YYYY-MM-DD
const yyyymmdd_to_iso = (d) => `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;

// --- Alias/redirect para compatibilidad con el frontend ---
// Si el cliente pide /history, redirigimos a /api/wu/history con los mismos query params
app.get("/history", (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(302, `/api/wu/history?${qs}`);
});

// --- Endpoint principal: histórico PWS + guardado en Postgres ---
app.get("/api/wu/history", async (req, res) => {
  try {
    const stationId = (req.query.stationId || DEFAULT_STATION_ID || "").trim();
    const date = (req.query.date || "").trim(); // YYYYMMDD

    if (!stationId) {
      return res.status(400).json({ error: "Falta stationId (y no hay valor por defecto)" });
    }
    if (!date || date.length !== 8) {
      return res.status(400).json({ error: "Falta date en formato YYYYMMDD" });
    }
    if (!WU_API_KEY) {
      return res.status(500).json({ error: "Falta WU_API_KEY/CLAVE DE API WU en variables" });
    }

    // Llamada a Weather.com (WU) — historial por día
    const urlHist = new URL(
      `https://api.weather.com/v2/pws/history/all?stationId=${encodeURIComponent(
        stationId
      )}&date=${encodeURIComponent(date)}&format=json&units=m&apiKey=${encodeURIComponent(WU_API_KEY)}`
    );

    const upstream = await fetch(urlHist, { headers: { accept: "application/json" } });
    const text = await upstream.text();

    // Intentar parsear a JSON; si no, devolvemos tal cual
    let histJson = null;
    try {
      histJson = JSON.parse(text);
    } catch {
      res.status(upstream.status).type("application/json").send(text);
      return;
    }

    // Guardado en Postgres (idempotente por station_id + obs_date)
    try {
      const obsDateISO = yyyymmdd_to_iso(date);
      await pool.query(
        `INSERT INTO "observaciones diarias" (station_id, obs_date, payload)
         VALUES ($1, $2, $3)
         ON CONFLICT (station_id, obs_date)
         DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
        [stationId, obsDateISO, histJson]
      );
      console.log(`✅ Guardado en DB: ${stationId} ${obsDateISO}`);
    } catch (e) {
      console.error("❌ Error guardando en DB:", e);
      // No frenamos la respuesta al cliente por un fallo de guardado
    }

    // Devolver al cliente lo que vino de WU
    res.status(upstream.status).json(histJson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar Weather.com", details: String(err) });
  }
});

// --- Leer desde DB (útil para comprobar) ---
app.get("/api/db/daily", async (req, res) => {
  try {
    const stationId = (req.query.stationId || DEFAULT_STATION_ID || "").trim();
    const date = (req.query.date || "").trim(); // YYYYMMDD o YYYY-MM-DD

    if (!stationId || !date) {
      return res.status(400).json({ error: "Faltan stationId y/o date" });
    }

    const obsDateISO = date.includes("-") ? date : yyyymmdd_to_iso(date);

    const { rows } = await pool.query(
      `SELECT payload FROM "observaciones diarias" WHERE station_id=$1 AND obs_date=$2`,
      [stationId, obsDateISO]
    );
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0].payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error leyendo DB", details: String(e) });
  }
});

// Healthcheck simple
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

// Endpoint para ejecución diaria (cron)
app.get("/cron/daily", async (_req, res) => {
  try {
    await collectTodayForAllStations();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});
