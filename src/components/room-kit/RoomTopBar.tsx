'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, MessageSquareHeart, MoreHorizontal, Palette, Pencil, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { THEME_MODES, THEME_VARIANTS } from '@/lib/theme-options';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ProfileMenu } from '@/components/home/ProfileMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOCUS_RING, TONES, type Tone } from './tokens';
import { useMediaQuery } from './useBelowBreakpoint';
import { IconButton, IconTile, StatusChip } from './primitives';
import { PersonAvatar } from './PresenceList';
import { PhaseStepper, type PhaseStep } from './PhaseStepper';
import {
  normalizeRoomTitle,
  pendingTiers,
  presenceLabel,
  presenceMaxAvatars,
  presenceStack,
  type TopBarPerson,
  type TopBarTier,
} from './room-top-bar-utils';

/** Botão de ícone do cabeçalho. */
export interface RoomTopBarAction {
  id: string;
  /** Vira `aria-label` e `title`. */
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  pressed?: boolean;
  /** Contagem no canto do botão (fila, mensagens não lidas). */
  badge?: number;
  /**
   * `core`: botão visível a partir de 640 px; `mid`: a partir de 1536 px; `wide`: a partir de 1920 px.
   * Fora da faixa o botão vai para o menu "Mais" (com o mesmo texto e ícone).
   */
  tier?: TopBarTier;
}

/** Item que mora sempre no menu "Mais" (som do timer, abrir retro...). */
export interface RoomTopBarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

export type RoomTopBarStatus = 'live' | 'waiting' | 'done';

export interface RoomTopBarChip {
  id: string;
  label: string;
  tone?: Tone;
  /** Chip secundário (ex.: squad): some abaixo de 1536 px para a identidade não apertar. */
  secondary?: boolean;
}

export interface RoomTopBarProps {
  /** Nome da ferramenta, em letra pequena acima do título ("Scrum Poker"). */
  toolName: string;
  toolIcon: LucideIcon;
  /** Nome da sala. */
  title: string;
  /** Com este callback o título vira editável (clique, Enter salva, Esc cancela). */
  onTitleChange?: (title: string) => void;
  /** Para onde o botão de voltar leva. Padrão: Home. */
  homeHref?: string;
  /** Estado da sessão: ponto pulsante em "Ao vivo". */
  status?: RoomTopBarStatus;
  /** Texto do selo no lugar do padrão ("Em preparação" em vez de "Aguardando"). */
  statusLabel?: string;
  chips?: RoomTopBarChip[];
  /** Fases da cerimônia (centro). Cada sala passa as suas. */
  phases?: { steps: readonly PhaseStep[]; current: string; label?: string };
  /** Cronômetro (centro). */
  timer?: React.ReactNode;
  /** Ação principal da sala (ex.: "Revelar votos"), ao lado do cronômetro. */
  primaryAction?: React.ReactNode;
  /** Presença: pilha de avatares que abre a lista de participantes. */
  presence?: { people: readonly TopBarPerson[]; open?: boolean; onClick: () => void };
  actions?: RoomTopBarAction[];
  /** Itens que ficam sempre no "Mais". */
  menuItems?: RoomTopBarMenuItem[];
  onOpenFeedback?: () => void;
  /** Padrão: menu da conta da Home. */
  userMenu?: React.ReactNode;
  className?: string;
}

const STATUS_LABEL: Record<RoomTopBarStatus, string> = { live: 'Ao vivo', waiting: 'Aguardando', done: 'Encerrada' };

/** Classes literais por camada: botão visível na faixa, item do menu escondido na mesma faixa. */
const TIER_BUTTON: Record<TopBarTier, string> = { core: 'max-sm:hidden', mid: 'max-2xl:hidden', wide: 'max-3xl:hidden' };
const TIER_MENU_ITEM: Record<TopBarTier, string> = { core: 'sm:hidden', mid: '2xl:hidden', wide: '3xl:hidden' };
const TIER_DOT = TIER_MENU_ITEM;

function StatusPill({ status, label: custom }: { status: RoomTopBarStatus; label?: string }) {
  const label = custom ?? STATUS_LABEL[status];
  const live = status === 'live';
  return (
    <span
      className={cn(
        'inline-flex h-[18px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-1.5 text-[11px] font-semibold',
        live ? cn(TONES.success.chip, 'max-sm:px-1') : cn(TONES.neutral.chip, 'max-sm:hidden')
      )}
    >
      {live && (
        <span aria-hidden="true" className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-current opacity-60 motion-safe:animate-ping" />
          <span className="absolute inset-0 rounded-full bg-current" />
        </span>
      )}
      <span className={cn(live && 'max-sm:sr-only')}>{label}</span>
    </span>
  );
}

/** Fase atual em uma linha só ("2/4 Votar") para o celular, onde o passo a passo completo não cabe. */
function PhaseSummary({ steps, current }: { steps: readonly PhaseStep[]; current: string }) {
  const index = Math.max(0, steps.findIndex((s) => s.id === current));
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-muted/50 px-2.5 text-[13px] font-semibold sm:hidden">
      <span aria-hidden="true" className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] tabular-nums text-primary-foreground">
        {index + 1}/{steps.length}
      </span>
      <span>
        <span className="sr-only">Fase {index + 1} de {steps.length}: </span>
        {steps[index]?.label}
      </span>
    </span>
  );
}

