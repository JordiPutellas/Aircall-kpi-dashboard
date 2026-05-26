import { query } from '@/lib/db';
import TimelineClient from '@/components/TimelineClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface UserDb {
  user_id: string;
  name: string;
  email: string;
}

interface IntervaloDb {
  started_at: Date | string;
  ended_at: Date | string | null;
  status: string;
  substatus: string | null;
  minutos: number;
}

interface Intervalo {
  started_at: string;
  ended_at: string | null;
  status: string;
  substatus: string | null;
  minutos: number;
}

interface IntervaloColectivo {
  user_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  substatus: string | null;
}

interface CollectiveDb {
  user_id: string;
  started_at: Date | string;
  ended_at: Date | string | null;
  status: string;
  substatus: string | null;
}

interface PageProps {
  searchParams: Promise<{
    user_id?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedUserId = resolvedSearchParams.user_id || null;

  // 1. Obtener la lista de usuarios para el selector y la visualización colectiva
  const qUsers = `
    SELECT 
      user_id::text, 
      name, 
      email 
    FROM v_users 
    WHERE name IS NOT NULL
    ORDER BY name ASC;
  `;
  const users = await query<UserDb>(qUsers);

  // 2. Obtener límites de tiempo de hoy (09:00 a 18:00 Madrid) desde la base de datos
  const qLimits = `
    SELECT 
      madrid_work_start(now()) AS start_time,
      madrid_work_end(now()) AS end_time
  `;
  const limitsRes = await query<{ start_time: Date; end_time: Date }>(qLimits);
  const startLimit = limitsRes[0].start_time.toISOString();
  const endLimit = limitsRes[0].end_time.toISOString();

  let timeline: Intervalo[] = [];
  let collectiveTimeline: IntervaloColectivo[] = [];

  if (selectedUserId) {
    // Caso 1: Usuario seleccionado -> Traer sus últimos 50 intervalos
    const qTimeline = `
      SELECT
        started_at,
        ended_at,
        status,
        substatus,
        ROUND(duration_s / 60.0, 1)::float AS minutos
      FROM agent_status_intervals
      WHERE user_id = $1::bigint
      ORDER BY started_at DESC
      LIMIT 50;
    `;
    const rawTimeline = await query<IntervaloDb>(qTimeline, [selectedUserId]);

    timeline = rawTimeline.map(interval => ({
      started_at: interval.started_at instanceof Date 
        ? interval.started_at.toISOString() 
        : new Date(interval.started_at).toISOString(),
      ended_at: interval.ended_at 
        ? (interval.ended_at instanceof Date ? interval.ended_at.toISOString() : new Date(interval.ended_at).toISOString())
        : null,
      status: interval.status,
      substatus: interval.substatus,
      minutos: Number(interval.minutos) || 0
    }));
  } else {
    // Caso 2: Vista colectiva -> Traer todos los intervalos de hoy entre 09:00 y 18:00
    const qCollective = `
      WITH range_today AS (
        SELECT 
          madrid_work_start(now()) AS start_time,
          madrid_work_end(now()) AS end_time
      )
      SELECT 
        i.user_id::text,
        i.started_at,
        i.ended_at,
        i.status,
        i.substatus
      FROM agent_status_intervals i
      CROSS JOIN range_today r
      WHERE i.started_at < r.end_time 
        AND (i.ended_at IS NULL OR i.ended_at > r.start_time)
      ORDER BY i.started_at ASC;
    `;
    const rawCollective = await query<CollectiveDb>(qCollective);
    collectiveTimeline = rawCollective.map(interval => ({
      user_id: interval.user_id,
      started_at: interval.started_at instanceof Date 
        ? interval.started_at.toISOString() 
        : new Date(interval.started_at).toISOString(),
      ended_at: interval.ended_at 
        ? (interval.ended_at instanceof Date ? interval.ended_at.toISOString() : new Date(interval.ended_at).toISOString())
        : null,
      status: interval.status,
      substatus: interval.substatus
    }));
  }

  const lastUpdated = new Date().toLocaleTimeString('es-ES', { 
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <TimelineClient
      users={users}
      selectedUserId={selectedUserId}
      timeline={timeline}
      collectiveTimeline={collectiveTimeline}
      startLimit={startLimit}
      endLimit={endLimit}
      lastUpdated={lastUpdated}
      // eslint-disable-next-line react-hooks/purity
      nowMs={Date.now()}
    />
  );
}
