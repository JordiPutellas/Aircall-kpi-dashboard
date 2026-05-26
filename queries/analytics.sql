-- ============================================================
-- ANALYTICS QUERIES — Aircall KPIs Dashboard
-- ============================================================
-- Queries de análisis sobre las tablas derivadas
-- (agent_status_intervals, calls) que materializa transform_events().
--
-- Cómo usarlas: pega cada query (con su CREATE VIEW si aplica)
-- en el SQL Editor de Neon de forma independiente.
-- ============================================================


-- ============================================================
-- 0. VIEW HELPER — dimensión de usuarios
-- ============================================================
-- Última versión conocida del nombre/email de cada user_id.
-- La definición canónica vive en migrations/004_create_views.sql (incluye la
-- exclusión de cuentas no-agente). No la dupliques aquí.


-- ============================================================
-- 1. ESTADO ACTUAL DE CADA AGENTE
-- ============================================================
-- Snapshot del último estado conocido por usuario. Útil para
-- el wallboard "qué está pasando ahora mismo".

SELECT
  u.name,
  i.status,
  i.substatus,
  i.started_at AS desde,
  EXTRACT(EPOCH FROM (now() - i.started_at))::int / 60 AS minutos_en_estado
FROM agent_status_intervals i
LEFT JOIN v_users u ON u.user_id = i.user_id
WHERE i.ended_at IS NULL
ORDER BY i.started_at DESC;


-- ============================================================
-- 2. TIEMPO POR ESTADO POR AGENTE — HOY
-- ============================================================
-- Cuánto tiempo ha pasado cada agente en cada estado dentro
-- de una ventana temporal. Maneja correctamente intervalos
-- que cruzan los bordes (clipping a la ventana).

WITH ventana AS (
  SELECT
    date_trunc('day', now())                     AS inicio,
    date_trunc('day', now()) + interval '1 day'  AS fin
)
SELECT
  u.name,
  i.status,
  ROUND(SUM(
    EXTRACT(EPOCH FROM (
      LEAST(COALESCE(i.ended_at, now()), v.fin)
      - GREATEST(i.started_at, v.inicio)
    )) / 60.0
  )::numeric, 1) AS minutos
FROM agent_status_intervals i
CROSS JOIN ventana v
LEFT JOIN v_users u ON u.user_id = i.user_id
WHERE i.started_at < v.fin
  AND COALESCE(i.ended_at, now()) > v.inicio
GROUP BY u.name, i.status
ORDER BY u.name, minutos DESC;


-- ============================================================
-- 3. DESGLOSE DE PAUSAS POR MOTIVO — HOY
-- ============================================================
-- Para cada agente, tiempo en cada motivo de pausa real
-- (excluye los substatus por defecto always_opened/always_closed).

WITH ventana AS (
  SELECT
    date_trunc('day', now())                     AS inicio,
    date_trunc('day', now()) + interval '1 day'  AS fin
)
SELECT
  u.name,
  i.substatus AS motivo,
  COUNT(*)    AS num_pausas,
  ROUND(SUM(
    EXTRACT(EPOCH FROM (
      LEAST(COALESCE(i.ended_at, now()), v.fin)
      - GREATEST(i.started_at, v.inicio)
    )) / 60.0
  )::numeric, 1) AS minutos_total,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (
      LEAST(COALESCE(i.ended_at, now()), v.fin)
      - GREATEST(i.started_at, v.inicio)
    )) / 60.0
  )::numeric, 1) AS minutos_media
FROM agent_status_intervals i
CROSS JOIN ventana v
LEFT JOIN v_users u ON u.user_id = i.user_id
WHERE i.status = 'unavailable'
  AND i.substatus NOT IN ('always_opened', 'always_closed')
  AND i.started_at < v.fin
  AND COALESCE(i.ended_at, now()) > v.inicio
GROUP BY u.name, i.substatus
ORDER BY u.name, minutos_total DESC;


-- ============================================================
-- 4. JORNADA EFECTIVA — HOY
-- ============================================================
-- Primer login, último logout, número de des/reconexiones.

SELECT
  u.name,
  MIN(e.occurred_at) FILTER (
    WHERE e.event_type LIKE 'user.connected%'
  ) AS primer_login,
  MAX(e.occurred_at) FILTER (
    WHERE e.event_type LIKE 'user.disconnected%'
  ) AS ultimo_logout,
  COUNT(*) FILTER (
    WHERE e.event_type LIKE 'user.disconnected%'
  ) AS desconexiones,
  COUNT(*) FILTER (
    WHERE e.event_type LIKE 'user.connected%'
  ) AS reconexiones
FROM events_raw e
LEFT JOIN v_users u ON u.user_id = e.user_id
WHERE e.occurred_at >= date_trunc('day', now())
  AND e.event_type IN (
    'user.connected', 'user.connected.v2',
    'user.disconnected', 'user.disconnected.v2'
  )
GROUP BY u.name
ORDER BY primer_login;


-- ============================================================
-- 5. LLAMADAS PERDIDAS POR HORA — HOY
-- ============================================================

