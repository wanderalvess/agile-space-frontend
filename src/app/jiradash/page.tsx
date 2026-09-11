'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Gauge, ExternalLink, RefreshCw, KeyRound, ShieldCheck, Activity } from 'lucide-react';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/hooks/use-toast';

export default function JiraDashPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { settings, loading } = useJiraSettings();
  const { mode } = useTheme();
  const { toast } = useToast();
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Sincroniza o token PAT do usuário com o JiraDash no iframe
  const sendTokenToIframe = (token?: string) => {
    const targetToken = token || settings?.token;
    if (!targetToken || !iframeRef.current?.contentWindow) return;

    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'SET_JIRA_PAT',
          token: targetToken,
        },
        '*'
      );
    } catch (e) {
      console.error('[JiraDash] Erro ao sincronizar token com iframe:', e);
    }
  };

  // Sincroniza tema escuro / claro em tempo real com o iframe
  useEffect(() => {
    if (iframeLoaded && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'SET_THEME',
          mode,
        },
        '*'
      );
    }
  }, [iframeLoaded, mode]);

  useEffect(() => {
    if (iframeLoaded && settings?.token) {
      sendTokenToIframe(settings.token);
    }
  }, [iframeLoaded, settings?.token]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    if (settings?.token) {
      sendTokenToIframe(settings.token);
      toast({
        title: 'JiraDash conectado',
        description: 'Credenciais do Jira sincronizadas com sucesso.',
        duration: 3000,
      });
    }
  };

  const handleReloadIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.src = '/jiradash/index.html';
      toast({
        title: 'Recarregando JiraDash',
        description: 'A página interna está sendo atualizada...',
        duration: 2000,
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      <RoomHeader
        title="JiraDash"
        toolIcon={<Gauge className="w-5 h-5 text-amber-500" />}
        toolColorClass="text-amber-500"
        badge={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            >
              TOTVS Agile Intelligence
            </Badge>
            {settings?.token && (
              <Badge
                variant="outline"
                className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1"
              >
                <ShieldCheck className="w-3 h-3" />
                PAT Ativo
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReloadIframe}
              title="Recarregar JiraDash"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
              title="Comparar com o módulo Squad Pulse anterior"
            >
              <Link href="/squad">
                <Activity className="w-3.5 h-3.5" />
                Squad Pulse
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden sm:flex items-center gap-1.5 text-xs"
            >
              <a
                href="https://jiraproducao.totvs.com.br"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Jira TOTVS
              </a>
            </Button>
          </div>
        }
      />

      <main className="flex-1 w-full h-full relative overflow-hidden bg-background">
        <iframe
          ref={iframeRef}
          src="/jiradash/index.html"
          onLoad={handleIframeLoad}
          className="w-full h-full border-0 block"
          title="JiraDash TOTVS"
        />
      </main>
    </div>
  );
}
