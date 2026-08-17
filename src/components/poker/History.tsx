"use client";

import { useMemo } from 'react';
import { VotingRound, Participant, Role, Issue } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-xl">
            <HistoryIcon className="mr-2 h-5 w-5" />
            Histórico de Votação
            </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {(!rounds || rounds.length === 0) ? (
          <div className="text-center text-muted-foreground p-4">
            <p>Nenhuma rodada de votação foi concluída ainda.</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {rounds.map(round => {
              const m = meta.get(round.id);
              const votingLabel = m?.votingMs !== null && m?.votingMs !== undefined ? formatDuration(m.votingMs) : null;
              const topicLabel = m?.topicMs !== null && m?.topicMs !== undefined ? formatDuration(m.topicMs) : null;
              const roleEntries = finalRoleEntries(round);

              return (
              <AccordionItem value={round.id} key={round.id}>
                <AccordionTrigger>
                  <div className="flex flex-col gap-1.5 w-full pr-4 text-left">
                    <div className="flex justify-between items-start gap-4 w-full">
                      <span className="font-semibold truncate">{round.topic}</span>
                      <span
                        className="text-sm text-muted-foreground whitespace-nowrap"
                        title={format(new Date(round.timestamp), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      >
                        {formatDistanceToNow(new Date(round.timestamp), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    {/* Resumo da rodada: o que já era gravado mas ficava só no banco. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {round.skipped ? (
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
                            <UsersIcon className="h-3 w-3" /> {m?.voters ?? round.votes.length} voto{(m?.voters ?? round.votes.length) !== 1 ? 's' : ''}
                          </Badge>
                          {/* Com um votante só não existe consenso nem divergência:
                              o badge mentiria dos dois jeitos. */}
                          {(m?.voters ?? round.votes.length) > 1 && (
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
                </AccordionTrigger>
                <AccordionContent>
                  {round.skipped ? (
                    <div className="flex flex-col gap-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-600 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-400/20">
                          <SkipForward className="h-3 w-3" />
                          Tarefa Pulada / Sem Estimativa
                        </div>
                      </div>
                      {round.note && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">
                          <MessageSquare className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                          <p className="font-medium italic">"{round.note}"</p>
                        </div>
                      )}
                    </div>
                  ) : (
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">{round.deckType === 'tshirt' ? 'Mais Votado' : 'Média'}</p>
                      <p className="text-lg font-bold">{round.stats.avg}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Menor</p>
                      <p className="text-lg font-bold">{round.stats.min}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Maior</p>
                      <p className="text-lg font-bold">{round.stats.max}</p>
                    </div>
                  </div>
                  )}
                  {!round.skipped && (
                  <>
                  {roleEntries.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2">Estimativa final por papel:</h4>
                      <div className="flex flex-wrap gap-2">
                        {roleEntries.map(([role, value]) => (
                          <div key={role} className="flex items-center gap-2 text-sm p-1.5 rounded-md bg-muted/50">
                            <span className="text-muted-foreground">{role === 'Developer' ? 'Dev' : role}</span>
                            <Badge variant="secondary" className="font-bold">{value}h</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {m && m.distribution.length > 1 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2">Distribuição:</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {m.distribution.map(([value, count]) => (
                          <span key={value} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-muted/50 text-muted-foreground">
                            {value} <span className="opacity-60">× {count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Votos individuais:</h4>
                      <div className="flex flex-wrap gap-2">
                        {round.votes.map(vote => {
                          const participant = participantMap.get(vote.participantId);
                          // Metadados persistidos no voto ("votos são fatos"):
                          // sobrevivem à saída do participante da sala.
                          const nickname = participant?.nickname || vote.participantNickname || '...';
                          const roleLabel = vote.participantGlobalRole || participant?.globalRole || null;
                          return (
                            <div key={vote.participantId} className="flex items-center gap-2 text-sm p-1.5 rounded-md bg-muted/50">
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
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleCopyRound(round)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar Estimativas
                      </Button>
                    </div>
                  </div>
                  </>
                  )}
                </AccordionContent>
              </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
