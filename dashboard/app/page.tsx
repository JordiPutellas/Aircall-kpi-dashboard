import { query } from '@/lib/db';
import WallboardClient from '@/components/WallboardClient';

// Forzar renderizado dinámico en cada petición para reflejar el tiempo real
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DbAgent {
  user_id: string;
  name: string;
  email: string;
  status: string;
  substatus: string | null;
  desde: Date | string | null;
  minutos_en_estado: number;
}

export default async function Page() {
  // Query lateral para traer todos los agentes (v_users) con su último estado abierto si existe,
  // evaluando si el último evento de llamada de cada agente fue un descuelgue activo sin cierre
  const sqlQuery = `
    SELECT 
      u.user_id::text, 
      u.name, 
      u.email,
      CASE 
        WHEN ac.occurred_at IS NOT NULL THEN 'in_call'
        ELSE COALESCE(i.status, 'offline')
      END AS status,
      i.substatus,
      CASE 
        WHEN ac.occurred_at IS NOT NULL THEN ac.occurred_at
        ELSE i.started_at
      END AS desde,
      CASE
        WHEN ac.occurred_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (now() - ac.occurred_at))::int / 60
        WHEN i.started_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (now() - i.started_at))::int / 60
        ELSE 0
      END AS minutos_en_estado
    FROM v_users u
    LEFT JOIN LATERAL (
      SELECT status, substatus, started_at 
      FROM agent_status_intervals 
      WHERE user_id = u.user_id AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    ) i ON true
    LEFT JOIN LATERAL (
      SELECT a.occurred_at 
      FROM events_raw a
      WHERE a.user_id = u.user_id
        AND a.event_type = 'call.answered'
        AND a.occurred_at > now() - interval '4 hours'
        AND NOT EXISTS (
          SELECT 1 
          FROM events_raw e
          WHERE e.user_id = u.user_id
            AND e.event_type IN ('call.ended', 'call.hungup')
            AND e.occurred_at > a.occurred_at
            AND e.occurred_at > now() - interval '4 hours'
        )
      ORDER BY a.occurred_at DESC
      LIMIT 1
    ) ac ON true
    ORDER BY 
      (CASE 
        WHEN ac.occurred_at IS NOT NULL THEN 0
        WHEN COALESCE(i.status, 'offline') = 'available' THEN 1
        WHEN COALESCE(i.status, 'offline') = 'after_call_work' THEN 2
        WHEN COALESCE(i.status, 'offline') = 'unavailable' THEN 3
        ELSE 4
      END) ASC, 
      minutos_en_estado DESC;
  `;

  const rawAgents = await query<DbAgent>(sqlQuery);

  // Serializar fechas para pasar de Server Component a Client Component de forma segura
  const agents = rawAgents.map(agent => ({
    user_id: agent.user_id,
    name: agent.name || 'Agente Desconocido',
    email: agent.email || '',
    status: agent.status as 'available' | 'unavailable' | 'after_call_work' | 'offline' | 'in_call',
    substatus: agent.substatus,
    desde: agent.desde 
      ? (agent.desde instanceof Date ? agent.desde.toISOString() : new Date(agent.desde).toISOString()) 
      : null,
    minutos_en_estado: Number(agent.minutos_en_estado) || 0
  }));

  const lastUpdated = new Date().toLocaleTimeString('es-ES', { 
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <WallboardClient initialAgents={agents} lastUpdated={lastUpdated} />
  );
}
