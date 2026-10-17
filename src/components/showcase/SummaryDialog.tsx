'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Clock3, Copy, Download, ExternalLink, Link2, ListChecks, Printer, UserCheck2, XCircle } from 'lucide-react';
import { FOCUS_RING, IconButton, Modal, ModalButton } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { cn } from '@/lib/utils';
import { DECISION, type ShowcaseSession, type ShowcaseTask } from './types';
import { approvalRateOf, buildLinksText, decidedWhen, decisionGroups, efficiencyOf, groupByDecision, participantNames } from './review-export';
import { formatTime } from './utils';

interface SummaryDialogProps {
  open: boolean;
  onClose: () => void;
  tasks: ShowcaseTask[];
  sessionName: string;
  session: ShowcaseSession | null;
  /** Abre a escolha de formato (PDF, log, tabela, impressão). */
  onExport: () => void;
  onPrint: () => void;
}

/**
 * Resumo da Review: números, taxa de aprovação, estimado ÷ gasto, tempo total e as entregas agrupadas por
 * decisão. Abre ao finalizar e pelo menu Mais (qualquer Review); exportar e imprimir ficam no rodapé.
 */
export function SummaryDialog({ open, onClose, tasks, sessionName, session, onExport, onPrint }: SummaryDialogProps) {
  const { toast } = useToast();
  const g = groupByDecision(tasks);
  const approvalRate = approvalRateOf(tasks);
  const efficiency = efficiencyOf(tasks);
  const totalSpent = tasks.reduce((acc, t) => acc + (t.evidence.timeSpent || 0), 0);
  const groups = decisionGroups(tasks);
  const links = buildLinksText(groups);
  const participants = participantNames(session);

  const statBoxes: Array<{ label: string; count: number; icon: React.ElementType; wrap: string; text: string }> = [
    { label: 'Aprovadas', count: g.approved.length, icon: CheckCircle2, wrap: 'border-emerald-500/30 bg-emerald-500/5', text: 'text-emerald-700 dark:text-emerald-300' },
    { label: 'Precisam de ajuste', count: g.adjustments.length, icon: AlertCircle, wrap: 'border-amber-500/30 bg-amber-500/5', text: 'text-amber-700 dark:text-amber-300' },
    { label: 'Rejeitadas', count: g.rejected.length, icon: XCircle, wrap: 'border-red-500/30 bg-red-500/5', text: 'text-red-700 dark:text-red-300' },
    { label: DECISION.open.label, count: g.pending.length, icon: Clock3, wrap: 'border-border bg-muted/30', text: 'text-muted-foreground' },
  ];

  const copyText = async (text: string, title: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast({ title });
    else toast({ title: 'Não foi possível copiar', description: 'Permita o acesso à área de transferência e tente de novo.', variant: 'destructive' });
  };

  // Eficiência = estimado ÷ gasto: acima de 100% a squad gastou menos do que estimou.
  const efficiencyTone = efficiency === null ? 'text-muted-foreground' : efficiency >= 100 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300';

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      size="lg"
      icon={ListChecks}
      title="Resumo da Review"
      description={`${sessionName} · ${tasks.length} ${tasks.length === 1 ? 'entrega' : 'entregas'}`}
      className="sm:max-w-[1000px]"
      footerStart={<ModalButton variant="ghost" onClick={onClose}>Fechar</ModalButton>}
      footer={
        <>
          <ModalButton className="gap-2" onClick={onPrint}>
            <Printer className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> <span className="max-sm:sr-only">Imprimir slides</span>
          </ModalButton>
          <ModalButton variant="primary" className="gap-2" onClick={onExport}>
            <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Exportar
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Participantes: quem estava na sala ao finalizar (o servidor grava); sem a lista, a linha não aparece. */}
        {participants.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Participantes">
            <span className="mr-1 text-xs font-semibold text-muted-foreground">Participantes:</span>
            {participants.map((name) => (
              <span key={name} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{name}</span>
            ))}
          </div>
        )}
        {session?.members && session.members.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-muted-foreground">Squad:</span>
            {session.members.map((m) => (
              <span key={m.id} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{m.name}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {statBoxes.map((st) => (
            <div key={st.label} className={cn('flex items-center gap-3 rounded-2xl border p-4', st.wrap)}>
              <st.icon className={cn('h-5 w-5 shrink-0', st.text)} strokeWidth={1.5} aria-hidden="true" />
              <div className="min-w-0">
                <p className={cn('m-0 text-2xl font-bold leading-none tabular-nums', st.text)}>{st.count}</p>
                <p className="m-0 mt-1 truncate text-xs text-muted-foreground">{st.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="m-0 text-xs font-semibold text-muted-foreground">Taxa de aprovação</p>
            <p className="m-0 mt-2 text-2xl font-bold leading-none tabular-nums">{approvalRate === null ? '—' : `${approvalRate}%`}</p>
            <p className="m-0 mt-1.5 text-xs text-muted-foreground">Sobre as entregas que já foram avaliadas pelo PO.</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="m-0 text-xs font-semibold text-muted-foreground">Estimado ÷ gasto</p>
            <p className={cn('m-0 mt-2 text-2xl font-bold leading-none tabular-nums', efficiencyTone)}>{efficiency === null ? '—' : `${efficiency}%`}</p>
            <p className="m-0 mt-1.5 text-xs text-muted-foreground">
              {efficiency === null ? 'Sem horas lançadas nas entregas.' : efficiency >= 100 ? 'A squad gastou menos horas do que estimou.' : 'A squad gastou mais horas do que estimou.'}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="m-0 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Tempo total gasto</p>
            <p className="m-0 mt-2 text-2xl font-bold leading-none tabular-nums">{formatTime(totalSpent) || '—'}</p>
            <p className="m-0 mt-1.5 text-xs text-muted-foreground">Soma das horas lançadas em todas as entregas.</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 text-sm font-bold">Entregas por decisão</h3>
            {links.count > 0 && (
              <ModalButton className="h-8 gap-1.5 px-3 text-[13px]" onClick={() => copyText(links.text, `${links.count} ${links.count === 1 ? 'link copiado' : 'links copiados'}`)}>
                <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Copiar links das issues
              </ModalButton>
            )}
          </div>
          {groups.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhuma entrega nesta Review.</p>}
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2.5">
              <p className="m-0 text-xs font-bold text-muted-foreground">{group.label} ({group.items.length})</p>
              {group.items.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 px-1.5 text-xs font-bold text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground" title={t.key}>
                        {t.key.split('-').pop()}
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 line-clamp-2 text-sm font-bold" title={t.title}>{t.title}</p>
                        <p className="m-0 truncate text-xs text-muted-foreground">{t.type} · {t.evidence.dev || 'Sem autor'}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {t.url && (
                        <>
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Abrir ${t.key} no Jira`}
                            aria-label={`Abrir ${t.key} no Jira`}
                            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', FOCUS_RING)}
                          >
                            <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                          </a>
                          <IconButton size="sm" label={`Copiar link de ${t.key}`} icon={Copy} onClick={() => copyText(t.url, `Link de ${t.key} copiado`)} className="border-transparent" />
                        </>
                      )}
                      <span className={cn('inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold', DECISION[t.decision].cls)}>{DECISION[t.decision].label}</span>
                    </div>
                  </div>
                  {t.decidedByName && (
                    <p className="m-0 mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserCheck2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                      Decidido por {t.decidedByName}{decidedWhen(t.decidedAt) && ` · ${decidedWhen(t.decidedAt)}`}
                    </p>
                  )}
                  {t.feedback && (
                    <div className="mt-2.5 rounded-xl border border-border bg-background/60 p-3">
                      <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                        <span className="mr-1.5 font-bold text-foreground">Feedback:</span>
                        {t.feedback}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
