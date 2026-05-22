'use client';

import { useEffect, useState } from 'react';
import { 
  PhoneCall, 
  PhoneOff, 
  Percent, 
  Award,
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
import { getLossesForDateAction, getTodayKpiSummaryAction, LossRecord, AgentLossSummary } from '@/app/overview/actions';

interface Resumen {
  total: number;
  atendidas: number;
  perdidas_brutas: number;
  perdidas: number; // pérdidas reales
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
  categoria: 'ACCIONABLE' | 'CONTEXTUAL';
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
  ahtAgentes: AhtAgente[];
  agentesPerdidas: AgentLossSummary[];
  detalleLlamadas: LossRecord[];
  lastUpdated: string;
}

// Obtener fecha de hoy en formato YYYY-MM-DD en la zona horaria de Europa/Madrid
const getMadridTodayString = () => {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
};

export default function OverviewClient({
  resumen,
  llamadasHora,
  llamadasMotivos,
  ahtAgentes,
  agentesPerdidas: initialAgentesPerdidas,
  detalleLlamadas: initialDetalleLlamadas,
  lastUpdated
}: Props) {
  const [isMounted, setIsMounted] = useState(false);

  // Estados interactivos para el selector de fecha, registro y auditoría
  const [selectedDate, setSelectedDate] = useState(getMadridTodayString());
  const [agentesPerdidas, setAgentesPerdidas] = useState<AgentLossSummary[]>(initialAgentesPerdidas);
  const [detalleLlamadas, setDetalleLlamadas] = useState<LossRecord[]>(initialDetalleLlamadas);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Estados de métricas principales
  const [currentResumen, setCurrentResumen] = useState<Resumen>(resumen);
  const [currentLlamadasHora, setCurrentLlamadasHora] = useState<LlamadaHora[]>(llamadasHora);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(lastUpdated);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Intervalo de auto-refresco de 60 segundos si la fecha seleccionada es el día de hoy
  useEffect(() => {
    if (selectedDate !== getMadridTodayString()) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const todayStr = new Date().toISOString();
        const [lossesData, todayKpis] = await Promise.all([
          getLossesForDateAction(todayStr),
          getTodayKpiSummaryAction()
        ]);
        setAgentesPerdidas(lossesData.agentesPerdidas);
        setDetalleLlamadas(lossesData.detalleLlamadas);
        setCurrentResumen(todayKpis.resumen);
        setCurrentLlamadasHora(todayKpis.llamadasHora);
        setLastUpdatedTime(new Date().toLocaleTimeString('es-ES', { 
          timeZone: 'Europe/Madrid',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }));
      } catch (error) {
        console.error('Error al actualizar datos en tiempo real:', error);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedDate]);

  // Manejador del cambio de fecha
  const handleDateChange = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedAgentId(null); // Reiniciar selección para evitar estados inconsistentes
    try {
      const data = await getLossesForDateAction(dateStr);
      setAgentesPerdidas(data.agentesPerdidas);
      setDetalleLlamadas(data.detalleLlamadas);

      // Si volvemos al día de hoy, refrescamos también los KPIs principales y gráfico de horas para hoy
      if (dateStr === getMadridTodayString()) {
        const todayKpis = await getTodayKpiSummaryAction();
        setCurrentResumen(todayKpis.resumen);
        setCurrentLlamadasHora(todayKpis.llamadasHora);
        setLastUpdatedTime(new Date().toLocaleTimeString('es-ES', { 
          timeZone: 'Europe/Madrid',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }));
      }
    } catch (error) {
      console.error('Error al cambiar de fecha:', error);
    }
  };

  const formatDurationHumana = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs}s`;
  };

  const getReasonCategory = (reason: string): 'ACCIONABLE' | 'CONTEXTUAL' => {
    if (reason === 'agents_did_not_answer' || reason === 'no_available_agent') {
      return 'ACCIONABLE';
    }
    return 'CONTEXTUAL';
  };

  const translateReason = (reason: string) => {
    const isAccionable = getReasonCategory(reason) === 'ACCIONABLE';
    const prefix = isAccionable ? '🔴 [ACCIONABLE] ' : '⚪ [CONTEXTUAL] ';
    let name = reason;
    switch (reason) {
      case 'no_available_agent':
      case 'no_agent_available':
        name = 'Sin agentes disponibles';
        break;
      case 'agents_did_not_answer':
        name = 'Agentes no contestaron';
        break;
      case 'out_of_opening_hours': 
        name = 'Fuera de horario'; 
        break;
      case 'short_abandoned': 
        name = 'Abandono rápido'; 
        break;
      case 'abandoned_in_classic':
      case 'abandoned_in_classic_ring': 
        name = 'Abandono en cola'; 
        break;
      case 'abandoned_in_ivr': 
        name = 'Abandono en IVR'; 
        break;
      default:
        name = reason.replace(/_/g, ' ');
        break;
    }
    return prefix + name;
  };

  const getReasonColor = (reason: string) => {
    const category = getReasonCategory(reason);
    if (category === 'ACCIONABLE') {
      return reason === 'agents_did_not_answer' ? '#ef4444' : '#f59e0b';
    } else {
      switch (reason) {
        case 'out_of_opening_hours': return '#334155'; // Slate-700
        case 'short_abandoned': return '#475569'; // Slate-600
        case 'abandoned_in_classic':
        case 'abandoned_in_classic_ring': return '#64748b'; // Slate-500
        case 'abandoned_in_ivr': return '#94a3b8'; // Slate-400
        default: return '#1e293b'; // Slate-850
      }
    }
  };

  // Agente estrella (mejor AHT y atención)
  const mejorAht = [...ahtAgentes]
    .filter(a => a.llamadas_atendidas > 0)
    .sort((a, b) => a.aht_minutos - b.aht_minutos)[0];

  const datosTortaMotivos = llamadasMotivos.map((m) => ({
    name: translateReason(m.missed_reason),
    value: Number(m.num_llamadas),
    rawReason: m.missed_reason
  }));

  const datosHoras = currentLlamadasHora.map(h => ({
    hora: `${String(h.hora).padStart(2, '0')}:00`,
    perdidas: h.perdidas
  }));

  const BAR_COLORS = ['#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'];

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
          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold">{lastUpdatedTime}</p>
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
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">{currentResumen.total}</span>
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
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-outfit">{currentResumen.atendidas}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Conversaciones completadas</span>
          </div>
        </div>

        {/* Perdidas */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-rose-500 dark:text-rose-455">
            <span className="text-[10px] font-bold uppercase tracking-wider">Perdidas Operativas</span>
            <PhoneOff size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-outfit">{currentResumen.perdidas}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block mt-1">
              Brutas totales: {currentResumen.perdidas_brutas}
            </span>
          </div>
        </div>

        {/* Tasa Atencion */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-indigo-500 dark:text-indigo-445">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tasa de Atención</span>
            <Percent size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-outfit">{currentResumen.tasa_atencion}%</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Fórmula Operativa Real</span>
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
                      formatter={(value) => [`${value} llamadas`, 'Perdidas Operativas']}
                    />
                    <Area type="monotone" dataKey="perdidas" stroke="#ef4444" fill="rgba(239, 68, 68, 0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 dark:text-slate-500 text-sm">Sin llamadas perdidas operativas hoy</p>
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
                        <Cell key={`cell-${index}`} fill={getReasonColor(entry.rawReason)} />
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
      <div className="grid grid-cols-1 gap-6">
        {/* AHT (Media de minutos por llamada - Últimos 7 días) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col shadow-sm dark:shadow-none">
          <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-4">AHT por Agente (Últimos 7 Días)</h3>
          
          <div className="h-72 w-full flex-1 flex items-center justify-center mb-4">
            {isMounted ? (
              ahtAgentes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ahtAgentes.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} tickLine={false} width={120} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#38bdf8' }}
                      formatter={(value) => [`${value} minutos`, 'Duración Media']}
                    />
                    <Bar dataKey="aht_minutos" fill="#06b6d4" radius={[0, 4, 4, 0]}>
                      {ahtAgentes.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
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

      {/* Auditoría de Pérdidas por Agente */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white">
              Auditoría de Pérdidas por Agente
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Desglose interactivo por agente para auditar detalles operativos reales.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedDate === getMadridTodayString() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Refresco automático (60s)
              </span>
            )}
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Columna Izquierda: Listado de Rendimiento de Agentes */}
          <div className="lg:col-span-1 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3 px-1">
              Agentes Operativos
            </h4>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-2 px-3">Agente</th>
                    <th className="py-2 px-3 text-right">Llamadas Perdidas Hoy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
                  {agentesPerdidas.map((ag) => {
                    const isSelected = selectedAgentId === ag.user_id;
                    return (
                      <tr 
                        key={ag.user_id}
                        onClick={() => setSelectedAgentId(ag.user_id)}
                        className={`cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/40 transition-all ${
                          isSelected ? 'bg-indigo-500/10 dark:bg-indigo-950/20 border-l-2 border-indigo-500 font-bold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {ag.name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {ag.perdidas_hoy > 0 ? (
                            <span className="text-red-500 dark:text-red-400">{ag.perdidas_hoy}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">{ag.perdidas_hoy}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Columna Derecha: Panel de Auditoría Individual */}
          <div className="lg:col-span-2 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 min-h-[300px] flex flex-col justify-between">
            {selectedAgentId === null ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <span className="text-3xl mb-3">📑</span>
                <p className="text-sm text-slate-550 dark:text-slate-400 font-medium max-w-sm">
                  Selecciona un agente del listado para auditar sus llamadas perdidas en detalle 📑
                </p>
              </div>
            ) : (() => {
              const selectedAgent = agentesPerdidas.find(a => a.user_id === selectedAgentId);
              const agentCalls = detalleLlamadas.filter(c => c.agent_id === selectedAgentId);

              if (agentCalls.length === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <span className="text-3xl mb-3">🎉</span>
                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">
                      {selectedAgent?.name}
                    </h5>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      ¡Perfecto! Este agente no ha perdido ninguna llamada operativa hoy 🎉
                    </p>
                  </div>
                );
              }

              return (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      Detalle de Pérdidas: <span className="text-indigo-600 dark:text-indigo-400">{selectedAgent?.name}</span>
                    </h4>
                    <span className="text-xs font-mono bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                      {agentCalls.length} llamadas
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                          <th className="pb-2">Hora</th>
                          <th className="pb-2">ID Llamada</th>
                          <th className="pb-2">Motivo</th>
                          <th className="pb-2 text-right">Duración total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
                        {agentCalls.map((loss) => {
                          const timeStr = loss.started_at || loss.ended_at
                            ? new Date(loss.started_at || loss.ended_at || '').toLocaleTimeString('es-ES', { 
                                timeZone: 'Europe/Madrid', 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: false
                              })
                            : '--:--';
                          return (
                            <tr key={loss.call_id} className="hover:bg-slate-200/30 dark:hover:bg-slate-800/20 transition-all">
                              <td className="py-2.5 font-mono text-slate-800 dark:text-slate-200">
                                {timeStr}
                              </td>
                              <td className="py-2.5 font-mono text-slate-500 dark:text-slate-400">
                                {loss.call_id}
                              </td>
                              <td className="py-2.5">
                                {loss.missed_reason === 'agents_did_not_answer' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                    Agentes no contestaron ⏳
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    Sin agentes disponibles 👥
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 text-right font-mono text-slate-650 dark:text-slate-400">
                                {formatDurationHumana(loss.duration_s)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
