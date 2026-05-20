'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Tv, 
  BarChart3, 
  Coffee, 
  Clock, 
  Database,
  PhoneCall
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Sidebar() {
  const pathname = usePathname();

  const getLinkClass = (path: string) => {
    const isActive = pathname === path;
    const base = "flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl border transition-all duration-200";
    
    if (isActive) {
      return `${base} text-indigo-600 bg-indigo-50/70 border-indigo-100 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/35`;
    }
    
    return `${base} text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border-transparent hover:border-slate-200 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 dark:hover:border-slate-850`;
  };

  return (
    <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
      {/* Header/Logo */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <div className="p-2.5 bg-indigo-500/10 dark:bg-green-500/10 text-indigo-500 dark:text-green-400 rounded-xl border border-indigo-500/20 dark:border-green-500/20">
          <PhoneCall size={20} />
        </div>
        <div>
          <h1 className="font-outfit font-extrabold text-lg leading-tight bg-gradient-to-r from-slate-800 to-slate-950 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Aircall KPIs
          </h1>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Dashboard Analítico</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1">
        <Link href="/" className={getLinkClass('/')}>
          <Tv size={18} className="shrink-0" />
          <span>Wallboard en Vivo</span>
          {pathname === '/' && (
            <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500 dark:bg-emerald-500 animate-pulse" />
          )}
        </Link>

        <Link href="/overview" className={getLinkClass('/overview')}>
          <BarChart3 size={18} className="shrink-0" />
          <span>Overview Diario</span>
        </Link>

        <Link href="/pausas" className={getLinkClass('/pausas')}>
          <Coffee size={18} className="shrink-0" />
          <span>Detalle de Pausas</span>
        </Link>

        <Link href="/timeline" className={getLinkClass('/timeline')}>
          <Clock size={18} className="shrink-0" />
          <span>Timeline de Agentes</span>
        </Link>
      </nav>

      {/* Theme Toggle & DB Status Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
        <ThemeToggle />
        
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-indigo-50/40 dark:bg-emerald-950/10 border border-indigo-100/50 dark:border-emerald-900/20">
          <Database size={15} className="text-indigo-500 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-700 dark:text-emerald-400">Neon Database</p>
            <p className="text-[10px] text-slate-500 dark:text-emerald-500/80 truncate">Conectado (Pooler)</p>
          </div>
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-emerald-400" />
        </div>
      </div>
    </aside>
  );
}
