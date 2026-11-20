'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  Eraser,
  Frown,
  Hash,
  Info,
  List,
  ListChecks,
  Lock,
  Meh,
  Plus,
  RotateCcw,
  Smile,
  TrafficCone,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import {
  ConfirmDialog,
  FIELD,
  FOCUS_RING,
  Modal,
  ModalButton,
  SelectField,
  StatusChip,
  TabBar,
  type TabBarItem,
} from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { errorMessage } from '@/lib/ceremony-api';
import { DEFAULT_HEALTH_CHECK_DIMENSIONS } from '@/lib/health-check-defaults';
import {
  MAX_DESCRIPTION,
  MAX_DIMENSIONS,
  MAX_TITLE,
  cleanDimensions,
  newDimensionKey,
  parseBulkDimensions,
  remainingSlots,
  validateForm,
} from '@/lib/health-check-form';
import { squadChoices } from '@/lib/health-check-lobby';
import { HEALTH_CHECK_TEMPLATES } from '@/lib/health-check-templates';
import { moduleIcon } from '@/lib/modules-registry';
import type { HealthCheckDimension, HealthCheckScaleType } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface CreateHealthCheckInput {
  dimensions: HealthCheckDimension[];
  title: string;
  /** Chave da squad escolhida (vazia sem squad). */
  team: string;
  scaleType: HealthCheckScaleType;
}

interface CreateHealthCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cria o radar; deve lançar erro se falhar (o diálogo mostra a falha e mantém o que foi digitado). */
  onCreateBoard: (input: CreateHealthCheckInput) => Promise<void>;
  isCreating: boolean;
}

/** Mesma chave de antes: as perguntas padrão já salvas continuam valendo. */
const CUSTOM_DIMENSIONS_KEY = 'custom-health-check-dimensions';
const MINE = 'mine';
const LABEL = 'text-[13px] font-semibold text-foreground';

const SCALES: { id: HealthCheckScaleType; name: string; desc: string; icon: LucideIcon }[] = [
  { id: 'traffic_light', name: 'Semáforo', desc: 'Verde, amarelo e vermelho: ótimo, atenção, ruim.', icon: TrafficCone },
  { id: 'numbers_5', name: 'Numérica de 1 a 5', desc: 'Nota de 1 (crítico) a 5 (muito bom).', icon: Hash },
  { id: 'emojis', name: 'Emocional', desc: 'Bom, médio e ruim, com rostos de linha.', icon: Smile },
];

function ScalePreview({ scale }: { scale: HealthCheckScaleType }) {
  if (scale === 'numbers_5') {
    return (
      <span aria-hidden="true" className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold tabular-nums">{n}</span>
        ))}
      </span>
    );
  }
  if (scale === 'emojis') {
    return (
      <span aria-hidden="true" className="flex items-center gap-1.5">
        <Smile className="h-5 w-5 text-emerald-700 dark:text-emerald-300" strokeWidth={1.5} />
        <Meh className="h-5 w-5 text-amber-700 dark:text-amber-300" strokeWidth={1.5} />
        <Frown className="h-5 w-5 text-red-700 dark:text-red-300" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="flex items-center gap-1.5">
      <span className="h-3.5 w-3.5 rounded-full bg-emerald-600" />
      <span className="h-3.5 w-3.5 rounded-full bg-amber-500" />
      <span className="h-3.5 w-3.5 rounded-full bg-red-600" />
    </span>
  );
}

function readStoredDimensions(): HealthCheckDimension[] | null {
  try {
    const raw = localStorage.getItem(CUSTOM_DIMENSIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as HealthCheckDimension[]) : null;
  } catch {
    return null;
  }
}

/**
 * Nova pesquisa do Radar de clima (Modal G em duas abas): modelo e escala; perguntas. A squad é a do vínculo
 * (nunca texto livre), o título é obrigatório e as falhas aparecem aqui dentro, com o que foi digitado mantido.
 */
