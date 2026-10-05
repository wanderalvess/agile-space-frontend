"use client";

import { useMemo } from 'react';
import { VotingRound, Participant, Role, Issue } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  History as HistoryIcon,
  Copy,
  SkipForward,
  MessageSquare,
  Clock,
  Users as UsersIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface HistoryProps {
  roomId: string;
  rounds: VotingRound[];
  participants: Participant[];
  // Fila da sessão: dá acesso ao `startedAt` do item (quando entrou na mesa),
  // que é o que permite separar "tempo do tópico" de "tempo de votação".
  issues?: Issue[];
}

const CONFIDENCE_LABEL: Record<string, string> = { low: 'baixa', medium: 'média', high: 'alta' };
const CONFIDENCE_CLASS: Record<string, string> = {
  low: 'text-rose-600 dark:text-rose-400',
  medium: 'text-amber-600 dark:text-amber-400',
  high: 'text-emerald-600 dark:text-emerald-400',
};

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

  /** Estimativa final por papel salva na rodada (deck de horas). */
  const finalRoleEntries = (round: VotingRound): Array<[string, string]> => {
    if (round.rolePoints) {
      return Object.entries(round.rolePoints).filter(([, v]) => v && v !== '0');
    }
    const legacy: Array<[string, string]> = [];
    if (round.devPoints && round.devPoints !== '0') legacy.push(['Developer', round.devPoints]);
    if (round.qaPoints && round.qaPoints !== '0') legacy.push(['QA', round.qaPoints]);
    return legacy;
  };

  // Mais recente primeiro: quem abre o histórico quer ver a última rodada, não rolar até ela.
  const orderedRounds = useMemo(
    () => [...(rounds || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [rounds]
  );

  // Cor de status da rodada (barra lateral + selo do resultado).
  const statusOf = (round: VotingRound, voters: number) => {
    if (round.cancelled) return { bar: 'bg-rose-500', tone: 'text-rose-600 dark:text-rose-400', tile: 'bg-rose-500/10' };
    if (round.skipped) return { bar: 'bg-amber-500', tone: 'text-amber-600 dark:text-amber-400', tile: 'bg-amber-500/10' };
    if (voters > 1 && round.stats.consensus) return { bar: 'bg-emerald-500', tone: 'text-emerald-600 dark:text-emerald-400', tile: 'bg-emerald-500/10' };
    if (voters > 1) return { bar: 'bg-rose-400', tone: 'text-slate-900 dark:text-white', tile: 'bg-slate-100 dark:bg-slate-900' };
    return { bar: 'bg-indigo-400', tone: 'text-slate-900 dark:text-white', tile: 'bg-slate-100 dark:bg-slate-900' };
  };

  return (
    <section className="space-y-3" aria-label="Histórico de votação">
      <div className="flex items-center gap-2.5 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <HistoryIcon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Histórico da sessão</h3>
        {rounds && rounds.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black tabular-nums text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            {rounds.length} rodada{rounds.length !== 1 ? 's' : ''}
          </span>
        )}
        <span className="h-px flex-1 bg-slate-100 dark:bg-border/40" />
      </div>

      {(!rounds || rounds.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs font-medium text-muted-foreground dark:border-border">
          Nenhuma rodada de votação foi concluída ainda.
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-2">
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
              className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 px-5 shadow-sm backdrop-blur transition-shadow hover:shadow-md dark:border-border/60 dark:bg-card/70"
            >
              <span className={cn('absolute bottom-0 left-0 top-0 w-1.5', st.bar)} aria-hidden />
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="flex w-full items-center gap-4 pr-3 text-left">
                  <div className={cn('flex h-12 min-w-[3.25rem] shrink-0 items-center justify-center rounded-xl px-2', st.tile)}>
                    {round.cancelled ? (
                      <Ban className="h-5 w-5 text-rose-500" />
                    ) : round.skipped ? (
                      <SkipForward className="h-5 w-5 text-amber-500" />
                    ) : (
                      <span className={cn('text-xl font-black italic leading-none tracking-tighter', st.tone)}>
                        {round.stats.avg}{unit}
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-4">
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-white">{round.topic}</span>
                      <span
                        className="whitespace-nowrap text-[11px] font-medium text-muted-foreground"
                        title={format(new Date(round.timestamp), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      >
                        {formatDistanceToNow(new Date(round.timestamp), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    {/* Resumo da rodada: o que já era gravado mas ficava só no banco. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {round.cancelled ? (
                        <Badge variant="outline" className="gap-1 text-[10px] font-bold border-rose-400/40 text-rose-600 dark:text-rose-400">
                          <Ban className="h-3 w-3" /> cancelada
                        </Badge>
                      ) : round.skipped ? (
                        <Badge variant="outline" className="gap-1 text-[10px] font-bold border-amber-400/40 text-amber-600 dark:text-amber-400">
                          <SkipForward className="h-3 w-3" /> pulada
                        </Badge>
                      ) : (
                        <>
                          {votingLabel && (
                            <Badge variant="outline" className="gap-1 text-[10px] font-bold border-indigo-400/40 text-indigo-600 dark:text-indigo-400">
                              <Clock className="h-3 w-3" /> {votingLabel} votando
                            </Badge>
                          )}
                          {topicLabel && (
                            <Badge variant="outline" className="gap-1 text-[10px] font-bold border-slate-300 dark:border-border text-muted-foreground">
                              <Clock className="h-3 w-3" /> {topicLabel} no tópico
                            </Badge>
                          )}
                          <Badge variant="outline" className="gap-1 text-[10px] font-bold border-slate-300 dark:border-border text-muted-foreground">
                            <UsersIcon className="h-3 w-3" /> {voters} voto{voters !== 1 ? 's' : ''}
                          </Badge>
                          {/* Com um votante só não existe consenso nem divergência:
                              o badge mentiria dos dois jeitos. */}
                          {voters > 1 && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "gap-1 text-[10px] font-bold",
                                round.stats.consensus
                                  ? "border-emerald-400/40 text-emerald-600 dark:text-emerald-400"
                                  : "border-rose-400/40 text-rose-600 dark:text-rose-400"
                              )}
                            >
                              {round.stats.consensus ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                              {round.stats.consensus ? 'consenso' : 'divergência'}
                            </Badge>
                          )}
                        </>
                      )}
                      {m && m.roundTotal > 1 && (
                        <Badge variant="outline" className="gap-1 text-[10px] font-bold border-violet-400/40 text-violet-600 dark:text-violet-400">
                          <RotateCw className="h-3 w-3" /> rodada {m.roundNumber} de {m.roundTotal}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                {round.cancelled ? (
                  <div className="flex flex-col gap-3 py-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-rose-600">
                        <Ban className="h-3 w-3" />
                        Tarefa cancelada no refinamento
                      </div>
                    </div>
                    {round.note && (
                      <div className="flex items-start gap-2 rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                        <p className="font-medium italic">"{round.note}"</p>
                      </div>
                    )}
                  </div>
                ) : round.skipped ? (
                  <div className="flex flex-col gap-3 py-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-amber-600">
                        <SkipForward className="h-3 w-3" />
                        Tarefa pulada / sem estimativa
                      </div>
                    </div>
                    {round.note && (
                      <div className="flex items-start gap-2 rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <p className="font-medium italic">"{round.note}"</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { l: round.deckType === 'tshirt' ? 'Mais votado' : 'Média', v: round.stats.avg, strong: true },
                        { l: 'Menor', v: round.stats.min },
                        { l: 'Maior', v: round.stats.max },
                      ].map(t => (
                        <div key={t.l} className={cn('rounded-xl border p-2.5 text-center', t.strong ? 'border-indigo-200/70 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20' : 'border-slate-100 bg-slate-50/70 dark:border-border/40 dark:bg-slate-900/40')}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t.l}</p>
                          <p className={cn('mt-0.5 text-xl font-black italic tracking-tighter', t.strong ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100')}>{t.v}</p>
                        </div>
                      ))}
                    </div>

                    {roleEntries.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimativa final por papel</h4>
                        <div className="flex flex-wrap gap-2">
                          {roleEntries.map(([role, value]) => (
                            <div key={role} className="flex items-center gap-2 rounded-lg bg-muted/50 p-1.5 text-sm">
                              <span className="text-muted-foreground">{role === 'Developer' ? 'Dev' : role}</span>
                              <Badge variant="secondary" className="font-bold">{value}h</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {m && m.distribution.length > 1 && (
                      <div>
                        <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Distribuição</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {m.distribution.map(([value, count]) => (
                            <span key={value} className="rounded-lg bg-muted/50 px-2 py-1 text-[11px] font-bold text-muted-foreground">
                              {value} <span className="opacity-60">× {count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />
                    <div>
                      <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Votos individuais</h4>
                      <div className="flex flex-wrap gap-2">
                        {round.votes.map(vote => {
                          const participant = participantMap.get(vote.participantId);
                          // Metadados persistidos no voto ("votos são fatos"):
                          // sobrevivem à saída do participante da sala.
                          const nickname = participant?.nickname || vote.participantNickname || '...';
                          const roleLabel = vote.participantGlobalRole || participant?.globalRole || null;
                          return (
                            <div key={vote.participantId} className="flex items-center gap-2 rounded-lg bg-muted/50 p-1.5 text-sm">
                              <div className="flex flex-col leading-tight">
                                <span>{nickname}</span>
                                {roleLabel && (
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">{roleLabel}</span>
                                )}
                              </div>
                              <Badge variant="secondary" className="font-bold">{vote.value}</Badge>
                              {vote.confidence && (
                                <span
                                  className={cn("text-[9px] font-black uppercase tracking-widest", CONFIDENCE_CLASS[vote.confidence])}
                                  title="Confiança declarada no voto"
                                >
                                  {CONFIDENCE_LABEL[vote.confidence]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleCopyRound(round)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Copiar estimativas
                      </Button>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </section>
  );
}
