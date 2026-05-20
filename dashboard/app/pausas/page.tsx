import { query } from '@/lib/db';
import PausasClient from '@/components/PausasClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ResumenPausasDb {
  total_pausas: number;
  minutos_total: number;
  minutos_media: number;
}

interface PausaMotivoDb {
  name: string;
  motivo: string;
  num_pausas: number;
  minutos_total: number;
  minutos_media: number;
}

interface PausaLargaDb {
  name: string;
  motivo: string;
  started_at: Date | string;
  ended_at: Date | string | null;
  minutos: number;
}

export default async function Page() {
  // 1. Resumen global de pausas de agentes hoy (excluyendo Preventa Team y subestados de sistema)
  const qResumen = `
    WITH ventana AS (
      SELECT
        date_trunc('day', now())                     AS inicio,
        date_trunc('day', now()) + interval '1 day'  AS fin
    )
    SELECT
      COUNT(*)::int AS total_pausas,
      COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (LEAST(COALESCE(i.ended_at, now()), v.fin) - GREATEST(i.started_at, v.inicio))) / 60.0)::numeric, 1), 0.0)::float AS minutos_total,
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (LEAST(COALESCE(i.ended_at, now()), v.fin) - GREATEST(i.started_at, v.inicio))) / 60.0)::numeric, 1), 0.0)::float AS minutos_media
    FROM agent_status_intervals i
    CROSS JOIN ventana v
    LEFT JOIN v_users u ON u.user_id = i.user_id
    WHERE i.status = 'unavailable'
      AND i.substatus NOT IN ('always_opened', 'always_closed')
      AND u.name != 'Preventa Team'
      AND i.started_at < v.fin
      AND COALESCE(i.ended_at, now()) > v.inicio;
  `;

  // 2. Desglose de pausas por motivo y agente hoy
  const qPausasHoy = `
    WITH ventana AS (
      SELECT
        date_trunc('day', now())                     AS inicio,
        date_trunc('day', now()) + interval '1 day'  AS fin
    )
    SELECT
      u.name,
      i.substatus AS motivo,
      COUNT(*)::int AS num_pausas,
      ROUND(SUM(
        EXTRACT(EPOCH FROM (
          LEAST(COALESCE(i.ended_at, now()), v.fin)
          - GREATEST(i.started_at, v.inicio)
        ))
      ) / 60.0, 1)::float AS minutos_total,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (
          LEAST(COALESCE(i.ended_at, now()), v.fin)
          - GREATEST(i.started_at, v.inicio)
        ))
      ) / 60.0, 1)::float AS minutos_media
    FROM agent_status_intervals i
    CROSS JOIN ventana v
    LEFT JOIN v_users u ON u.user_id = i.user_id
    WHERE i.status = 'unavailable'
      AND i.substatus NOT IN ('always_opened', 'always_closed')
      AND u.name != 'Preventa Team'
      AND i.started_at < v.fin
      AND COALESCE(i.ended_at, now()) > v.inicio
    GROUP BY u.name, i.substatus
    ORDER BY minutos_total DESC;
  `;

  // 3. Top de pausas más largas últimos 7 días (> 30 minutos)
  const qPausasLargas = `
    SELECT
      u.name,
      i.substatus AS motivo,
      i.started_at,
      i.ended_at,
      ROUND(i.duration_s / 60.0, 1)::float AS minutos
    FROM agent_status_intervals i
    LEFT JOIN v_users u ON u.user_id = i.user_id
    WHERE i.status = 'unavailable'
      AND i.substatus NOT IN ('always_opened', 'always_closed')
      AND u.name != 'Preventa Team'
      AND i.duration_s > 30 * 60
      AND i.started_at >= now() - interval '7 days'
    ORDER BY i.duration_s DESC
    LIMIT 50;
  `;

  const [resumenRaw, pausasHoy, pausasLargasRaw] = await Promise.all([
    query<ResumenPausasDb>(qResumen),
    query<PausaMotivoDb>(qPausasHoy),
    query<PausaLargaDb>(qPausasLargas),
  ]);

  const resumen = resumenRaw[0] || { total_pausas: 0, minutos_total: 0, minutos_media: 0 };

  const pausasLargas = pausasLargasRaw.map(p => ({
    name: p.name || 'Agente Desconocido',
    motivo: p.motivo,
    started_at: p.started_at instanceof Date ? p.started_at.toISOString() : new Date(p.started_at).toISOString(),
    ended_at: p.ended_at 
      ? (p.ended_at instanceof Date ? p.ended_at.toISOString() : new Date(p.ended_at).toISOString())
      : null,
    minutos: Number(p.minutos) || 0
  }));

  const lastUpdated = new Date().toLocaleTimeString('es-ES', { 
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <PausasClient
      resumen={{
        total_pausas: Number(resumen.total_pausas) || 0,
        minutos_total: Number(resumen.minutos_total) || 0.0,
        minutos_media: Number(resumen.minutos_media) || 0.0
      }}
      pausasHoy={pausasHoy}
      pausasLargas={pausasLargas}
      lastUpdated={lastUpdated}
    />
  );
}
