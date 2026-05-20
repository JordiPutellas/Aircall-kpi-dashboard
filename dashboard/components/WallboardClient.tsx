'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  CheckCircle2, 
  Coffee, 
  Clock, 
  RefreshCw, 
  AlertTriangle,
  UserX,
  PhoneCall,
  Mail
} from 'lucide-react';

interface Agent {
  user_id: string;
  name: string;
  email: string;
  status: 'available' | 'unavailable' | 'after_call_work' | 'offline';
  substatus: string | null;
  desde: string | null;
  minutos_en_estado: number;
}

interface Props {
  initialAgents: Agent[];
  lastUpdated: string;
}

export default function WallboardClient({ initialAgents, lastUpdated }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [timeDiffs, setTimeDiffs] = useState<Record<string, number>>({});

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const diffs: Record<string, number> = {};
      
      initialAgents.forEach(agent => {
        if (agent.desde) {
          const startedAt = new Date(agent.desde).getTime();
          const now = Date.now();
          const diffSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
          diffs[agent.user_id] = diffSeconds;
        }
      });
      
      setTimeDiffs(diffs);
    }, 1000);

    return () => clearInterval(timer);
  }, [initialAgents]);

  const formatDuration = (totalSeconds: number | undefined, serverMinutes: number) => {
    if (totalSeconds === undefined) {
      if (serverMinutes > 0) {
        const hrs = Math.floor(serverMinutes / 60);
        const mins = serverMinutes % 60;
        return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      }
      return '0s';
    }
    
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'bg-pink-500/10 text-pink-500 dark:text-pink-400 border-pink-500/20 dark:border-pink-500/10',
      'bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20 dark:border-purple-500/10',
      'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-500/10',
      'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/10',
      'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/20 dark:border-cyan-500/10',
      'bg-teal-500/10 text-teal-500 dark:text-teal-400 border-teal-500/20 dark:border-teal-500/10',
      'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/10',
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/10',
    ];
    return colors[hash % colors.length];
  };

  const getSubstatusLabel = (substatus: string | null) => {
    if (!substatus) return null;
    switch (substatus) {
      case 'on_a_break': return 'Descanso ☕';
      case 'out_for_lunch': return 'Almuerzo 🍔';
      case 'doing_back_office': return 'Back Office 📝';
      case 'in_training': return 'Formación 🎓';
      case 'other': return 'Otro ⚙️';
      case 'always_opened': return 'Default Abierto';
      case 'always_closed': return 'Default Cerrado';
      default: return substatus;
    }
  };

  const isLongPause = (agent: Agent, durationSeconds: number | undefined) => {
    if (agent.status !== 'unavailable') return false;
    if (!agent.substatus || agent.substatus === 'always_opened' || agent.substatus === 'always_closed') return false;
    
    const minutes = durationSeconds !== undefined 
      ? durationSeconds / 60 
      : agent.minutos_en_estado;
      
    return minutes >= 30;
  };

  const totalCount = initialAgents.length;
  const availableCount = initialAgents.filter(a => a.status === 'available').length;
  const acwCount = initialAgents.filter(a => a.status === 'after_call_work').length;
  const pausedCount = initialAgents.filter(
    a => a.status === 'unavailable' && a.substatus && a.substatus !== 'always_opened' && a.substatus !== 'always_closed'
  ).length;
  const offlineCount = initialAgents.filter(a => a.status === 'offline').length;

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-outfit font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white tracking-tight">
            Wallboard de Agentes
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Visualización en vivo del estado actual del call center. Refresco automático de 60s.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right sm:block hidden">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Última actualización</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-mono font-bold">{lastUpdated}</p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={`${isPending ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
        {/* Total */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Agentes</span>
            <Users size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit">{totalCount}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Registrados</span>
          </div>
        </div>

        {/* Disponibles */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-emerald-500 dark:text-emerald-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Disponibles</span>
            <CheckCircle2 size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-outfit">{availableCount}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Listos para llamada</span>
          </div>
        </div>

        {/* ACW */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-blue-500 dark:text-blue-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">En ACW</span>
            <PhoneCall size={18} className="animate-pulse" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-outfit">{acwCount}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">After Call Work</span>
          </div>
        </div>

        {/* En Pausa Real */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between text-amber-500 dark:text-amber-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">En Pausa</span>
            <Coffee size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-outfit">{pausedCount}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Motivo específico</span>
          </div>
        </div>

        {/* Offline */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover-card-trigger shadow-sm dark:shadow-none col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Desconectados</span>
            <UserX size={18} />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-600 dark:text-slate-400 font-outfit">{offlineCount}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">Sin conexión activa</span>
          </div>
        </div>
      </div>

      {/* Grid de Agentes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-outfit font-extrabold text-lg text-slate-900 dark:text-white">Detalle de Agentes</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-850 shadow-sm dark:shadow-none">
            {initialAgents.length} agentes cargados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {initialAgents.map(agent => {
            const durationSecs = timeDiffs[agent.user_id];
            const isLong = isLongPause(agent, durationSecs);
            const avatarColor = getAvatarColor(agent.name);
            const substatusLabel = getSubstatusLabel(agent.substatus);

            let badgeClasses = '';
            let ringColor = 'border-slate-200 dark:border-slate-800';
            
            if (agent.status === 'available') {
              badgeClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
              ringColor = 'ring-2 ring-emerald-500/30 dark:ring-emerald-500/40 border-white dark:border-slate-950';
            } else if (agent.status === 'after_call_work') {
              badgeClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
              ringColor = 'ring-2 ring-blue-500/30 dark:ring-blue-500/40 border-white dark:border-slate-950';
            } else if (agent.status === 'unavailable') {
              const isSystem = agent.substatus === 'always_opened' || agent.substatus === 'always_closed';
              badgeClasses = isSystem 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50' 
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
              ringColor = isSystem 
                ? 'border-slate-250 dark:border-slate-800' 
                : 'ring-2 ring-amber-550/30 dark:ring-amber-500/40 border-white dark:border-slate-950';
            } else {
              badgeClasses = 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800';
              ringColor = 'border-slate-200 dark:border-slate-800';
            }

            return (
              <div 
                key={agent.user_id} 
                className={`relative flex flex-col justify-between bg-white dark:bg-slate-900/60 border rounded-2xl p-5 hover-card-trigger shadow-sm dark:shadow-none transition-all duration-200 overflow-hidden ${
                  isLong ? 'border-rose-500 dark:border-rose-500/60 shadow-lg shadow-rose-950/10 dark:shadow-rose-950/20 ring-1 ring-rose-500/25 animate-pulse-slow' : 'border-slate-200 dark:border-slate-800/80'
                }`}
              >
                {/* Alerta de Pausa Larga */}
                {isLong && (
                  <div className="absolute top-0 inset-x-0 bg-rose-500 text-white text-[10px] font-bold py-1 px-3 flex items-center justify-center gap-1.5 z-10">
                    <AlertTriangle size={10} className="animate-bounce" />
                    <span>PAUSA CRÍTICA (&gt;30 MIN)</span>
                  </div>
                )}

                {/* Contenido Principal */}
                <div className={`space-y-4 ${isLong ? 'pt-4' : ''}`}>
                  {/* Agente Info */}
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold border shrink-0 ${ringColor} ${avatarColor}`}>
                      {getInitials(agent.name)}
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate tracking-tight">{agent.name}</h4>
                      <p className="text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1 mt-0.5 truncate">
                        <Mail size={10} className="shrink-0" />
                        <span className="truncate">{agent.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Estado y Subestado */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Estado</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badgeClasses}`}>
                        {agent.status === 'available' && 'Disponible'}
                        {agent.status === 'after_call_work' && 'ACW'}
                        {agent.status === 'unavailable' && 'No Disponible'}
                        {agent.status === 'offline' && 'Offline'}
                      </span>
                    </div>

                    {agent.status === 'unavailable' && substatusLabel && (
                      <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950/40 rounded-lg p-1.5 px-2.5 border border-slate-150 dark:border-slate-800/30">
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Motivo</span>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                          {substatusLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer - Timer */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <Clock size={12} />
                    <span className="text-xs font-semibold">Tiempo</span>
                  </div>
                  {agent.status !== 'offline' && agent.desde ? (
                    <span className={`text-xs font-mono font-bold ${isLong ? 'text-rose-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {formatDuration(durationSecs, agent.minutos_en_estado)}
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