/** Título da sala; editável quando há `onTitleChange`. */
function RoomTitle({ title, onTitleChange }: { title: string; onTitleChange?: (title: string) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(title);

  const commit = () => {
    setEditing(false);
    const next = normalizeRoomTitle(draft, title);
    if (next) onTitleChange?.(next);
    else setDraft(title);
  };

  if (!onTitleChange) {
    return (
      <h1 title={title} className="m-0 truncate text-[15px] font-semibold leading-tight text-foreground">
        {title}
      </h1>
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Nome da sala"
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(title);
            setEditing(false);
          }
        }}
        className={cn('h-7 w-full min-w-[8rem] rounded-md border border-border bg-background px-2 text-[15px] font-semibold', FOCUS_RING)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(title);
        setEditing(true);
      }}
      title="Editar o nome da sala"
      aria-label={`Nome da sala: ${title}. Ativar para editar`}
      className={cn('group -mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 text-left hover:bg-accent', FOCUS_RING)}
    >
      <h1 className="m-0 truncate text-[15px] font-semibold leading-tight text-foreground">{title}</h1>
      <Pencil aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={1.5} />
    </button>
  );
}

/**
 * Pilha de avatares da presença; clicar abre a lista de participantes.
 * Avatares de 28 px (32 no celular), sobreposição de 6 px e iniciais de 11 px: legíveis sem esmagar o vizinho.
 * O ponto verde só aparece em quem está online; quem saiu fica sem ponto (a lista completa explica o resto).
 */
function PresenceStack({ people, open, onClick }: { people: readonly TopBarPerson[]; open?: boolean; onClick: () => void }) {
  // Pilha menor quando a barra está apertada; o "+N" acompanha.
  const wide = useMediaQuery('(min-width: 1536px)');
  const phone = !useMediaQuery('(min-width: 640px)');
  const stack = presenceStack(people, presenceMaxAvatars(wide, phone));
  const label = presenceLabel(stack);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={open}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-1.5 transition-colors duration-fast max-sm:h-11',
        open ? 'border-primary/60 bg-primary/10' : 'border-transparent hover:bg-accent',
        FOCUS_RING
      )}
    >
      <span className="flex items-center" aria-hidden="true">
        {stack.visible.map((p, i) => (
          // Quem vem antes fica por cima: o ponto de online nunca some atrás do vizinho.
          <span key={p.id} className={cn('relative inline-flex', i > 0 && '-ml-1.5')} style={{ zIndex: stack.visible.length - i }}>
            {/* O vizinho da frente cobre a borda esquerda (6 px + anel): o recuo de 4 px leva as iniciais para a parte que aparece. */}
            <PersonAvatar name={p.name} size="sm" className={cn('h-7 w-7 text-[11px] ring-2 ring-card max-sm:h-8 max-sm:w-8', i > 0 && 'pl-1')} />
            {p.online && (
              <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
            )}
          </span>
        ))}
      </span>
      {stack.extra > 0 && (
        <span aria-hidden="true" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          +{stack.extra}
        </span>
      )}
      {stack.visible.length === 0 && <span aria-hidden="true" className="px-1 text-xs text-muted-foreground">0</span>}
    </button>
  );
}

