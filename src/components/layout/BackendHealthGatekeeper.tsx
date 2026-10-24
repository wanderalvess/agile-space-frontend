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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="max-w-md w-full mx-4 p-8 bg-card text-card-foreground rounded-2xl shadow-lg border border-destructive/30 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6 border border-destructive/30">
              <ServerCrash className="h-8 w-8 text-destructive" />
            </div>
            
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              Backend <span className="text-destructive">Desconectado</span>
            </h2>
            
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              {process.env.NODE_ENV === 'production'
                ? 'Não conseguimos falar com o servidor do Portal Tech V&D. Sua sessão continua guardada: assim que ele voltar, você segue de onde parou.'
                : 'O servidor do Portal Tech V&D (Spring Boot) não está respondendo na porta 8002. Inicie o backend para continuar navegando.'}
            </p>

            <Button
              onClick={checkHealth}
              disabled={isChecking}
              className="w-full h-11 gap-2 font-semibold"
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
