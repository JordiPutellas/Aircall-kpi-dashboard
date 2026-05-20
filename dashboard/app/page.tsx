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
  // Query lateral para traer todos los agentes (v_users) con su último estado abierto si existe
  const sqlQuery = `
    SELECT
      u.user_id::text,
      u.name,
      u.email,
      COALESCE(i.status, 'offline') AS status,
      i.substatus,
      i.started_at AS desde,
      CASE 
        WHEN i.started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - i.started_at))::int / 60 
        ELSE 0 
      END AS minutos_en_estado
    FROM v_users u
    LEFT JOIN LATERAL (
      SELECT * 
      FROM agent_status_intervals 
      WHERE user_id = u.user_id AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    ) i ON true
    ORDER BY 
      (CASE 
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
    status: agent.status as 'available' | 'unavailable' | 'after_call_work' | 'offline',
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