/** Aparência dentro do "Mais": abaixo de 1920 px o botão de tema sai da barra para dar lugar ao título e às fases. */
function ThemeSubmenu() {
  const { mode, variant, setMode, setVariant } = useTheme();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 3xl:hidden">
        <Palette className="h-4 w-4" strokeWidth={1.5} /> Aparência
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        {THEME_MODES.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => setMode(m.id)} className="gap-2">
            <m.icon className="h-4 w-4" strokeWidth={1.5} /> <span className="flex-1">{m.name}</span>
            {mode === m.id && <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {THEME_VARIANTS.map((v) => (
          <DropdownMenuItem key={v.id} onSelect={() => setVariant(v.id)} className="gap-2">
            <v.icon className="h-4 w-4" strokeWidth={1.5} /> <span className="flex-1">{v.name}</span>
            {variant === v.id && <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * Cabeçalho único da sala (~56 px): voltar, ferramenta e nome da sala, fases,
 * cronômetro, presença, ações, tema e menu da conta, numa barra só. Substitui a
 * dupla "cabeçalho global + barra da sala". A partir de 1280 px tudo cabe numa linha; abaixo
 * disso as fases e o cronômetro descem para uma segunda linha compacta. Ações extras
 * recolhem no menu "Mais" conforme a largura (ver `tier` em `RoomTopBarAction`).
 */
export function RoomTopBar({
  toolName,
  toolIcon,
  title,
  onTitleChange,
  homeHref = '/',
  status,
  statusLabel,
  chips = [],
  phases,
  timer,
  primaryAction,
  presence,
  actions = [],
  menuItems = [],
  onOpenFeedback,
  userMenu,
  className,
}: RoomTopBarProps) {
  const pending = pendingTiers(actions);
  const hasCenter = !!phases || !!timer || !!primaryAction;
  const feedbackInMenu = !!onOpenFeedback;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 shrink-0 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4 xl:h-14 xl:flex-nowrap xl:py-0 xl:px-6">
        {/* Identidade */}
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2.5 xl:min-w-[15rem]">
          <Link
            href={homeHref}
            aria-label="Voltar para a página inicial"
            title="Voltar para a página inicial"
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground transition-colors duration-fast hover:bg-accent max-sm:h-11 max-sm:w-11',
              FOCUS_RING
            )}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <IconTile icon={toolIcon} size="md" className="max-sm:hidden" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              <span className="shrink-0 text-[11px] font-medium leading-[18px] text-muted-foreground">{toolName}</span>
              {status && <StatusPill status={status} label={statusLabel} />}
              {chips.map((c) => (
                <StatusChip
                  key={c.id}
                  tone={c.tone ?? 'neutral'}
                  className={cn(
                    'h-[18px] px-1.5 text-[11px]',
                    c.secondary ? 'min-w-[4rem] max-w-[10rem] shrink max-2xl:hidden 3xl:max-w-[14rem]' : 'shrink-0 max-md:hidden max-[1339px]:xl:hidden'
                  )}
                >
                  <span className="truncate">{c.label}</span>
                </StatusChip>
              ))}
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <RoomTitle title={title} onTitleChange={onTitleChange} />
            </div>
          </div>
        </div>

        {/* Centro: fases, cronômetro e ação principal. Em < lg desce para a segunda linha. */}
        {hasCenter && (
          <div className="order-3 flex basis-full flex-wrap items-center gap-2 xl:order-2 xl:basis-auto xl:flex-nowrap xl:justify-center">
            {phases && (
              <>
                <PhaseStepper
                  className="max-sm:hidden"
                  steps={phases.steps}
                  current={phases.current}
                  label={phases.label ?? 'Fases'}
                  collapseBelow="3xl"
                />
                <PhaseSummary steps={phases.steps} current={phases.current} />
              </>
            )}
            {timer}
            {primaryAction && (
              <div className="ml-auto flex items-center max-sm:basis-full max-sm:[&>*]:w-full max-sm:[&>*]:justify-center xl:ml-0">{primaryAction}</div>
            )}
          </div>
        )}

        {/* Direita: presença, ações, tema e conta */}
        <div className="order-2 ml-auto flex shrink-0 items-center gap-1.5 xl:order-3 xl:ml-0">
          {presence && <PresenceStack people={presence.people} open={presence.open} onClick={presence.onClick} />}

          {actions.map((a) => (
            <IconButton
              key={a.id}
              label={a.badge ? `${a.label} (${a.badge})` : a.label}
              icon={a.icon}
              pressed={a.pressed}
              badge={a.badge}
              onClick={a.onClick}
              className={TIER_BUTTON[a.tier ?? 'core']}
            />
          ))}

          {(actions.length > 0 || menuItems.length > 0 || feedbackInMenu) && (
            <DropdownMenu>
              <span className="relative inline-flex">
                <DropdownMenuTrigger asChild>
                  <IconButton label="Mais opções da sala" icon={MoreHorizontal} />
                </DropdownMenuTrigger>
                {(['core', 'mid', 'wide'] as const).map(
                  (t) =>
                    pending[t] && (
                      <span
                        key={t}
                        aria-hidden="true"
                        className={cn('pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary', TIER_DOT[t])}
                      />
                    )
                )}
              </span>
              <DropdownMenuContent align="end" className="w-60">
                {actions.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={a.onClick} className={cn('gap-2', TIER_MENU_ITEM[a.tier ?? 'core'])}>
                    <a.icon className="h-4 w-4" strokeWidth={1.5} /> <span className="flex-1">{a.label}</span>
                    {!!a.badge && a.badge > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">{a.badge > 99 ? '99+' : a.badge}</span>
                    )}
                  </DropdownMenuItem>
                ))}
                {onOpenFeedback && (
                  <DropdownMenuItem onClick={onOpenFeedback} className="gap-2">
                    <MessageSquareHeart className="h-4 w-4" strokeWidth={1.5} /> Sugerir melhoria
                  </DropdownMenuItem>
                )}
                {(actions.length > 0 || feedbackInMenu) && menuItems.length > 0 && <DropdownMenuSeparator />}
                {menuItems.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={m.onClick} className="gap-2">
                    <m.icon className="h-4 w-4" strokeWidth={1.5} /> {m.label}
                  </DropdownMenuItem>
                ))}
                <ThemeSubmenu />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <span aria-hidden="true" className="mx-1 h-6 w-px bg-border max-sm:hidden" />

          <ThemeToggle className="h-9 w-9 rounded-lg max-3xl:hidden" />
          <div className="max-sm:[&_button]:h-11">{userMenu ?? <ProfileMenu />}</div>
        </div>
      </div>
    </header>
  );
}
