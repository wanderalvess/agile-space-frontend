'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Gauge, ExternalLink, RefreshCw, KeyRound, ShieldCheck, Activity, Settings, Play } from 'lucide-react';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useSavedJqls } from '@/hooks/useSavedJqls';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const JQL_QUICK_PRESETS = [
  { label: 'Sprint Aberta', jql: 'project = "PROJETO" AND Sprint in openSprints() AND status != Cancelled' },
  { label: 'Próxima Sprint', jql: 'project = "PROJETO" AND Sprint in futureSprints()' },
  { label: 'Últimas do Projeto', jql: 'project = "PROJETO" AND status != Cancelled ORDER BY created DESC' },
];

export default function JiraDashPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { settings, loading, saveSettings } = useJiraSettings();
  const { savedJqls } = useSavedJqls();
  const { mode } = useTheme();
  const { toast } = useToast();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [jqlInput, setJqlInput] = useState('');

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

  // O modal padrão (mesmo formato do "Sincronizar Jira" do Scrum Poker) é a ÚNICA
  // entrada de config quando embedado: o HTML estático interno intercepta seus próprios
  // botões "Configurar" e pede pra abrir este aqui via postMessage, em vez de mostrar
  // o <dialog> dele. Evita duas UIs diferentes pra mesma coisa.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'JIRADASH_OPEN_CONFIG') {
        setIsConfigOpen(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (isConfigOpen) {
      setPatInput(settings?.token || '');
    }
  }, [isConfigOpen, settings?.token]);

  const handleLoadSprint = () => {
    const token = patInput.trim();
    const jql = jqlInput.trim();
    if (!token) {
      toast({ title: 'Informe o token (PAT) do Jira', variant: 'destructive', duration: 3000 });
      return;
    }
    if (!jql) {
      toast({ title: 'Informe a consulta JQL da sprint', variant: 'destructive', duration: 3000 });
      return;
    }
    saveSettings({ domain: settings?.domain || 'jiraproducao.totvs.com.br', token });
    iframeRef.current?.contentWindow?.postMessage({ type: 'JIRADASH_LOAD', token, jql }, '*');
    setIsConfigOpen(false);
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
              className="hidden lg:inline-flex text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
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
              variant="outline"
              size="sm"
              onClick={() => setIsConfigOpen(true)}
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Configurar</span>
            </Button>
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

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-lg rounded-[2rem] p-0 border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                <KeyRound className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                  Configurar JiraDash
                </DialogTitle>
                <DialogDescription className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                  Token de acesso e consulta JQL da sprint — mesma configuração usada no Scrum Poker.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Autenticação
              </Label>
              <Input
                type="password"
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                placeholder="Cole aqui seu token de acesso pessoal do Jira"
                className="h-10 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Consulta JQL
              </Label>
              <Textarea
                value={jqlInput}
                onChange={(e) => setJqlInput(e.target.value)}
                placeholder='project = "Meu Projeto" AND Sprint = 12345 AND status != Cancelled'
                className="min-h-[72px] rounded-xl text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 resize-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {JQL_QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setJqlInput(preset.jql)}
                    className="px-2.5 py-1 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
                {savedJqls.map((sj) => (
                  <button
                    key={sj.id}
                    type="button"
                    onClick={() => setJqlInput(sj.jql)}
                    title={sj.jql}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[9px] font-bold transition-colors',
                      sj.isPublic
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20'
                    )}
                  >
                    {sj.isPublic ? '🌐' : '🔒'} {sj.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 px-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setIsConfigOpen(false)}
              className="h-10 px-5 rounded-xl font-black uppercase text-[9px] tracking-widest text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLoadSprint}
              className="h-10 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-[0.1em] text-[10px] rounded-xl shadow-xl shadow-amber-500/10"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Carregar Sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
