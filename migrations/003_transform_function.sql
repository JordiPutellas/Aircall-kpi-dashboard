-- Migración 003: función transform_events()
-- Materializa agent_status_intervals y calls a partir de events_raw.
-- Idempotente: se puede relanzar sin duplicar filas.

-- DROP explícito para permitir cambios de firma al reaplicar la migración.
DROP FUNCTION IF EXISTS transform_events();

CREATE OR REPLACE FUNCTION transform_events()
RETURNS TABLE (intervals_upserted INTEGER, calls_upserted INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
    v_intervals INTEGER := 0;
    v_calls     INTEGER := 0;
BEGIN
    ----------------------------------------------------------------------------
    -- 1) agent_status_intervals
    ----------------------------------------------------------------------------
    --
    -- Estrategia:
    --   a) Recorremos en orden cronológico los eventos user.* y reconciliation.*
    --      de cada usuario. Con LEAD calculamos directamente el ended_at de
    --      cada intervalo (occurred_at del siguiente evento).
    --   b) INSERT ... ON CONFLICT (user_id, started_at) DO NOTHING evita
    --      duplicados al relanzar.
    --   c) Después cerramos los intervalos que quedaron con ended_at = NULL
    --      en runs anteriores pero que ya tienen un evento posterior
    --      registrado (DO NOTHING no actualiza, así que lo hacemos aparte).
    --
    WITH src AS (
        SELECT
            er.user_id,
            er.event_type,
            er.occurred_at,
            -- Los eventos wut_start no traen availability_status en el sentido
            -- normal: representan la transición a after_call_work.
            CASE
                WHEN er.event_type = 'user.wut_start.v2' THEN 'after_call_work'
                ELSE er.payload->'data'->>'availability_status'
            END                                       AS status,
            er.payload->'data'->>'substatus'          AS substatus
        FROM events_raw er
        WHERE er.user_id IS NOT NULL
          AND (er.event_type LIKE 'user.%' OR er.event_type LIKE 'reconciliation.%')
    ),
    with_next AS (
        SELECT
            user_id,
            status,
            substatus,
            occurred_at                                AS started_at,
            -- Próximo occurred_at ESTRICTAMENTE mayor para el mismo usuario.
            -- LEAD() devolvía el siguiente row aunque tuviera el mismo
            -- timestamp (eventos de webhook + reconciliación en el mismo
            -- segundo), generando intervalos de duración 0.
            -- GROUPS BETWEEN 1 FOLLOWING ... colapsa los empates en un solo
            -- "grupo" y salta al siguiente valor distinto.
            MIN(occurred_at) OVER (
                PARTITION BY user_id ORDER BY occurred_at
                GROUPS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
            )                                          AS ended_at
        FROM src
        WHERE status IS NOT NULL
    )
    INSERT INTO agent_status_intervals (user_id, status, substatus, started_at, ended_at)
    SELECT user_id, status, substatus, started_at, ended_at
    FROM with_next
    ON CONFLICT (user_id, started_at) DO NOTHING;

    GET DIAGNOSTICS v_intervals = ROW_COUNT;

    -- Cierre de intervalos abiertos en runs previos: si ya existe en la tabla
    -- un intervalo posterior para ese user_id, fijamos ended_at al inicio del
    -- siguiente. (No se vuelven a contar en v_intervals porque son updates,
    -- no inserts.)
    UPDATE agent_status_intervals a
    SET ended_at = (
        -- Próximo started_at ESTRICTAMENTE mayor para el mismo usuario.
        SELECT MIN(b.started_at)
        FROM agent_status_intervals b
        WHERE b.user_id    = a.user_id
          AND b.started_at > a.started_at
    )
    WHERE a.ended_at IS NULL
      AND EXISTS (
          SELECT 1 FROM agent_status_intervals b
          WHERE b.user_id    = a.user_id
            AND b.started_at > a.started_at
      );

    ----------------------------------------------------------------------------
    -- 2) calls
    ----------------------------------------------------------------------------
    --
    -- Consolidamos por call_id (extraído de payload->'data'->>'id') todos los
    -- eventos call.* en una sola fila. UPSERT con COALESCE para no perder
    -- datos cuando un campo llegue en un run posterior.
    --
    WITH call_events AS (
        SELECT
            (er.payload->'data'->>'id')::BIGINT                       AS call_id,
            er.event_type,
            er.occurred_at,
            er.payload,
            NULLIF(er.payload->'data'->'user'->>'id', '')::BIGINT     AS agent_id,
            er.payload->'data'->>'direction'                          AS direction,
            NULLIF(er.payload->'data'->>'number_id', '')::BIGINT      AS number_id,
            -- Aircall envía missed_call_reason (no missed_reason) en call.ended/call.hungup
            er.payload->'data'->>'missed_call_reason'                 AS missed_reason
        FROM events_raw er
        WHERE er.event_type LIKE 'call.%'
          AND er.payload->'data'->>'id' IS NOT NULL
    ),
    aggregated AS (
        SELECT
            call_id,
            MIN(occurred_at) FILTER (WHERE event_type = 'call.created')  AS started_at,
            MIN(occurred_at) FILTER (WHERE event_type = 'call.answered') AS answered_at,
            MAX(occurred_at) FILTER (WHERE event_type = 'call.ended')    AS ended_at,
            MAX(agent_id)                                                AS agent_id,
            MAX(direction)                                               AS direction,
            MAX(number_id)                                               AS number_id,
            -- missed_reason solo tiene sentido si la llamada nunca se contestó
            CASE
                WHEN MIN(occurred_at) FILTER (WHERE event_type = 'call.answered') IS NULL
                THEN MAX(missed_reason) FILTER (
                    WHERE event_type IN ('call.hungup', 'call.ended')
                      AND missed_reason IS NOT NULL
                )
                ELSE NULL
            END                                                          AS missed_reason,
            -- raw_payload: el evento más reciente registrado de esa llamada
            (ARRAY_AGG(payload ORDER BY occurred_at DESC))[1]            AS raw_payload
        FROM call_events
        GROUP BY call_id
    )
    INSERT INTO calls (
        call_id, agent_id, direction,
        started_at, answered_at, ended_at, duration_s,
        missed_reason, number_id, raw_payload
    )
    SELECT
        call_id, agent_id, direction,
        started_at, answered_at, ended_at,
        CASE
            WHEN started_at IS NOT NULL AND ended_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
            ELSE NULL
        END,
        missed_reason, number_id, raw_payload
    FROM aggregated
    ON CONFLICT (call_id) DO UPDATE SET
        agent_id      = COALESCE(EXCLUDED.agent_id,      calls.agent_id),
        direction     = COALESCE(EXCLUDED.direction,     calls.direction),
        started_at    = COALESCE(EXCLUDED.started_at,    calls.started_at),
        answered_at   = COALESCE(EXCLUDED.answered_at,   calls.answered_at),
        ended_at      = COALESCE(EXCLUDED.ended_at,      calls.ended_at),
        duration_s    = COALESCE(EXCLUDED.duration_s,    calls.duration_s),
        missed_reason = COALESCE(EXCLUDED.missed_reason, calls.missed_reason),
        number_id     = COALESCE(EXCLUDED.number_id,     calls.number_id),
        raw_payload   = COALESCE(EXCLUDED.raw_payload,   calls.raw_payload);

    GET DIAGNOSTICS v_calls = ROW_COUNT;

    RETURN QUERY SELECT v_intervals, v_calls;
END;
$$;

COMMENT ON FUNCTION transform_events() IS
    'Materializa agent_status_intervals y calls desde events_raw. Idempotente. '
    'Llamada por el handler scheduled del worker tras la reconciliación.';
