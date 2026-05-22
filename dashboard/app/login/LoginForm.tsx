"use client";

import { useActionState, useState } from "react";
import { Lock, Eye, EyeOff, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { loginAction } from "./actions";

interface LoginFormProps {
  callbackUrl?: string;
  envError?: boolean;
}

export default function LoginForm({ callbackUrl = "/", envError = false }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(loginAction, null);

  // Determinar si hay algún error
  const displayError = envError
    ? "Error del sistema: DASHBOARD_PASSWORD no está configurada en el servidor (.env.local)."
    : state?.error;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Decorative Outer Glow Effect */}
      <div className="relative group">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-25 dark:group-hover:opacity-40 transition duration-1000"></div>

        {/* Card Main Container */}
        <div className="relative bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/85 rounded-2xl shadow-2xl p-8 overflow-hidden transition-all duration-300">
          
          {/* Top colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

          {/* Card Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-4 p-4 bg-indigo-50/80 dark:bg-slate-950/60 text-indigo-600 dark:text-emerald-400 rounded-2xl border border-indigo-100/50 dark:border-slate-800/60 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.15)] dark:shadow-[0_4px_20px_-4px_rgba(16,185,129,0.15)] relative">
              <KeyRound size={28} className="animate-pulse-slow" />
            </div>
            
            <h2 className="text-2xl font-outfit font-extrabold bg-gradient-to-r from-slate-850 to-slate-950 dark:from-slate-50 dark:to-slate-300 bg-clip-text text-transparent">
              Acceso Restringido
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Por favor, introduce la clave de seguridad del Dashboard.
            </p>
          </div>

          {/* Form */}
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            {/* Error Message */}
            {displayError && (
              <div 
                className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-450 p-4 rounded-xl text-sm flex items-start gap-3 animate-[shake_0.5s_ease-in-out]"
                role="alert"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span className="font-semibold leading-snug">{displayError}</span>
              </div>
            )}

            {/* Input Group */}
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Contraseña Compartida
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock size={18} />
                </div>
                
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  disabled={isPending || envError}
                  placeholder="••••••••••••"
                  className="block w-full pl-11 pr-12 py-3.5 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-emerald-500/10 focus:border-indigo-500 dark:focus:border-emerald-500 disabled:opacity-50 transition-all duration-200 text-sm tracking-wider"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isPending || envError}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 transition-colors focus:outline-none cursor-pointer"
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending || envError}
              className="w-full relative flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold rounded-xl shadow-lg shadow-slate-950/10 dark:shadow-emerald-500/10 hover:shadow-xl hover:shadow-slate-950/15 dark:hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 cursor-pointer text-sm tracking-wide"
            >
              {isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Validando acceso...</span>
                </>
              ) : (
                <span>Acceder al Dashboard</span>
              )}
            </button>
          </form>
        </div>
      </div>
      
      {/* Footer Info */}
      <p className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-6 tracking-wide uppercase">
        Aircall KPIs • Conexión Segura
      </p>

      {/* Inline styles for custom shake keyframe */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
