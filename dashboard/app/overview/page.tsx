import { query } from '@/lib/db';
import OverviewClient from '@/components/OverviewClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ResumenDb {
  total: number | null;
  atendidas: number | null;
  perdidas: number | null;
  tasa_atencion: number | null;
}

interface LlamadaHoraDb {
  hora: number;
  perdidas: number;
}

interface LlamadaMotivoDb {
  missed_reason: string;
  num_llamadas: number;
  pct: number;
}

interface OcupacionAgenteDb {
  name: string;
  talk_s: number;
  acw_s: number;
  conectado_s: number;
  ocupacion_pct: number;
}

interface AhtAgenteDb {
  name: string;
  llamadas_atendidas: number;
  aht_minutos: number;
}

export default async function Page() {
  // 1. Resumen general hoy
  const qResumen = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS atendidas,
      COUNT(*) FILTER (WHERE answered_at IS NULL)::int AS perdidas,
      COALESCE(
        ROUND(100.0 * COUNT(*) FILTER (WHERE answered_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1),
        0.0
      )::float AS tasa_atencion
    FROM calls
    WHERE COALESCE(started_at, ended_at) >= date_trunc('day', now());
  `;

  // 2. Llamadas perdidas por hora hoy
  const qLlamadasHora = `
    SELECT
      EXTRACT(HOUR FROM COALESCE(started_at, ended_at))::int AS hora,
      COUNT(*)::int AS perdidas
    FROM calls
    WHERE answered_at IS NULL
      AND COALESCE(started_at, ended_at) >= date_trunc('day', now())
    GROUP BY hora
    ORDER BY hora;
  `;

  // 3. Motivos de llamadas perdidas últimos 7 días
  const qLlamadasMotivos = `
    SELECT
      missed_reason,
      COUNT(*)::int AS num_llamadas,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)::float AS pct
    FROM calls
    WHERE answered_at IS NULL
      AND missed_reason IS NOT NULL
      AND COALESCE(started_at, ended_at) >= now() - interval '7 days'
    GROUP BY missed_reason
    ORDER BY num_llamadas DESC;
  `;

  // 4. Ocupación por agente hoy
  const qOcupacion = `
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
      COALESCE(
        ROUND(
          100.0 * (COALESCE(l.talk_s, 0) + COALESCE(t.acw_s, 0))
                / NULLIF(t.conectado_s, 0),
          1
        ),
        0.0
      )::float AS ocupacion_pct
    FROM tiempos t
    LEFT JOIN llamadas l ON l.user_id = t.user_id
    LEFT JOIN v_users u  ON u.user_id = t.user_id
    WHERE u.name IS NOT NULL
    ORDER BY ocupacion_pct DESC NULLS LAST;
  `;

  // 5. AHT últimos 7 días
  const qAht = `
    SELECT
      u.name,
      COUNT(*)::int AS llamadas_atendidas,
      ROUND(
        AVG(EXTRACT(EPOCH FROM (ended_at - answered_at))) / 60.0,
        1
      )::float AS aht_minutos
    FROM calls c
    LEFT JOIN v_users u ON u.user_id = c.agent_id
    WHERE c.answered_at IS NOT NULL
      AND c.ended_at IS NOT NULL
      AND c.answered_at >= now() - interval '7 days'
      AND u.name IS NOT NULL
    GROUP BY u.name
    ORDER BY aht_minutos DESC;
  `;

  // Ejecución concurrente de las consultas
  const [resumenRaw, llamadasHora, llamadasMotivos, ocupacionAgentes, ahtAgentes] = await Promise.all([
    query<ResumenDb>(qResumen),
    query<LlamadaHoraDb>(qLlamadasHora),
    query<LlamadaMotivoDb>(qLlamadasMotivos),
    query<OcupacionAgenteDb>(qOcupacion),
    query<AhtAgenteDb>(qAht),
  ]);

  const resumen = resumenRaw[0] || { total: 0, atendidas: 0, perdidas: 0, tasa_atencion: 0.0 };

  const lastUpdated = new Date().toLocaleTimeString('es-ES', { 
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <OverviewClient
      resumen={{
        total: Number(resumen.total) || 0,
        atendidas: Number(resumen.atendidas) || 0,
        perdidas: Number(resumen.perdidas) || 0,
        tasa_atencion: Number(resumen.tasa_atencion) || 0.0
      }}
      llamadasHora={llamadasHora}
      llamadasMotivos={llamadasMotivos}
      ocupacionAgentes={ocupacionAgentes}
      ahtAgentes={ahtAgentes}
      lastUpdated={lastUpdated}
    />
  );
}
