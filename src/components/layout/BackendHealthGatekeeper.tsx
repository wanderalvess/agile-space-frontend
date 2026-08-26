'use client';

import React, { useState, useEffect } from 'react';
import { ServerCrash, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BackendHealthGatekeeper({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
      // Tentamos bater em um endpoint público do backend que não exige autenticação
      await fetch(`${apiUrl}/public/system-config`, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      setIsOffline(false);
    } catch (error) {
      // TypeError: Failed to fetch indica que o servidor não está acessível
      setIsOffline(true);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Tenta reconectar a cada 10 segundos caso esteja offline
    const interval = setInterval(() => {
      if (isOffline) {
        checkHealth();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isOffline]);

  return (
    <>
      {children}

      {isOffline && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="max-w-md w-full mx-4 p-8 bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl border border-rose-100 dark:border-rose-900/50 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/50 rounded-3xl flex items-center justify-center mb-6 border-2 border-rose-100 dark:border-rose-900 shadow-inner">
              <ServerCrash className="h-10 w-10 text-rose-500" />
            </div>
            
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 mb-2">
              Backend <span className="text-rose-500">Desconectado</span>
            </h2>
            
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              O servidor do Espaço Ágil (Spring Boot) não está respondendo na porta 8002. Inicie o backend para continuar navegando.
            </p>

            <Button
              onClick={checkHealth}
              disabled={isChecking}
              className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-black uppercase text-[11px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isChecking ? 'Tentando Reconectar...' : 'Tentar Novamente'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
