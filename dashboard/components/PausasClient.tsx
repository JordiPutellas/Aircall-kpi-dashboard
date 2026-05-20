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

interface ResumenPausas {
  total_pausas: number;
  minutos_total: number;
  minutos_media: number;
}

interface PausaMotivo {
  name: string;
  motivo: string;
  num_pausas: number;
  minutos_total: number;
  minutos_media: number;
}

interface PausaLarga {
  name: string;
  motivo: string;
  started_at: string;
  ended_at: string | null;
  minutos: number;
}

interface Props {
  resumen: ResumenPausas;
  pausasHoy: PausaMotivo[];
  pausasLargas: PausaLarga[];
  lastUpdated: string;
}

export default function PausasClient({
  resumen,
  pausasHoy,
  pausasLargas,
  lastUpdated
}: Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const translateReason = (reason: string | null) => {
    if (!reason) return '—';
    switch (reason) {
      case 'on_a_break': return 'Descanso ☕';
      case 'out_for_lunch': return 'Almuerzo 🍔';
      case 'doing_back_office': return 'Back Office 📝';
      case 'in_training': return 'Formación 🎓';
      case 'other': return 'Otro ⚙️';
      default: return reason;
    }
  };

  const getCleanReason = (reason: string | null) => {
    if (!reason) return '—';
    switch (reason) {
      case 'on_a_break': return 'Descanso';
      case 'out_for_lunch': return 'Almuerzo';
      case 'doing_back_office': return 'Back Office';
      case 'in_training': return 'Formación';
      case 'other': return 'Otro';
      default: return reason;
    }
  };

  // Agrupar datos por motivo para el gráfico de torta
  const rawMotivos = pausasHoy.reduce((acc, curr) => {
    const key = curr.motivo;
    if (!acc[key]) {
      acc[key] = { name: translateReason(key), value: 0 };
    }
    acc[key].value += Number(curr.minutos_total);
    return acc;
  }, {} as Record<string, { name: string; value: number }>);
  
  const datosMotivos = Object.values(rawMotivos);

  // Agrupar datos por agente para el gráfico de barras
  const rawAgentes = pausasHoy.reduce((acc, curr) => {
    const key = curr.name;
    if (!acc[key]) {
      acc[key] = { name: key, minutos: 0 };
    }
    acc[key].minutos += Number(curr.minutos_total);
    return acc;
  }, {} as Record<string, { name: string; minutos: number }>);

  const datosAgentes = Object.values(rawAgentes).sort((a, b) => b.minutos - a.minutos);

  // Agente con más tiempo en pausa hoy
  const agenteMasPausas = datosAgentes[0] || { name: '—', minutos: 0 };

  const COLORS = ['#f59e0b', '#ef4444', '#06b6d4', '#6366f1', '#10b981'];

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-outfit font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white tracking-tight">
            Detalle de Pausas
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Análisis de pausas activas, motivos específicos e identificación de pausas críticas.
          </p>
        </div>
        <div className="text-right sm:block hidden">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Última actualización</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold">{lastUpdated}</p>
        </div>
      </div>

      {/* KPI Cards Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Total Pausas */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-slate-450 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Pausas</span>
            <Coffee size={18} className="text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">{resumen.total_pausas}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Hoy (excl. autologin)</span>
          </div>
        </div>

        {/* Tiempo Total Pausa */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-amber-650 dark:text-amber-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tiempo en Pausa</span>
            <Clock size={18} className="text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-outfit">
              {resumen.minutos_total > 60 
                ? `${Math.floor(resumen.minutos_total / 60)}h ${Math.round(resumen.minutos_total % 60)}m`
                : `${Math.round(resumen.minutos_total)} min`
              }
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Acumulado Hoy</span>
          </div>
        </div>

        {/* Pausa Media */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Duración Media</span>
            <Hourglass size={18} className="text-cyan-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 font-outfit">{resumen.minutos_media || '0.0'} min</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Por intervalo de pausa</span>
          </div>
        </div>

        {/* Agente Top Pausas */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-rose-550 dark:text-rose-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Top Pausas Hoy</span>
            <TrendingUp size={18} className="text-rose-500" />
          </div>
          <div className="mt-4">
            <span className="text-lg font-bold text-slate-800 dark:text-white block truncate tracking-tight" title={agenteMasPausas.name}>
              {agenteMasPausas.name}
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-455 block mt-1 font-mono font-bold">
              {Math.round(agenteMasPausas.minutos)} minutos totales
            </span>
          </div>
        </div>
      </div>

      {/* Gráficos de Pausas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pausas por Agente (Gráfico de Barras) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">Minutos en Pausa por Agente (Hoy)</h3>
          <div className="h-72 w-full flex-1 flex items-center justify-center">
            {isMounted ? (
              datosAgentes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosAgentes.slice(0, 10)} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
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
                      itemStyle={{ color: '#f59e0b' }}
                      formatter={(value) => [`${Math.round(Number(value))} min`, 'Tiempo total']}
                    />
                    <Bar dataKey="minutos" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                      {datosAgentes.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm">Sin pausas registradas hoy</p>
              )
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm">Cargando gráfico...</p>
            )}
          </div>
        </div>

        {/* Desglose por Motivo (Torta) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">Desglose de Minutos por Motivo de Pausa (Hoy)</h3>
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

      {/* Tabla de Detalle de Pausas por Agente */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-none">
        <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">Pausas del Día por Agente</h3>
        <div className="overflow-x-auto">
          {pausasHoy.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold">
                  <th className="pb-3">Agente</th>
                  <th className="pb-3 text-center">Motivo de Pausa</th>
                  <th className="pb-3 text-center">Cantidad de Pausas</th>
                  <th className="pb-3 text-center">Duración Promedio</th>
                  <th className="pb-3 text-right">Duración Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                {pausasHoy.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">{p.name}</td>
                    <td className="py-3 text-center">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-full">
                        {translateReason(p.motivo)}
                      </span>
                    </td>
                    <td className="py-3 text-center text-slate-550 dark:text-slate-400 font-mono text-xs">{p.num_pausas}</td>
                    <td className="py-3 text-center text-slate-550 dark:text-slate-400 font-mono text-xs">{p.minutos_media} min</td>
                    <td className="py-3 text-right text-slate-800 dark:text-slate-200 font-mono font-bold">{p.minutos_total} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">Sin pausas registradas hoy</p>
            </div>
          )}
        </div>
      </div>

      {/* Anomalías: Pausas más largas últimos 7 días */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2 mb-4">
          <AlertOctagon size={18} className="text-rose-500 animate-pulse animate-pulse-slow" />
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white">Anomalías Detectadas: Pausas &gt; 30 min (Últimos 7 Días)</h3>
        </div>
        
        <div className="overflow-x-auto">
          {pausasLargas.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold">
                  <th className="pb-3">Agente</th>
                  <th className="pb-3 text-center">Motivo de Pausa</th>
                  <th className="pb-3 text-center">Inicio</th>
                  <th className="pb-3 text-center">Fin</th>
                  <th className="pb-3 text-right">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                {pausasLargas.map((p, idx) => {
                  const inicio = new Date(p.started_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const fin = p.ended_at 
                    ? new Date(p.ended_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : 'Activa';
                    
                  return (
                    <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-all border-l-2 border-l-rose-500/35">
                      <td className="py-3 font-bold text-slate-800 dark:text-slate-200 pl-3">{p.name}</td>
                      <td className="py-3 text-center">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-500">
                          {getCleanReason(p.motivo)}
                        </span>
                      </td>
                      <td className="py-3 text-center text-slate-550 dark:text-slate-400 font-mono text-xs">{inicio}</td>
                      <td className="py-3 text-center text-slate-550 dark:text-slate-400 font-mono text-xs">
                        <span className={p.ended_at ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-600 dark:text-emerald-450 font-bold animate-pulse'}>
                          {fin}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-extrabold text-rose-600 dark:text-rose-400">
                        {p.minutos} min
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">No se han detectado pausas superiores a 30 minutos en los últimos 7 días. ¡Excelente!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
