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

interface PageProps {
  searchParams: Promise<{
    user_id?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  // En Next.js 15+ searchParams es una Promise y debe ser esperada
  const resolvedSearchParams = await searchParams;
  const selectedUserId = resolvedSearchParams.user_id || null;

  // 1. Obtener la lista de usuarios para el selector
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

  let timeline: any[] = [];

  // 2. Si hay un usuario seleccionado, traer sus últimos 50 intervalos
  if (selectedUserId) {
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
      lastUpdated={lastUpdated}
    />
  );
}
