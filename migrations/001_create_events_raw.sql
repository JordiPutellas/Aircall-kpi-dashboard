-- Migración 001: tabla de ingesta cruda de eventos Aircall
-- Ejecutar una sola vez contra la base de datos Neon.

CREATE TABLE IF NOT EXISTS events_raw (
    id          BIGSERIAL       PRIMARY KEY,
    event_type  TEXT            NOT NULL,
    user_id     BIGINT,                         -- null en eventos sin agente
    occurred_at TIMESTAMPTZ     NOT NULL,        -- timestamp del evento (del campo .timestamp del webhook)
    payload     JSONB           NOT NULL,        -- cuerpo completo del webhook
    received_at TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Consultas más frecuentes: filtrar por agente y por rango de tiempo
CREATE INDEX IF NOT EXISTS idx_events_raw_user_id
    ON events_raw (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_raw_occurred_at
    ON events_raw (occurred_at DESC);

-- Útil para filtrar por tipo de evento en el job de transformación (fase 2)
CREATE INDEX IF NOT EXISTS idx_events_raw_event_type
    ON events_raw (event_type);

-- Comentario de tabla para autodocumentación en Metabase / psql
COMMENT ON TABLE events_raw IS
    'Ingesta cruda de webhooks de Aircall. Un registro por evento recibido. '
    'No se modifica; es la fuente de verdad para la transformación.';
