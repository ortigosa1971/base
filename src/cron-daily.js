// src/cron-daily.js
import 'dotenv/config'
import pool from '../db.js'

const API_KEY = process.env.WU_API_KEY
const STATIONS = (process.env.STATIONS || 'IALFAR32').split(',').map(s => s.trim()).filter(Boolean)

function todayYYYYMMDD() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

async function fetchStationPayload(stationId, dateYYYYMMDD) {
  if (!API_KEY) throw new Error('WU_API_KEY no definido')
  const url = `https://api.weather.com/v2/pws/history/all?stationId=${stationId}&date=${dateYYYYMMDD}&format=json&units=m&apiKey=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather.com ${res.status}`)
  return await res.json()
}

export async function collectTodayForAllStations() {
  const fechaISO = todayISO()
  const fechaWU = todayYYYYMMDD()

  const results = await Promise.allSettled(
    STATIONS.map(async (stationId) => {
      const payload = await fetchStationPayload(stationId, fechaWU)
      const r = await pool.query(
        `INSERT INTO "observaciones diarias" (station_id, obs_date, payload)
         VALUES ($1, $2, $3)
         ON CONFLICT (station_id, obs_date)
         DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
         RETURNING 1`,
        [stationId, fechaISO, payload]
      )
      return { stationId, inserted: r.rowCount }
    })
  )

  const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value)
  const ko = results.filter(r => r.status === 'rejected').map(r => ({ error: String(r.reason) }))

  if (ok.length === 0) {
    const msg = `No se insertó nada. Errores: ${JSON.stringify(ko)}`
    console.error(msg)
    throw new Error(msg)
  }

  return { attempted: STATIONS.length, succeeded: ok.length, failed: ko.length, details: { ok, ko } }
}

