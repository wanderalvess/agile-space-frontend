'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Eye, EyeOff, Keyboard, Lock, Check } from 'lucide-react';
import { DECKS, DeckType, Participant } from '@/lib/types';
import { canParticipantVote, getParticipantCategory } from '@/lib/poker-utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DECK_CARD_MAX, DECK_CARD_MAX_SHORT, deckLayout } from '@/lib/poker-table';
import { DeckCard, FOCUS_RING, Segmented, useBelowBreakpoint, useElementSize, useMediaQuery } from '@/components/room-kit';

/** `?` (indefinido) e `☕` (pausa) não são estimativas — recebem tratamento à parte. */
const isSpecialCard = (v: string) => v === '?' || v === '☕';

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

const CONFIDENCE_OPTIONS = [
  { id: 'low', label: 'Baixa' },
  { id: 'medium', label: 'Média' },
  { id: 'high', label: 'Alta' },
] as const;

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

/** Faixa de baixo da sala (baralho, avisos): encostada nas bordas, separada do miolo por um filete. */
const BAR = 'border-t border-border bg-card px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5 shadow-[0_-8px_24px_rgba(15,23,42,0.05)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.3)]';

function DeckNotice({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; children?: React.ReactNode }) {
  return (
    <section aria-label="Seu baralho" className={cn(BAR, 'flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      {children}
    </section>
  );
}

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
  const numberCards = useMemo(() => deckValues.filter((v) => !isSpecialCard(v)), [deckValues]);
  const specialCards = useMemo(() => deckValues.filter(isSpecialCard), [deckValues]);
  const hasVoted = currentUserVote !== null;

  // Cartas do maior tamanho que cabe numa fileira (até 72 x 96); no celular o baralho rola de lado.
  const [rowRef, { width: rowWidth }] = useElementSize<HTMLDivElement>();
  const isPhone = useBelowBreakpoint(640);
  const hasSeparator = numberCards.length > 0 && specialCards.length > 0;
  const isShort = useMediaQuery('(max-height: 820px)');
  const layout = isPhone ? { cardWidth: 56, rows: 1 } : deckLayout(deckValues.length, rowWidth, hasSeparator ? 17 : 0, isShort ? DECK_CARD_MAX_SHORT : DECK_CARD_MAX);

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

  // Gate único (poker-utils.canParticipantVote) para botão e denominador.
  const canVote = useMemo(
    () => canParticipantVote(currentUser, allowManagementToVote),
    [currentUser, allowManagementToVote]
  );

  // Revotação seletiva é por CATEGORIA técnica (Developer/QA/UX/Designer).
  // Quem não é da categoria-alvo mantém o voto e aguarda.
  const isWaitingSelectiveRevote = !!selectiveRevotingRole && hasVoted && getParticipantCategory(currentUser) !== selectiveRevotingRole;

  const getRandomPhrase = (participant: Participant) => {
    const globalRoleLower = participant.globalRole?.toLowerCase() || '';
    const roleLower = participant.role?.toLowerCase() || '';
    const combinedRoles = `${globalRoleLower} ${roleLower}`;

    let roleKey: keyof typeof POKER_PHRASES = 'geral';

    if (combinedRoles.includes('dev') || combinedRoles.includes('engenheir') ||
      combinedRoles.includes('programador') || combinedRoles.includes('desenv') ||
      combinedRoles.includes('lead')) {
      roleKey = 'dev';
    } else if (combinedRoles.includes('qa') || combinedRoles.includes('test') || combinedRoles.includes('qualidade')) {
      roleKey = 'qa';
    } else if (combinedRoles.includes('po') || combinedRoles.includes('product') || combinedRoles.includes('produto')) {
      roleKey = 'po';
    } else if (combinedRoles.includes('agile') || combinedRoles.includes('scrum') || combinedRoles.includes('master')) {
      roleKey = 'agile';
    } else if (combinedRoles.includes('ux') || combinedRoles.includes('ui') || combinedRoles.includes('design')) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVoted, currentUser, activePhrase]);

  // Ref estável para o efeito de teclado não precisar re-assinar a cada render.
  const handleVoteRef = useRef(onVote);
  handleVoteRef.current = onVote;

  // Votação por teclado (aditivo): digite o valor ("1" depois "3" => 13), "?" para
  // indefinido, "C" para o café. Ignora campo de texto, diálogo aberto e rodada revelada.
  useEffect(() => {
    // isSessionNotStarted também bloqueia o atalho: sem isso dava pra votar
    // pelo teclado com o baralho escondido.
    if (!canVote || votesRevealed || isWaitingSelectiveRevote || isSessionNotStarted) return;
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
      let prefixes = values.filter((v) => v.toLowerCase().startsWith(candidate.toLowerCase()));
      if (prefixes.length === 0) {
        // O acumulado não casa com nada; recomeça a partir da tecla atual.
        candidate = k;
        prefixes = values.filter((v) => v.toLowerCase().startsWith(k.toLowerCase()));
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
        const exact = values.find((v) => v.toLowerCase() === buffer.toLowerCase());
        if (exact) handleVoteRef.current(exact);
        buffer = '';
      }, 800);
    };

    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer); };
  }, [deckValues, canVote, votesRevealed, isWaitingSelectiveRevote, isSessionNotStarted]);

  // Modo apresentação: oculta completamente para não-votantes.
  if (isTheaterMode && !canVote) return null;

  // Sessão não iniciada: baralho bloqueado. O relógio da cerimônia só começa no
  // "Iniciar refinamento"; um voto antes disso ficaria fora da conta de tempo.
  if (isSessionNotStarted) {
    return <DeckNotice icon={Lock} title="O baralho abre quando o refinamento começar" />;
  }

  // Não-votante (gestão sem liberação / observador): aviso no lugar do baralho.
  if (!canVote) {
    return (
      <DeckNotice icon={EyeOff} title="Gestão acompanha sem votar">
        {onAllowManagementVote ? (
          <Button onClick={onAllowManagementVote} className="h-10 rounded-[10px] bg-primary px-5 text-sm font-semibold text-primary-foreground room-glow hover:bg-primary/90">
            Votar também
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">O facilitador pode liberar o voto da gestão nas configurações.</span>
        )}
      </DeckNotice>
    );
  }

  if (isWaitingSelectiveRevote) {
    return (
      <DeckNotice icon={Check} title="Seu voto foi mantido">
        <span className="text-xs text-muted-foreground">Aguardando a revotação de {selectiveRevotingRole}.</span>
      </DeckNotice>
    );
  }

  const selected = (v: string) => !hideVote && currentUserVote === v;

  return (
    <section aria-label="Seu voto" className={cn(BAR, 'flex flex-col gap-1')}>
      <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <div className="flex min-w-0 flex-1 items-center gap-x-4">
          <h2 className="m-0 shrink-0 text-[15px] font-semibold">Seu baralho</h2>
          {hasVoted && activePhrase && <p className="m-0 hidden min-w-0 truncate text-[13px] italic text-muted-foreground md:block">{activePhrase}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          <span className="hidden items-center gap-1.5 lg:flex"><Keyboard className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Digite o valor{specialCards.includes('☕') ? ' · C café' : ''} · ? indefinido</span>
          {confidenceEnabled && onSetConfidence && (
            <fieldset title={hasVoted ? undefined : "Disponível depois do voto"} className="m-0 flex items-center gap-2 border-0 p-0 [&_button]:h-7">
              <legend className="sr-only">Confiança (opcional)</legend>
              <span aria-hidden="true" className="hidden sm:inline">Confiança</span>
              <Segmented
                label="Confiança"
                options={CONFIDENCE_OPTIONS}
                value={hasVoted ? currentUserConfidence : null}
                onChange={(id) => { if (hasVoted) onSetConfidence(id); }}
                className={cn(!hasVoted && 'opacity-50')}
              />
            </fieldset>
          )}
          {hasVoted && (
            <button
              type="button"
              onClick={toggleHideVote}
              aria-pressed={hideVote}
              aria-label={hideVote ? 'Mostrar meu voto' : 'Ocultar meu voto'}
              title={hideVote ? 'Mostrar meu voto' : 'Ocultar meu voto (ao apresentar a tela)'}
              className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground', FOCUS_RING)}
            >
              {hideVote ? <Eye className="h-4 w-4" strokeWidth={1.5} /> : <EyeOff className="h-4 w-4" strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </div>
      <div ref={rowRef} className="mx-auto w-full max-w-[1500px]">
        <div role="radiogroup" aria-label="Cartas" className="flex items-end justify-center gap-2 pb-1 pt-3 max-sm:pt-6 max-sm:-mx-3 max-sm:justify-start max-sm:overflow-x-auto max-sm:px-3 max-sm:[scrollbar-width:none] sm:flex-wrap">
          {numberCards.map((v) => (
            <DeckCard key={v} value={v} width={layout.cardWidth} selected={selected(v)} onSelect={() => onVote(v)} />
          ))}
          {hasSeparator && <span aria-hidden="true" className="mx-1 hidden h-10 w-px self-center bg-border sm:block" />}
          {specialCards.map((v) => (
            <DeckCard key={v} value={v} width={layout.cardWidth} selected={selected(v)} onSelect={() => onVote(v)} />
          ))}
        </div>
      </div>
    </section>
  );
}
