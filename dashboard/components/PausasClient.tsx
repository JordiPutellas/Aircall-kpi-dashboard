'use client';

import { useEffect, useState } from 'react';
import { 
  Coffee, 
  Clock, 
  AlertOctagon, 
  Hourglass,
  TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { 
  ResumenPausas, 
  PausaTopAgente, 
  PausaMotivo, 
  PausaAgente, 
  PausaAnomalia,
  getPausasDataForDateAction
} from '../app/pausas/actions';

interface Props {
  initialDate: string;
  initialResumen: ResumenPausas;
  initialTopAgente: PausaTopAgente | null;
  initialPausasMotivos: PausaMotivo[];
  initialPausasAgentes: PausaAgente[];
  initialPausasAnomalias: PausaAnomalia[];
  lastUpdated: string;
}

export default function PausasClient({
  initialDate,
  initialResumen,
  initialTopAgente,
  initialPausasMotivos,
  initialPausasAgentes,
  initialPausasAnomalias,
  lastUpdated
}: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [resumen, setResumen] = useState(initialResumen);
  const [topAgente, setTopAgente] = useState(initialTopAgente);
  const [pausasMotivos, setPausasMotivos] = useState(initialPausasMotivos);
  const [pausasAgentes, setPausasAgentes] = useState(initialPausasAgentes);
  const [pausasAnomalias, setPausasAnomalias] = useState(initialPausasAnomalias);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(lastUpdated);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Helper to format date in Madrid timezone YYYY-MM-DD
  const getMadridTodayString = (): string => {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  };

  // Poll for data updates when selectedDate is today
  useEffect(() => {
    const todayStr = getMadridTodayString();
    if (selectedDate !== todayStr) return;

    const interval = setInterval(async () => {
      try {
        const data = await getPausasDataForDateAction(todayStr);
        setResumen(data.resumen);
        setTopAgente(data.topAgente);
        setPausasMotivos(data.pausasMotivos);
        setPausasAgentes(data.pausasAgentes);
        setPausasAnomalias(data.pausasAnomalias);
        setLastUpdatedTime(new Date().toLocaleTimeString('es-ES', { 
          timeZone: 'Europe/Madrid',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }));
      } catch (error) {
        console.error('Error refreshing real-time pauses data:', error);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedDate]);

  // Handle date selector changes
  const handleDateChange = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsLoading(true);
    try {
      const data = await getPausasDataForDateAction(dateStr);
      setResumen(data.resumen);
      setTopAgente(data.topAgente);
      setPausasMotivos(data.pausasMotivos);
      setPausasAgentes(data.pausasAgentes);
      setPausasAnomalias(data.pausasAnomalias);
      setLastUpdatedTime(new Date().toLocaleTimeString('es-ES', { 
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    } catch (error) {
      console.error('Error changing date:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const translateReason = (reason: string | null) => {
    if (!reason) return '—';
    const lower = reason.toLowerCase();
    if (lower === 'out_for_lunch' || lower === 'lunch') return 'Pausa para comer 🍔';
    switch (reason) {
      case 'on_a_break': return 'Descanso ☕';
      case 'doing_back_office': return 'Back Office 📝';
      case 'in_training': return 'Formación 🎓';
      case 'other': return 'Otro ⚙️';
      default: return reason;
    }
  };

  const formatTiempoPausa = (minutos: number) => {
    const mins = Math.round(minutos);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
    return `${mins} min`;
  };

  const formatDurationHumana = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
    return `${mins} min`;
  };

  const formatTimeMadrid = (isoStr: string | null) => {
    if (!isoStr) return '—';
    try {
      return new Date(isoStr).toLocaleTimeString('es-ES', { 
        timeZone: 'Europe/Madrid', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return '—';
    }
  };

  const getAnomalyBadge = (tipo: string) => {
    switch (tipo) {
      case 'pausa_larga_en_horario':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            Pausa Larga (Horario Laboral) ⚠️
          </span>
        );
      case 'pausa_se_extiende_fuera_horario':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Exceso Fuera de Horario ⏳
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-650 dark:text-slate-405 border border-slate-500/20">
            {tipo}
          </span>
        );
    }
  };

  // Map reasons data for the pie chart
  const datosMotivos = pausasMotivos.map(m => ({
    name: translateReason(m.motivo),
    value: Math.round(m.minutos_total)
  }));

  const COLORS = ['#6366f1', '#f59e0b', '#06b6d4', '#ef4444', '#10b981'];

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-outfit font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white tracking-tight">
            Detalle de Pausas
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Análisis de pausas operativas, exclusión de almuerzos e identificación automatizada de desvíos.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right sm:block hidden">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Última actualización</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold">{lastUpdatedTime}</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedDate === getMadridTodayString() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                En tiempo real (60s)
              </span>
            )}
            {isLoading && (
              <span className="text-xs text-slate-400 dark:text-slate-500 animate-pulse">
                Cargando...
              </span>
            )}
            <div className="relative">
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm dark:shadow-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Total Pausas */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.01] transition-all shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-slate-450 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Pausas</span>
            <Coffee size={18} className="text-indigo-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">{resumen.total_pausas}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Intervalos Operativos</span>
          </div>
        </div>

        {/* Tiempo Total Pausa */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between text-amber-650 dark:text-amber-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tiempo en Pausa</span>
            <Clock size={18} className="text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-outfit">
              {formatTiempoPausa(resumen.minutos_total)}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Horas Acumuladas</span>
          </div>
        </div>

        {/* Pausa Media */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Duración Media</span>
            <Hourglass size={18} className="text-cyan-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 font-outfit">
              {resumen.minutos_media.toFixed(1)} min
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Por Intervalo Válido</span>
          </div>
        </div>

        {/* Agente Top Pausas */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none hover:scale-[1.01] transition-all">
          <div className="flex items-center justify-between text-rose-550 dark:text-rose-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Top Pausas Hoy</span>
            <TrendingUp size={18} className="text-rose-500" />
          </div>
          <div className="mt-4">
            <span className="text-lg font-bold text-slate-800 dark:text-white block truncate tracking-tight" title={topAgente?.name || '—'}>
              {topAgente?.name || '—'}
            </span>
            <span className="text-xs text-rose-650 dark:text-rose-400 block mt-1 font-mono font-bold">
              {topAgente ? `${Math.round(topAgente.minutos_total)} min acumulados` : '0 min'}
            </span>
          </div>
        </div>
      </div>

      {/* Gráficos de Pausas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pausas por Agente (Gráfico de Barras) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">
            Minutos en Pausa por Agente (Hoy)
          </h3>
          <div className="h-72 w-full flex-1 flex items-center justify-center">
            {isMounted ? (
              pausasAgentes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pausasAgentes.slice(0, 10)} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#475569" 
                      fontSize={9} 
                      tickLine={false}
                      angle={-25}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                      itemStyle={{ color: '#6366f1' }}
                      formatter={(value) => [`${Math.round(Number(value))} min`, 'Tiempo total']}
                    />
                    <Bar dataKey="minutos_total" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {pausasAgentes.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm">Sin pausas registradas en el día seleccionado</p>
              )
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm">Cargando gráfico...</p>
            )}
          </div>
        </div>

        {/* Desglose por Motivo (Torta) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">
            Distribución por Motivo de Pausa (Minutos)
          </h3>
          <div className="h-72 w-full flex-1 flex items-center justify-center">
            {isMounted ? (
              datosMotivos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosMotivos}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {datosMotivos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => [`${Math.round(Number(value))} min`, 'Minutos']}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm">Sin datos de motivos de pausa hoy</p>
              )
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm">Cargando gráfico...</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabla Central: Pausas del Día por Agente (09:00 - 18:00) */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white">
              Pausas del Día por Agente
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rendimiento operativo agrupado por trabajador durante el horario laboral (09:00 a 18:00).
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          {pausasAgentes.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold">
                  <th className="pb-3">Agente</th>
                  <th className="pb-3 text-center">Cantidad de Pausas</th>
                  <th className="pb-3 text-center">Duración Promedio</th>
                  <th className="pb-3 text-right">Duración Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                {pausasAgentes.map((p) => (
                  <tr key={p.user_id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {p.name}
                    </td>
                    <td className="py-3 text-center text-slate-550 dark:text-slate-400 font-mono text-xs">
                      {p.total_pausas}
                    </td>
                    <td className="py-3 text-center text-slate-550 dark:text-slate-400 font-mono text-xs">
                      {p.minutos_media.toFixed(1)} min
                    </td>
                    <td className="py-3 text-right text-slate-800 dark:text-slate-200 font-mono font-bold">
                      {formatTiempoPausa(p.minutos_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">Sin pausas operativas en el rango laboral hoy</p>
            </div>
          )}
        </div>
      </div>

      {/* Anomalías Detectadas (Olvidos y Excesos) */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2 mb-2">
          <AlertOctagon size={18} className="text-red-500 animate-pulse" />
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white">
            Anomalías Detectadas (Olvidos y Excesos)
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Auditoría de desvíos operativos: pausas excesivamente largas y pausas extendidas fuera del horario establecido.
        </p>
        
        <div className="overflow-x-auto">
          {pausasAnomalias.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold">
                  <th className="pb-3">Agente</th>
                  <th className="pb-3 text-center">Tipo de Anomalía</th>
                  <th className="pb-3 text-center">Motivo de Pausa</th>
                  <th className="pb-3 text-center">Inicio</th>
                  <th className="pb-3 text-center">Fin</th>
                  <th className="pb-3 text-right">Duración Real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                {pausasAnomalias.map((an) => (
                  <tr key={an.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-all border-l-2 border-l-red-500/35">
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200 pl-3">
                      {an.name}
                    </td>
                    <td className="py-3 text-center">
                      {getAnomalyBadge(an.tipo_anomalia)}
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {translateReason(an.motivo)}
                      </span>
                    </td>
                    <td className="py-3 text-center text-slate-550 dark:text-slate-400 font-mono text-xs">
                      {formatTimeMadrid(an.started_at)}
                    </td>
                    <td className="py-3 text-center text-slate-550 dark:text-slate-400 font-mono text-xs">
                      {an.ended_at ? (
                        formatTimeMadrid(an.ended_at)
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-450 font-bold animate-pulse">
                          Activa
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono font-extrabold text-red-600 dark:text-red-400">
                      {formatDurationHumana(an.duration_s)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center flex flex-col items-center justify-center gap-2">
              <span className="text-2xl">🎉</span>
              <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">
                No se han detectado anomalías de pausas para el día consultado. ¡Rendimiento óptimo!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
