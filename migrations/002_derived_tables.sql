-- Migración 002: tablas derivadas
-- Materializadas desde events_raw por la función transform_events() (migración 003).

-- ── agent_status_intervals ────────────────────────────────────────────────────
-- Un intervalo por cada período que un agente pasó en un estado concreto.
-- ended_at IS NULL → intervalo aún abierto (el último estado conocido).

CREATE TABLE IF NOT EXISTS agent_status_intervals (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    status      TEXT         NOT NULL,  -- available | unavailable | after_call_work | offline
    substatus   TEXT,                    -- on_a_break | out_for_lunch | in_training | doing_back_office | other | NULL
    started_at  TIMESTAMPTZ  NOT NULL,
    ended_at    TIMESTAMPTZ,
    duration_s  INTEGER GENERATED ALWAYS AS (
                  EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
                ) STORED,
    -- Clave natural para idempotencia del transform (ON CONFLICT DO NOTHING)
    CONSTRAINT agent_status_intervals_user_started_key UNIQUE (user_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_intervals_user_id
    ON agent_status_intervals (user_id);

CREATE INDEX IF NOT EXISTS idx_intervals_started_at
    ON agent_status_intervals (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_intervals_user_started
    ON agent_status_intervals (user_id, started_at DESC);

COMMENT ON TABLE agent_status_intervals IS
    'Un intervalo por cada período que un agente pasó en un estado concreto. '
    'Reconstruido desde events_raw por transform_events().';


-- ── calls ─────────────────────────────────────────────────────────────────────
-- Una fila por llamada, consolidando los eventos call.* del payload bruto.

CREATE TABLE IF NOT EXISTS calls (
    id            BIGSERIAL    PRIMARY KEY,
    call_id       BIGINT       UNIQUE NOT NULL,
    agent_id      BIGINT,
    direction     TEXT,                          -- inbound | outbound
    started_at    TIMESTAMPTZ,                   -- de call.created
    answered_at   TIMESTAMPTZ,                   -- de call.answered (NULL si nunca se contestó)
    ended_at      TIMESTAMPTZ,                   -- de call.ended
    duration_s    INTEGER,                       -- ended_at - started_at, calculado en transform
    missed_reason TEXT,                          -- solo si answered_at IS NULL
    number_id     BIGINT,
    raw_payload   JSONB                          -- último evento conocido de la llamada
);

CREATE INDEX IF NOT EXISTS idx_calls_agent_id
    ON calls (agent_id);

CREATE INDEX IF NOT EXISTS idx_calls_started_at
    ON calls (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_missed_reason
    ON calls (missed_reason)
    WHERE missed_reason IS NOT NULL;

COMMENT ON TABLE calls IS
    'Una fila por llamada. Consolidada vía UPSERT en transform_events() '
    'a partir de todos los eventos call.* en events_raw.';