export function CreateHealthCheckDialog({ open, onOpenChange, onCreateBoard, isCreating }: CreateHealthCheckDialogProps) {
  const { toast } = useToast();
  const { squadId: activeSquadId, squadName: activeSquadName } = useActiveSquad();
  const { memberships } = useMyMemberships();
  const squads = useMemo(
    () => squadChoices(memberships?.memberships, { squadId: activeSquadId, squadName: activeSquadName }),
    [memberships, activeSquadId, activeSquadName]
  );

  const [tab, setTab] = useState<'model' | 'questions'>('model');
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [squad, setSquad] = useState('');
  const [templateId, setTemplateId] = useState('spotify');
  const [scaleType, setScaleType] = useState<HealthCheckScaleType>('traffic_light');
  const [dimensions, setDimensions] = useState<HealthCheckDimension[]>([]);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [stored, setStored] = useState<HealthCheckDimension[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Ao abrir: as perguntas padrão deste navegador (se houver) ou as do modelo clássico.
  useEffect(() => {
    if (!open) return;
    const saved = readStoredDimensions();
    setStored(saved);
    setTab('model');
    setTitleError(false);
    setFailure(null);
    setImporting(false);
    setBulkText('');
    setSaveAsDefault(false);
    if (saved) {
      setTemplateId(MINE);
      setDimensions(saved);
    } else {
      setTemplateId('spotify');
      setDimensions(DEFAULT_HEALTH_CHECK_DIMENSIONS);
    }
    setScaleType('traffic_light');
  }, [open]);

  // A squad do cabeçalho é a sugerida; mudar de squad com a janela aberta não pisa na escolha da pessoa.
  useEffect(() => {
    if (!open) return;
    setSquad((current) => (current && squads.some((s) => s.value === current) ? current : activeSquadId || squads[0]?.value || ''));
  }, [open, activeSquadId, squads]);

  const templateOptions = useMemo(
    () => [
      ...HEALTH_CHECK_TEMPLATES.map((t) => ({ value: t.id, label: t.name })),
      ...(stored ? [{ value: MINE, label: 'Meu padrão (neste navegador)' }] : []),
    ],
    [stored]
  );

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    if (id === MINE) {
      if (stored) setDimensions(stored);
      return;
    }
    const template = HEALTH_CHECK_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    setDimensions(template.dimensions);
    setScaleType(template.defaultScale);
    toast({ title: `Modelo ${template.name} carregado` });
  };

  const restore = () => {
    const template = HEALTH_CHECK_TEMPLATES.find((t) => t.id === templateId);
    setDimensions(template ? template.dimensions : DEFAULT_HEALTH_CHECK_DIMENSIONS);
    setScaleType(template ? template.defaultScale : 'traffic_light');
    toast({ title: 'Perguntas do modelo restauradas' });
  };

  const forgetDefault = () => {
    try { localStorage.removeItem(CUSTOM_DIMENSIONS_KEY); } catch { /* sem armazenamento: nada a esquecer */ }
    setStored(null);
    if (templateId === MINE) setTemplateId('spotify');
    toast({ title: 'Padrão deste navegador esquecido' });
  };

  const change = (index: number, field: 'title' | 'description', value: string) =>
    setDimensions((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));

  const remove = (key: string) => setDimensions((prev) => prev.filter((d) => d.key !== key));

  const slots = remainingSlots(dimensions.length);
  const canAdd = newTitle.trim() !== '' && slots > 0;

  const quickAdd = () => {
    if (!canAdd) return;
    setDimensions((prev) => [...prev, { key: newDimensionKey(), title: newTitle.trim(), description: newDesc.trim() }]);
    setNewTitle('');
    setNewDesc('');
  };

  const parsed = useMemo(() => parseBulkDimensions(bulkText), [bulkText]);
  const overLimit = parsed.length > slots;

  const importBulk = () => {
    if (parsed.length === 0) {
      setImporting(false);
      return;
    }
    if (overLimit) return;
    setDimensions((prev) => [...prev, ...parsed.map((d) => ({ key: newDimensionKey('import'), ...d }))]);
    setBulkText('');
    setImporting(false);
    toast({ title: parsed.length === 1 ? 'Pergunta importada' : `${parsed.length} perguntas importadas` });
  };

  const errors = validateForm(title, dimensions);

  const submit = async () => {
    if (isCreating) return;
    setFailure(null);
    if (errors.title) {
      setTitleError(true);
      setTab('model');
      return;
    }
    if (errors.dimensions) {
      setTab('questions');
      return;
    }
    const clean = cleanDimensions(dimensions);
    if (saveAsDefault) {
      try { localStorage.setItem(CUSTOM_DIMENSIONS_KEY, JSON.stringify(clean)); } catch { /* sem armazenamento: o padrão não é salvo */ }
    }
    try {
      await onCreateBoard({ dimensions: clean, title: title.trim(), team: squad, scaleType });
      setTitle('');
    } catch (e) {
      console.error('Erro ao criar o radar', e);
      setFailure(errorMessage(e, 'Não foi possível criar a pesquisa agora.'));
    }
  };

  const tabs: TabBarItem<'model' | 'questions'>[] = [
    { id: 'model', label: 'Modelo e escala' },
    { id: 'questions', label: `Perguntas (${dimensions.length})` },
  ];
  const noSquad = squads.length === 0;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        icon={moduleIcon('health')}
        title="Nova pesquisa"
        description={
          tab === 'questions' && importing
            ? 'Importação em massa de perguntas.'
            : tab === 'questions'
              ? `Edite títulos e perguntas, adicione as suas ou cole uma lista. No máximo ${MAX_DIMENSIONS}.`
              : 'Anônima e sem texto obrigatório. Quem cria encerra e gera o resultado.'
        }
        preventClose={isCreating}
        headerExtra={
          <div className="shrink-0 border-b border-border">
            <TabBar
              label="Etapas da nova pesquisa"
              idPrefix="health-create"
              value={tab}
              onChange={setTab}
              tabs={tabs}
              className="border-b-0"
            />
          </div>
        }
        bodyClassName="px-6 pb-6 pt-5"
        footerStart={<ModalButton variant="ghost" onClick={() => onOpenChange(false)} disabled={isCreating}>Cancelar</ModalButton>}
        footer={
          <>
            {tab === 'questions' && !importing && (
              <ModalButton className="gap-1.5" onClick={() => setTab('model')} disabled={isCreating}>
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Voltar
              </ModalButton>
            )}
            <ModalButton variant="primary" className="gap-2" onClick={submit} disabled={isCreating}>
              {isCreating ? 'Criando…' : 'Iniciar pesquisa'}
              {!isCreating && <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
            </ModalButton>
          </>
        }
      >
        {tab === 'model' ? (
          <div role="tabpanel" id="health-create-panel-model" aria-labelledby="health-create-tab-model" className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="health-template" className={LABEL}>Modelo</label>
                <SelectField id="health-template" aria-label="Modelo de perguntas" value={templateId} onChange={pickTemplate} options={templateOptions} className="h-11" />
                <p className="m-0 text-xs text-muted-foreground">Carrega as perguntas e a escala do modelo. Dá para editar na aba Perguntas.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="health-squad" className={LABEL}>Squad</label>
                {squads.length > 1 ? (
                  <SelectField id="health-squad" aria-label="Squad da pesquisa" value={squad} onChange={setSquad} options={squads} className="h-11" />
                ) : (
                  <div id="health-squad" className={cn(FIELD, 'flex h-11 items-center justify-between gap-2 opacity-90')} aria-label="Squad da pesquisa">
                    <span className="truncate">{squads[0]?.label ?? 'Sem squad'}</span>
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                )}
                <p className="m-0 text-xs text-muted-foreground">
                  {noSquad
                    ? 'Você ainda não tem squad: a pesquisa não aparece em nenhuma lista, só por link.'
                    : squads.length > 1
                      ? 'As squads do seu vínculo. A pesquisa aparece na lista da squad escolhida.'
                      : 'A squad ativa no cabeçalho. A pesquisa aparece na lista dela.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="health-title" className={LABEL}>Título da pesquisa</label>
              <input
                id="health-title"
                autoFocus
                value={title}
                maxLength={MAX_TITLE}
                onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
                placeholder="Ex.: Radar Sprint 45"
                aria-invalid={titleError}
                aria-describedby={titleError ? 'health-title-error' : undefined}
                className={cn(FIELD, 'h-11', titleError && 'border-red-500/60')}
              />
              {titleError && (
                <p id="health-title-error" role="alert" className="m-0 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> {errors.title ?? 'Dê um título para a pesquisa.'}
                </p>
              )}
            </div>

            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 p-0 text-[13px] font-semibold text-muted-foreground">Escala de resposta</legend>
              <div role="radiogroup" aria-label="Escala de resposta" className="flex flex-col gap-2">
                {SCALES.map((s) => {
                  const on = scaleType === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setScaleType(s.id)}
                      className={cn(
                        'flex min-h-[56px] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-base max-sm:min-h-14',
                        on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/50',
                        FOCUS_RING
                      )}
                    >
                      <s.icon className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-bold">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{s.desc}</span>
                      </span>
                      <ScalePreview scale={s.id} />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <label className="flex min-h-10 cursor-pointer items-center gap-3 max-sm:min-h-11">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  className={cn('h-4 w-4 accent-[hsl(var(--primary))]', FOCUS_RING)}
                />
                <span className="text-sm text-foreground">Usar estas perguntas como padrão neste navegador</span>
              </label>
              {stored && (
                <button type="button" onClick={forgetDefault} className={cn('self-start rounded-md px-1 text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline', FOCUS_RING)}>
                  Esquecer o padrão salvo
                </button>
              )}
            </div>

            {failure && (
              <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span><strong>Não foi possível criar a pesquisa agora.</strong> {failure} O que você digitou foi mantido. Confira a conexão e tente de novo.</span>
              </p>
            )}
          </div>
        ) : importing ? (
          <div role="tabpanel" id="health-create-panel-questions" aria-labelledby="health-create-tab-questions" className="flex flex-col gap-4">
            <p className="m-0 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <span>
                Cole uma dimensão por linha. Use <strong>-</strong> ou <strong>:</strong> para separar o título da pergunta.
                <br />
                Exemplo: <strong>Autonomia - Temos poder de decisão?</strong>
              </span>
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="health-bulk" className={LABEL}>Lista de dimensões</label>
              <textarea
                id="health-bulk"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={9}
                placeholder="Autonomia - Temos poder de decisão?"
                className={cn(FIELD, 'resize-y py-2.5 leading-relaxed')}
              />
              <p className={cn('m-0 text-xs', overLimit ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')} aria-live="polite">
                {overLimit
                  ? `Passa do limite: cabem mais ${slots} (o máximo é ${MAX_DIMENSIONS}).`
                  : parsed.length === 0
                    ? 'Nenhuma linha reconhecida ainda.'
                    : `${parsed.length} ${parsed.length === 1 ? 'linha será criada' : 'linhas serão criadas'}.`}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <ModalButton className="gap-2" onClick={() => { setImporting(false); setBulkText(''); }}>
                <List className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Voltar para a lista
              </ModalButton>
              <ModalButton variant="primary" className="gap-2" onClick={importBulk} disabled={parsed.length === 0 || overLimit}>
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {parsed.length === 0 ? 'Adicionar' : parsed.length === 1 ? 'Adicionar 1 dimensão' : `Adicionar as ${parsed.length} dimensões`}
              </ModalButton>
            </div>
          </div>
        ) : (
          <div role="tabpanel" id="health-create-panel-questions" aria-labelledby="health-create-tab-questions" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 flex items-center gap-2 text-sm font-bold">
                Perguntas da pesquisa
                <StatusChip tone="brand">{dimensions.length} de {MAX_DIMENSIONS}</StatusChip>
              </h3>
              <span className="flex-1" />
              <ModalButton className="h-9 gap-2 text-[13px]" onClick={() => setImporting(true)}>
                <Upload className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Importar em massa
              </ModalButton>
              <ModalButton variant="ghost" className="h-9 gap-2 text-[13px]" onClick={() => setConfirmClear(true)} disabled={dimensions.length === 0}>
                <Eraser className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Limpar tudo
              </ModalButton>
            </div>

            {errors.dimensions && dimensions.length === 0 && (
              <p role="alert" className="m-0 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> {errors.dimensions}
              </p>
            )}

            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {dimensions.map((d, i) => (
                <li key={d.key} className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
                  <span aria-hidden="true" className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold tabular-nums text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">{i + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <input
                      value={d.title}
                      maxLength={MAX_TITLE}
                      onChange={(e) => change(i, 'title', e.target.value)}
                      placeholder="Título da dimensão"
                      aria-label={`Título da pergunta ${i + 1}`}
                      className={cn(FIELD, 'h-9 bg-transparent px-2 font-bold')}
                    />
                    <input
                      value={d.description}
                      maxLength={MAX_DESCRIPTION}
                      onChange={(e) => change(i, 'description', e.target.value)}
                      placeholder="Pergunta que guia o time"
                      aria-label={`Pergunta ${i + 1}`}
                      className={cn(FIELD, 'h-9 bg-transparent px-2 text-[13px]')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(d.key)}
                    aria-label={`Remover ${d.title.trim() || `a pergunta ${i + 1}`}`}
                    title="Remover"
                    className={cn('mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-red-700 dark:hover:text-red-300 max-sm:h-11 max-sm:w-11', FOCUS_RING)}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-3 sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label htmlFor="health-new-title" className="text-xs font-semibold text-muted-foreground">Nova dimensão</label>
                <input
                  id="health-new-title"
                  value={newTitle}
                  maxLength={MAX_TITLE}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); }}
                  placeholder="Ex.: Missão"
                  disabled={slots === 0}
                  className={cn(FIELD, 'h-10')}
                />
              </div>
              <div className="flex min-w-0 flex-[1.4] flex-col gap-1.5">
                <label htmlFor="health-new-desc" className="text-xs font-semibold text-muted-foreground">Pergunta que guia o time</label>
                <input
                  id="health-new-desc"
                  value={newDesc}
                  maxLength={MAX_DESCRIPTION}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); }}
                  placeholder="O time sabe para onde está indo?"
                  disabled={slots === 0}
                  className={cn(FIELD, 'h-10')}
                />
              </div>
              <ModalButton variant="primary" className="gap-2" onClick={quickAdd} disabled={!canAdd}>
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Adicionar
              </ModalButton>
            </div>
            {slots === 0 && <p className="m-0 text-xs text-muted-foreground">Você chegou ao limite de {MAX_DIMENSIONS} perguntas.</p>}

            <div className="flex justify-center">
              <ModalButton variant="ghost" className="gap-2 text-[13px]" onClick={restore}>
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Restaurar as perguntas do modelo
              </ModalButton>
            </div>

            {failure && (
              <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span><strong>Não foi possível criar a pesquisa agora.</strong> {failure} O que você digitou foi mantido.</span>
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        tone="warn"
        icon={ListChecks}
        title="Limpar todas as perguntas?"
        description="A lista fica vazia. Você pode restaurar as perguntas do modelo ou escrever as suas."
        confirmLabel="Limpar tudo"
        onConfirm={() => setDimensions([])}
      />
    </>
  );
}
