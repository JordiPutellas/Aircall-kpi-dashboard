'use server';

import { query } from '@/lib/db';

export interface ResumenPausas {
  total_pausas: number;
  minutos_total: number;
  minutos_media: number;
}

export interface PausaTopAgente {
  name: string;
  minutos_total: number;
}

export interface PausaMotivo {
  motivo: string;
  num_pausas: number;
  minutos_total: number;
}

export interface PausaAgente {
  user_id: string;
  name: string;
  total_pausas: number;
  minutos_total: number;
  minutos_media: number;
}

export interface PausaAnomalia {
  id: string;
  name: string;
  motivo: string;
  started_at: string;
  ended_at: string | null;
  duration_s: number;
  tipo_anomalia: string;
}

interface ResumenPausasDb {
  total_pausas: number;
  minutos_total: number;
  minutos_media: number;
}

interface PausaTopAgenteDb {
  name: string;
  minutos_total: number;
}

interface PausaMotivoDb {
  motivo: string | null;
  num_pausas: number;
  minutos_total: number;
}

interface PausaAgenteDb {
  user_id: string;
  name: string;
  total_pausas: number;
  minutos_total: number;
  minutos_media: number;
}

interface PausaAnomaliaDb {
  id: string;
  name: string;
  motivo: string | null;
  started_at: Date | string | null;
  ended_at: Date | string | null;
  duration_s: number;
  tipo_anomalia: string;
}

/**
 * Server Action para obtener todos los datos de pausas para una fecha específica (YYYY-MM-DD)
 */
export async function getPausasDataForDateAction(dateStr: string): Promise<{
  resumen: ResumenPausas;
  topAgente: PausaTopAgente | null;
  pausasMotivos: PausaMotivo[];
  pausasAgentes: PausaAgente[];
  pausasAnomalias: PausaAnomalia[];
}> {
  // 1. Resumen global de pausas de agentes
  const qResumen = `
    SELECT
      COUNT(*)::int AS total_pausas,
      COALESCE(SUM(duracion_recortada_s) / 60.0, 0.0)::float AS minutos_total,
      COALESCE(AVG(duracion_recortada_s) / 60.0, 0.0)::float AS minutos_media
    FROM v_pausas_operativas
    WHERE madrid_local(started_at)::date = $1::date;
  `;

  // 2. Top Agente por pausas operativas legítimas
  const qTopAgente = `
    SELECT
      u.name,
      COALESCE(SUM(p.duracion_recortada_s) / 60.0, 0.0)::float AS minutos_total
    FROM v_pausas_operativas p
    INNER JOIN v_users u ON u.user_id = p.user_id
    WHERE madrid_local(p.started_at)::date = $1::date
      AND u.name != 'Preventa Team'
    GROUP BY u.name
    ORDER BY minutos_total DESC
    LIMIT 1;
  `;

  // 3. Desglose por motivo (para el gráfico de torta)
  const qMotivos = `
    SELECT
      substatus AS motivo,
      COUNT(*)::int AS num_pausas,
      COALESCE(SUM(duracion_recortada_s) / 60.0, 0.0)::float AS minutos_total
    FROM v_pausas_operativas
    WHERE madrid_local(started_at)::date = $1::date
    GROUP BY substatus
    ORDER BY minutos_total DESC;
  `;

  // 4. Pausas del día por agente (rango laboral de 09:00 a 18:00)
  const qAgentesPausas = `
    SELECT
      u.user_id::text,
      u.name,
      COUNT(p.id)::int AS total_pausas,
      COALESCE(SUM(p.duracion_recortada_s) / 60.0, 0.0)::float AS minutos_total,
      COALESCE(AVG(p.duracion_recortada_s) / 60.0, 0.0)::float AS minutos_media
    FROM v_pausas_operativas p
    INNER JOIN v_users u ON u.user_id = p.user_id
    WHERE madrid_local(p.started_at)::date = $1::date
      AND madrid_local(p.started_at)::time >= '09:00:00'
      AND madrid_local(p.started_at)::time <= '18:00:00'
      AND u.name != 'Preventa Team'
    GROUP BY u.user_id, u.name
    ORDER BY minutos_total DESC;
  `;

  // 5. Anomalías de pausas (Olvidos y Excesos)
  const qAnomalias = `
    SELECT
      p.id::text,
      u.name,
      p.substatus AS motivo,
      p.started_at,
      p.ended_at,
      p.duration_s,
      p.tipo_anomalia
    FROM v_pausas_anomalias p
    INNER JOIN v_users u ON u.user_id = p.user_id
    WHERE madrid_local(p.started_at)::date = $1::date
      AND p.tipo_anomalia IN ('pausa_larga_en_horario', 'pausa_se_extiende_fuera_horario')
      AND p.substatus NOT IN ('doing_back_office', 'out_for_lunch', 'Lunch', 'lunch')
      AND LOWER(p.substatus) NOT LIKE '%lunch%'
      AND LOWER(p.substatus) NOT LIKE '%back%office%'
    ORDER BY p.started_at DESC;
  `;

  try {
    const [resumenRaw, topAgenteRaw, motivosRaw, agentesPausasRaw, anomaliasRaw] = await Promise.all([
      query<ResumenPausasDb>(qResumen, [dateStr]),
      query<PausaTopAgenteDb>(qTopAgente, [dateStr]),
      query<PausaMotivoDb>(qMotivos, [dateStr]),
      query<PausaAgenteDb>(qAgentesPausas, [dateStr]),
      query<PausaAnomaliaDb>(qAnomalias, [dateStr])
    ]);

    const resumen = resumenRaw[0] || { total_pausas: 0, minutos_total: 0.0, minutos_media: 0.0 };
    const topAgente = topAgenteRaw[0] 
      ? { name: topAgenteRaw[0].name, minutos_total: Number(topAgenteRaw[0].minutos_total) || 0.0 }
      : null;

    return {
      resumen: {
        total_pausas: Number(resumen.total_pausas) || 0,
        minutos_total: Number(resumen.minutos_total) || 0.0,
        minutos_media: Number(resumen.minutos_media) || 0.0
      },
      topAgente,
      pausasMotivos: motivosRaw.map(m => ({
        motivo: m.motivo || 'other',
        num_pausas: Number(m.num_pausas) || 0,
        minutos_total: Number(m.minutos_total) || 0.0
      })),
      pausasAgentes: agentesPausasRaw.map(a => ({
        user_id: a.user_id,
        name: a.name || 'Agente Desconocido',
        total_pausas: Number(a.total_pausas) || 0,
        minutos_total: Number(a.minutos_total) || 0.0,
        minutos_media: Number(a.minutos_media) || 0.0
      })),
      pausasAnomalias: anomaliasRaw
        .filter(an => {
          const mot = (an.motivo || '').toLowerCase().trim();
          const allowedSubstatuses = ['on_a_break', 'do_not_disturb', 'other', 'break', 'descanso', 'otro', 'no molestar'];
          return allowedSubstatuses.includes(mot);
        })
        .map(an => ({
          id: an.id,
          name: an.name || 'Agente Desconocido',
          motivo: an.motivo || 'other',
          started_at: an.started_at ? new Date(an.started_at).toISOString() : '',
          ended_at: an.ended_at ? new Date(an.ended_at).toISOString() : null,
          duration_s: Number(an.duration_s) || 0,
          tipo_anomalia: an.tipo_anomalia
        }))
    };
  } catch (error) {
    console.error('Error fetching pausas data for date:', error);
    throw new Error('No se pudieron recuperar los datos de pausas para la fecha seleccionada.');
  }
}
