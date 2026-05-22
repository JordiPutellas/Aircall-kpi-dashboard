'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  if (!mounted) {
    return (
      <div className="h-10 bg-slate-100 dark:bg-slate-800/40 animate-pulse rounded-xl" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-850 transition-all duration-200 cursor-pointer"
      title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      <div className="flex items-center gap-3">
        {theme === 'dark' ? (
          <>
            <Sun size={18} className="text-amber-400 shrink-0" />
            <span className="text-slate-300">Modo Claro</span>
          </>
        ) : (
          <>
            <Moon size={18} className="text-indigo-500 shrink-0" />
            <span className="text-slate-700 font-semibold">Modo Oscuro</span>
          </>
        )}
      </div>
    </button>
  );
}
