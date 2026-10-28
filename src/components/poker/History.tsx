"use client";

import { useMemo, useState } from 'react';
import { VotingRound, Participant, Role, Issue } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Copy,
  SkipForward,
  MessageSquare,
  Clock,
  Users as UsersIcon,
  CheckCircle2,
  AlertTriangle,
  Ban,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatEstimateCopy, formatRoleForCopy } from '@/lib/poker-utils';
import { PersonAvatar, RoleChip, StatusChip } from '@/components/room-kit';
import { issueToDetail } from '@/lib/poker-issue-detail';
import { IssueDetail } from './IssueDetail';

interface HistoryProps {
  roomId: string;
  rounds: VotingRound[];
  participants: Participant[];
  // Fila da sessão: dá acesso ao `startedAt` do item (quando entrou na mesa),
  // que é o que permite separar "tempo do tópico" de "tempo de votação".
  issues?: Issue[];
}

const CONFIDENCE_LABEL: Record<string, string> = { low: 'baixa', medium: 'média', high: 'alta' };

/** Estimativa final por papel salva na rodada (deck de horas). */
function finalRoleEntries(round: VotingRound): Array<[string, string]> {
  if (round.rolePoints) {
    return Object.entries(round.rolePoints).filter(([, v]) => v && v !== '0');
  }
  const legacy: Array<[string, string]> = [];
  if (round.devPoints && round.devPoints !== '0') legacy.push(['Developer', round.devPoints]);
  if (round.qaPoints && round.qaPoints !== '0') legacy.push(['QA', round.qaPoints]);
  return legacy;
}

/** "4 min" / "45s" — rodada curta em segundos evita um monte de "0 min". */
function formatDuration(ms: number) {
  if (!isFinite(ms) || ms < 0) return null;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rest = secs % 60;
  return rest >= 30 ? `${mins}min ${rest}s` : `${mins}min`;
}

