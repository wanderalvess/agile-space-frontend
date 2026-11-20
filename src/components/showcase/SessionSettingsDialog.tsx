'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Camera, Check, CloudDownload, Copy, FileText, Info, Layout, Link as LinkIcon, ListChecks,
  Moon, Palette, Pipette, SlidersHorizontal, SortAsc, Sparkles, Sun, Target, TrendingUp, Users, Video,
} from 'lucide-react';
import { ConfirmDialog, FIELD, FOCUS_RING, Modal, ModalButton, SelectField, TabBar } from '@/components/room-kit';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { cn } from '@/lib/utils';
import { type CardKind, type ShowcaseSession, type ShowcaseTask, PRESETS, PRESENTATION_PRESETS } from './types';
import { getDirectImageUrl, imageBackgroundCss, isImageBackground, isLightBackground, toSafeUrl } from './utils';
import { SORT_LABELS, isReviewSort, squadOptions, type ReviewSort } from './review-room-logic';

interface SessionSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  session: ShowcaseSession | null;
  onUpdate: (updates: Partial<ShowcaseSession>) => void;
  /**
   * true quando o diálogo foi reaberto porque a pessoa tentou apresentar sem preencher os objetivos:
   * mostra o aviso em vez de abrir em silêncio como o botão de Configurações.
   */
  presentWarning?: boolean;
  onPresentAnyway?: () => void;
  /** Quantos cards a Review já tem (atualiza ao vivo enquanto o modal está aberto). */
  taskCount?: number;
  /** Abre a importação do Jira por cima deste modal: quem configura faz tudo daqui. */
  onOpenJira?: () => void;
  onAddManualTask?: (cardKind: CardKind) => void;
  onCopyLink?: () => void;
}

type TabType = 'geral' | 'tarefas' | 'identidade' | 'apresentacao';

/** Onde a importação procura cada informação (ver jiraService.ts e makeTask em utils.ts). */
const JIRA_FIELD_SOURCES: [string, string][] = [
  ['Título, tipo, status', 'Campos da própria issue.'],
  ['Horas planejadas', 'Título da issue, no formato "(DEV 4h / QA 3h)".'],
  ['Problema', 'Seção "Problema", "Contexto" ou "Motivação" no comentário do dev; se não houver, na descrição.'],
  ['Solução', 'Seção "Solução", "O que foi feito" ou "Implementação" no comentário do dev ou na descrição.'],
  ['Critérios de aceite', 'Campo "Critérios de Aceite" ou a seção com esse nome na descrição.'],
  ['Dev e QA', 'Campos "Desenvolvedor" e de QA/aceitação; sem eles, o responsável da issue vira o dev.'],
  ['Projeto e versões', 'Comentário da "Esteira de Integração Contínua" (Repositório, Versão e Branch).'],
  ['Vídeo', 'Primeiro link do Google Drive nos comentários ou na descrição.'],
  ['Print', 'Primeira imagem ou anexo da descrição (ícones e emoticons do Jira são ignorados).'],
  ['Documento técnico', 'Link logo depois de "Documento técnico" ou "Documentação técnica"; senão, o primeiro link de Google Docs, SharePoint ou Confluence.'],
  ['TDN', 'Primeiro link do tdn.totvs.com na descrição, nos comentários ou em campos da issue.'],
];

const STYLES = [
  { id: 'cinematic', label: 'Cinematográfico', desc: 'Foco no conteúdo com bordas suaves e presença cênica' },
  { id: 'minimalist', label: 'Minimalista', desc: 'Sem divisórias laterais, layout limpo e direto' },
  { id: 'corporate', label: 'Corporativo', desc: 'Estrutura sólida executiva para stakeholders' },
  { id: 'glass', label: 'Glassmorphism', desc: 'Painéis translúcidos com efeito de desfoque moderno' },
] as const;

