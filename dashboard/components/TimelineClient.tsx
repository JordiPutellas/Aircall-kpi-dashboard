'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Clock, 
  Coffee, 
  Activity, 
  Calendar,
  ChevronRight,
  Sparkles
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

interface Props {
  users: UserInfo[];
  selectedUserId: string | null;
  timeline: Intervalo[];
  lastUpdated: string;
}

export default function TimelineClient({
  users,
  selectedUserId,
  timeline,
  lastUpdated
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
            <option value="">-- Seleccionar Agente --</option>
            {users.map((user) => (
              <option key={user.user_id} value={user.user_id} className="text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-950">
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedUserId ? (
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
                        interval.status === 'available' ? 'bg-emerald-555 dark:bg-emerald-400' :
                        interval.status === 'after_call_work' ? 'bg-blue-555 dark:bg-blue-400' :
                        interval.status === 'unavailable' ? 'bg-amber-555 dark:bg-amber-400' : 'bg-slate-400 dark:bg-slate-500'
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
        <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/40 rounded-2xl p-16 text-center max-w-2xl mx-auto space-y-4 shadow-sm dark:shadow-none">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center mx-auto text-xl font-extrabold">
            ?
          </div>
          <h3 className="font-outfit font-extrabold text-base text-slate-800 dark:text-white">Ningún Agente Seleccionado</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Por favor, selecciona un agente del menú desplegable superior para cargar su historial detallado y visualizar su timeline de auditoría de conexión.
          </p>
        </div>
      )}
    </div>
  );
}
