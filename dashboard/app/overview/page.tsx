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
      WHERE COALESCE(started_at, ended_at) >= madrid_day_start(now())
        AND COALESCE(started_at, ended_at) < madrid_day_end(now())
    ),
    stats_perdidas_reales AS (
      SELECT COUNT(*)::int AS perdidas_reales
      FROM v_perdidas_reales
      WHERE COALESCE(started_at, ended_at) >= madrid_day_start(now())
        AND COALESCE(started_at, ended_at) < madrid_day_end(now())
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

  // 2. Conteo de pérdidas operativas reales por agente hoy
  const qAgentesPerdidas = `
    SELECT 
      u.user_id::text, 
      u.name, 
      COUNT(c.call_id)::int AS perdidas_hoy
    FROM v_users u
    LEFT JOIN v_perdidas_reales c ON c.agent_id = u.user_id
      AND COALESCE(c.started_at, c.ended_at) >= madrid_day_start(now())
      AND COALESCE(c.started_at, c.ended_at) < madrid_day_end(now())
    GROUP BY u.user_id, u.name
    ORDER BY perdidas_hoy DESC, u.name ASC;
  `;

  // 3. Detalle de todas las llamadas perdidas reales de hoy
  const qDetalleLlamadas = `
    SELECT 
      c.call_id::text, 
      c.started_at, 
      c.ended_at, 
      c.missed_reason, 
      c.duration_s, 
      c.agent_id::text
    FROM v_perdidas_reales c
    WHERE COALESCE(c.started_at, c.ended_at) >= madrid_day_start(now())
      AND COALESCE(c.started_at, c.ended_at) < madrid_day_end(now())
    ORDER BY COALESCE(c.started_at, c.ended_at) DESC;
  `;

  // Ejecución concurrente de las consultas
  const [resumenRaw, agentesPerdidasRaw, detalleLlamadasRaw] = await Promise.all([
    query<ResumenDb>(qResumen),
    query<AgentePerdidaDb>(qAgentesPerdidas),
    query<DetalleLlamadaDb>(qDetalleLlamadas)
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
      agentesPerdidas={agentesPerdidas}
      detalleLlamadas={detalleLlamadas}
      lastUpdated={lastUpdated}
    />
  );
}