const QUICK_BACKGROUNDS = [
  { label: 'Branco Puro', value: '#ffffff', border: true },
  { label: 'Studio Off-White', value: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', border: true },
  { label: 'Azul institucional', value: 'linear-gradient(135deg, #001824 0%, #002233 50%, #0A3048 100%)' },
  { label: 'Deep Space', value: 'linear-gradient(135deg, #050510 0%, #0d0d1f 50%, #050510 100%)' },
  { label: 'Tech Emerald', value: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #021a14 100%)' },
];

const PANEL = 'flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-4';
const LABEL = 'text-[13px] font-semibold text-foreground';
const HELP = 'm-0 text-xs text-muted-foreground';

function PanelTitle({ icon: I, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="m-0 flex items-center gap-2 text-sm font-bold">
      <I className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      {children}
    </h3>
  );
}

/**
 * Réplica em miniatura do painel lateral do Modo Teatro (TeatroMode.tsx), mesma lógica de fundo/tema em
 * escala menor. Sem ela a aba só deixava escolher fundo/tema às cegas.
 */
function PresentationPreview({ background, theme, task }: { background?: string; theme?: ShowcaseSession['presentationTheme']; task?: ShowcaseTask }) {
  const isLight = isLightBackground(background);
  const isGlass = theme === 'glass';
  const isMinimalist = theme === 'minimalist';

  const bgStyle: React.CSSProperties = background
    ? { background: isImageBackground(background) ? imageBackgroundCss(background) : background, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(135deg, #001824 0%, #002233 50%, #0A3048 100%)' };

  const badgeKey = task?.key || 'DEMO-101';
  const title = task?.title || 'Assim seus cards vão aparecer na tela';
  const desc = task?.evidence?.problem || task?.description || 'Evidência, contexto do negócio e resultados da entrega.';

  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-2xl shadow-lg transition-all duration-500', isLight ? 'stage-light' : 'stage-dark')} style={bgStyle}>
      <div className="absolute right-3 top-3 z-20">
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-md',
          isLight ? 'border-border bg-card/90 text-foreground' : 'border-border bg-card/80 text-foreground'
        )}>
          {isLight ? <Sun className="h-3 w-3 shrink-0 text-amber-500" strokeWidth={1.5} aria-hidden="true" /> : <Moon className="h-3 w-3 shrink-0 text-cyan-300" strokeWidth={1.5} aria-hidden="true" />}
          {isLight ? 'Modo claro ativo' : 'Modo escuro ativo'}
        </span>
      </div>

      <div className={cn(
        'absolute inset-y-0 left-0 flex w-[58%] max-w-[270px] flex-col justify-between border-r p-5 transition-all duration-300',
        isLight
          ? (isGlass ? 'border-border bg-card/80 backdrop-blur-xl' : 'border-border bg-card/95 backdrop-blur-md')
          : (isGlass ? 'border-border bg-foreground/[0.03] backdrop-blur-2xl' : 'border-border bg-[#001824]/95 backdrop-blur-2xl'),
        isMinimalist && 'border-r-0 shadow-none'
      )}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', task ? 'bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' : (isLight ? 'bg-muted text-foreground' : 'bg-foreground/10 text-muted-foreground'))}>
              {badgeKey}
            </span>
            <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/15 text-emerald-300')}>
              <Check className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> Aprovado
            </span>
          </div>
          <h4 className={cn('m-0 line-clamp-2 text-[15px] font-bold leading-tight', 'text-foreground')}>{title}</h4>
          <p className={cn('m-0 line-clamp-3 text-xs leading-relaxed', 'text-muted-foreground')}>{desc}</p>
        </div>
        <div className={cn('flex items-center justify-between border-t pt-3 text-xs', 'border-border text-muted-foreground')}>
          <span>Desenvolvedor</span>
          <span className={cn('font-bold', 'text-foreground')}>{task?.evidence?.dev || 'Ana Silva'}</span>
        </div>
      </div>

      <div className="absolute inset-y-0 left-[58%] right-0 flex items-center justify-center p-6">
        <div className={cn(
          'flex aspect-video w-full max-w-[210px] flex-col items-center justify-center gap-2 rounded-2xl border transition-all',
          isLight ? 'border-border bg-card/80 text-muted-foreground' : 'border-border bg-foreground/[0.03] text-muted-foreground'
        )}>
          <Camera className="h-7 w-7 opacity-70" strokeWidth={1.5} aria-hidden="true" />
          <span className="text-xs opacity-80">Evidência / demo</span>
        </div>
      </div>
    </div>
  );
}

export function SessionSettingsDialog({ open, onClose, session: initialSession, onUpdate: onCommit, presentWarning, onPresentAnyway, taskCount = 0, onOpenJira, onAddManualTask, onCopyLink }: SessionSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [linkCopied, setLinkCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const [presetFilter, setPresetFilter] = useState<'all' | 'light' | 'dark'>('all');
  const [session, setSession] = useState<Partial<ShowcaseSession>>({});
  const [coverUrl, setCoverUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const { squadId: activeSquadId, squadName: activeSquadName } = useActiveSquad();
  const { memberships } = useMyMemberships();

  // A sessão do pai muda de referência a cada broadcast de WebSocket (SESSION_UPDATED), disparado por QUALQUER
  // save na sessão (editar um card, etc.), não só pelo que este diálogo controla. Sincronizar direto de
  // `initialSession` a cada mudança apagava edições locais não salvas se um broadcast concorrente chegasse com o
  // diálogo aberto. Guardamos a versão mais recente numa ref (sem disparar re-sync) e só carregamos no
  // formulário quando o diálogo efetivamente abre.
  const latestSessionRef = React.useRef(initialSession);
  React.useEffect(() => { latestSessionRef.current = initialSession; }, [initialSession]);
  // Cópia de quando o modal abriu: base do diff no salvar.
  const openedSessionRef = React.useRef<Partial<ShowcaseSession> | null>(null);

  React.useEffect(() => {
    if (open && latestSessionRef.current) {
      openedSessionRef.current = latestSessionRef.current;
      setSession(latestSessionRef.current);
      setCoverUrl(latestSessionRef.current.coverImage || '');
      setPreviewError(false);
    }
  }, [open]);

  const squads = useMemo(
    () => squadOptions(memberships?.memberships, { squadId: activeSquadId, squadName: activeSquadName }, initialSession?.squadName),
    [memberships, activeSquadId, activeSquadName, initialSession?.squadName]
  );

  const onUpdate = (updates: Partial<ShowcaseSession>) => {
    setSession((prev) => ({ ...prev, ...updates }));
  };

  // Grava só o que mudou no modal. Mandar a sessão inteira regravava `tasks` com a cópia de quando o modal abriu
  // (apagando edições feitas nos cards nesse meio-tempo).
  const getChanged = () => {
    const original = (openedSessionRef.current || {}) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(session).filter(([k, v]) =>
        !['id', 'tasks', 'createdAt', 'updatedAt'].includes(k) && v !== undefined && v !== original[k]
      )
    ) as Partial<ShowcaseSession>;
  };

  const handleSave = () => {
    const changed = getChanged();
    if (Object.keys(changed).length > 0) onCommit(changed);
    onClose();
  };

  // Clicar fora ou apertar Esc fecha o modal: sem aviso, as alterações digitadas se perdiam.
  const handleDismiss = () => {
    if (Object.keys(getChanged()).length > 0) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const tabs = [
    { id: 'geral' as const, label: 'Geral' },
    { id: 'tarefas' as const, label: 'Cards e link' },
    { id: 'identidade' as const, label: 'Capa' },
    { id: 'apresentacao' as const, label: 'Apresentação' },
  ];

  // Prontidão da sessão: os 4 campos que fazem diferença real numa apresentação.
  const checklist = [
    { key: 'squad', label: 'Squad', done: !!session?.squadName?.trim(), tab: 'geral' as TabType },
    { key: 'tarefas', label: taskCount > 0 ? `${taskCount} cards` : 'Cards', done: taskCount > 0, tab: 'tarefas' as TabType },
    { key: 'objetivos', label: 'Objetivos', done: !!session?.description?.trim(), tab: 'geral' as TabType },
    { key: 'capa', label: 'Capa', done: !!session?.coverImage, tab: 'identidade' as TabType },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  const renderGeral = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <div className={cn(PANEL, 'md:col-span-6')}>
        <PanelTitle icon={Layout}>Identificação</PanelTitle>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-name" className={LABEL}>Título da Review</label>
          <input id="cfg-name" value={session?.name || ''} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Ex.: Review da Sprint 42" className={cn(FIELD, 'h-10')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-squad" className={LABEL}>Squad</label>
          <SelectField id="cfg-squad" aria-label="Squad da Review" value={session?.squadName || ''} onChange={(squadName) => onUpdate({ squadName })} options={squads} placeholder="Escolha a squad" className="h-10" />
          <p className={HELP}>É o nome que a lista do hub usa para achar a Review. Escolha entre as squads do seu vínculo.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-period" className={LABEL}>Data ou ciclo</label>
          <input id="cfg-period" value={session?.period || ''} onChange={(e) => onUpdate({ period: e.target.value })} placeholder="Ex.: 2026 · 4º trimestre" className={cn(FIELD, 'h-10')} />
        </div>
      </div>

      <div className={cn(PANEL, 'md:col-span-6')}>
        <PanelTitle icon={SortAsc}>Ordem dos cards</PanelTitle>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-sort" className={LABEL}>Ordenar por</label>
          <SelectField
            id="cfg-sort"
            aria-label="Ordenar os cards por"
            value={session?.defaultSort || 'key'}
            onChange={(v) => isReviewSort(v) && onUpdate({ defaultSort: v })}
            options={(Object.keys(SORT_LABELS) as ReviewSort[]).map((k) => ({ value: k, label: SORT_LABELS[k] }))}
            className="h-10"
          />
          <p className={HELP}>Define a ordem em que os cards aparecem na lista e na apresentação. Com a chave, PTV-2 vem antes de PTV-10.</p>
        </div>
      </div>

      <div className={cn(PANEL, 'md:col-span-12')}>
        <PanelTitle icon={Target}>Objetivos da sprint</PanelTitle>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-goals" className={LABEL}>Objetivos</label>
          <textarea
            id="cfg-goals"
            value={session?.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Ex.: reduzimos o tempo de fechamento de pedido de 40 s para 12 s..."
            className={cn(FIELD, 'h-24 resize-none py-2.5')}
          />
        </div>
      </div>
    </div>
  );

  const renderTarefas = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <div className={cn(PANEL, 'gap-5 md:col-span-7')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <PanelTitle icon={ListChecks}>Cards da Review</PanelTitle>
            <p className={cn(HELP, 'max-w-sm')}>A importação traz título, tipo, problema, solução e critérios de cada issue. Depois cada pessoa completa a evidência no próprio card.</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="m-0 text-3xl font-bold leading-none tabular-nums">{taskCount}</p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">{taskCount === 1 ? 'card' : 'cards'}</p>
          </div>
        </div>
        <ModalButton variant="primary" className="h-11 w-full gap-2" onClick={onOpenJira} disabled={!onOpenJira}>
          <CloudDownload className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> {taskCount > 0 ? 'Importar mais issues do Jira' : 'Importar issues do Jira'}
        </ModalButton>
        <div className="flex flex-col gap-2">
          <p className="m-0 text-xs font-semibold text-muted-foreground">Ou crie um card manual</p>
          <div className="grid grid-cols-2 gap-2">
            <ModalButton className="h-11 justify-start gap-2.5" onClick={() => onAddManualTask?.('story')} disabled={!onAddManualTask}>
              <FileText className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Card padrão
            </ModalButton>
            <ModalButton className="h-11 justify-start gap-2.5" onClick={() => onAddManualTask?.('metrics')} disabled={!onAddManualTask}>
              <TrendingUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Card de métricas
            </ModalButton>
          </div>
        </div>
      </div>

      <div className={cn(PANEL, 'md:col-span-5')}>
        <div className="flex flex-col gap-1.5">
          <PanelTitle icon={Users}>Compartilhar com a squad</PanelTitle>
          <p className={HELP}>Quem abrir o link entra nesta Review e ajuda a preparar os cards antes da apresentação.</p>
        </div>
        <div className="flex gap-2">
          <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Link da Review" className={cn(FIELD, 'h-10 min-w-0 flex-1 font-mono text-xs')} />
          <ModalButton
            variant="primary"
            className="shrink-0 gap-1.5"
            onClick={() => { onCopyLink?.(); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
          >
            {linkCopied ? <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            {linkCopied ? 'Copiado' : 'Copiar'}
          </ModalButton>
        </div>
      </div>

      <div className={cn(PANEL, 'md:col-span-12')}>
        <div className="flex flex-col gap-1.5">
          <PanelTitle icon={Info}>De onde vem cada campo do card</PanelTitle>
          <p className={HELP}>
            Quer que o card já chegue completo? Ajuste a issue no Jira antes de importar. Uma issue que já virou card não é importada de novo: para reimportar, exclua o card primeiro.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
          {JIRA_FIELD_SOURCES.map(([field, source]) => (
            <div key={field} className="flex gap-3 border-b border-border py-2 text-[13px]">
              <span className="w-32 shrink-0 font-semibold">{field}</span>
              <span className="text-muted-foreground">{source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderIdentidade = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <div className={cn(PANEL, 'md:col-span-7')}>
        <div className="flex flex-col gap-2">
          <PanelTitle icon={Sparkles}>Fundos prontos</PanelTitle>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, i) => {
              const selected = session?.coverImage === p.url;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => { onUpdate({ coverImage: p.url }); setCoverUrl(p.url); }}
                  className={cn(
                    'group relative aspect-video overflow-hidden rounded-xl border-2 transition-all hover:shadow-md',
                    i === 0 && 'col-span-2',
                    selected ? 'border-primary shadow-md' : 'border-transparent',
                    FOCUS_RING
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} className="h-full w-full object-cover" alt={p.name} />
                  <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/85 via-background/35 to-transparent p-2 text-left">
                    <span className="text-xs font-bold text-foreground">{p.name}</span>
                    <span className="line-clamp-1 text-xs text-foreground">{p.description}</span>
                  </span>
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 rounded-md bg-primary p-0.5 text-primary-foreground shadow-lg [.theme-totvs:not(.dark)_&]:text-foreground">
                      <Check className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <PanelTitle icon={LinkIcon}>Imagem de fundo por link</PanelTitle>
          <div className="flex gap-2">
            <input
              value={coverUrl}
              onChange={(e) => { setCoverUrl(e.target.value); setPreviewError(false); }}
              placeholder="URL da imagem..."
              aria-label="URL da imagem de capa"
              className={cn(FIELD, 'h-10 flex-1')}
            />
            <ModalButton
              variant="primary"
              className="shrink-0"
              disabled={!coverUrl}
              onClick={() => {
                const safe = toSafeUrl(coverUrl);
                setCoverUrl(safe);
                onUpdate({ coverImage: safe });
              }}
            >
              Aplicar
            </ModalButton>
          </div>
        </div>
      </div>

      <div className={cn(PANEL, 'md:col-span-5')}>
        <PanelTitle icon={Palette}>Visualização da capa</PanelTitle>
        {previewError && coverUrl ? (
          <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
            <p className="m-0 text-xs font-semibold text-amber-700 dark:text-amber-300">Erro na visualização</p>
            <p className="m-0 max-w-[200px] text-xs leading-normal text-muted-foreground">Essa imagem não carregou. Confira se o link está correto e é público: alguns sites bloqueiam exibir a imagem fora deles.</p>
          </div>
        ) : coverUrl ? (
          <div className="relative flex min-h-[160px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-background/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getDirectImageUrl(coverUrl)} referrerPolicy="no-referrer" className="h-full w-full object-cover" alt="Visualização da capa" onError={() => setPreviewError(true)} />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/80 via-background/20 to-transparent p-3.5">
              <span className="text-xs font-semibold text-cyan-300">Visualização</span>
              <h4 className="m-0 mt-1 truncate text-sm font-bold text-foreground">{session?.name || 'Sua Review'}</h4>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-center text-muted-foreground">
            <Sparkles className="h-6 w-6 opacity-60" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-xs font-semibold">Nenhuma capa selecionada</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderApresentacao = () => {
    const filteredPresets = PRESENTATION_PRESETS.filter((p) => (presetFilter === 'all' ? true : p.category === presetFilter));
    const isLightBg = isLightBackground(session?.presentationBackground);
    const filterBtn = (id: 'all' | 'light' | 'dark', label: React.ReactNode) => (
      <button
        key={id}
        type="button"
        aria-pressed={presetFilter === id}
        onClick={() => setPresetFilter(id)}
        className={cn(
          'flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors max-sm:min-h-11',
          presetFilter === id ? 'bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground' : 'text-muted-foreground hover:text-foreground',
          FOCUS_RING
        )}
      >
        {label}
      </button>
    );
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <div className="flex flex-col gap-4 md:col-span-6">
          <div className={PANEL}>
            <div className="flex items-center justify-between">
              <PanelTitle icon={Sparkles}>Cores do Modo Teatro</PanelTitle>
              {isLightBg && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Sun className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Fundo claro ativo
                </span>
              )}
            </div>

            <div role="group" aria-label="Filtrar os fundos" className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
              {filterBtn('all', `Todos (${PRESENTATION_PRESETS.length})`)}
              {filterBtn('light', <><Sun className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Claros ({PRESENTATION_PRESETS.filter((p) => p.category === 'light').length})</>)}
              {filterBtn('dark', <><Moon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Escuros ({PRESENTATION_PRESETS.filter((p) => p.category === 'dark').length})</>)}
            </div>

            <div className="scrollbar-thin grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1">
              {filteredPresets.map((p) => {
                const isSelected = session?.presentationBackground === p.value;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onUpdate({ presentationBackground: p.value })}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all hover:shadow-md',
                      isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card hover:border-foreground/30',
                      FOCUS_RING
                    )}
                  >
                    <span
                      style={isImageBackground(p.value) ? { background: `center / cover no-repeat url(${p.value})` } : { background: p.value }}
                      className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg', p.isLight ? 'border-2 border-border' : 'border border-border')}
                    >
                      {isSelected && (
                        <span className={cn('flex h-[18px] w-[18px] items-center justify-center rounded-full shadow-md', p.isLight ? 'bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' : 'bg-card text-foreground')}>
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold leading-tight">{p.name}</span>
                        {p.id === 'white' && <span className="shrink-0 rounded bg-emerald-500/10 px-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Projetor</span>}
                      </span>
                      <span className="line-clamp-1 text-xs leading-snug text-muted-foreground">{p.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2.5 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <PanelTitle icon={Pipette}>Cor livre ou link</PanelTitle>
                <span className="text-xs text-muted-foreground">Hexadecimal ou CSS</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border shadow-inner" title="Abrir o seletor de cores">
                  <input
                    type="color"
                    aria-label="Seletor de cores"
                    value={session?.presentationBackground?.startsWith('#') && session.presentationBackground.length === 7 ? session.presentationBackground : '#ffffff'}
                    onChange={(e) => onUpdate({ presentationBackground: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <span className="flex h-full w-full items-center justify-center rounded-xl" style={isImageBackground(session?.presentationBackground) ? { background: `center / cover no-repeat url(${session?.presentationBackground})` } : { background: session?.presentationBackground || '#002233' }}>
                    <Palette className={cn('h-4 w-4 drop-shadow', 'text-foreground')} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </label>
                <input
                  value={session?.presentationBackground || ''}
                  onChange={(e) => onUpdate({ presentationBackground: e.target.value })}
                  placeholder="Ex.: #ffffff, #0f172a ou https://..."
                  aria-label="Cor ou link do fundo"
                  className={cn(FIELD, 'h-10 flex-1')}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold text-muted-foreground">Atalhos:</span>
                {QUICK_BACKGROUNDS.map((chip) => {
                  const active = session?.presentationBackground === chip.value;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onUpdate({ presentationBackground: chip.value })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors max-sm:min-h-11',
                        active ? 'border-primary bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border bg-card text-muted-foreground hover:border-foreground/30',
                        FOCUS_RING
                      )}
                    >
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', chip.border && 'border border-border')} style={{ background: chip.value }} />
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={PANEL}>
            <div className="flex items-center justify-between">
              <PanelTitle icon={Layout}>Estilo de interface</PanelTitle>
              <span className="text-xs font-semibold text-muted-foreground">{STYLES.find((s) => s.id === (session?.presentationTheme || 'cinematic'))?.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((t) => {
                const selected = (session?.presentationTheme || 'cinematic') === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onUpdate({ presentationTheme: t.id })}
                    className={cn(
                      'flex flex-col gap-1 rounded-xl border-2 p-2.5 text-left transition-all',
                      selected ? 'border-primary bg-primary/5 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-foreground/30',
                      FOCUS_RING
                    )}
                  >
                    <span className="flex items-center justify-between text-[13px] font-semibold">
                      {t.label}
                      {selected && <Check className="h-3.5 w-3.5 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={2} aria-hidden="true" />}
                    </span>
                    <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:col-span-6">
          <div className="flex items-center justify-between">
            <PanelTitle icon={Video}>Pré-visualização</PanelTitle>
            <span className="text-xs text-muted-foreground">Como a audiência verá</span>
          </div>
          <div className="min-h-[380px] flex-1 overflow-hidden rounded-2xl border border-border shadow-inner">
            <PresentationPreview background={session?.presentationBackground} theme={session?.presentationTheme} task={session?.tasks?.[0]} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => { if (!next) handleDismiss(); }}
        size="lg"
        icon={SlidersHorizontal}
        title="Configurações da Review"
        description="Nome, cards, link da squad, capa e aparência da apresentação. Nada aqui é obrigatório, mas cards, capa e objetivos deixam a Review mais completa."
        className="sm:h-[760px] sm:max-w-[1000px]"
        bodyClassName="pt-5"
        headerExtra={
          <div className="flex flex-wrap items-end justify-between gap-x-4 border-b border-border">
            <TabBar<TabType> label="Seções das configurações" idPrefix="cfg" value={activeTab} onChange={setActiveTab} tabs={tabs} className="border-b-0 max-sm:gap-3 max-sm:overflow-x-auto" tabClassName="max-sm:h-11" />
            <div className="flex flex-wrap items-center gap-1.5 px-6 pb-2" role="group" aria-label="Antes de apresentar">
              <span className="mr-1 text-[13px] font-semibold text-muted-foreground">Antes de apresentar · {doneCount}/{checklist.length}</span>
              {checklist.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveTab(c.tab)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors max-sm:h-9',
                    c.done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                    FOCUS_RING
                  )}
                >
                  {c.done ? <Check className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> : <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-current opacity-60" />}
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        }
        footerStart={
          <p className="m-0 hidden max-w-md text-xs text-muted-foreground md:block">
            Vai apresentar em projetor ou sala com muita luz? Em <strong className="font-semibold text-foreground">Apresentação</strong>, escolha o fundo Branco Puro.
          </p>
        }
        footer={
          <>
            <ModalButton onClick={handleDismiss}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={handleSave}>Salvar alterações</ModalButton>
          </>
        }
      >
        {presentWarning && (
          <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-bold text-amber-800 dark:text-amber-300">Esta Review ainda não tem os objetivos da sprint</p>
              <p className="m-0 text-xs text-amber-800/80 dark:text-amber-300/80">Complete agora ou apresente do jeito que está.</p>
            </div>
            <ModalButton className="shrink-0 border-amber-500/40 text-amber-800 hover:bg-amber-500/10 dark:text-amber-300" onClick={onPresentAnyway}>
              Apresentar mesmo assim
            </ModalButton>
          </div>
        )}
        <div role="tabpanel" id={`cfg-panel-${activeTab}`} aria-labelledby={`cfg-tab-${activeTab}`}>
          {activeTab === 'geral' && renderGeral()}
          {activeTab === 'tarefas' && renderTarefas()}
          {activeTab === 'identidade' && renderIdentidade()}
          {activeTab === 'apresentacao' && renderApresentacao()}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        tone="warn"
        icon={AlertTriangle}
        title="Descartar as alterações?"
        description="Você mudou campos das configurações que ainda não foram salvos. Se sair agora, eles se perdem."
        cancelLabel="Continuar editando"
        confirmLabel="Descartar"
        onConfirm={onClose}
      />
    </>
  );
}
