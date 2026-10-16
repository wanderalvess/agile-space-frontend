'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Save, Settings2, Users, WalletCards } from 'lucide-react';
import { cleanTemplateName, deleteTemplate, listTemplates, renameTemplate, saveTemplate, TEMPLATE_NAME_MAX, type PokerTemplate } from '@/lib/poker-templates';
import { TSHIRT_UNIT_LABELS, type DeckType, type TshirtUnit } from '@/lib/types';
import { HOURS_MAX_DEFAULT, effectiveMaxHours, getDeckCards } from '@/lib/poker-deck';
import { DEFAULT_ROOM_SETTINGS } from '@/lib/poker-utils';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { pokerApi } from '@/app/room/api';
import { FIELD, FOCUS_RING, IconButton, IconTile, Modal, ModalButton, SelectField, StatusChip } from '@/components/room-kit';
import { MaxHoursField } from './MaxHoursField';
import { TemplateManagerDialog } from './TemplateDialogs';
import { Switch } from '@/components/ui/switch';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';
const BLANK_TEMPLATE = '__blank';
const UNIT_OPTIONS = (Object.keys(TSHIRT_UNIT_LABELS) as TshirtUnit[]).map((u) => ({ value: u, label: TSHIRT_UNIT_LABELS[u] }));

// Metadados dos baralhos para os cartões do modal (as cartas completas vêm de DECKS).
const DECK_OPTIONS = [
  { key: 'fibonacci', name: 'Fibonacci', tagline: 'Story points', sample: ['1', '3', '5', '8'], desc: 'Complexidade relativa. Boa para histórias de usuário.' },
  { key: 'hours', name: 'Horas reais', tagline: 'Esforço em horas', sample: ['2', '4', '8', '16'], desc: 'Horas por papel (DEV, QA, UX…). Boa para subtarefas e capacidade.' },
  { key: 'tshirt', name: 'Camisetas', tagline: 'Tamanhos', sample: ['P', 'M', 'G'], desc: 'Tamanhos relativos e rápidos. Boa para triagem.' },
] as const;

// Recursos na ordem em que fazem sentido: primeiro o que só acrescenta informação,
// depois o que dá ação ao facilitador, o ritual do time e por fim a automação.
const SETUP_GROUPS = [
  {
    label: 'Dados e visão',
    items: [
      { key: 'perTopicTime', title: 'Tempo por tópico', desc: 'Quanto durou cada item' },
      { key: 'showDistribution', title: 'Distribuição dos votos', desc: 'Histograma ao revelar' },
      { key: 'showVelocity', title: 'Velocity do time', desc: 'Histórico no relatório final' },
      { key: 'decisionNotes', title: 'Nota de decisão', desc: 'Por que estimamos assim' },
      { key: 'refinementNotes', title: 'Notas de refinamento', desc: 'Solução técnica e cenários de QA' },
    ],
  },
  {
    label: 'Opções do facilitador',
    items: [
      { key: 'cancelTask', title: 'Cancelar tarefa', desc: 'Permite cancelar itens no refinamento' },
      { key: 'parkTask', title: 'Adiar tarefa', desc: 'Volta o item para o fim da fila' },
      { key: 'referenceStory', title: 'História de referência', desc: 'Régua visível na votação' },
      { key: 'roundNudge', title: 'Aviso de rodadas', desc: 'Sugere quebrar ou adiar' },
      { key: 'suggestRevote', title: 'Sugerir revotação', desc: 'Em divergência crítica' },
    ],
  },
  {
    label: 'Ritual de votação',
    items: [
      { key: 'confidenceVote', title: 'Voto de confiança', desc: 'Baixa, média ou alta' },
      { key: 'outlierPrompt', title: 'Justificar extremos', desc: 'Maior e menor explicam' },
    ],
  },
  {
    label: 'Automação',
    items: [
      { key: 'allowManagementToVote', title: 'Gestão pode votar', desc: 'Inclui papéis de gestão' },
      { key: 'autoReveal', title: 'Auto-revelar', desc: 'Quando todos votarem' },
      { key: 'autoConsensus', title: 'Auto-consenso', desc: 'Salva e avança no consenso' },
    ],
  },
] as const;

