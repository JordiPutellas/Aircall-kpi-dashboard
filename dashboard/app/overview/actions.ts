'use server';

import { query } from '@/lib/db';

export interface LossRecord {
  call_id: string;
  started_at: string | null;
  ended_at: string | null;
  missed_reason: string;
  duration_s: number;
  agent_id: string | null;
}

export interface AgentLossSummary {
  user_id: string;
  name: string;
  perdidas_hoy: number;
}

/**
 * Server Action para obtener el listado de agentes con pérdidas y el detalle de llamadas
 * para una fecha dada (formato YYYY-MM-DD o ISO string).
 */
export async function getLossesForDateAction(dateStr: string): Promise<{
  agentesPerdidas: AgentLossSummary[];
  detalleLlamadas: LossRecord[];
}> {
  const qAgentesPerdidas = `
    SELECT 
      u.user_id::text, 
      u.name, 
      COUNT(c.call_id)::int AS perdidas_hoy
    FROM v_users u
    LEFT JOIN v_perdidas_reales c ON c.agent_id = u.user_id
      AND COALESCE(c.started_at, c.ended_at) >= date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
      AND COALESCE(c.started_at, c.ended_at) < date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' + interval '1 day'
    GROUP BY u.user_id, u.name
    ORDER BY perdidas_hoy DESC, u.name ASC;
  `;

  const qDetalleLlamadas = `
    SELECT 
      c.call_id::text, 
      c.started_at, 
      c.ended_at, 
      c.missed_reason, 
      c.duration_s, 
      c.agent_id::text
    FROM v_perdidas_reales c
    WHERE COALESCE(c.started_at, c.ended_at) >= date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
      AND COALESCE(c.started_at, c.ended_at) < date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' + interval '1 day'
    ORDER BY COALESCE(c.started_at, c.ended_at) DESC;
  `;

  try {
    const [agentesPerdidasRaw, detalleLlamadasRaw] = await Promise.all([
      query(qAgentesPerdidas, [dateStr]),
      query(qDetalleLlamadas, [dateStr])
    ]);

    return {
      agentesPerdidas: agentesPerdidasRaw.map(a => ({
        user_id: a.user_id,
        name: a.name || 'Agente Desconocido',
        perdidas_hoy: Number(a.perdidas_hoy) || 0
      })),
      detalleLlamadas: detalleLlamadasRaw.map(c => ({
        call_id: c.call_id,
        started_at: c.started_at ? new Date(c.started_at).toISOString() : null,
        ended_at: c.ended_at ? new Date(c.ended_at).toISOString() : null,
        missed_reason: c.missed_reason || '',
        duration_s: Number(c.duration_s) || 0,
        agent_id: c.agent_id || null
      }))
    };
  } catch (error) {
    console.error('Error fetching losses for date:', error);
    throw new Error('No se pudieron recuperar las pérdidas para la fecha seleccionada.');
  }
}

/**
 * Server Action para refrescar el resumen de KPIs diario de hoy
 */
export async function getTodayKpiSummaryAction() {
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

  try {
    const resumenRaw = await query(qResumen);
    const resumen = resumenRaw[0] || { total: 0, atendidas: 0, perdidas_brutas: 0, perdidas: 0, tasa_atencion: 0.0 };

    return {
      resumen: {
        total: Number(resumen.total) || 0,
        atendidas: Number(resumen.atendidas) || 0,
        perdidas_brutas: Number(resumen.perdidas_brutas) || 0,
        perdidas: Number(resumen.perdidas) || 0,
        tasa_atencion: Number(resumen.tasa_atencion) || 0.0
      }
    };
  } catch (error) {
    console.error('Error fetching today KPI summary:', error);
    throw new Error('No se pudo refrescar el resumen de KPIs.');
  }
}
