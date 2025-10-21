-- Crea tabla con nombre con espacio: "observaciones diarias"
CREATE TABLE IF NOT EXISTS "observaciones diarias" (
  station_id TEXT NOT NULL,
  obs_date   DATE NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT observaciones_diarias_pk PRIMARY KEY (station_id, obs_date)
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS observaciones_diarias_obs_date_idx ON "observaciones diarias"(obs_date);
