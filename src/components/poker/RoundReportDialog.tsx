"use client";

import { Modal, ModalButton, ROLE_STYLES, roleToneOf } from '@/components/room-kit';
import { CheckCircle2, ClipboardCopy, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Participant, VotingRound } from '@/lib/types';
import { TECHNICAL_CATEGORIES, getParticipantCategory, formatRoleForCopy, formatEstimateCopy } from '@/lib/poker-utils';
import { SEM_CARGO } from '@/lib/cargo';

/** Relatório consolidado de uma rodada (estimativa final, papéis ou faixa, votos). Abre pela fila. */
export function RoundReportDialog({ round, onClose, participants }: { round: VotingRound | null; onClose: () => void; participants: Participant[] }) {
  const { toast } = useToast();
  if (!round) return null;

  const participantMap = new Map((participants || []).map(p => [p.id, p]));

  const handleCopyResults = () => {
    let text = `Relatório: ${round.topic}\nEstimativa Final: ${round.stats.avg}${round.deckType === 'hours' ? 'h' : ''}\n`;

    if (round.deckType === 'hours') {
      const rolePoints = round.rolePoints || {
        'Developer': round.devPoints || '0',
        'QA': round.qaPoints || '0'
      };

      const effortsParts = Object.entries(rolePoints)
        .filter(([_, val]) => val !== '0')
        .map(([role, val]) => `${role}: ${val}h`);

      if (effortsParts.length > 0) {
        text += effortsParts.join('\n') + '\n';
      } else if (round.stats.avg && round.stats.avg !== 'N/A') {
        text += `Esforço Total: ${round.stats.avg}h\n`;
      }
    }

    text += '\nVotos:\n';
    (round.votes || []).forEach((v: any) => {
      const p = participantMap.get(v.participantId);
      if (p) {
        // O cargo por extenso (o da administração); quem ainda não tem cargo aparece como "Sem cargo".
        text += `${p.nickname} (${p.globalRole?.trim() || SEM_CARGO}): ${v.value}\n`;
      }
    });

    navigator.clipboard.writeText(text);
    toast({ title: "Relatório Copiado!", description: "Dados completos da rodada copiados." });
  };

  const handleCopyHoursOnly = () => {
    if (round.deckType !== 'hours') return;

    const rolePoints = round.rolePoints || {
      'Developer': round.devPoints || '0',
      'QA': round.qaPoints || '0'
    };

    // Mesmo formato do "Copiar estimativa" da revelação: (DEV 10h / QA 4h / UX 2h).
    let copyText = formatEstimateCopy(
      Object.entries(rolePoints).map(([role, value]) => ({ role, value: String(value ?? '') })),
      'h',
      { skipZero: true }
    );
    if (!copyText) {
      const total = round.stats.avg !== 'N/A' ? round.stats.avg : '0';
      copyText = `(${total}h)`;
    }

    navigator.clipboard.writeText(copyText);
    toast({ title: "Horas Copiadas!", description: `"${copyText}" pronto para colar.` });
  };

  return (
    <Modal
      open={!!round}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="md"
      tone="success"
      icon={CheckCircle2}
      title={round.topic}
      description="Estimativa consolidada da tarefa"
      footer={
        <>
          {round.deckType === 'hours' && (
            <ModalButton onClick={handleCopyHoursOnly} className="gap-2">
              <ClipboardCopy className="h-4 w-4" strokeWidth={1.5} /> Copiar estimativa
            </ModalButton>
          )}
          <ModalButton variant="primary" onClick={handleCopyResults} className="gap-2">
            <Copy className="h-4 w-4" strokeWidth={1.5} /> Copiar relatório
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-xl bg-primary p-4 text-primary-foreground">
            <span className="text-xs font-semibold opacity-80">Total</span>
            <span className="text-2xl font-bold tabular-nums">{round.stats.avg}{round.deckType === 'hours' ? 'h' : ''}</span>
          </div>
          {round.deckType === 'hours' ? (
            TECHNICAL_CATEGORIES.map(category => {
              const rolePoints: Record<string, string | null | undefined> = round.rolePoints || { 'Developer': round.devPoints, 'QA': round.qaPoints };
              const value = rolePoints[category];
              if (!value || value === '0') return null;
              return (
                <div key={category} className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-4">
                  <span className={cn('text-xs font-bold', ROLE_STYLES[roleToneOf(category)].text)}>{formatRoleForCopy(category)}</span>
                  <span className="text-2xl font-bold tabular-nums">{value}h</span>
                </div>
              );
            })
          ) : (
            <>
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-4">
                <span className="text-xs font-semibold text-muted-foreground">Menor</span>
                <span className="text-xl font-bold tabular-nums">{round.stats.min}</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-4">
                <span className="text-xs font-semibold text-muted-foreground">Maior</span>
                <span className="text-xl font-bold tabular-nums">{round.stats.max}</span>
              </div>
            </>
          )}
        </div>

        <section aria-label="Votos da rodada" className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-foreground">Votos</h3>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {(round.votes || []).map((vote: any) => {
              const p = participantMap.get(vote.participantId);
              const category = p ? getParticipantCategory(p) : null;
              return (
                <li key={vote.participantId} className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-muted/30 px-3 py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold">{p?.nickname || 'Participante'}</span>
                    <span className={cn('truncate text-xs font-bold', ROLE_STYLES[roleToneOf(category)].text)}>
                      {p ? (p.globalRole?.trim() || SEM_CARGO) : (vote.participantGlobalRole?.trim() || SEM_CARGO)}
                    </span>
                  </span>
                  <span className="rounded-md border border-border bg-card px-2 py-0.5 text-sm font-bold tabular-nums">{vote.value}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