SELECT
  date_trunc('hour', COALESCE(started_at, ended_at)) AS hora,
  COUNT(*) AS perdidas
FROM calls
WHERE answered_at IS NULL
  AND COALESCE(started_at, ended_at) >= date_trunc('day', now())
GROUP BY hora
ORDER BY hora;


-- ============================================================
-- 6. LLAMADAS PERDIDAS POR MOTIVO — ÚLTIMOS 7 DÍAS
-- ============================================================

SELECT
  missed_reason,
  COUNT(*) AS num_llamadas,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM calls
WHERE answered_at IS NULL
  AND missed_reason IS NOT NULL
  AND COALESCE(started_at, ended_at) >= now() - interval '7 days'
GROUP BY missed_reason
ORDER BY num_llamadas DESC;


-- ============================================================
-- 7. OCUPACIÓN POR AGENTE — HOY
-- ============================================================
-- Ratio (talk + ACW) / tiempo conectado.
-- "Conectado" = todo intervalo no offline.

WITH ventana AS (
  SELECT
    date_trunc('day', now())                     AS inicio,
    date_trunc('day', now()) + interval '1 day'  AS fin
),
tiempos AS (
  SELECT
    i.user_id,
    SUM(
      EXTRACT(EPOCH FROM (
        LEAST(COALESCE(i.ended_at, now()), v.fin)
        - GREATEST(i.started_at, v.inicio)
      ))
    ) FILTER (WHERE i.status = 'after_call_work') AS acw_s,
    SUM(
      EXTRACT(EPOCH FROM (
        LEAST(COALESCE(i.ended_at, now()), v.fin)
        - GREATEST(i.started_at, v.inicio)
      ))
    ) FILTER (
      WHERE i.status IN ('available', 'unavailable', 'after_call_work')
    ) AS conectado_s
  FROM agent_status_intervals i
  CROSS JOIN ventana v
  WHERE i.started_at < v.fin
    AND COALESCE(i.ended_at, now()) > v.inicio
  GROUP BY i.user_id
),
llamadas AS (
  SELECT
    agent_id AS user_id,
    SUM(EXTRACT(EPOCH FROM (ended_at - answered_at)))::int AS talk_s
  FROM calls
  WHERE answered_at IS NOT NULL
    AND ended_at IS NOT NULL
    AND answered_at >= (SELECT inicio FROM ventana)
    AND answered_at <  (SELECT fin FROM ventana)
  GROUP BY agent_id
)
SELECT
  u.name,
  COALESCE(l.talk_s, 0)::int AS talk_s,
  COALESCE(t.acw_s, 0)::int  AS acw_s,
  t.conectado_s::int         AS conectado_s,
  ROUND(
    100.0 * (COALESCE(l.talk_s, 0) + COALESCE(t.acw_s, 0))
          / NULLIF(t.conectado_s, 0),
    1
  ) AS ocupacion_pct
FROM tiempos t
LEFT JOIN llamadas l ON l.user_id = t.user_id
LEFT JOIN v_users u  ON u.user_id = t.user_id
ORDER BY ocupacion_pct DESC NULLS LAST;


-- ============================================================
-- 8. AHT (Average Handle Time) — ÚLTIMOS 7 DÍAS
-- ============================================================

SELECT
  u.name,
  COUNT(*) AS llamadas_atendidas,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (ended_at - answered_at))) / 60.0,
    1
  ) AS aht_minutos
FROM calls c
LEFT JOIN v_users u ON u.user_id = c.agent_id
WHERE c.answered_at IS NOT NULL
  AND c.ended_at IS NOT NULL
  AND c.answered_at >= now() - interval '7 days'
GROUP BY u.name
ORDER BY aht_minutos DESC;


-- ============================================================
-- 9. TOP DE PAUSAS MÁS LARGAS — ÚLTIMOS 7 DÍAS
-- ============================================================
-- Anomalías: pausas reales que superan 30 min.

SELECT
  u.name,
  i.substatus AS motivo,
  i.started_at,
  i.ended_at,
  ROUND(i.duration_s / 60.0, 1) AS minutos
FROM agent_status_intervals i
LEFT JOIN v_users u ON u.user_id = i.user_id
WHERE i.status = 'unavailable'
  AND i.substatus NOT IN ('always_opened', 'always_closed')
  AND i.duration_s > 30 * 60
  AND i.started_at >= now() - interval '7 days'
ORDER BY i.duration_s DESC
LIMIT 50;


-- ============================================================
-- 10. TIMELINE DETALLADA DE UN AGENTE
-- ============================================================
-- Audit trail de los últimos N intervalos del usuario indicado.
-- Sustituye el user_id por el del agente que quieras inspeccionar.

SELECT
  i.started_at,
  i.ended_at,
  i.status,
  i.substatus,
  ROUND(i.duration_s / 60.0, 1) AS minutos
FROM agent_status_intervals i
WHERE i.user_id = 1505407  -- cambia por el ID que quieras
ORDER BY i.started_at DESC
LIMIT 50;