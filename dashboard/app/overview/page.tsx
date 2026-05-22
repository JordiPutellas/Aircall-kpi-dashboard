import { query } from '@/lib/db';
import OverviewClient from '@/components/OverviewClient';

// Forzar renderizado dinámico en cada petición para reflejar el tiempo real
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ResumenDb {
  total: number | null;
  atendidas: number | null;
  perdidas_brutas: number | null;
  perdidas: number | null; // pérdidas reales (de v_perdidas_reales)
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
  categoria: 'ACCIONABLE' | 'CONTEXTUAL';
}

interface AhtAgenteDb {
  name: string;
  llamadas_atendidas: number;
  aht_minutos: number;
}

interface AgentePerdidaDb {
  user_id: string;
  name: string;
  perdidas_hoy: number;
}

interface DetalleLlamadaDb {
  call_id: string;
  started_at: Date | string | null;
  ended_at: Date | string | null;
  missed_reason: string;
  duration_s: number;
  agent_id: string | null;
}

export default async function Page() {
  // 1. Resumen general hoy (usando v_perdidas_reales para pérdidas operativas y tasa de atención)
  const qResumen = `
    WITH stats_calls AS (
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS atendidas,
        COUNT(*) FILTER (WHERE answered_at IS NULL)::int AS perdidas_brutas
      FROM calls
      WHERE COALESCE(started_at, ended_at) >= date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
        AND COALESCE(started_at, ended_at) < date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' + interval '1 day'
    ),
    stats_perdidas_reales AS (
      SELECT COUNT(*)::int AS perdidas_reales
      FROM v_perdidas_reales
      WHERE COALESCE(started_at, ended_at) >= date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
        AND COALESCE(started_at, ended_at) < date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' + interval '1 day'
    )
    SELECT
      sc.total,
      sc.atendidas,
      sc.perdidas_brutas,
      spr.perdidas_reales AS perdidas,
      COALESCE(
        ROUND(100.0 * sc.atendidas / NULLIF(sc.atendidas + spr.perdidas_reales, 0), 1),
        0.0
      )::float AS tasa_atencion
    FROM stats_calls sc
    CROSS JOIN stats_perdidas_reales spr;
  `;

  // 2. Llamadas perdidas por hora hoy (consumiendo de v_perdidas_reales)
  const qLlamadasHora = `
    SELECT
      EXTRACT(HOUR FROM COALESCE(started_at, ended_at) AT TIME ZONE 'Europe/Madrid')::int AS hora,
      COUNT(*)::int AS perdidas
    FROM v_perdidas_reales
    WHERE COALESCE(started_at, ended_at) >= date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
      AND COALESCE(started_at, ended_at) < date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' + interval '1 day'
    GROUP BY hora
    ORDER BY hora;
  `;

  // 3. Motivos de llamadas perdidas últimos 7 días (categorizando ACCIONABLE vs CONTEXTUAL)
  const qLlamadasMotivos = `
    SELECT
      missed_reason,
      COUNT(*)::int AS num_llamadas,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)::float AS pct,
      CASE 
        WHEN missed_reason IN ('agents_did_not_answer', 'no_available_agent') THEN 'ACCIONABLE' 
        ELSE 'CONTEXTUAL' 
      END AS categoria
    FROM calls
    WHERE answered_at IS NULL
      AND missed_reason IS NOT NULL
      AND COALESCE(started_at, ended_at) >= now() - interval '7 days'
    GROUP BY missed_reason
    ORDER BY num_llamadas DESC;
  `;

  // 4. AHT últimos 7 días
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

  // 5. Conteo de pérdidas operativas reales por agente hoy
  const qAgentesPerdidas = `
    SELECT 
      u.user_id::text, 
      u.name, 
      COUNT(c.call_id)::int AS perdidas_hoy
    FROM v_users u
    LEFT JOIN v_perdidas_reales c ON c.agent_id = u.user_id
      AND COALESCE(c.started_at, c.ended_at) >= date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
      AND COALESCE(c.started_at, c.ended_at) < date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' + interval '1 day'
    GROUP BY u.user_id, u.name
    ORDER BY perdidas_hoy DESC, u.name ASC;
  `;

  // 6. Detalle de todas las llamadas perdidas reales de hoy
  const qDetalleLlamadas = `
    SELECT 
      c.call_id::text, 
      c.started_at, 
      c.ended_at, 
      c.missed_reason, 
      c.duration_s, 
      c.agent_id::text
    FROM v_perdidas_reales c
    WHERE COALESCE(c.started_at, c.ended_at) >= date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
      AND COALESCE(c.started_at, c.ended_at) < date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' + interval '1 day'
    ORDER BY COALESCE(c.started_at, c.ended_at) DESC;
  `;

  // Ejecución concurrente de las consultas
  const [resumenRaw, llamadasHora, llamadasMotivos, agentesPerdidasRaw, ahtAgentes, detalleLlamadasRaw] = await Promise.all([
    query<ResumenDb>(qResumen),
    query<LlamadaHoraDb>(qLlamadasHora),
    query<LlamadaMotivoDb>(qLlamadasMotivos),
    query<AgentePerdidaDb>(qAgentesPerdidas),
    query<AhtAgenteDb>(qAht),
    query<any>(qDetalleLlamadas)
  ]);

  const resumen = resumenRaw[0] || { total: 0, atendidas: 0, perdidas_brutas: 0, perdidas: 0, tasa_atencion: 0.0 };

  const agentesPerdidas = agentesPerdidasRaw.map(a => ({
    user_id: a.user_id,
    name: a.name || 'Agente Desconocido',
    perdidas_hoy: Number(a.perdidas_hoy) || 0
  }));

  const detalleLlamadas = detalleLlamadasRaw.map(c => ({
    call_id: c.call_id,
    started_at: c.started_at ? new Date(c.started_at).toISOString() : null,
    ended_at: c.ended_at ? new Date(c.ended_at).toISOString() : null,
    missed_reason: c.missed_reason || '',
    duration_s: Number(c.duration_s) || 0,
    agent_id: c.agent_id || null
  }));

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
        perdidas_brutas: Number(resumen.perdidas_brutas) || 0,
        perdidas: Number(resumen.perdidas) || 0,
        tasa_atencion: Number(resumen.tasa_atencion) || 0.0
      }}
      llamadasHora={llamadasHora}
      llamadasMotivos={llamadasMotivos}
      ahtAgentes={ahtAgentes}
      agentesPerdidas={agentesPerdidas}
      detalleLlamadas={detalleLlamadas}
      lastUpdated={lastUpdated}
    />
  );
}
