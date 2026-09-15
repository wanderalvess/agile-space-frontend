'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, PauseCircle, AlertTriangle, Copy, ExternalLink, Radar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSquadDashboardData } from '@/hooks/useSquadDashboardData';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { buildDailyRadar, getLatestSyncedAt, RadarItem } from '@/lib/dailyRadar';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function groupByAssignee(items: RadarItem[]): Map<string, RadarItem[]> {
  const map = new Map<string, RadarItem[]>();
  items.forEach((item) => {
    const list = map.get(item.assigneeName) || [];
    list.push(item);
    map.set(item.assigneeName, list);
  });
  return map;
}

function RadarSection({
  title,
  icon,
  accent,
  items,
  emptyLabel,
  jiraBrowseUrl,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  items: RadarItem[];
  emptyLabel: string;
  jiraBrowseUrl: (key: string) => string | null;
}) {
  const grouped = useMemo(() => groupByAssignee(items), [items]);

  return (
    <div className="flex-1 min-w-0 bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm">
      <div className={`flex items-center gap-1.5 mb-3 ${accent}`}>
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
        <span className="text-[9px] font-bold text-slate-400">({items.length})</span>
      </div>

      {items.length === 0 ? (
        <p className="text-[10px] text-slate-400 font-medium py-4 text-center">{emptyLabel}</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar pr-1">
          {Array.from(grouped.entries()).map(([assignee, group]) => (
            <div key={assignee}>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">{assignee}</p>
              <div className="space-y-1">
                {group.map((item) => {
                  const url = jiraBrowseUrl(item.key);
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between gap-2 text-[11px] rounded-lg px-2 py-1.5 ${
                        item.overdue ? 'bg-rose-50 dark:bg-rose-950/20' : 'bg-slate-50/70 dark:bg-slate-800/30'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-code font-bold text-primary mr-1.5">{item.key}</span>
                        <span className="text-slate-600 dark:text-slate-300 truncate">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`font-black text-[9px] uppercase ${
                            item.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {item.detail}
                        </span>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no Jira"
                            aria-label={`Abrir ${item.key} no Jira`}
                          >
                            <ExternalLink className="h-3 w-3 text-slate-300 hover:text-primary transition-colors" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DailyRadar({ squadJiraDomain }: { squadJiraDomain?: string }) {
  const { toast } = useToast();
  const { issues, loading, sprintName } = useSquadDashboardData();
  const { settings: jiraSettings } = useJiraSettings();
  const [manualNote, setManualNote] = useState('');

  const radar = useMemo(() => buildDailyRadar(issues), [issues]);
  const latestSyncedAt = useMemo(() => getLatestSyncedAt(issues), [issues]);

  // Domínio do SQUAD primeiro — o Radar é visão coletiva, então o link tem
  // que funcionar pra qualquer membro, mesmo quem nunca configurou Jira
  // pessoal. Domínio pessoal só como fallback (squad sem domínio salvo).
  const domain = squadJiraDomain || jiraSettings?.domain;
  const jiraBrowseUrl = (key: string): string | null => {
    if (!domain) return null;
    return `https://${domain}/browse/${key}`;
  };

  const hasAnyPoint = radar.completedRecently.length > 0 || radar.stale.length > 0 || radar.dueSoon.length > 0;

  const handleCopyPauta = () => {
    const lines: string[] = [`*Radar da Daily — ${sprintName}*`, ''];

    if (radar.completedRecently.length > 0) {
      lines.push('*✅ Concluído desde ontem*');
      radar.completedRecently.forEach((i) => lines.push(`- [${i.key}] ${i.title} (${i.assigneeName})`));
      lines.push('');
    }
    if (radar.stale.length > 0) {
      lines.push('*⏸️ Parado*');
      radar.stale.forEach((i) => lines.push(`- [${i.key}] ${i.title} (${i.assigneeName}) — ${i.detail}`));
      lines.push('');
    }
    if (radar.dueSoon.length > 0) {
      lines.push('*⏰ Prazo perto/estourado*');
      radar.dueSoon.forEach((i) => lines.push(`- [${i.key}] ${i.title} (${i.assigneeName}) — ${i.detail}`));
    }
    if (!hasAnyPoint) lines.push('Nenhum ponto de atenção — sprint tranquila.');
    if (manualNote.trim()) {
      lines.push('', '*📝 Observações manuais*', manualNote.trim());
    }

    navigator.clipboard.writeText(lines.join('\n'));
    toast({ title: 'Pauta copiada!', description: 'Pronta pra colar no Slack/Teams antes da daily.' });
  };

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl">
        <AgileSpinner size="md" variant="indigo" />
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600">
            <Radar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Radar da Daily
            </h3>
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 flex-wrap">
              <span>Pontos gerados automático da sprint — sem preencher nada</span>
              {latestSyncedAt && (
                <span className="flex items-center gap-0.5 text-slate-400">
                  <span className="opacity-50">•</span>
                  <Clock className="h-2.5 w-2.5" />
                  sync {formatDistanceToNow(parseISO(latestSyncedAt), { locale: ptBR, addSuffix: true })}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          onClick={handleCopyPauta}
          variant="outline"
          size="sm"
          className="h-8 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest gap-1.5 border-slate-200"
        >
          <Copy className="h-3 w-3" /> Copiar Pauta
        </Button>
      </div>

      {!hasAnyPoint ? (
        <div className="py-6 text-center">
          <p className="text-xs font-bold text-slate-400">Nenhum ponto de atenção — sprint tranquila.</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          <RadarSection
            title="Concluído desde ontem"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            accent="text-emerald-600 dark:text-emerald-400"
            items={radar.completedRecently}
            emptyLabel="Nada concluído desde ontem"
            jiraBrowseUrl={jiraBrowseUrl}
          />
          <RadarSection
            title="Parado"
            icon={<PauseCircle className="h-3.5 w-3.5" />}
            accent="text-amber-600 dark:text-amber-400"
            items={radar.stale}
            emptyLabel="Nenhum ticket parado"
            jiraBrowseUrl={jiraBrowseUrl}
          />
          <RadarSection
            title="Prazo perto"
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            accent="text-rose-600 dark:text-rose-400"
            items={radar.dueSoon}
            emptyLabel="Nenhum prazo próximo"
            jiraBrowseUrl={jiraBrowseUrl}
          />
        </div>
      )}

      <div className="pt-1 border-t border-slate-100 dark:border-slate-800/50">
        <Textarea
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          placeholder="Algo fora do Jira pra levar na daily? (opcional — entra junto na pauta copiada)"
          className="mt-3 bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800/60 rounded-xl min-h-[48px] text-[10px] font-medium resize-none p-2.5"
        />
      </div>
    </div>
  );
}