export function History({ roomId, rounds, participants, issues }: HistoryProps) {
  const { toast } = useToast();
  const participantMap = new Map(participants.map(p => [p.id, p]));
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  // A tarefa da rodada na fila da sessão (pelo id; rodadas antigas só guardam o título).
  const issueOfRound = (round: VotingRound) =>
    issues?.find(i => i.id === round.issueId) ?? issues?.find(i => i.title === round.topic);

  /**
   * Métricas por rodada que já estavam gravadas e nunca apareciam: duração da
   * votação, número da rodada dentro do tópico (revotações), participação,
   * consenso e distribuição dos votos.
   */
  const meta = useMemo(() => {
    const ordered = [...(rounds || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const seen = new Map<string, number>();
    const totals = new Map<string, number>();
    ordered.forEach(r => {
      const key = r.issueId || r.topic;
      totals.set(key, (totals.get(key) || 0) + 1);
    });

    const byId = new Map<string, {
      roundNumber: number;
      roundTotal: number;
      votingMs: number | null;
      topicMs: number | null;
      distribution: Array<[string, number]>;
      voters: number;
    }>();

    ordered.forEach(r => {
      const key = r.issueId || r.topic;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);

      const end = new Date(r.timestamp).getTime();
      const voteTimes = (r.votes || [])
        .map(v => new Date(v.timestamp).getTime())
        .filter(t => !isNaN(t));
      const firstVote = voteTimes.length ? Math.min(...voteTimes) : null;

      // Tempo do tópico só na PRIMEIRA rodada: nas revotações o `startedAt`
      // continua sendo a entrada na mesa, então repetir o número daria a
      // impressão de que cada rodada durou a sessão inteira.
      const issue = issues?.find(i => i.id === r.issueId);
      const startedAt = n === 1 && issue?.startedAt ? new Date(issue.startedAt).getTime() : NaN;

      const counts = new Map<string, number>();
      (r.votes || []).forEach(v => counts.set(v.value, (counts.get(v.value) || 0) + 1));

      byId.set(r.id, {
        roundNumber: n,
        roundTotal: totals.get(key) || 1,
        votingMs: firstVote !== null ? end - firstVote : null,
        topicMs: !isNaN(startedAt) ? end - startedAt : null,
        distribution: [...counts.entries()].sort((a, b) => b[1] - a[1]),
        voters: (r.votes || []).length,
      });
    });

    return byId;
  }, [rounds, issues]);

  const handleCopyRound = (round: VotingRound) => {
    // Com horas finais por papel salvas, copia no formato padrão da issue pai: (DEV 10h / QA 4h).
    if (round.deckType === 'hours') {
      const final = finalRoleEntries(round);
      const text = formatEstimateCopy(final.map(([role, value]) => ({ role, value })), 'h');
      if (text) {
        navigator.clipboard.writeText(text);
        toast({ title: 'Estimativa copiada', description: text });
        return;
      }
    }
    const votesByRole: { [key in Role]?: string[] } = {};

    round.votes.forEach(vote => {
      const participant = participantMap.get(vote.participantId);
      if (participant && participant.role !== 'spectator') {
        if (!votesByRole[participant.role]) {
          votesByRole[participant.role] = [];
        }
        votesByRole[participant.role]!.push(vote.value);
      }
    });

    const roleLabels: Record<Role, string> = {
      dev: 'Dev',
      qa: 'Q.A',
      organizador: 'Organizador',
      spectator: 'Espectador',
    };

    const roleOrder: Role[] = ['dev', 'qa', 'organizador'];

    const copyTextLines = roleOrder.map(role => {
      const votes = votesByRole[role];
      if (!votes || votes.length === 0) return null;

      const label = roleLabels[role];
      let resultValue: string | null = null;
      let suffix = '';

      if (round.deckType === 'tshirt') {
        if (votes.length > 0) {
            const voteCounts = votes.reduce((acc, value) => {
                acc[value] = (acc[value] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            resultValue = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
        }
      } else { // fibonacci or hours
        const numericVotes = votes.filter(v => !isNaN(Number(v))).map(Number);

        if (numericVotes.length > 0) {
          const sum = numericVotes.reduce((acc, val) => acc + val, 0);
          resultValue = String(Math.ceil(sum / numericVotes.length));
          if (round.deckType === 'hours') {
            suffix = 'h';
          }
        }
      }

      if (resultValue) {
        return `${label} ${resultValue}${suffix}`;
      }
      return null;

    }).filter((line): line is string => line !== null);


    if (copyTextLines.length > 0) {
      const copyText = copyTextLines.join('\n');
      navigator.clipboard.writeText(copyText);
      toast({
        title: 'Estimativas copiadas!',
        description: 'As estimativas por função foram copiadas para a área de transferência.',
      });
    } else {
      toast({
        title: 'Nada para copiar',
        description: 'Não há votos para copiar nesta rodada.',
        variant: "destructive",
      });
    }
  };

  // Mais recente primeiro: quem abre o histórico quer ver a última rodada, não rolar até ela.
  const orderedRounds = useMemo(
    () => [...(rounds || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [rounds]
  );

  // Cor de status da rodada (barra lateral e cor do resultado).
  const statusOf = (round: VotingRound, voters: number) => {
    if (round.cancelled) return { bar: 'bg-red-500', tone: 'text-red-700 dark:text-red-300' };
    if (round.skipped) return { bar: 'bg-amber-500', tone: 'text-amber-700 dark:text-amber-300' };
    if (voters > 1 && round.stats.consensus) return { bar: 'bg-emerald-500', tone: 'text-emerald-700 dark:text-emerald-300' };
    if (voters > 1) return { bar: 'bg-red-400', tone: 'text-foreground' };
    return { bar: 'bg-primary', tone: 'text-foreground' };
  };


  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Histórico de votação">
      {(!rounds || rounds.length === 0) ? (
        <div className="m-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma rodada concluída ainda.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <Accordion type="single" collapsible className="flex w-full flex-col gap-2">
            {orderedRounds.map(round => {
              const m = meta.get(round.id);
              const voters = m?.voters ?? round.votes.length;
              const votingLabel = m?.votingMs !== null && m?.votingMs !== undefined ? formatDuration(m.votingMs) : null;
              const topicLabel = m?.topicMs !== null && m?.topicMs !== undefined ? formatDuration(m.topicMs) : null;
              const roleEntries = finalRoleEntries(round);
              const st = statusOf(round, voters);
              const unit = round.deckType === 'hours' && !isNaN(Number(round.stats.avg)) ? 'h' : '';

              return (
                <AccordionItem
                  value={round.id}
                  key={round.id}
                  className="relative overflow-hidden rounded-xl border border-border bg-muted/30 transition-colors duration-base data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5"
                >
                  <span className={cn('absolute bottom-0 left-0 top-0 w-1', st.bar)} aria-hidden="true" />
                  <AccordionTrigger className="px-4 py-3 text-left hover:no-underline">
                    <div className="flex w-full min-w-0 items-center gap-3 pr-2">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[13px] font-semibold">{round.topic}</span>
                        <span
                          className="text-xs font-normal text-muted-foreground"
                          title={format(new Date(round.timestamp), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        >
                          {formatDistanceToNow(new Date(round.timestamp), { addSuffix: true, locale: ptBR })}
                          {m && m.roundTotal > 1 ? ` · rodada ${m.roundNumber} de ${m.roundTotal}` : ''}
                        </span>
                      </span>
                      {round.cancelled ? (
                        <Ban className="h-4 w-4 shrink-0 text-red-600 dark:text-red-300" strokeWidth={1.5} aria-label="Cancelada" />
                      ) : round.skipped ? (
                        <SkipForward className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" strokeWidth={1.5} aria-label="Pulada" />
                      ) : (
                        <span className={cn('whitespace-nowrap text-[13px] font-bold tabular-nums', st.tone)}>{round.stats.avg}{unit}</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {round.cancelled || round.skipped ? (
                      <div className="flex flex-col gap-2.5">
                        <StatusChip tone={round.cancelled ? 'danger' : 'warn'} className="self-start">
                          {round.cancelled ? 'Cancelada no refinamento' : 'Pulada, sem estimativa'}
                        </StatusChip>
                        {round.note && (
                          <p className="m-0 flex items-start gap-2 rounded-[10px] bg-muted/50 p-3 text-sm text-muted-foreground">
                            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                            “{round.note}”
                          </p>
                        )}
                        {issueOfRound(round) && (
                          <Button variant="outline" size="sm" onClick={() => setDetailIssue(issueOfRound(round)!)} className="h-9 gap-2 self-start rounded-lg text-[13px]">
                            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} /> Ver detalhes
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {votingLabel && <StatusChip tone="neutral"><Clock className="h-3 w-3" strokeWidth={1.5} /> {votingLabel} votando</StatusChip>}
                          {topicLabel && <StatusChip tone="neutral"><Clock className="h-3 w-3" strokeWidth={1.5} /> {topicLabel} no tópico</StatusChip>}
                          <StatusChip tone="neutral"><UsersIcon className="h-3 w-3" strokeWidth={1.5} /> {voters} voto{voters !== 1 ? 's' : ''}</StatusChip>
                          {/* Com um votante só não existe consenso nem divergência: o selo mentiria dos dois jeitos. */}
                          {voters > 1 && (
                            <StatusChip tone={round.stats.consensus ? 'success' : 'danger'}>
                              {round.stats.consensus ? <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} /> : <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />}
                              {round.stats.consensus ? 'consenso' : 'divergência'}
                            </StatusChip>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { l: round.deckType === 'tshirt' ? 'Mais votado' : 'Média', v: round.stats.avg },
                            { l: 'Menor', v: round.stats.min },
                            { l: 'Maior', v: round.stats.max },
                          ].map(t => (
                            <div key={t.l} className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-2">
                              <span className="text-xs text-muted-foreground">{t.l}</span>
                              <span className="text-sm font-bold tabular-nums">{t.v}</span>
                            </div>
                          ))}
                        </div>

                        {roleEntries.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <h4 className="m-0 text-xs font-bold text-muted-foreground">Estimativa final por papel</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {roleEntries.map(([role, value]) => (
                                <RoleChip key={role} category={role} label={`${formatRoleForCopy(role)} ${value}h`} className="h-[26px] px-2.5 text-[13px]" />
                              ))}
                            </div>
                          </div>
                        )}

                        {m && m.distribution.length > 1 && (
                          <div className="flex flex-col gap-1.5">
                            <h4 className="m-0 text-xs font-bold text-muted-foreground">Distribuição</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {m.distribution.map(([value, count]) => (
                                <span key={value} className="rounded-md bg-card px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground ring-1 ring-inset ring-border">
                                  {value} <span className="opacity-60">× {count}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                          <h4 className="m-0 text-xs font-bold text-muted-foreground">Votos individuais</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {round.votes.map(vote => {
                              const participant = participantMap.get(vote.participantId);
                              // Metadados persistidos no voto ("votos são fatos"): sobrevivem à saída da sala.
                              const nickname = participant?.nickname || vote.participantNickname || '…';
                              return (
                                <span
                                  key={vote.participantId}
                                  title={vote.confidence ? `Confiança ${CONFIDENCE_LABEL[vote.confidence]}` : undefined}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-card pl-1 pr-2 text-xs ring-1 ring-inset ring-border"
                                >
                                  <PersonAvatar name={nickname} userId={vote.participantId} size="sm" />
                                  <strong className="tabular-nums">{vote.value}</strong>
                                  {vote.confidence && (
                                    <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', vote.confidence === 'high' ? 'bg-emerald-500' : vote.confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500')} />
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleCopyRound(round)} className="h-9 gap-2 rounded-lg text-[13px]">
                            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} /> Copiar estimativa
                          </Button>
                          {issueOfRound(round) && (
                            <Button variant="outline" size="sm" onClick={() => setDetailIssue(issueOfRound(round)!)} className="h-9 gap-2 rounded-lg text-[13px]">
                              <FileText className="h-3.5 w-3.5" strokeWidth={1.5} /> Ver detalhes
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}
      <IssueDetail
        issue={detailIssue ? issueToDetail(detailIssue) : null}
        isOpen={!!detailIssue}
        onClose={() => setDetailIssue(null)}
      />
    </section>
  );
}
