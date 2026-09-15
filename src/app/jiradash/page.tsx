'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Gauge, ExternalLink, RefreshCw, KeyRound, ShieldCheck, Activity, Settings, Play, Bookmark, Globe, User, X } from 'lucide-react';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { useSavedJqls } from '@/hooks/useSavedJqls';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getSnapshot, saveSnapshot } from './snapshotApi';

const JQL_QUICK_PRESETS = [
  { label: 'Sprint Aberta', jql: 'project = "PROJETO" AND Sprint in openSprints() AND status != Cancelled' },
  { label: 'Próxima Sprint', jql: 'project = "PROJETO" AND Sprint in futureSprints()' },
  { label: 'Últimas do Projeto', jql: 'project = "PROJETO" AND status != Cancelled ORDER BY created DESC' },
];

export default function JiraDashPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { settings, loading, saveSettings } = useJiraSettings();
  const { savedJqls, saveJql, deleteJql } = useSavedJqls();
  const { mode, variant } = useTheme();
  const { toast } = useToast();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [jqlInput, setJqlInput] = useState('');
  const [isSaveJqlOpen, setIsSaveJqlOpen] = useState(false);
  const [newJqlLabel, setNewJqlLabel] = useState('');
  const [newJqlIsPublic, setNewJqlIsPublic] = useState(false);

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

  // Sincroniza tema escuro / claro e variante de cor em tempo real com o iframe
  useEffect(() => {
    if (iframeLoaded && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'SET_THEME',
          mode,
          variant,
        },
        '*'
      );
    }
  }, [iframeLoaded, mode, variant]);

  useEffect(() => {
    if (iframeLoaded && settings?.token) {
      sendTokenToIframe(settings.token);
    }
  }, [iframeLoaded, settings?.token]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'SET_THEME',
          mode,
          variant,
        },
        '*'
      );
    }
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
  //
  // As mesmas duas mensagens fazem o relé do cache compartilhado: o JWT do app nunca
  // entra no iframe (ele só conhece o PAT do Jira) — quem fala com o backend é sempre
  // este componente React, que já tem authFetch. O iframe só pede/empurra dado.
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'JIRADASH_OPEN_CONFIG') {
        setIsConfigOpen(true);
        return;
      }
      if (event.data?.type === 'JIRADASH_REQUEST_SNAPSHOT') {
        const jql = event.data.jql as string;
        try {
          const snapshot = await getSnapshot(jql);
          iframeRef.current?.contentWindow?.postMessage({ type: 'JIRADASH_SNAPSHOT_RESULT', jql, snapshot }, '*');
        } catch (e) {
          console.warn('[JiraDash] Falha ao buscar snapshot compartilhado:', e);
          iframeRef.current?.contentWindow?.postMessage({ type: 'JIRADASH_SNAPSHOT_RESULT', jql, snapshot: null }, '*');
        }
        return;
      }
      if (event.data?.type === 'JIRADASH_PUSH_SNAPSHOT') {
        const { jql, payload } = event.data as { jql: string; payload: unknown };
        saveSnapshot(jql, payload).catch((e) =>
          console.warn('[JiraDash] Falha ao salvar snapshot compartilhado (dado local segue válido):', e)
        );
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

  // Dispara um refresh de verdade (loadData → sempre busca no Jira, nunca lê o
  // snapshot compartilhado) em vez de recarregar o iframe inteiro — que agora, com
  // cache compartilhado, só voltaria a mostrar a mesma versão salva.
  const handleForceRefresh = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'JIRADASH_FORCE_REFRESH' }, '*');
    toast({
      title: 'Atualizando JiraDash',
      description: 'Buscando os dados mais recentes do Jira...',
      duration: 2000,
    });
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      <RoomHeader
        title="JiraDash"
        toolIcon={<Gauge className="w-5 h-5 text-amber-500" />}
        toolColorClass="text-amber-500"
        badge={
          settings?.token ? (
            <Badge
              variant="outline"
              className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />
              PAT Ativo
            </Badge>
          ) : undefined
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
              onClick={handleForceRefresh}
              title="Atualizar (busca no Jira agora)"
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
              <div className="flex items-center justify-between">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Consulta JQL
                </Label>
                <button
                  type="button"
                  disabled={!jqlInput.trim()}
                  onClick={() => {
                    setNewJqlLabel('');
                    setNewJqlIsPublic(false);
                    setIsSaveJqlOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-400 border border-amber-200/40 dark:border-amber-800 disabled:opacity-40 transition-all"
                >
                  <Bookmark className="h-3 w-3" /> Salvar JQL
                </button>
              </div>
              <Textarea
                value={jqlInput}
                onChange={(e) => setJqlInput(e.target.value)}
                placeholder='project = "Meu Projeto" AND Sprint = 12345 AND status != Cancelled'
                className="min-h-[72px] rounded-xl text-[11px] font-mono bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 resize-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {savedJqls.map((sj) => (
                  <div key={sj.id} className="relative group inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setJqlInput(sj.jql)}
                      title={sj.jql}
                      className={cn(
                        'pl-2.5 pr-6 py-1 rounded-full text-[9px] font-bold transition-colors flex items-center gap-1',
                        sj.isPublic
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20'
                      )}
                    >
                      {sj.isPublic ? <Globe className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                      {sj.label}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteJql(sj.id);
                        toast({ title: 'JQL excluída', duration: 2000 });
                      }}
                      className="absolute right-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Excluir esta JQL salva"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
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

      {/* Sub-modal para nomear e salvar a JQL atual como preset reutilizável */}
      <Dialog open={isSaveJqlOpen} onOpenChange={setIsSaveJqlOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-amber-500" />
              Salvar Consulta JQL
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Defina um nome e a visibilidade para reutilizar esta consulta rapidamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Preview da Consulta
              </Label>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[10px] font-mono text-amber-600 dark:text-amber-400 max-h-24 overflow-y-auto break-all leading-normal">
                {jqlInput || 'Nenhuma JQL preenchida'}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Nome do Filtro
              </Label>
              <Input
                value={newJqlLabel}
                onChange={(e) => setNewJqlLabel(e.target.value)}
                placeholder="Ex: Review DDPDV, Meus Bugs, Sprint Ativa"
                className="h-10 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                autoFocus
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
              <Checkbox checked={newJqlIsPublic} onCheckedChange={(v) => setNewJqlIsPublic(v === true)} />
              Salvar como pública (visível pra toda a squad)
            </label>
          </div>

          <DialogFooter className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setIsSaveJqlOpen(false)}
              className="h-9 px-4 rounded-xl font-bold text-xs uppercase"
            >
              Cancelar
            </Button>
            <Button
              disabled={!newJqlLabel.trim() || !jqlInput.trim()}
              onClick={() => {
                saveJql({ label: newJqlLabel, jql: jqlInput, isPublic: newJqlIsPublic });
                setIsSaveJqlOpen(false);
                toast({ title: 'JQL salva com sucesso!', description: `Salva como ${newJqlIsPublic ? 'Pública' : 'Privada'}.`, duration: 3000 });
              }}
              className="h-9 px-5 rounded-xl font-extrabold text-xs uppercase bg-amber-500 hover:bg-amber-600 text-slate-950"
            >
              Salvar Filtro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
