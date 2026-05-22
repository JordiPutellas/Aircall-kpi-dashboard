// Desactivar validación estricta de SSL para saltar el proxy corporativo en desarrollo local
/* eslint-disable @typescript-eslint/no-explicit-any */
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not defined');
}

// Inicializar el cliente HTTP de Neon (ideal para Serverless)
const sql = neon(process.env.DATABASE_URL);

/**
 * Helper para ejecutar consultas seguras en Neon Postgres.
 * @param queryText Consulta SQL
 * @param params Parámetros opcionales para la consulta
 */
export async function query<T = any>(
  queryText: string,
  params?: any[]
): Promise<T[]> {
  try {
    const start = Date.now();
    const result = params 
      ? await sql.query(queryText, params) 
      : await sql.query(queryText);
    
    // Loguear duración de consulta en desarrollo
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - start;
      console.log(`[DB Query] Executed query in ${duration}ms. Rows returned: ${result.length}`);
    }
    
    return result as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}
