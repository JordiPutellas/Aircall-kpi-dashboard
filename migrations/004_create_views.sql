-- Migración 004: vistas analíticas que consume el dashboard.
-- Dependen de events_raw (001) y de las tablas derivadas (002).
-- Estas definiciones se extrajeron de la BBDD de producción (Neon) para
-- versionar el esquema completo; antes solo existían en la instancia.

-- ── v_users ────────────────────────────────────────────────────────────────────
-- Última versión conocida de nombre/email por user_id. Excluye cuentas que no
-- son agentes individuales y distorsionan métricas (cuenta compartida y un alta
-- que no opera). Sustituye a la definición de queries/analytics.sql.
CREATE OR REPLACE VIEW v_users AS
SELECT DISTINCT ON (user_id)
  user_id,
  payload->'data'->>'name'  AS name,
  payload->'data'->>'email' AS email
FROM events_raw
WHERE event_type LIKE 'user.%'
  AND user_id IS NOT NULL
  AND (payload->'data'->>'name') <> ALL (ARRAY['Preventa Team', 'Alba Cabanas'])
ORDER BY user_id, occurred_at DESC;


-- ── v_perdidas_reales ───────────────────────────────────────────────────────────
-- Llamadas perdidas que cuentan como pérdida operativa real: sin contestar y con
-- un motivo imputable al equipo (no short_abandoned, out_of_opening_hours, etc.).
CREATE OR REPLACE VIEW v_perdidas_reales AS
SELECT
  id,
  call_id,
  agent_id,
  direction,
  started_at,
  answered_at,
  ended_at,
  duration_s,
  missed_reason,
  number_id,
  raw_payload
FROM calls
WHERE answered_at IS NULL
  AND missed_reason = ANY (ARRAY['agents_did_not_answer', 'no_available_agent']);


-- ── v_pausas_operativas ─────────────────────────────────────────────────────────
-- Pausas "reales" recortadas a la jornada (09:00–18:00 Europe/Madrid). Excluye los
-- substatus por defecto y comidas, y deja fuera las que superan 2400 s (40 min),
-- que se consideran anomalías (ver v_pausas_anomalias).
CREATE OR REPLACE VIEW v_pausas_operativas AS
SELECT
  id,
  user_id,
  status,
  substatus,
  started_at,
  ended_at,
  EXTRACT(epoch FROM
    LEAST(
      COALESCE(ended_at, now()),
      (date_trunc('day', started_at AT TIME ZONE 'Europe/Madrid') + '18:00:00'::interval) AT TIME ZONE 'Europe/Madrid'
    )
    - GREATEST(
      started_at,
      (date_trunc('day', started_at AT TIME ZONE 'Europe/Madrid') + '09:00:00'::interval) AT TIME ZONE 'Europe/Madrid'
    )
  )::integer AS duracion_recortada_s
FROM agent_status_intervals
WHERE status = 'unavailable'
  AND substatus <> ALL (ARRAY['always_opened', 'always_closed', 'out_for_lunch', 'Lunch'])
  AND started_at < (date_trunc('day', started_at AT TIME ZONE 'Europe/Madrid') + '18:00:00'::interval) AT TIME ZONE 'Europe/Madrid'
  AND COALESCE(ended_at, now()) > (date_trunc('day', started_at AT TIME ZONE 'Europe/Madrid') + '09:00:00'::interval) AT TIME ZONE 'Europe/Madrid'
  AND EXTRACT(epoch FROM
    LEAST(
      COALESCE(ended_at, now()),
      (date_trunc('day', started_at AT TIME ZONE 'Europe/Madrid') + '18:00:00'::interval) AT TIME ZONE 'Europe/Madrid'
    )
    - GREATEST(
      started_at,
      (date_trunc('day', started_at AT TIME ZONE 'Europe/Madrid') + '09:00:00'::interval) AT TIME ZONE 'Europe/Madrid'
    )
  ) < 2400::numeric;


-- ── v_pausas_anomalias ──────────────────────────────────────────────────────────
-- Pausas que superan 2400 s (40 min), clasificadas según si empiezan/terminan
-- dentro o fuera de la jornada (09:00–18:00 Europe/Madrid).
CREATE OR REPLACE VIEW v_pausas_anomalias AS
SELECT
  id,
  user_id,
  substatus,
  started_at,
  ended_at,
  EXTRACT(epoch FROM COALESCE(ended_at, now()) - started_at)::integer AS duration_s,
  CASE
    WHEN (started_at AT TIME ZONE 'Europe/Madrid')::time >= '09:00:00'::time
     AND (started_at AT TIME ZONE 'Europe/Madrid')::time <= '18:00:00'::time
     AND (COALESCE(ended_at, now()) AT TIME ZONE 'Europe/Madrid')::time >= '09:00:00'::time
     AND (COALESCE(ended_at, now()) AT TIME ZONE 'Europe/Madrid')::time <= '18:00:00'::time
      THEN 'pausa_larga_en_horario'
    WHEN (started_at AT TIME ZONE 'Europe/Madrid')::time >= '09:00:00'::time
     AND (started_at AT TIME ZONE 'Europe/Madrid')::time <= '18:00:00'::time
      THEN 'pausa_se_extiende_fuera_horario'
    ELSE 'pausa_fuera_horario'
  END AS tipo_anomalia
FROM agent_status_intervals
WHERE status = 'unavailable'
  AND substatus <> ALL (ARRAY['always_opened', 'always_closed', 'out_for_lunch', 'Lunch'])
  AND EXTRACT(epoch FROM COALESCE(ended_at, now()) - started_at) > 2400::numeric;
