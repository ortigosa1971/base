# Conexión a Postgres (Railway)

## Variables de entorno
Crea `.env` (ya incluido) con:
```
DATABASE_URL=postgresql://elias:123456789@tocadiscos.proxy.rlwy.net:52128/produccion?sslmode=require
PORT=3000
```

## Inicializar la base
```bash
npm install
npm run db:init
npm run dev
```

## Tabla usada
Se crea automáticamente `"observaciones diarias"` con columnas:
- `station_id` (TEXT)
- `obs_date` (DATE)
- `payload` (JSONB)
- `created_at`, `updated_at`

**Clave primaria compuesta**: `(station_id, obs_date)` — compatible con `ON CONFLICT (station_id, obs_date)` del servidor.

## Recolección diaria automática
- Endpoint: `GET /cron/daily` — guarda los datos de HOY para las estaciones definidas en `STATIONS`.
- Script directo (sin HTTP): `npm run collect:today`

Configura en Railway una tarea cron que haga ping a:
`https://TU-APP.up.railway.app/cron/daily` diariamente.

Variable opcional en Railway (o .env local):
```
STATIONS=EST-001,EST-002
```

## Weather Underground (WU)
Añade estas variables (ya incluidas en `.env` de ejemplo):
```
WU_API_KEY=43c4f747135944db84f747135914db79
STATIONS=IALFAR32
```
- Ruta manual: `GET /cron/daily`
- Script sin HTTP: `npm run collect:today`
Esto guardará en `"observaciones diarias"` el JSON devuelto por WU para la fecha de hoy.
