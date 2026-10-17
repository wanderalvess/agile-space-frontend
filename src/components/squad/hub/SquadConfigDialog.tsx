'use client';

/**
 * "Configurar a squad": conexão com o Jira (todos), projeto, capacidade e opções avançadas (só liderança).
 * Quem não é liderança só conecta o próprio Jira; a configuração da squad é da liderança (o servidor também recusa).
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Settings2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { defaultSyncJql, resolveSyncJql } from '@/lib/squad-hub';
import type { SquadConfig } from '@/lib/types';
import type { useSquadStore } from '@/store/useSquadStore';

interface JiraSettingsLike {
  domain?: string;
  token?: string;
}

export interface SquadConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadId: string;
  config: SquadConfig | null;
  isLeadership: boolean;
  jiraSettings: JiraSettingsLike | null | undefined;
  saveJiraSettings: (s: { domain: string; token: string }) => Promise<unknown>;
  saveSquadConfig: ReturnType<typeof useSquadStore.getState>['saveSquadConfig'];
}

export function SquadConfigDialog({ open, onOpenChange, squadId, config, isLeadership, jiraSettings, saveJiraSettings, saveSquadConfig }: SquadConfigDialogProps) {
  const { toast } = useToast();
  const [projectKey, setProjectKey] = useState('');
  const [jql, setJql] = useState('');
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [sprintFieldId, setSprintFieldId] = useState('');
  const [rapidViewId, setRapidViewId] = useState<number | string>('');
  const [rankingEnabled, setRankingEnabled] = useState(false);
  const [capacityHours, setCapacityHours] = useState(6);

  useEffect(() => {
    if (jiraSettings?.token) setJiraToken(jiraSettings.token);
  }, [jiraSettings]);

  useEffect(() => {
    const defaultKey = squadId || '';
    if (config) {
      const activeKey = config.jiraProjectKey || defaultKey;
      setProjectKey(activeKey);
      setJql(resolveSyncJql(config.syncJql, activeKey));
      setRankingEnabled(!!config.rankingEnabled);
      setCapacityHours(config.defaultDailyCapacityHours || 6);
      setJiraDomain(config.jiraDomain || jiraSettings?.domain || '');
      setSprintFieldId(config.sprintFieldId || '');
      setRapidViewId(config.rapidViewId || '');
    } else if (squadId) {
      setProjectKey(defaultKey);
      setJql(defaultSyncJql(defaultKey));
      setJiraDomain(jiraSettings?.domain || '');
    }
  }, [config, squadId, jiraSettings?.domain]);

  const handleSave = async () => {
    if (!squadId) return;
    try {
      if (jiraToken.trim()) {
        const dom = jiraDomain.trim() || jiraSettings?.domain || '';
        if (!dom) {
          toast({
            title: 'Domínio do Jira obrigatório',
            description: 'Informe o domínio (ex.: suaempresa.atlassian.net) antes de salvar o token — sem ele a sincronização não encontra suas credenciais.',
            variant: 'destructive',
          });
          return;
        }
        await saveJiraSettings({ domain: dom, token: jiraToken.trim() });
      }
      if (!isLeadership) {
        onOpenChange(false);
        toast({ title: 'Conexão salva', description: 'O seu Jira está conectado. A configuração da squad (projeto, capacidade, filtro) é feita pela liderança.' });
        return;
      }
      await saveSquadConfig(squadId, {
        jiraProjectKey: projectKey.trim().toUpperCase(),
        syncJql: jql.trim(),
        rankingEnabled,
        defaultDailyCapacityHours: Number(capacityHours) || 6,
        jiraDomain: jiraDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') || undefined,
        sprintFieldId: sprintFieldId.trim() || undefined,
        rapidViewId: rapidViewId ? Number(rapidViewId) || rapidViewId : undefined,
      });
      onOpenChange(false);
      toast({ title: 'Configuração salva', description: 'Squad e credenciais prontas para sincronizar com o Jira.' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao salvar', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-3 overflow-y-auto rounded-[2rem] border border-border bg-card p-6 text-card-foreground sm:max-w-xl">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-2xl font-bold leading-none tracking-tight">
            <Settings2 className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" /> Configurar a squad
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Conecte o Jira e diga de onde vêm as issues da sprint de <strong className="text-foreground">{squadId}</strong>. O essencial está logo abaixo; o resto fica em Opções avançadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <section className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-bold">1. Conexão com o Jira</h3>
            <div className="space-y-1.5">
              <label htmlFor="squad-jira-domain" className="block text-sm font-semibold">Endereço do Jira</label>
              <Input id="squad-jira-domain" value={jiraDomain} onChange={(e) => setJiraDomain(e.target.value)} placeholder="jira.suaempresa.com.br" className="h-11 rounded-xl text-sm" />
              <p className="text-xs text-muted-foreground">O endereço que você usa para abrir o Jira no navegador.</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="squad-jira-token" className="block text-sm font-semibold">Token de acesso pessoal</label>
                {jiraToken.trim() ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Informado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                    <XCircle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Falta informar
                  </span>
                )}
              </div>
              <Input id="squad-jira-token" type="password" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} placeholder="Cole aqui o token gerado no seu perfil do Jira" className="h-11 rounded-xl font-code text-sm" />
              <p className="text-xs text-muted-foreground">É o Personal Access Token do seu perfil no Jira. Serve para buscar as issues e sincronizar a squad.</p>
            </div>
          </section>

          {!isLeadership && (
            <p className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              O projeto, a capacidade e o filtro de issues da squad são configurados pela liderança (Agile Master, People Lead, Tech Lead, PO). Aqui você só conecta o seu Jira.
            </p>
          )}

          {isLeadership && (
            <>
              <section className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-bold">2. Projeto da squad</h3>
                <div className="space-y-1.5">
                  <label htmlFor="squad-project-key" className="block text-sm font-semibold">Chave do projeto</label>
                  <Input id="squad-project-key" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} placeholder="Ex.: ABC" className="h-11 rounded-xl text-sm" />
                  <p className="text-xs text-muted-foreground">A sigla que aparece antes do número nas issues (em ABC-123, a chave é ABC).</p>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-bold">3. Capacidade do time</h3>
                <div className="space-y-1.5">
                  <label htmlFor="squad-capacity" className="block text-sm font-semibold">Horas por dia de cada pessoa</label>
                  <Input id="squad-capacity" type="number" min={1} max={16} value={capacityHours} onChange={(e) => setCapacityHours(Number(e.target.value) || 6)} className="h-11 w-32 rounded-xl text-sm" />
                  <p className="text-xs text-muted-foreground">Valor padrão para quem ainda não tem horas definidas.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <Checkbox id="rankingEnabled" checked={rankingEnabled} onCheckedChange={(v) => setRankingEnabled(!!v)} className="mt-0.5" />
                  <label htmlFor="rankingEnabled" className="cursor-pointer text-sm">
                    <span className="block font-semibold">Calcular a capacidade e as horas de cada pessoa</span>
                    <span className="text-xs text-muted-foreground">Ao sincronizar, busca também as horas lançadas por cada pessoa no Jira.</span>
                  </label>
                </div>
              </section>

              <details className="group rounded-2xl border border-border bg-muted/30 p-4">
                <summary className="flex cursor-pointer list-none select-none items-center justify-between text-sm font-bold">
                  Opções avançadas
                  <span className="text-xs font-medium text-muted-foreground group-open:hidden">Só se algo não aparecer</span>
                </summary>
                <div className="mt-3 space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="squad-jql" className="block text-sm font-semibold">Filtro das issues da sprint (JQL)</label>
                    <Input id="squad-jql" value={jql} onChange={(e) => setJql(e.target.value)} placeholder='project = "CHAVE" AND sprint in openSprints()' className="h-11 rounded-xl font-code text-sm" />
                    <p className="text-xs text-muted-foreground">Consulta do Jira que escolhe as issues da sprint ativa. Se não souber o que é, deixe como está.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="squad-board-id" className="block text-sm font-semibold">Número do quadro Scrum</label>
                      <Input id="squad-board-id" value={rapidViewId} onChange={(e) => setRapidViewId(e.target.value)} placeholder="Ex.: 1234" className="h-11 rounded-xl font-code text-sm" />
                      <p className="text-xs text-muted-foreground">Preencha se o Quadro da squad não for encontrado.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="squad-sprint-field" className="block text-sm font-semibold">Campo da sprint no Jira</label>
                      <Input id="squad-sprint-field" value={sprintFieldId} onChange={(e) => setSprintFieldId(e.target.value)} placeholder="customfield_10005" className="h-11 rounded-xl font-code text-sm" />
                      <p className="text-xs text-muted-foreground">Nome técnico do campo. Só mude se as sprints não aparecerem.</p>
                    </div>
                  </div>
                </div>
              </details>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-sm font-semibold text-muted-foreground">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="h-11 rounded-xl px-6 text-sm font-bold">
              Salvar configuração
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
