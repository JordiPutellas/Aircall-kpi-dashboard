'use client';

import { useEffect, useState } from 'react';
import { 
  PhoneCall, 
  PhoneCall as PhoneIcon, 
  PhoneOff, 
  Percent, 
  Clock, 
  TrendingUp, 
  Award,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';

interface Resumen {
  total: number;
  atendidas: number;
  perdidas: number;
  tasa_atencion: number;
}

interface LlamadaHora {
  hora: number;
  perdidas: number;
}

interface LlamadaMotivo {
  missed_reason: string;
  num_llamadas: number;
  pct: number;
}

interface OcupacionAgente {
  name: string;
  talk_s: number;
  acw_s: number;
  conectado_s: number;
  ocupacion_pct: number;
}

interface AhtAgente {
  name: string;
  llamadas_atendidas: number;
  aht_minutos: number;
}

interface Props {
  resumen: Resumen;
  llamadasHora: LlamadaHora[];
  llamadasMotivos: LlamadaMotivo[];
  ocupacionAgentes: OcupacionAgente[];
  ahtAgentes: AhtAgente[];
  lastUpdated: string;
}

export default function OverviewClient({
  resumen,
  llamadasHora,
  llamadasMotivos,
  ocupacionAgentes,
  ahtAgentes,
  lastUpdated
}: Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formatSeconds = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`;
  };

  const translateReason = (reason: string) => {
    switch (reason) {
      case 'no_agent_available': return 'Sin agentes disponibles';
      case 'out_of_opening_hours': return 'Fuera de horario';
      case 'short_abandoned': return 'Abandono rápido';
      case 'abandoned_in_classic_ring': return 'Abandono en cola';
      case 'abandoned_in_ivr': return 'Abandono en IVR';
      default: return reason;
    }
  };

  const COLORS = ['#ef4444', '#f59e0b', '#06b6d4', '#6366f1', '#10b981'];

  // Agente estrella (mejor AHT y atención)
  const mejorAht = [...ahtAgentes]
    .filter(a => a.llamadas_atendidas > 0)
    .sort((a, b) => a.aht_minutos - b.aht_minutos)[0];

  const datosTortaMotivos = llamadasMotivos.map((m) => ({
    name: translateReason(m.missed_reason),
    value: Number(m.num_llamadas)
  }));

  const datosHoras = llamadasHora.map(h => ({
    hora: `${String(h.hora).padStart(2, '0')}:00`,
    perdidas: h.perdidas
  }));

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-outfit font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white tracking-tight">
            Overview Diario y KPIs
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Métricas de atención al cliente acumuladas hoy y analíticas históricas de rendimiento de agentes.
          </p>
        </div>
        <div className="text-right sm:block hidden">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Última actualización</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold">{lastUpdated}</p>
        </div>
      </div>

      {/* KPI Cards Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Total Llamadas */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Llamadas Totales</span>
            <PhoneCall size={18} className="text-indigo-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">{resumen.total}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Recibidas Hoy</span>
          </div>
        </div>

        {/* Atendidas */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-emerald-500 dark:text-emerald-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Atendidas</span>
            <PhoneCall size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-outfit">{resumen.atendidas}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Conversaciones completadas</span>
          </div>
        </div>

        {/* Perdidas */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-rose-500 dark:text-rose-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Perdidas</span>
            <PhoneOff size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-450 font-outfit">{resumen.perdidas}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Llamadas no contestadas</span>
          </div>
        </div>

        {/* Tasa Atencion */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-indigo-500 dark:text-indigo-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tasa de Atención</span>
            <Percent size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-outfit">{resumen.tasa_atencion}%</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Objetivo: &gt;90%</span>
          </div>
        </div>
      </div>

      {/* Gráficos de Llamadas Perdidas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Curva de Perdidas por hora (Hoy) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">Llamadas Perdidas por Hora (Hoy)</h3>
          <div className="h-72 w-full flex-1 flex items-center justify-center">
            {isMounted ? (
              datosHoras.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={datosHoras} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="hora" stroke="#475569" fontSize={11} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                      itemStyle={{ color: '#ef4444' }}
                      formatter={(value) => [`${value} llamadas`, 'Perdidas']}
                    />
                    <Area type="monotone" dataKey="perdidas" stroke="#ef4444" fill="rgba(239, 68, 68, 0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm">Sin llamadas perdidas hoy</p>
              )
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm">Cargando gráfico...</p>
            )}
          </div>
        </div>

        {/* Distribución por Motivos de Perdidas (Torta) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">Motivos de Llamadas Perdidas (Últimos 7 Días)</h3>
          <div className="h-72 w-full flex-1 flex items-center justify-center">
            {isMounted ? (
              datosTortaMotivos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosTortaMotivos}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {datosTortaMotivos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => [`${value} llamadas`, 'Total']}
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
                <p className="text-slate-400 dark:text-slate-500 text-sm">Sin datos de llamadas perdidas</p>
              )
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm">Cargando gráfico...</p>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Rendimiento de Agentes */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Tabla Ocupación */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">Tasa de Ocupación Hoy (Talk time + ACW)</h3>
          
          <div className="overflow-x-auto">
            {ocupacionAgentes.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold">
                    <th className="pb-3">Agente</th>
                    <th className="pb-3 text-center">Conectado</th>
                    <th className="pb-3 text-center">Conversando / ACW</th>
                    <th className="pb-3 text-right">Ocupación %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                  {ocupacionAgentes.map((ag, idx) => (
                    <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">{ag.name}</td>
                      <td className="py-3 text-center text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {formatSeconds(ag.conectado_s)}
                      </td>
                      <td className="py-3 text-center text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {formatSeconds(ag.talk_s)} / {formatSeconds(ag.acw_s)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{ag.ocupacion_pct}%</span>
                          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className={`h-full rounded-full ${
                                ag.ocupacion_pct > 80 ? 'bg-emerald-500' :
                                ag.ocupacion_pct > 50 ? 'bg-indigo-500' : 'bg-slate-400'
                              }`} 
                              style={{ width: `${Math.min(100, ag.ocupacion_pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-10 text-center">
                <p className="text-slate-400 dark:text-slate-500 text-sm">Sin datos de conexión hoy</p>
              </div>
            )}
          </div>
        </div>

        {/* AHT (Media de minutos por llamada - Últimos 7 días) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">AHT por Agente (Últimos 7 Días)</h3>
          
          <div className="h-72 w-full flex-1 flex items-center justify-center mb-4">
            {isMounted ? (
              ahtAgentes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ahtAgentes.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} tickLine={false} width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#38bdf8' }}
                      formatter={(value) => [`${value} minutos`, 'Duración Media']}
                    />
                    <Bar dataKey="aht_minutos" fill="#06b6d4" radius={[0, 4, 4, 0]}>
                      {ahtAgentes.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm">Sin llamadas atendidas en los últimos 7 días</p>
              )
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm">Cargando gráfico...</p>
            )}
          </div>

          {/* Destacado Mejor AHT */}
          {mejorAht && (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                <Award size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">AHT más eficiente</p>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{mejorAht.name}</h4>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">
                  {mejorAht.aht_minutos} min / llamada ({mejorAht.llamadas_atendidas} atendidas)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
