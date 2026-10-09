
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { DECKS, DeckType, Participant, Role } from '@/lib/types';
import { canParticipantVote, getParticipantCategory } from '@/lib/poker-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Pencil, Check, Sparkles, Quote, Eye, EyeOff, Coffee, Keyboard, Lock } from 'lucide-react';

/** `?` (indefinido) e `☕` (pausa) não são estimativas — recebem tratamento à parte. */
const isSpecialCard = (v: string) => v === '?' || v === '☕';

/**
 * Carta do baralho com cara de carta de baralho real: valor grande no centro e
 * "pips" nos cantos (superior-esquerdo e inferior-direito invertido). Numéricas
 * levantam e giram no hover; a selecionada sobe e ganha destaque. As especiais
 * (? / ☕) usam cor própria (violeta / âmbar) e dispensam os pips.
 */
function DeckCard({
  value,
  selected,
  onSelect,
  disabled = false,
  dense = false,
}: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  // Baralhos grandes (ex.: Horas, 22 cartas): cartas menores para tudo caber sem rolar.
  dense?: boolean;
}) {
  const special = isSpecialCard(value);
  const isCoffee = value === '☕';
  const isUnknown = value === '?';

  const showPips = !isCoffee && !dense;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={isCoffee ? 'Pausa para o café' : isUnknown ? 'Não sei estimar' : `Votar ${value}`}
      className={cn(
        'group/card relative shrink-0 overflow-hidden rounded-xl sm:rounded-2xl border-2',
        dense ? 'h-14 w-[2.6rem] sm:h-[4.5rem] sm:w-14' : 'h-16 w-[3.1rem] sm:h-24 sm:w-[4.5rem]',
        'flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] select-none uppercase',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        disabled && 'pointer-events-none opacity-10 grayscale',
        selected
          ? 'bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 border-white/30 text-white shadow-xl shadow-indigo-600/45 ring-4 ring-indigo-500/20 scale-110 -translate-y-5 z-10'
          : special
            ? isCoffee
              ? 'bg-gradient-to-b from-white to-amber-50 dark:from-card dark:to-amber-950/20 border-amber-200/90 dark:border-amber-900/40 text-amber-600 dark:text-amber-500 shadow-sm hover:-translate-y-4 hover:scale-105 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/20 z-0'
              : 'bg-gradient-to-b from-white to-violet-50 dark:from-card dark:to-violet-950/20 border-violet-200/90 dark:border-violet-900/40 text-violet-600 dark:text-violet-400 shadow-sm hover:-translate-y-4 hover:scale-105 hover:border-violet-400 hover:shadow-xl hover:shadow-violet-500/20 z-0'
            : 'bg-gradient-to-b from-white to-slate-50 dark:from-card dark:to-slate-900/60 border-slate-200/80 dark:border-border text-slate-800 dark:text-foreground shadow-sm hover:-translate-y-4 hover:scale-105 hover:rotate-2 hover:border-indigo-400 dark:hover:border-indigo-400/60 hover:text-indigo-600 dark:hover:text-indigo-300 hover:shadow-xl hover:shadow-indigo-500/25 z-0'
      )}
    >
      {showPips && (
        <>
          <span className="pointer-events-none absolute left-1.5 top-1 hidden text-[9px] font-black leading-none opacity-50 sm:block">{value}</span>
          <span className="pointer-events-none absolute bottom-1 right-1.5 hidden rotate-180 text-[9px] font-black leading-none opacity-50 sm:block">{value}</span>
        </>
      )}
      {selected && (
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 opacity-70" />
      )}
      {isCoffee ? (
        <Coffee className="h-6 w-6 sm:h-8 sm:w-8" />
      ) : (
        <span className={cn('font-black italic leading-none tracking-tighter drop-shadow-sm', isUnknown ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-3xl')}>
          {value}
        </span>
      )}
    </button>
  );
}

interface ControlsProps {
  deck: DeckType;
  onVote: (vote: string) => void;
  currentUserVote: string | null;
  votesRevealed: boolean;
  currentUser: Participant;
  allowManagementToVote?: boolean;
  selectiveRevotingRole?: string | null;
  isTheaterMode?: boolean;
  // Sessão ainda não iniciada pelo facilitador: o baralho fica bloqueado.
  // Sem isso dava pra votar antes do "Iniciar Refinamento", e o voto ficava
  // fora da conta de tempo (que só começa no clique).
  isSessionNotStarted?: boolean;
  confidenceEnabled?: boolean;
  onSetConfidence?: (confidence: 'low' | 'medium' | 'high') => void;
  currentUserConfidence?: 'low' | 'medium' | 'high' | null;
  // Facilitador de gestão: atalho para liberar o próprio voto (e o da gestão) sem abrir as configurações.
  onAllowManagementVote?: () => void;
}

export const POKER_PHRASES = {
  geral: [
    "Qualidade não é evento, é hábito (tipo café ☕).",
    "Feito é melhor que perfeito… mas dá pra caprichar né.",
    "Se complicou demais, provavelmente tem um jeito mais simples.",
    "Código simples hoje, menos dor de cabeça amanhã.",
    "Gente alinhada resolve mais que ferramenta cara.",
    "Mudou o requisito? Ok… faz parte do jogo.",
    "Software funcionando vale mais que mil apresentações.",
    "Se não precisa existir, melhor ainda.",
    "Feedback rápido evita desastre lento.",
    "Menos código, menos bug. Simples assim.",
    "Sem comunicação, vira adivinhação.",
    "Estimativa é aproximação, não promessa.",
    "Deploy tranquilo é deploy com plano B.",
    "Enquanto isso… confia no time e toma uma água 💧",
    "Se tudo é prioridade… nada é."
  ],
  dev: [
    "Se compilou de primeira… algo tá errado 🤨",
    "Na minha máquina tava perfeito.",
    "Isso aqui era só um ajuste rápido… juro.",
    "Só mais um console.log e eu descubro.",
    "Funciona… mas não me pergunta como.",
    "Um SQL bem feito resolve mais que mil ifs.",
    "TODO: resolver isso depois (nunca mais visto).",
    "Refatorar? Agora não… tá funcionando 😅",
    "Se quebrou, foi depois do meu commit.",
    "Testar em produção é ousadia ou desespero?",
    "Funcionou? Comita antes que pare."
  ],
  qa: [
    "Achei um bug sem nem clicar 👀",
    "Caminho feliz é só o começo…",
    "Se o usuário consegue, ele vai quebrar.",
    "Testado? Ou só acreditou?",
    "Funciona… até eu testar direito 😏",
    "Isso aqui passou em teste mesmo?",
    "Automação rodando, QA observando.",
    "Se não tá documentado, alguém vai usar errado.",
    "Bug pequeno também é bug.",
    "Relaxa, é só mais um cenário de teste.",
    "Deploy tranquilo… até o QA entrar."
  ],
  po: [
    "Se tudo é prioridade, nada é prioridade.",
    "O backlog chora, mas o negócio agradece.",
    "Qual é o valor de negócio disso mesmo?",
    "Mais uma feature, menos um espaço na tela."
  ],
  agile: [
    "Timebox é sagrado, pessoal ⏱️.",
    "Sem impedimentos hoje? Certeza?",
    "A retrospectiva vai ser animada depois dessa sprint...",
    "Facilitando o caos, um post-it de cada vez."
  ],
  design: [
    "Esse botão está 2 pixels desalinhado.",
    "Espaço em branco é o seu melhor amigo.",
    "A interface é como uma piada: se precisa explicar, não é boa."
  ]
};

export function Controls({
  deck,
  onVote,
  currentUserVote,
  votesRevealed,
  currentUser,
  allowManagementToVote = false,
  selectiveRevotingRole = null,
  isTheaterMode = false,
  isSessionNotStarted = false,
  confidenceEnabled = false,
  onSetConfidence,
  onAllowManagementVote,
  currentUserConfidence = null,
}: ControlsProps) {
  const deckValues = DECKS[deck];
  const isDenseDeck = deckValues.length > 14;
  const numberCards = useMemo(() => deckValues.filter(v => !isSpecialCard(v)), [deckValues]);
  const specialCards = useMemo(() => deckValues.filter(isSpecialCard), [deckValues]);
  const hasVoted = currentUserVote !== null;

  const [showControls, setShowControls] = useState(!hasVoted);
  const [activePhrase, setActivePhrase] = useState('');

  // Voto secreto: esconde o valor do SEU voto na tela (útil ao compartilhar/apresentar).
  // null = sem escolha explícita → oculta sozinho no modo apresentação. Ao alternar,
  // a preferência vale daí em diante e fica salva neste navegador.
  const [hideVotePref, setHideVotePref] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('poker:hideMyVote');
      if (saved === '1' || saved === '0') setHideVotePref(saved === '1');
    } catch { /* storage indisponível: segue sem persistir */ }
  }, []);
  const hideVote = hideVotePref ?? isTheaterMode;
  const toggleHideVote = () => {
    const next = !hideVote;
    setHideVotePref(next);
    try { localStorage.setItem('poker:hideMyVote', next ? '1' : '0'); } catch { /* ignora */ }
  };

  // Gate único (poker-utils.canParticipantVote) — antes havia uma lista de
  // MANAGEMENT_ROLES local aqui divergente da de poker-utils, gerando regras
  // de "pode votar" inconsistentes entre o botão e o denominador.
  const canVote = useMemo(
    () => canParticipantVote(currentUser, allowManagementToVote),
    [currentUser, allowManagementToVote]
  );

  // Revotação seletiva agora é por CATEGORIA técnica (Developer/QA/UX/Designer).
  // Quem não é da categoria-alvo mantém o voto e aguarda.
  const isWaitingSelectiveRevote = !!selectiveRevotingRole && hasVoted && getParticipantCategory(currentUser) !== selectiveRevotingRole;

  const getRandomPhrase = (participant: Participant) => {
    const globalRoleLower = participant.globalRole?.toLowerCase() || '';
    const roleLower = participant.role?.toLowerCase() || '';
    const combinedRoles = `${globalRoleLower} ${roleLower}`;

    let roleKey: keyof typeof POKER_PHRASES = 'geral';

    // DEV: dev, engenheiro, programador, desenvolvedor, tech lead
    if (combinedRoles.includes('dev') || combinedRoles.includes('engenheir') ||
      combinedRoles.includes('programador') || combinedRoles.includes('desenv') ||
      combinedRoles.includes('lead')) {
      roleKey = 'dev';
    }
    // QA: qa, test, qualidade
    else if (combinedRoles.includes('qa') || combinedRoles.includes('test') || combinedRoles.includes('qualidade')) {
      roleKey = 'qa';
    }
    // PO: po, product, produto
    else if (combinedRoles.includes('po') || combinedRoles.includes('product') || combinedRoles.includes('produto')) {
      roleKey = 'po';
    }
    // AGILE: agile, scrum, master
    else if (combinedRoles.includes('agile') || combinedRoles.includes('scrum') || combinedRoles.includes('master')) {
      roleKey = 'agile';
    }
    // DESIGN: ux, ui, design
    else if (combinedRoles.includes('ux') || combinedRoles.includes('ui') || combinedRoles.includes('design')) {
      roleKey = 'design';
    }

    const pool = [...POKER_PHRASES.geral, ...(roleKey !== 'geral' ? POKER_PHRASES[roleKey] : [])];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  useEffect(() => {
    if (hasVoted && !activePhrase) {
      setActivePhrase(getRandomPhrase(currentUser));
    } else if (!hasVoted) {
      setActivePhrase('');
    }
  }, [hasVoted, currentUser, activePhrase]);

  useEffect(() => {
    if (!hasVoted) {
      setShowControls(true);
    }
  }, [hasVoted]);

  const handleVote = (value: string) => {
    onVote(value);
    setShowControls(false);
  };

  // Ref estável para o efeito de teclado não precisar re-assinar a cada render.
  const handleVoteRef = useRef(handleVote);
  handleVoteRef.current = handleVote;

  // Votação por teclado (aditivo, sem mudar o comportamento padrão): digite o
  // valor ("1" depois "3" => 13), "?" para indefinido, "C" para o café. Ignora
  // quando o foco está num campo de texto ou a rodada já foi revelada.
  useEffect(() => {
    // isSessionNotStarted também bloqueia o atalho: sem isso dava pra votar
    // pelo teclado com o baralho escondido.
    if (!canVote || votesRevealed || isWaitingSelectiveRevote || isSessionNotStarted) return;
    // Diálogos abertos (configurações, notas) não podem virar voto por tecla digitada.
    const dialogOpen = () => !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
    const values = deckValues;
    let buffer = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => { buffer = ''; if (timer) clearTimeout(timer); };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || dialogOpen()) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;

      const k = e.key;
      if (k === 'Escape') { reset(); return; }
      if (k === '?') { e.preventDefault(); handleVoteRef.current('?'); reset(); return; }
      if ((k === 'c' || k === 'C') && values.includes('☕')) { e.preventDefault(); handleVoteRef.current('☕'); reset(); return; }
      if (!/^[0-9a-zA-Z]$/.test(k)) return;

      let candidate = (buffer + k);
      let prefixes = values.filter(v => v.toLowerCase().startsWith(candidate.toLowerCase()));
      if (prefixes.length === 0) {
        // O acumulado não casa com nada; recomeça a partir da tecla atual.
        candidate = k;
        prefixes = values.filter(v => v.toLowerCase().startsWith(k.toLowerCase()));
      }
      buffer = candidate;
      if (timer) clearTimeout(timer);

      if (prefixes.length === 1) {
        e.preventDefault();
        handleVoteRef.current(prefixes[0]);
        reset();
        return;
      }
      if (prefixes.length === 0) { reset(); return; }

      // Vários candidatos (ex.: "1" -> 1, 13...): espera o próximo dígito; se
      // parar, resolve para o valor exato digitado.
      timer = setTimeout(() => {
        const exact = values.find(v => v.toLowerCase() === buffer.toLowerCase());
        if (exact) handleVoteRef.current(exact);
        buffer = '';
      }, 800);
    };

    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer); };
  }, [deckValues, canVote, votesRevealed, isWaitingSelectiveRevote, isSessionNotStarted]);

  // Modo teatro: oculta completamente para não-votantes.
  if (isTheaterMode && !canVote) {
    return null;
  }

  // Sessão não iniciada: baralho bloqueado. O relógio da cerimônia só começa
  // no "Iniciar Refinamento", então um voto antes disso ficaria fora da conta
  // de tempo — melhor impedir do que registrar um voto órfão.
  if (isSessionNotStarted) {
    return (
      <Card className="w-full bg-muted/20 border-2 border-dashed border-indigo-500/20 rounded-[2rem]">
        <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="p-3 bg-indigo-500/10 rounded-full">
            <Lock className="h-6 w-6 text-indigo-500/60" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/80 dark:text-indigo-400/80 text-center">
            Baralho liberado quando o refinamento começar
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-center">
            O facilitador inicia a sessão para abrir a votação
          </span>
        </CardContent>
      </Card>
    );
  }

  // Não-votante (gestão sem liberação / observador) em modo normal: mostra
  // aviso em vez do baralho. Antes o baralho aparecia e o voto era aceito,
  // contradizendo o denominador (que já excluía a gestão) — o famoso "1 DE 0".
  if (!canVote) {
    return (
      <Card className="w-full bg-muted/20 border-2 border-dashed border-muted-foreground/10 rounded-[2rem]">
        <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="p-3 bg-muted/50 rounded-full">
            <EyeOff className="h-6 w-6 opacity-40" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-center">
            Gestão acompanha sem votar
          </span>
          {onAllowManagementVote ? (
            <>
              <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-center">
                Você é o facilitador — quer participar da estimativa?
              </span>
              <Button
                onClick={onAllowManagementVote}
                className="mt-1 h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px]"
              >
                Votar também
              </Button>
            </>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-center">
              O facilitador pode liberar o voto da gestão nas configurações
            </span>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] bg-white/80 dark:bg-card/70 backdrop-blur-2xl rounded-[3rem] overflow-hidden border border-slate-200/60 dark:border-border/80">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col items-center gap-6 w-full">
          {!votesRevealed && !hasVoted && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-px bg-slate-200 dark:bg-slate-800" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                FAÇA SUA ESCOLHA
              </p>
              <div className="w-10 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
          )}

          {votesRevealed && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-px bg-slate-200 dark:bg-slate-800" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                RODADA ENCERRADA
              </p>
              <div className="w-10 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
          )}

          {!votesRevealed ? (
            isWaitingSelectiveRevote ? (
              <div className="flex flex-col items-center justify-center gap-6 py-6 animate-in fade-in zoom-in-95 duration-700 text-center w-full">
                <div className="flex items-center justify-center gap-3 text-emerald-500 mb-2">
                  <div className="bg-emerald-500/10 p-4 rounded-full ring-8 ring-emerald-500/5 shadow-inner">
                    <Check className="h-8 w-8" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">Seu voto foi mantido!</h3>
                  <div className="flex items-center justify-center gap-2 opacity-80">
                    <Sparkles className="h-4 w-4 text-blue-500 animate-pulse" />
                    <p className="text-[10px] font-black tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase">
                      Aguardando a revotação de {selectiveRevotingRole}...
                    </p>
                  </div>
                </div>
              </div>
            ) : showControls ? (
              <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500 w-full pt-4 pb-2">
                <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 max-w-6xl">
                  {numberCards.map((value) => (
                    <DeckCard key={value} value={value} dense={isDenseDeck} selected={!hideVote && currentUserVote === value} onSelect={() => handleVote(value)} />
                  ))}
                  {/* Baralho grande: cartas sem número entram na mesma fileira, após um divisor. */}
                  {isDenseDeck && specialCards.length > 0 && (
                    <>
                      <span className="hidden sm:block w-px h-12 bg-slate-200 dark:bg-slate-700/60 mx-1" aria-hidden="true" />
                      {specialCards.map((value) => (
                        <DeckCard key={value} value={value} dense selected={!hideVote && currentUserVote === value} onSelect={() => handleVote(value)} />
                      ))}
                    </>
                  )}
                </div>

                {!isDenseDeck && specialCards.length > 0 && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3">
                      <span className="h-px w-8 bg-slate-200 dark:bg-slate-700/60" />
                      <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">Sem número</span>
                      <span className="h-px w-8 bg-slate-200 dark:bg-slate-700/60" />
                    </div>
                    <div className="flex items-center justify-center gap-2 md:gap-3">
                      {specialCards.map((value) => (
                        <DeckCard key={value} value={value} selected={!hideVote && currentUserVote === value} onSelect={() => handleVote(value)} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-slate-400/80 dark:text-slate-500 pt-1">
                  <Keyboard className="h-3 w-3" />
                  <span>Digite o valor{specialCards.includes('☕') ? ' · C = café' : ''} · ? = indefinido</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full animate-in slide-in-from-bottom-8 duration-700">
                {/* BENTO BOX 1: FRASE DE IMPACTO (OCUPA 2 COLUNAS) */}
                <div className="md:col-span-2 relative overflow-hidden p-6 rounded-[2rem] bg-slate-50/50 dark:bg-slate-900/25 border border-slate-200/40 dark:border-border/30 shadow-sm flex items-center justify-center min-h-[120px]">
                  <div className="relative px-6 group w-full">
                    <Quote className="absolute -top-6 -left-2 h-12 w-12 text-primary/5 -rotate-12 transition-transform group-hover:rotate-0 duration-700 animate-pulse" />
                    <p className="text-base md:text-lg lg:text-xl font-extrabold text-slate-800 dark:text-foreground tracking-tight italic leading-relaxed text-center">
                      "{activePhrase}"
                    </p>
                    <Quote className="absolute -bottom-6 -right-2 h-12 w-12 text-primary/5 rotate-12 transition-transform group-hover:rotate-0 duration-700 animate-pulse" />
                  </div>
                </div>
 
                {/* BENTO BOX 2: STATUS E AÇÃO (OCUPA 1 COLUNA) */}
                <div className="md:col-span-1 p-6 rounded-[2rem] bg-slate-50/50 dark:bg-slate-900/25 border border-slate-200/40 dark:border-border/30 shadow-sm flex flex-col items-center justify-center gap-4 min-h-[120px]">
                  <div className="flex flex-col items-center gap-3.5 w-full">
                    <div className="flex items-center justify-center gap-3 text-emerald-500">
                      <div className="relative shrink-0">
                        <div className="relative flex h-14 w-10 -rotate-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-600/30 animate-in zoom-in-50 duration-500">
                          {hideVote ? (
                            <Lock className="h-4 w-4 opacity-90" />
                          ) : currentUserVote === '☕' ? (
                            <Coffee className="h-5 w-5" />
                          ) : (
                            <span className={cn('font-black italic leading-none tracking-tighter', (currentUserVote?.length ?? 0) > 2 ? 'text-sm' : 'text-xl')}>{currentUserVote}</span>
                          )}
                          <span className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-card">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={toggleHideVote}
                          aria-pressed={hideVote}
                          aria-label={hideVote ? 'Mostrar meu voto' : 'Ocultar meu voto'}
                          title={hideVote ? 'Mostrar meu voto' : 'Ocultar meu voto (ao apresentar a tela)'}
                          className="absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-indigo-600 dark:border-border dark:bg-card dark:text-slate-300"
                        >
                          {hideVote ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </button>
                      </div>
                      <div className="flex flex-col items-start text-left gap-0.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950 dark:text-foreground leading-none">{hideVote ? 'Voto secreto' : 'Voto Confirmado'}</p>
                        <div className="flex items-center gap-1 opacity-70">
                          <Sparkles className="h-2.5 w-2.5 text-blue-500 animate-pulse" />
                          <p className="text-[8px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-none">Aguardando squad...</p>
                        </div>
                      </div>
                    </div>
 
                    <Button
                      onClick={() => {
                        setShowControls(true);
                        setActivePhrase('');
                      }}
                      className="w-full flex items-center justify-center gap-2 px-6 h-10 text-[9px] font-black uppercase tracking-widest border border-border/85 rounded-xl bg-white dark:bg-card hover:bg-slate-100 dark:hover:bg-muted transition-all cursor-pointer text-muted-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-98"
                    >
                      <Pencil className="h-3 w-3" />
                      MUDAR ESTIMATIVA
                    </Button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 pb-4">
              {deckValues.map((value) => (
                <DeckCard key={value} value={value} dense={isDenseDeck} selected={false} disabled onSelect={() => {}} />
              ))}
            </div>
          )}

          {/* Seletor de confiança (opt-in): aparece após votar, antes de revelar. */}
          {confidenceEnabled && hasVoted && !votesRevealed && onSetConfidence && (
            <div className="flex flex-col items-center gap-2 pt-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">Sua confiança</span>
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 gap-1">
                {([
                  { key: 'low', label: 'Baixa', active: 'bg-rose-500 text-white' },
                  { key: 'medium', label: 'Média', active: 'bg-amber-500 text-white' },
                  { key: 'high', label: 'Alta', active: 'bg-emerald-500 text-white' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={currentUserConfidence === opt.key}
                    onClick={() => onSetConfidence(opt.key)}
                    className={cn(
                      'px-3 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                      currentUserConfidence === opt.key ? opt.active : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