const MODE_OPTIONS = [
  { key: 'sync', icon: Users, name: 'Síncrono', tagline: 'Ao vivo', desc: 'Todos votam juntos, com revelação simultânea. Para o time reunido.' },
  { key: 'async', icon: Clock, name: 'Assíncrono', tagline: 'No seu tempo', desc: 'Cada pessoa vota por tarefa quando puder. Para times distribuídos.' },
] as const;

const SETUP_TOTAL = SETUP_GROUPS.reduce((n, g) => n + g.items.length, 0);

const baseSetupSettings = (): Record<string, boolean> => ({
  ...DEFAULT_ROOM_SETTINGS,
  allowManagementToVote: false,
  autoReveal: false,
  autoConsensus: false,
});

const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/** Leque de cartas do cartão de baralho. */
function DeckFan({ sample, selected }: { sample: readonly string[]; selected: boolean }) {
  return (
    <span aria-hidden="true" className="relative block h-[54px] w-full">
      {sample.map((v, i) => (
        <span
          key={v}
          className={cn(
            'absolute top-0 flex h-[50px] w-9 items-start justify-start rounded-md border bg-card p-1.5 text-[13px] font-bold leading-none tabular-nums shadow-sm',
            selected ? 'border-primary text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-card-foreground'
          )}
          style={{ left: i * 26, top: Math.abs(i - (sample.length - 1) / 2) * 2, transform: `rotate(${(i - (sample.length - 1) / 2) * 6}deg)` }}
        >
          {v}
        </span>
      ))}
    </span>
  );
}

