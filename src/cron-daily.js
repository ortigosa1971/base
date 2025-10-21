// src/cron-daily.js
import 'dotenv/config'
import pool from '../db.js'

const API_KEY = process.env.WU_API_KEY || '43c4f747135944db84f747135914db79'
const STATIONS = (process.env.STATIONS || 'IALFAR32').split(',').map(s => s.trim()).filter(Boolean)

function todayYYYYMMDD() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function todayISO() {
  const now = new Date()
  return now.toISOString().slice(0, 10) // YYYY-MM-DD
}

async function fetchStationPayload(stationId, dateYYYYMMDD) {
  const url = `https://api.weather.com/v2/pws/history/all?stationId=${stationId}&date=${dateYYYYMMDD}&format=json&units=m&apiKey=${API_KEY}`
  console.log('🌤️ Fetching:', url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather.com error ${res.status}`)
  const data = await res.json()
  return data
}

export async function collectTodayForAllStations() {
  const fechaISO = todayISO()
  const fechaWU = todayYYYYMMDD()

  for (const stationId of STATIONS) {
    try {
      const payload = await fetchStationPayload(stationId, fechaWU)
      await pool.query(
        `INSERT INTO "observaciones diarias" (station_id, obs_date, payload)
         VALUES ($1, $2, $3)
         ON CONFLICT (station_id, obs_date)
         DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
        [stationId, fechaISO, payload]
      )
      console.log(`✅ Guardado ${stationId} ${fechaISO}`)
    } catch (e) {
      console.error(`❌ Error para ${stationId}:`, e)
    }
  }
}
