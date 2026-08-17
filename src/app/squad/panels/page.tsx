'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Plus, RefreshCw, Pencil, Trash2, ArrowLeft, Lock, Users2, Hash, Rows3, BarChart3, PieChart
} from 'lucide-react';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useFirebase } from '@/firebase';
import { useUserContext } from '@/context/UserContext';
import { useSquadPanelsStore } from '@/store/useSquadPanelsStore';
import type { SquadPanel, SquadPanelChartType, SquadPanelGroupBy, SquadPanelAggregateMetric } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

function timeAgo(iso?: string): string {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'nunca';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

const CHART_ICON: Record<SquadPanelChartType, React.ComponentType<any>> = {
  number: Hash, table: Rows3, bar: BarChart3, pie: PieChart,
};

const PIE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#64748b'];

const AGGREGATE_LABEL: Record<SquadPanelAggregateMetric, string> = {
  count: 'Contagem de issues',
  estimateHours: 'Horas estimadas',
  remainingHours: 'Horas restantes',
  loggedHours: 'Horas logadas',
};

function formatAggregateValue(value: number, metric: SquadPanelAggregateMetric): string {
  return metric === 'count' ? String(value) : `${value}h`;
}

function PanelForm({
  initial, onSubmit, onCancel,
}: {
  initial?: Partial<SquadPanel>;
  onSubmit: (input: { title: string; jql: string; chartType: SquadPanelChartType; groupBy: SquadPanelGroupBy; aggregateMetric: SquadPanelAggregateMetric; visibility: 'private' | 'squad' }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [jql, setJql] = useState(initial?.jql || '');
  const [chartType, setChartType] = useState<SquadPanelChartType>(initial?.chartType || 'bar');
  const [groupBy, setGroupBy] = useState<SquadPanelGroupBy>(initial?.groupBy || 'status');
  const [aggregateMetric, setAggregateMetric] = useState<SquadPanelAggregateMetric>(initial?.aggregateMetric || 'count');
  const [visibility, setVisibility] = useState<'private' | 'squad'>(initial?.visibility || 'private');

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Título</label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Bugs críticos abertos" className="h-9 text-[12px]" />
      </div>
      <div>
        <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">JQL</label>
        <Input value={jql} onChange={e => setJql(e.target.value)} placeholder="priority = Highest AND status != Done" className="h-9 text-[12px] font-mono" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Tipo de painel</label>
          <Select value={chartType} onValueChange={v => setChartType(v as SquadPanelChartType)}>
            <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Número (contagem)</SelectItem>
              <SelectItem value="table">Tabela</SelectItem>
              <SelectItem value="bar">Gráfico de barras</SelectItem>
              <SelectItem value="pie">Gráfico de pizza</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Visibilidade</label>
          <Select value={visibility} onValueChange={v => setVisibility(v as 'private' | 'squad')}>
            <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Só eu</SelectItem>
              <SelectItem value="squad">Squad inteiro (só leitura)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {(chartType === 'bar' || chartType === 'pie') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Agrupar por</label>
            <Select value={groupBy} onValueChange={v => setGroupBy(v as SquadPanelGroupBy)}>
              <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="type">Tipo de issue</SelectItem>
                <SelectItem value="priority">Prioridade</SelectItem>
                <SelectItem value="assignee">Responsável</SelectItem>
                <SelectItem value="parent">Issue pai (história)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">O que somar</label>
            <Select value={aggregateMetric} onValueChange={v => setAggregateMetric(v as SquadPanelAggregateMetric)}>
              <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Contagem de issues</SelectItem>
                <SelectItem value="estimateHours">Horas estimadas</SelectItem>
                <SelectItem value="remainingHours">Horas restantes</SelectItem>
                <SelectItem value="loggedHours">Horas logadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {groupBy === 'parent' && (
            <p className="text-[9px] font-medium text-slate-400 col-span-2 -mt-1">
              Junta as issues filhas (JQL deve trazer subtarefas) sob a história-pai de cada uma
              {aggregateMetric !== 'count' ? ' — soma as horas das filhas por pai.' : '.'}
            </p>
          )}
        </div>
      )}
      <p className="text-[9px] font-medium text-slate-400 leading-relaxed">
        Roda com o seu Personal Access Token pessoal do Jira (Configurações). Painel "Squad inteiro" fica visível a
        todo mundo, mas só você consegue atualizar o resultado.
      </p>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm" className="h-9 text-[10px] font-black uppercase tracking-wider"
          disabled={!title.trim() || !jql.trim()}
          onClick={() => onSubmit({
            title, jql, chartType,
            groupBy: (chartType === 'bar' || chartType === 'pie') ? groupBy : 'none',
            aggregateMetric: (chartType === 'bar' || chartType === 'pie') ? aggregateMetric : 'count',
            visibility,
          })}
        >
          Salvar painel
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-[10px] font-black uppercase tracking-wider" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function PanelCard({ panel, isOwner, onRun, onEdit, onDelete, isRunning }: {
  panel: SquadPanel; isOwner: boolean; isRunning: boolean;
  onRun: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const Icon = CHART_ICON[panel.chartType];
  const metric = panel.aggregateMetric || 'count';
  const maxValue = Math.max(1, ...(panel.resultRows || []).map(r => r.value));
  const total = (panel.resultRows || []).reduce((s, r) => s + r.value, 0);

  let gradientStops = '';
  if (panel.chartType === 'pie' && panel.resultRows?.length) {
    let acc = 0;
    gradientStops = panel.resultRows.map((r, idx) => {
      const start = (acc / total) * 360;
      acc += r.value;
      const end = (acc / total) * 360;
      return `${PIE_COLORS[idx % PIE_COLORS.length]} ${start}deg ${end}deg`;
    }).join(', ');
  }

  return (
    <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{panel.title}</span>
          </div>
          <p className="text-[9px] font-mono text-slate-400 truncate mt-1">{panel.jql}</p>
          {(panel.chartType === 'bar' || panel.chartType === 'pie') && metric !== 'count' && (
            <p className="text-[8.5px] font-black text-indigo-500 uppercase tracking-wider mt-0.5">{AGGREGATE_LABEL[metric]}</p>
          )}
        </div>
        <span className="shrink-0 flex items-center gap-1 text-[8.5px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800/80">
          {panel.visibility === 'squad' ? <Users2 className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
          {panel.visibility === 'squad' ? 'squad' : 'privado'}
        </span>
      </div>

      <div className="flex-1">
        {panel.lastRunError && (
          <p className="text-[10px] font-semibold text-rose-500 mb-2">{panel.lastRunError}</p>
        )}
        {!panel.lastRunAt ? (
          <p className="text-[10.5px] font-medium text-slate-400">Ainda não rodou — clique em atualizar.</p>
        ) : panel.chartType === 'number' ? (
          <p className="text-3xl font-black text-slate-900 dark:text-white font-headline">{panel.resultTotal ?? 0}</p>
        ) : panel.chartType === 'table' ? (
          <div className="overflow-x-auto -mx-1 max-h-64 overflow-y-auto">
            <table className="w-full text-[10.5px]">
              <thead>
                <tr className="text-[8px] uppercase tracking-wider text-slate-400">
                  <th className="text-left font-black px-1 py-1">Issue</th>
                  <th className="text-left font-black px-1 py-1">Status</th>
                  <th className="text-left font-black px-1 py-1">Pai</th>
                </tr>
              </thead>
              <tbody>
                {(panel.resultIssues || []).map(i => (
                  <tr key={i.key} className="border-t border-slate-100 dark:border-slate-800/40">
                    <td className="px-1 py-1 font-mono text-indigo-600 dark:text-indigo-400">{i.key}</td>
                    <td className="px-1 py-1 text-slate-500 dark:text-slate-400 truncate">{i.status}</td>
                    <td className="px-1 py-1 text-slate-500 dark:text-slate-400 truncate">
                      {i.parentKey ? <span><span className="font-mono text-cyan-600 dark:text-cyan-400">{i.parentKey}</span> {i.parentTitle}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(panel.resultTotal || 0) > (panel.resultIssues?.length || 0) && (
              <p className="text-[8.5px] text-slate-400 mt-1.5">mostrando {panel.resultIssues?.length} de {panel.resultTotal}</p>
            )}
          </div>
        ) : panel.chartType === 'pie' ? (
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full shrink-0" style={{ background: gradientStops ? `conic-gradient(${gradientStops})` : '#e2e8f0' }} />
            <div className="space-y-1 min-w-0">
              {(panel.resultRows || []).slice(0, 6).map((r, idx) => (
                <div key={r.label} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="truncate font-bold text-slate-600 dark:text-slate-300">{r.label}</span>
                  <span className="text-slate-400 shrink-0">{formatAggregateValue(r.value, metric)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {(panel.resultRows || []).slice(0, 8).map(r => (
              <div key={r.label} className="flex items-center gap-2 text-[10.5px]">
                <span className="w-24 truncate font-bold text-slate-600 dark:text-slate-300">{r.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${Math.round((r.value / maxValue) * 100)}%` }} />
                </div>
                <span className="text-[9.5px] font-black text-slate-400 tabular-nums w-10 text-right shrink-0">{formatAggregateValue(r.value, metric)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/40">
        <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">
          {panel.ownerName} · {timeAgo(panel.lastRunAt)}
        </span>
        <div className="flex items-center gap-1">
          {isOwner && (
            <>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={onRun} disabled={isRunning} title="Atualizar">
                <RefreshCw className={`h-3 w-3 ${isRunning ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={onEdit} title="Editar">
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7 hover:text-rose-500" onClick={onDelete} title="Excluir">
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function SquadPanelsPage() {
  const router = useRouter();
  const { firestore, user, isUserLoading } = useFirebase();
  const { userProfile, isInitializing, requestIdentity } = useUserContext();
  const { toast } = useToast();
  const { panels, isLoading, runningIds, fetchPanels, createPanel, updatePanel, deletePanel, runPanel } = useSquadPanelsStore();

  const squadId = userProfile?.squadId || '';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<SquadPanel | null>(null);

  useEffect(() => {
    document.title = 'Meus Painéis | Squad Pulse';
  }, []);

  // Mesmo gate de src/app/squad/page.tsx — dado de painel roda JQL do Jira
  // do squad, não pode nem mostrar a casca sem login.
  useEffect(() => {
    if (!isUserLoading && !user) {
      requestIdentity();
    }
  }, [isUserLoading, user, requestIdentity]);

  useEffect(() => {
    if (firestore && user && squadId && squadId !== 'Sem Time') {
      fetchPanels(firestore, squadId, user.uid);
    }
  }, [firestore, user, squadId, fetchPanels]);

  const handleCreate = async (input: { title: string; jql: string; chartType: SquadPanelChartType; groupBy: SquadPanelGroupBy; aggregateMetric: SquadPanelAggregateMetric; visibility: 'private' | 'squad' }) => {
    if (!firestore || !user || !squadId) return;
    try {
      const id = await createPanel(firestore, squadId, user.uid, userProfile?.name || 'Alguém', input);
      setIsCreateOpen(false);
      toast({ title: 'Painel criado', description: 'Clique em atualizar pra rodar a JQL pela primeira vez.' });
      runPanel(firestore, squadId, id, user.uid).catch(() => {});
    } catch (err: any) {
      toast({ title: 'Erro ao criar painel', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleEditSave = async (input: { title: string; jql: string; chartType: SquadPanelChartType; groupBy: SquadPanelGroupBy; aggregateMetric: SquadPanelAggregateMetric; visibility: 'private' | 'squad' }) => {
    if (!firestore || !squadId || !editingPanel) return;
    try {
      await updatePanel(firestore, squadId, editingPanel.id, input);
      setEditingPanel(null);
      toast({ title: 'Painel atualizado' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleRun = async (panelId: string) => {
    if (!firestore || !user || !squadId) return;
    try {
      await runPanel(firestore, squadId, panelId, user.uid);
    } catch (err: any) {
      toast({ title: 'Erro ao rodar painel', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleDelete = async (panelId: string) => {
    if (!firestore || !squadId) return;
    try {
      await deletePanel(firestore, squadId, panelId);
      toast({ title: 'Painel excluído' });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  if (isUserLoading || !user) {
    return (
      <LoadingScreen
        message="Meus Painéis"
        submessage="Dashboards customizados por JQL do Jira — faça login pra continuar"
      />
    );
  }

  if (isInitializing) {
    return (
      <ToolHubLayout title="Meus Painéis" description="Dashboards customizados por JQL própria." icon={<LayoutDashboard className="h-5 w-5" />} themeColor="indigo" tips={[]} onlyChildren={true}>
        <main className="flex-1 w-full p-4 md:p-5" />
      </ToolHubLayout>
    );
  }

  if (!squadId || squadId === 'Sem Time') {
    return (
      <ToolHubLayout title="Meus Painéis" description="Dashboards customizados por JQL própria." icon={<LayoutDashboard className="h-5 w-5" />} themeColor="indigo" tips={[]} onlyChildren={true}>
        <main className="flex-1 w-full p-4 md:p-5 flex items-center justify-center">
          <div className="max-w-sm text-center bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Sem squad definido</p>
            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Defina seu squad no perfil primeiro.</p>
          </div>
        </main>
      </ToolHubLayout>
    );
  }

  return (
    <ToolHubLayout
      title="Meus Painéis"
      description={`Dashboards customizados — squad ${squadId} — cada um monta a própria JQL e visualização`}
      icon={<LayoutDashboard className="h-5 w-5" />}
      themeColor="indigo"
      tips={[]}
      onlyChildren={true}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-[10px] font-black uppercase tracking-wider" onClick={() => router.push('/squad')}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Squad Pulse
          </Button>
          <Button size="sm" className="h-8 text-[10px] font-black uppercase tracking-wider" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo painel
          </Button>
        </div>
      }
    >
      <main className="flex-1 w-full p-4 md:p-5 overflow-y-auto">
        {isLoading && panels.length === 0 ? (
          <p className="text-[11px] font-medium text-slate-400">Carregando…</p>
        ) : panels.length === 0 ? (
          <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 shadow-sm text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Nenhum painel ainda</p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-4">
              Monte sua própria JQL e escolha como ver o resultado — número, tabela, barras ou pizza.
            </p>
            <Button size="sm" className="h-9 text-[10px] font-black uppercase tracking-wider" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar primeiro painel
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {panels.map(panel => (
              <PanelCard
                key={panel.id}
                panel={panel}
                isOwner={panel.ownerId === user?.uid}
                isRunning={runningIds.has(panel.id)}
                onRun={() => handleRun(panel.id)}
                onEdit={() => setEditingPanel(panel)}
                onDelete={() => handleDelete(panel.id)}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-base">Novo painel</DialogTitle></DialogHeader>
          <PanelForm onSubmit={handleCreate} onCancel={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPanel} onOpenChange={open => !open && setEditingPanel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-base">Editar painel</DialogTitle></DialogHeader>
          {editingPanel && <PanelForm initial={editingPanel} onSubmit={handleEditSave} onCancel={() => setEditingPanel(null)} />}
        </DialogContent>
      </Dialog>
    </ToolHubLayout>
  );
}