export function CreateSessionModal({
  open,
  onOpenChange,
  onCreatingChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatingChange?: (creating: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useAuth();
  const { userProfile } = useUserContext();

  const [isCreating, setIsCreatingState] = useState(false);
  const setIsCreating = (v: boolean) => { setIsCreatingState(v); onCreatingChange?.(v); };
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [team, setTeam] = useState('');
  const [teamTouched, setTeamTouched] = useState(false);
  const [mode, setMode] = useState<'sync' | 'async'>('sync');
  const [deckType, setDeckType] = useState<string>('hours');
  const [templates, setTemplates] = useState<PokerTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);
  // Horas máximas do baralho "Horas reais": salas novas nascem com 40.
  const [maxHours, setMaxHours] = useState<number>(HOURS_MAX_DEFAULT);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateNameError, setTemplateNameError] = useState(false);
  // O modal mostra TODOS os toggles que a sala vai levar, já no estado em que vão nascer.
  const [setupSettings, setSetupSettings] = useState<Record<string, boolean>>(baseSetupSettings);
  // Equivalência numérica por tamanho (só relevante para o baralho de camisetas).
  const [tshirtEquivalents, setTshirtEquivalents] = useState<Record<string, { value: string; unit: TshirtUnit }>>({});

  // Templates vêm do localStorage; carrega ao abrir (evita mismatch de SSR).
  useEffect(() => {
    if (open) setTemplates(listTemplates());
  }, [open]);

  // Squad do usuário assim que o perfil chega (async) — só se o campo não foi editado à mão.
  useEffect(() => {
    if (teamTouched) return;
    const userTeam = session?.activeProjectId || userProfile?.squadId || userProfile?.team;
    if (userTeam) setTeam(userTeam);
  }, [session, userProfile, teamTouched]);

  const activeSetupCount = Object.values(setupSettings).filter(Boolean).length;
  const allItems: ReadonlyArray<{ key: string; title: string; desc: string }> = SETUP_GROUPS.flatMap((g) => [...g.items]);
  const onLabels = allItems.filter((i) => setupSettings[i.key]).map((i) => i.title);

  const saveRoomMeta = (id: string, type: string, roomTitle: string, roomTeam: string) => {
    try {
      const saved = localStorage.getItem(ROOMS_META_KEY);
      const rooms = saved ? JSON.parse(saved) : [];
      const newMeta = { roomId: id, type, title: roomTitle, team: roomTeam, createdBy: session?.id, createdAt: new Date().toISOString() };
      localStorage.setItem(ROOMS_META_KEY, JSON.stringify([...rooms, newMeta]));
    } catch (e) {
      console.error('Erro ao salvar metadados da sala', e);
    }
  };

  const applyTemplate = (id: string) => {
    if (!id || id === BLANK_TEMPLATE) { setTemplateId(''); return; }
    setTemplateId(id);
    const t = templates.find((tp) => tp.id === id);
    if (!t) return;
    setDeckType(t.deckType);
    // Template de sala antiga (sem o campo) guarda o baralho completo.
    setMaxHours(effectiveMaxHours(t.settings?.maxHours));
    // O template manda: cada toggle exibido passa a refletir o que ele traz (ausente = desligado),
    // senão o modal mostraria uma coisa e a sala nasceria com outra.
    setSetupSettings((prev) => {
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach((k) => { next[k] = !!(t.settings as Record<string, unknown> | undefined)?.[k]; });
      return next;
    });
  };

  const handleCreate = async () => {
    if (isCreating) return;

    if (!session || !session.id) {
      console.error('[poker] Tentativa de criação de sala abortada: usuário nulo ou sem ID.');
      toast({
        title: 'Perfil não identificado',
        description: 'Não foi possível carregar a sua identidade. Defina seu perfil e tente de novo.',
        variant: 'destructive',
      });
      return;
    }

    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    if (saveAsTemplate && !templateName.trim()) {
      setShowAdvancedSetup(true);
      setTemplateNameError(true);
      return;
    }

    setIsCreating(true);

    // Template escolhido: herda baralho, configurações e backlog.
    const tpl = templates.find((t) => t.id === templateId);
    const backlogIssues = tpl
      ? tpl.backlog.map((b, idx) => ({
          id: genId(),
          title: b.title,
          key: null,
          jiraLink: b.jiraLink || '',
          status: idx === 0 ? 'active' : 'pending',
          estimatedPoints: null,
          type: b.type || 'dev',
        }))
      : [];

    // Só grava a equivalência dos tamanhos preenchidos com número válido (> 0).
    const tshirtEquivalentsClean = Object.fromEntries(
      Object.entries(tshirtEquivalents)
        .filter(([, v]) => v.value && Number(v.value) > 0)
        .map(([k, v]) => [k, { value: Number(v.value), unit: v.unit }])
    );

    const roomId = crypto.randomUUID();
    const newRoom = {
      id: roomId,
      votesRevealed: false,
      creatorId: session.id,
      timer: { status: 'stopped' as const, endTime: null, initialDuration: 120, remainingOnPause: 120 },
      title: title.trim(),
      team: team.trim() || session?.activeProjectId || userProfile?.squadId || 'Squad Geral',
      createdAt: new Date().toISOString(),
      issuesQueue: backlogIssues,
      activeIssueId: backlogIssues[0]?.id || null,
      participantIds: [session.id],
      mode,
      deckType: deckType as DeckType,
      revealedIssues: [],
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        ...(tpl ? tpl.settings : {}),
        ...setupSettings,
        maxHours,
        ...(Object.keys(tshirtEquivalentsClean).length ? { tshirtEquivalents: tshirtEquivalentsClean } : {}),
      },
    };

    try {
      const docRef = await pokerApi.saveOrUpdateRoom(newRoom as any);
      if (docRef && docRef.id) {
        saveRoomMeta(docRef.id, 'poker', title.trim(), team.trim() || 'Squad');
        if (saveAsTemplate) {
          const saved = saveTemplate({ name: cleanTemplateName(templateName), deckType: deckType as DeckType, settings: newRoom.settings as NonNullable<PokerTemplate['settings']>, backlog: tpl?.backlog ?? [] });
          toast({ title: 'Template salvo', description: saved.name });
        }
        onOpenChange(false);
        router.push(`/room/${docRef.id}`);
      } else {
        console.error('[poker] Resposta da API ao criar sala não veio com ID válido:', docRef);
        setIsCreating(false);
        toast({ title: 'Erro ao criar', description: 'O servidor não retornou um ID para a nova sala.', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Error creating poker room: ', error);
      setIsCreating(false);
      toast({ title: 'Erro ao criar', description: error?.message || 'Não foi possível iniciar a sala agora.', variant: 'destructive' });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      className="sm:max-w-[800px]"
      icon={WalletCards}
      title="Nova sessão"
      preventClose={isCreating}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={isCreating}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={handleCreate} disabled={isCreating} className="min-w-[140px] gap-2">
            {isCreating && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />}
            {isCreating ? 'Preparando…' : 'Criar sala'}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6 pt-3">
        {/* Nome, squad, template */}
        <div className="grid gap-3.5 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ns-name" className="text-[13px] font-semibold">Nome da sala</label>
            <input
              id="ns-name"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(false); }}
              placeholder="Ex.: Refinamento Sprint 43"
              aria-invalid={titleError}
              aria-describedby={titleError ? 'ns-name-error' : undefined}
              className={cn(FIELD, 'h-10', titleError && 'border-red-500/70')}
            />
            {titleError && <span id="ns-name-error" className="text-xs text-red-700 dark:text-red-300">Dê um nome à sala.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ns-squad" className="text-[13px] font-semibold">Squad</label>
            <input id="ns-squad" value={team} onChange={(e) => { setTeam(e.target.value); setTeamTouched(true); }} placeholder="Ex.: Phoenix" className={cn(FIELD, 'h-10')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ns-tpl" className="text-[13px] font-semibold">Template</label>
            <div className="flex items-center gap-2">
              <SelectField
                id="ns-tpl"
                aria-label="Template"
                value={templateId || BLANK_TEMPLATE}
                onChange={applyTemplate}
                options={[{ value: BLANK_TEMPLATE, label: 'Sessão em branco' }, ...templates.map((t) => ({ value: t.id, label: `${t.name} · ${t.backlog.length} ${t.backlog.length === 1 ? 'tarefa' : 'tarefas'}` }))]}
                className="h-10 min-w-0 flex-1 text-sm"
              />
              {templates.length > 0 && <IconButton label="Gerenciar templates" icon={Settings2} onClick={() => setManagerOpen(true)} className="h-10 w-10" />}
            </div>
          </div>
        </div>

        {/* Baralho */}
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2.5 p-0 text-[13px] font-semibold">Baralho</legend>
          <div role="radiogroup" aria-label="Baralho" className="grid gap-3 sm:grid-cols-3">
            {DECK_OPTIONS.map((opt) => {
              const selected = deckType === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDeckType(opt.key)}
                  className={cn(
                    'flex flex-col gap-3 rounded-[14px] border p-3.5 text-left transition-[transform,background-color,border-color,box-shadow] duration-fast hover:-translate-y-0.5',
                    FOCUS_RING,
                    selected ? 'border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.2)] dark:bg-primary/15 [.theme-leitura_&]:shadow-none' : 'border-border hover:bg-accent/40'
                  )}
                >
                  <DeckFan sample={opt.sample} selected={selected} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{opt.name}</span>
                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                  </span>
                  <span className="text-[11px] leading-relaxed text-muted-foreground tabular-nums">
                    {getDeckCards(opt.key, opt.key === 'hours' ? maxHours : undefined).map((v) => (v === '☕' ? 'café' : v)).join(' · ')}
                  </span>
                </button>
              );
            })}
          </div>

          {deckType === 'hours' && (
            <div className="room-rise flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <label htmlFor="ns-max-hours" className="text-[13px] font-semibold">Horas máximas do baralho</label>
              <MaxHoursField id="ns-max-hours" value={maxHours} onChange={setMaxHours} />
            </div>
          )}

          {deckType === 'tshirt' && (
            <div className="room-rise flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <span className="text-[13px] font-semibold">
                Equivalência <span className="font-normal text-muted-foreground">(opcional — com ela o resultado calcula em horas)</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(['PP', 'P', 'M', 'G', 'GG'] as const).map((size) => (
                  <div key={size} className="flex flex-col gap-1">
                    <span className="text-center text-[13px] font-bold tabular-nums">{size}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={tshirtEquivalents[size]?.value || ''}
                      onChange={(e) => setTshirtEquivalents((s) => ({ ...s, [size]: { value: e.target.value, unit: s[size]?.unit || 'hora' } }))}
                      placeholder="0"
                      aria-label={`Quantidade para ${size}`}
                      className={cn(FIELD, 'h-8 px-2 text-center text-[13px]')}
                    />
                    <SelectField
                      aria-label={`Unidade para ${size}`}
                      value={tshirtEquivalents[size]?.unit || 'hora'}
                      onChange={(v) => setTshirtEquivalents((st) => ({ ...st, [size]: { value: st[size]?.value || '', unit: v as TshirtUnit } }))}
                      options={UNIT_OPTIONS}
                      className="h-8 gap-1 px-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        {/* Modo */}
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2.5 p-0 text-[13px] font-semibold">Modo</legend>
          <div role="radiogroup" aria-label="Modo" className="grid gap-3 sm:grid-cols-2">
            {MODE_OPTIONS.map((opt) => {
              const selected = mode === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMode(opt.key)}
                  className={cn(
                    'flex items-start gap-3.5 rounded-[14px] border px-4 py-3.5 text-left transition-[transform,background-color,border-color] duration-fast hover:-translate-y-0.5',
                    FOCUS_RING,
                    selected ? 'border-primary bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/40'
                  )}
                >
                  <IconTile icon={opt.icon} tone={selected ? 'brand' : 'neutral'} size="md" className="h-[38px] w-[38px]" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{opt.name} <span className="text-xs font-medium text-muted-foreground">· {opt.tagline}</span></span>
                    <span className="text-xs leading-snug text-muted-foreground">{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Recursos da sessão */}
        <section aria-label="Recursos da sessão" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[13px] font-semibold">Recursos da sessão</span>
            <StatusChip>{activeSetupCount} de {SETUP_TOTAL}</StatusChip>
            <span className="flex-1" />
            <ModalButton className="h-8 px-3 text-[13px]" aria-expanded={showAdvancedSetup} onClick={() => setShowAdvancedSetup((v) => !v)}>
              {showAdvancedSetup ? 'Ocultar' : 'Personalizar'}
            </ModalButton>
            <ModalButton variant="ghost" className="h-8 text-[13px]" onClick={() => setSetupSettings(baseSetupSettings())}>Padrão</ModalButton>
            <ModalButton variant="ghost" className="h-8 text-[13px]" onClick={() => setSetupSettings((s) => Object.fromEntries(Object.keys(s).map((k) => [k, false])))}>Nenhum</ModalButton>
          </div>

          {showAdvancedSetup ? (
            <div className="room-rise grid gap-3 sm:grid-cols-2">
              {SETUP_GROUPS.map((group) => (
                <div key={group.label} className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-3">
                  <span className="mb-1 text-[11px] font-bold text-muted-foreground">{group.label}</span>
                  {group.items.map((cfg) => (
                    <div key={cfg.key} className="flex items-center justify-between gap-2.5 py-1.5">
                      <label htmlFor={`ns-${cfg.key}`} className="flex min-w-0 cursor-pointer flex-col">
                        <span className="text-[13px] font-semibold">{cfg.title}</span>
                        <span className="text-[11px] text-muted-foreground">{cfg.desc}</span>
                      </label>
                      <Switch id={`ns-${cfg.key}`} checked={!!setupSettings[cfg.key]} onCheckedChange={(v) => setSetupSettings((s) => ({ ...s, [cfg.key]: v }))} className="shrink-0" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {onLabels.length === 0 ? (
                <span className="text-xs text-muted-foreground">Nenhum recurso ligado.</span>
              ) : (
                onLabels.map((label) => (
                  <span key={label} className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 text-xs">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" /> {label}
                  </span>
                ))
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2.5">
              <label htmlFor="ns-save-tpl" className="flex min-w-0 cursor-pointer items-center gap-2 text-[13px] font-semibold">
                <Save className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Salvar estas configurações como template
              </label>
              <Switch id="ns-save-tpl" checked={saveAsTemplate} onCheckedChange={(v) => { setSaveAsTemplate(v); setTemplateNameError(false); if (v && !templateName) setTemplateName(title.trim()); }} className="shrink-0" />
            </div>
            {saveAsTemplate && (
              <div className="room-rise flex flex-col gap-1.5">
                <label htmlFor="ns-tpl-name" className="text-xs font-semibold text-muted-foreground">Nome do template</label>
                <input
                  id="ns-tpl-name"
                  value={templateName}
                  maxLength={TEMPLATE_NAME_MAX}
                  onChange={(e) => { setTemplateName(e.target.value); if (templateNameError) setTemplateNameError(false); }}
                  placeholder="Ex.: Refinamento quinzenal"
                  aria-invalid={templateNameError}
                  aria-describedby={templateNameError ? 'ns-tpl-name-error' : undefined}
                  className={cn(FIELD, 'h-9 text-[13px]', templateNameError && 'border-red-500/70')}
                />
                {templateNameError && <span id="ns-tpl-name-error" className="text-xs text-red-700 dark:text-red-300">Dê um nome ao template.</span>}
              </div>
            )}
          </div>
        </section>
      </div>

      <TemplateManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        templates={templates}
        onRename={(id, name) => { renameTemplate(id, name); setTemplates(listTemplates()); }}
        onDelete={(id) => { deleteTemplate(id); setTemplates(listTemplates()); if (templateId === id) setTemplateId(''); }}
      />
    </Modal>
  );
}
