import PausasClient from '@/components/PausasClient';
import { getPausasDataForDateAction } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  
  // Default to today's date in Europe/Madrid timezone (formatted as YYYY-MM-DD)
  const defaultDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const selectedDate = resolvedSearchParams.date || defaultDateStr;

  // Retrieve all data for the selected date using the server action
  const data = await getPausasDataForDateAction(selectedDate);

  const lastUpdated = new Date().toLocaleTimeString('es-ES', { 
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <PausasClient
      initialDate={selectedDate}
      initialResumen={data.resumen}
      initialTopAgente={data.topAgente}
      initialPausasMotivos={data.pausasMotivos}
      initialPausasAgentes={data.pausasAgentes}
      initialPausasAnomalias={data.pausasAnomalias}
      lastUpdated={lastUpdated}
    />
  );
}
