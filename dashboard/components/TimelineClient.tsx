'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Clock, 
  Coffee, 
  Activity, 
  Calendar,
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';

interface UserInfo {
  user_id: string;
  name: string;
  email: string;
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

interface Props {
  users: UserInfo[];
  selectedUserId: string | null;
  timeline: Intervalo[];
  collectiveTimeline?: IntervaloColectivo[];
  startLimit?: string;
  endLimit?: string;
  lastUpdated: string;
  nowMs: number;
}

export default function TimelineClient({
  users,
  selectedUserId,
  timeline,
  collectiveTimeline = [],
  startLimit,
  endLimit,
  lastUpdated,
  nowMs
}: Props) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState(selectedUserId || '');

  const handleUserChange = (userId: string) => {
    setSelectedUser(userId);
    if (userId) {
      router.push(`/timeline?user_id=${userId}`);
    } else {
      router.push('/timeline');
    }
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case 'available': return 'Disponible 🟢';
      case 'after_call_work': return 'ACW 🔵';
      case 'unavailable': return 'No Disponible 🟡';
      case 'offline': return 'Desconectado 🔘';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-550/20';
      case 'after_call_work': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-550/20';
      case 'unavailable': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-550/20';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50';
    }
  };

  const translateSubstatus = (substatus: string | null) => {
    if (!substatus) return '';
    const lower = substatus.toLowerCase();
    if (lower === 'out_for_lunch' || lower === 'lunch') return 'Pausa para comer 🍔';
    switch (substatus) {
      case 'on_a_break': return 'Descanso ☕';
      case 'doing_back_office': return 'Back Office 📝';
      case 'in_training': return 'Formación 🎓';
      case 'other': return 'Otro ⚙️';
      case 'always_opened': return 'Default Abierto';
      case 'always_closed': return 'Default Cerrado';
      default: return substatus;
    }
  };

  const getStatusLabel = (status: string, substatus: string | null) => {
    if (status === 'available') return 'Disponible';
    if (status === 'after_call_work') return 'ACW';
    if (status === 'unavailable') {
      if (!substatus) return 'No Disponible';
      const lower = substatus.toLowerCase();
      if (lower === 'out_for_lunch' || lower === 'lunch') return 'Pausa para comer 🍔';
      switch (substatus) {
        case 'on_a_break': return 'Descanso ☕';
        case 'doing_back_office': return 'Back Office 📝';
        case 'in_training': return 'Formación 🎓';
        case 'other': return 'Otro ⚙️';
        case 'always_opened': return 'Default Abierto';
        case 'always_closed': return 'Default Cerrado';
        default: return substatus;
      }
    }
    return status;
  };

  const getSegmentColor = (status: string, substatus: string | null) => {
    if (status === 'available') {
      return 'bg-emerald-500 hover:bg-emerald-450 dark:bg-emerald-600 dark:hover:bg-emerald-500';
    }
    if (status === 'after_call_work') {
      return 'bg-blue-500 hover:bg-blue-450 dark:bg-blue-600 dark:hover:bg-blue-500';
    }
    if (status === 'unavailable') {
      if (substatus === 'always_opened' || substatus === 'always_closed') {
        return 'bg-slate-350 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-650';
      }
      return 'bg-rose-500 hover:bg-rose-450 dark:bg-rose-600 dark:hover:bg-rose-500';
    }
    return 'bg-slate-350 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-650';
  };

  const formatRange = (startStr: string, endStr: string | null) => {
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    
    const pad = (n: number) => String(n).padStart(2, '0');
    
    const startMonth = pad(start.getMonth() + 1);
    const startDay = pad(start.getDate());
    const startHour = pad(start.getHours());
    const startMin = pad(start.getMinutes());
    
    const endMonth = pad(end.getMonth() + 1);
    const endDay = pad(end.getDate());
    const endHour = pad(end.getHours());
    const endMin = pad(end.getMinutes());
    
    const rangeStr = `${startMonth}-${startDay} ${startHour}:${startMin} — ${endMonth}-${endDay} ${endHour}:${endMin}`;
    
    const diffMins = Math.round((end.getTime() - start.getTime()) / 60000);
    let durationStr = '';
    if (diffMins >= 60) {
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      durationStr = `${hrs}h ${mins}m`;
    } else {
      durationStr = `${diffMins} min`;
    }
    
    return { rangeStr, durationStr };
  };

  const mergeContiguousIntervals = (intervals: any[], nowMs: number) => {
    if (intervals.length === 0) return [];
    
    const sorted = [...intervals].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    
    const merged: any[] = [];
    let current = { ...sorted[0] };
    
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      
      const currentEnd = current.ended_at ? new Date(current.ended_at).getTime() : nowMs;
      const nextStart = new Date(next.started_at).getTime();
      
      const sameState = current.status === next.status && current.substatus === next.substatus;
      const gapMs = nextStart - currentEnd;
      const isContiguous = gapMs <= 5 * 60 * 1000; // Umbral de 5 minutos
      
      if (sameState && isContiguous) {
        const nextEndVal = next.ended_at ? new Date(next.ended_at).getTime() : nowMs;
        const currentEndVal = current.ended_at ? new Date(current.ended_at).getTime() : nowMs;
        const newEndMs = Math.max(currentEndVal, nextEndVal);
        
        current.ended_at = next.ended_at === null || current.ended_at === null 
          ? null 
          : new Date(newEndMs).toISOString();
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    
    merged.push(current);
    return merged;
  };

  // Procesar intervalos de la vista colectiva para un agente específico
  const processAgentSegments = (userId: string, nowMs: number) => {
    if (!collectiveTimeline || !startLimit || !endLimit) return [];
    
    const startLimitMs = new Date(startLimit).getTime();
    const endLimitMs = new Date(endLimit).getTime();
    const totalDurationMs = endLimitMs - startLimitMs;

    const agentIntervals = collectiveTimeline.filter(i => i.user_id === userId);
    const mergedIntervals = mergeContiguousIntervals(agentIntervals, nowMs);

    return mergedIntervals
      .map(interval => {
        // Cliquear y truncar los intervalos dentro de la ventana de 09:00 a 18:00
        const start = Math.max(new Date(interval.started_at).getTime(), startLimitMs);
        const end = Math.min(
          interval.ended_at ? new Date(interval.ended_at).getTime() : nowMs,
          endLimitMs
        );

        if (start >= end) return null;

        const leftPct = ((start - startLimitMs) / totalDurationMs) * 100;
        const widthPct = ((end - start) / totalDurationMs) * 100;

        return {
          ...interval,
          leftPct,
          widthPct,
          start,
          end
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  };

  // Calcular agregados rápidos del timeline para el agente seleccionado
  const totalMinutosPausa = timeline
    .filter(i => i.status === 'unavailable' && i.substatus !== 'always_opened' && i.substatus !== 'always_closed')
    .reduce((acc, curr) => acc + Number(curr.minutos), 0);

  const totalMinutosActivo = timeline
    .filter(i => i.status === 'available' || i.status === 'after_call_work')
    .reduce((acc, curr) => acc + Number(curr.minutos), 0);

  const totalIntervalos = timeline.length;

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-outfit font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white tracking-tight">
            Timeline de Agentes
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Auditoría de estados y transiciones en detalle para cada agente.
          </p>
        </div>
        <div className="text-right sm:block hidden">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Última actualización</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold">{lastUpdated}</p>
        </div>
      </div>

      {/* Selector de Agente */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6 justify-between shadow-sm dark:shadow-none">
        <div className="space-y-1.5 max-w-md">
          <label className="text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider block">Seleccionar Agente</label>
          <p className="text-xs text-slate-500">Selecciona un agente de la lista para ver su historial de estados e intervalos recientes.</p>
        </div>
        
        <div className="w-full md:w-80">
          <select
            value={selectedUser}
            onChange={(e) => handleUserChange(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-sm dark:shadow-none"
          >
            <option value="">-- Ver Todos los Agentes --</option>
            {users.map((user) => (
              <option key={user.user_id} value={user.user_id} className="text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-950">
                {user.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedUserId ? (
        // ================= VISTA 1: DETALLE DE AGENTE SELECCIONADO =================
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Resumen rápido del Agente */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-xl">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-outfit font-bold text-base text-slate-800 dark:text-white truncate">
                    {users.find(u => u.user_id === selectedUserId)?.name || 'Agente'}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold truncate">
                    {users.find(u => u.user_id === selectedUserId)?.email}
                  </p>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 dark:border-slate-850 pt-5">
                <h4 className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">Historial de Intervalos</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-100 dark:border-slate-850/50">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Activity size={14} className="text-emerald-500 dark:text-emerald-400" />
                      Tiempo Activo
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{Math.round(totalMinutosActivo)} min</span>
                  </div>

                  <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-100 dark:border-slate-850/50">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Coffee size={14} className="text-amber-500" />
                      Tiempo Pausa
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{Math.round(totalMinutosPausa)} min</span>
                  </div>

                  <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-100 dark:border-slate-850/50">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Clock size={14} className="text-indigo-500 dark:text-indigo-400" />
                      Transiciones
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totalIntervalos} cambios</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Info Box */}
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-6">
              <div className="flex gap-3 text-indigo-600 dark:text-indigo-400">
                <Sparkles size={18} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-outfit font-bold text-sm text-slate-800 dark:text-white">Auditoría Completa</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Este log lista las últimas 50 transiciones registradas por la integración de Aircall en las tablas de estado de agentes, con clipping y orden cronológico inverso.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stepper del Timeline */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-none">
            <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              Secuencia de Transiciones (Últimas 50)
            </h3>

            {timeline.length > 0 ? (
              <div className="relative pl-6 space-y-6 border-l border-slate-200 dark:border-slate-800">
                {timeline.map((interval, idx) => {
                  const inicio = new Date(interval.started_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  const duracionLabel = interval.ended_at 
                    ? `${interval.minutos} min` 
                    : 'Activo actualmente';

                  return (
                    <div key={idx} className="relative group">
                      {/* Timeline Node Point */}
                      <span className={`absolute -left-[31px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-slate-50 dark:ring-slate-950 ${
                        interval.status === 'available' ? 'bg-emerald-500 dark:bg-emerald-450' :
                        interval.status === 'after_call_work' ? 'bg-blue-500 dark:bg-blue-450' :
                        interval.status === 'unavailable' ? 'bg-amber-500 dark:bg-amber-450' : 'bg-slate-400 dark:bg-slate-500'
                      }`} />

                      <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850/50 hover:border-slate-300 dark:hover:border-slate-800 rounded-xl p-4 transition-all space-y-3">
                        {/* Status detail */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getStatusColor(interval.status)}`}>
                              {translateStatus(interval.status)}
                            </span>
                            {interval.status === 'unavailable' && interval.substatus && (
                              <>
                                <ChevronRight size={12} className="text-slate-400" />
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded-md border border-amber-500/10">
                                  {translateSubstatus(interval.substatus)}
                                </span>
                              </>
                            )}
                          </div>
                          
                          <span className="text-xs text-slate-450 dark:text-slate-500 font-bold font-mono">
                            {inicio}
                          </span>
                        </div>

                        {/* Connection Flow */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2 border-t border-slate-200/60 dark:border-slate-900/60 pt-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-450 dark:text-slate-500">DURACIÓN</span>
                            <span className={`font-bold ${interval.ended_at ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-600 dark:text-emerald-450 animate-pulse'}`}>
                              {duracionLabel}
                            </span>
                          </div>

                          {interval.ended_at && (
                            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-450 dark:text-slate-500">
                              <span>FIN:</span>
                              <span className="font-semibold">
                                {new Date(interval.ended_at).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-slate-450 dark:text-slate-500 text-sm">No se han registrado intervalos de estado para este agente.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ================= VISTA 2: CRONOGRAMA HORIZONTAL COLECTIVO =================
        <div className="space-y-6">
          {/* Tarjeta de Resumen y Leyenda */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-outfit font-extrabold text-base text-slate-900 dark:text-white">Panel Colectivo de Estados</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visualización y distribución del tiempo hoy entre las **09:00** y las **18:00**.
                </p>
              </div>
            </div>

            {/* Leyenda de Colores */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-650 dark:text-slate-350">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 dark:bg-emerald-600 block shrink-0" />
                <span>Disponible</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-rose-500 dark:bg-rose-600 block shrink-0" />
                <span>Pausa (Descanso / Almuerzo / Backoffice)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-blue-500 dark:bg-blue-600 block shrink-0" />
                <span>ACW (After Call Work)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-slate-300 dark:bg-slate-700 block shrink-0" />
                <span>Desconectado / Sin datos</span>
              </div>
            </div>
          </div>

          {/* Gráfico principal de Cronogramas */}
          <div className="relative border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 bg-white dark:bg-slate-900/40 shadow-sm dark:shadow-none">
            {/* Hour Labels Header */}
            <div className="grid grid-cols-[160px_1fr] gap-6 mb-4 items-center">
              <div className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider pl-2">Agente</div>
              <div className="flex justify-between px-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                <span>09:00</span>
                <span>10:00</span>
                <span>11:00</span>
                <span>12:00</span>
                <span>13:00</span>
                <span>14:00</span>
                <span>15:00</span>
                <span>16:00</span>
                <span>17:00</span>
                <span>18:00</span>
              </div>
            </div>

            {/* List area with background lines */}
            <div className="relative space-y-4 min-w-[700px] md:min-w-0">
              {/* background grid lines */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-[160px_1fr] gap-6">
                <div />
                <div className="flex justify-between px-1 h-full">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-full w-[1px] border-r border-dashed border-slate-200 dark:border-slate-800/80" />
                  ))}
                </div>
              </div>

              {/* Rows */}
              {users.map((user) => {
                const segments = processAgentSegments(user.user_id, nowMs);

                return (
                  <div key={user.user_id} className="grid grid-cols-[160px_1fr] gap-6 items-center group/row relative z-10 py-0.5">
                    {/* User profile identifier */}
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={user.name}>
                        {user.name}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate" title={user.email}>
                        {user.email}
                      </div>
                    </div>

                    {/* Timeline Bar Container */}
                    <div className="relative w-full h-7 bg-slate-100 dark:bg-slate-800/20 rounded-lg border border-slate-200/50 dark:border-slate-800/50 shadow-inner flex items-center">
                      {segments.length > 0 ? (
                        segments.map((seg, sIdx) => {
                          const { rangeStr, durationStr } = formatRange(seg.started_at, seg.ended_at);
                          
                          // Ajustar posicionamiento del tooltip en los bordes izquierdo/derecho para evitar recortes
                          const isNearRight = seg.leftPct > 72;
                          const isNearLeft = seg.leftPct < 15;
                          
                          const tooltipPositionClass = isNearRight 
                            ? 'right-0 left-auto translate-x-0 items-end' 
                            : isNearLeft 
                              ? 'left-0 right-auto translate-x-0 items-start' 
                              : 'left-1/2 -translate-x-1/2 right-auto items-center';
                              
                          const arrowPositionClass = isNearRight 
                            ? 'mr-4' 
                            : isNearLeft 
                              ? 'ml-4' 
                              : '';

                          return (
                            <div
                              key={sIdx}
                              className="absolute top-0 bottom-0 group cursor-help z-10 hover:z-20"
                              style={{
                                left: `${seg.leftPct}%`,
                                width: `${seg.widthPct}%`
                              }}
                            >
                              {/* Colored segment bar */}
                              <div className={`w-full h-full rounded-md transition-all opacity-85 hover:opacity-100 ${getSegmentColor(seg.status, seg.substatus)}`} />
                              
                              {/* Rich float Tooltip */}
                              <div className={`absolute bottom-full mb-2.5 hidden group-hover:flex flex-col z-50 pointer-events-none drop-shadow-xl ${tooltipPositionClass}`}>
                                <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 text-[11px] font-semibold py-2 px-3 rounded-xl border border-slate-800 dark:border-slate-850/80 whitespace-nowrap leading-tight">
                                  <div className="text-white font-extrabold mb-0.5">{user.name}</div>
                                  <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                                    <span className={`w-2 h-2 rounded-full ${
                                      seg.status === 'available' ? 'bg-emerald-500' :
                                      seg.status === 'after_call_work' ? 'bg-blue-500' :
                                      (seg.substatus === 'always_opened' || seg.substatus === 'always_closed') ? 'bg-slate-400' : 'bg-rose-500'
                                    }`} />
                                    <span>{getStatusLabel(seg.status, seg.substatus)}</span>
                                  </div>
                                  <div className="text-slate-400 font-mono text-[10px] mt-1.5">
                                    {rangeStr} <span className="text-indigo-400 font-bold">({durationStr})</span>
                                  </div>
                                </div>
                                {/* Tooltip arrow indicator */}
                                <div className={`w-2.5 h-2.5 bg-slate-900 dark:bg-slate-950 rotate-45 -mt-1.5 border-r border-b border-slate-800 dark:border-slate-850/80 ${arrowPositionClass}`} />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        // Muestra el barra de desconectado si no hay datos
                        <div className="w-full h-full bg-slate-200/50 dark:bg-slate-800/10 flex items-center justify-center pointer-events-none">
                          <span className="text-[9px] text-slate-400 dark:text-slate-600 font-medium">Sin datos / Desconectado</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
