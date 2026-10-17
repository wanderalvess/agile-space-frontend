'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { retroApi } from '@/app/retro/api';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { FIELD, FOCUS_RING, IconButton, Modal, ModalButton, SelectField, SettingRow } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import {
  DEFAULT_CUSTOM_COLUMNS,
  DEFAULT_HEALTH_CHECK_QUESTION,
  DEFAULT_SETUP_SETTINGS,
  MAX_CUSTOM_COLUMNS,
  MIN_CUSTOM_COLUMNS,
  RETRO_FORMATS,
  SETUP_TOGGLES,
  buildNewRetroBoard,
  formatColumns,
  validateNewRetro,
  type CustomColumnDraft,
  type SetupSettings,
} from '@/lib/retro-formats';
import { listTemplates, saveTemplate, type RetroTemplate } from '@/lib/retro-templates';
import { RETRO_TEMPLATES, type RetroTemplateKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { columnTone } from './retro-tones';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';
const BLANK_FORMAT = '__blank';

/** Guarda a retro criada na lista "abertas neste navegador" do lobby. */
function saveRoomMeta(roomId: string, title: string, team: string, createdBy?: string) {
  try {
    const saved = localStorage.getItem(ROOMS_META_KEY);
    const rooms = saved ? JSON.parse(saved) : [];
    localStorage.setItem(ROOMS_META_KEY, JSON.stringify([...rooms, { roomId, type: 'retro', title, team, createdBy, createdAt: new Date().toISOString() }]));
  } catch (e) {
    console.error('Erro ao salvar metadados da sala', e);
  }
}

interface CreateRetroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Avisa a tela de fora enquanto o quadro está sendo criado. */
  onCreatingChange?: (creating: boolean) => void;
  /** Formato salvo para já começar aplicado (botão "Usar" do lobby). */
  presetFormatId?: string;
}

/**
 * "Nova retro": título, squad, formato das colunas (ou colunas próprias), opções do facilitador e, se quiser,
 * salvar o formato para a próxima vez. Cria o quadro e leva a pessoa para a sala.
 */
export function CreateRetroDialog({ open, onOpenChange, onCreatingChange, presetFormatId }: CreateRetroDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const { squadId: activeSquadId } = useActiveSquad();

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [team, setTeam] = useState('');
  const [teamTouched, setTeamTouched] = useState(false);
  const [template, setTemplate] = useState<RetroTemplateKey>('classic');
  const [customColumns, setCustomColumns] = useState<CustomColumnDraft[]>(DEFAULT_CUSTOM_COLUMNS);
  const [settings, setSettings] = useState<SetupSettings>(DEFAULT_SETUP_SETTINGS);
  const [healthCheckQuestion, setHealthCheckQuestion] = useState('');
  const [saveFormat, setSaveFormat] = useState(false);
  const [savedFormats, setSavedFormats] = useState<RetroTemplate[]>([]);
  const [savedFormatId, setSavedFormatId] = useState(BLANK_FORMAT);
  const [sprintId, setSprintId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const applySaved = (id: string) => {
    setSavedFormatId(id);
    const tpl = savedFormats.find((t) => t.id === id);
    if (!tpl) return;
    setTemplate(tpl.template);
    setCustomColumns(tpl.customColumns.length ? tpl.customColumns : DEFAULT_CUSTOM_COLUMNS);
    setSettings({ ...DEFAULT_SETUP_SETTINGS, ...tpl.setupSettings });
  };

  // A cada abertura: formatos salvos, parâmetros de navegação (?squad, ?sprintId) e, se pedido, o formato "Usar".
  useEffect(() => {
    if (!open) return;
    const list = listTemplates();
    setSavedFormats(list);
    const params = new URLSearchParams(window.location.search);
    const sprintParam = params.get('sprintId');
    if (sprintParam) setSprintId(sprintParam);
    const squadParam = params.get('squad');
    if (squadParam && !teamTouched) setTeam(squadParam);
    const preset = presetFormatId ? list.find((t) => t.id === presetFormatId) : undefined;
    if (preset) {
      setSavedFormatId(preset.id);
      setTemplate(preset.template);
      setCustomColumns(preset.customColumns.length ? preset.customColumns : DEFAULT_CUSTOM_COLUMNS);
      setSettings({ ...DEFAULT_SETUP_SETTINGS, ...preset.setupSettings });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetFormatId]);

  // Preenche a squad com a ativa assim que o perfil carrega — só enquanto ninguém mexeu no campo.
  useEffect(() => {
    if (teamTouched || team) return;
    if (activeSquadId) setTeam(activeSquadId);
  }, [activeSquadId, teamTouched, team]);

  const reset = () => {
    setTitle('');
    setTitleError(false);
    setTemplate('classic');
    setCustomColumns(DEFAULT_CUSTOM_COLUMNS);
    setSettings(DEFAULT_SETUP_SETTINGS);
    setHealthCheckQuestion('');
    setSaveFormat(false);
    setSavedFormatId(BLANK_FORMAT);
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const setCreating = (value: boolean) => {
    setIsCreating(value);
    onCreatingChange?.(value);
  };

  const handleCreate = async () => {
    if (isCreating) return;
    if (!userProfile?.id) {
      toast({ title: 'Perfil não identificado', description: 'Não foi possível carregar a sua identidade. Defina seu perfil e tente de novo.', variant: 'destructive' });
      return;
    }
    const problem = validateNewRetro({ title, template, customColumns });
    if (problem === 'no-title') {
      setTitleError(true);
      return;
    }
    if (problem === 'custom-columns') {
      toast({ title: 'Revise as colunas', description: 'Dê nome a pelo menos 2 colunas, sem nomes repetidos.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    const newBoard = buildNewRetroBoard({
      id: crypto.randomUUID(),
      userId: userProfile.id,
      title,
      team,
      template,
      customColumns,
      settings,
      healthCheckQuestion,
      squadId: activeSquadId || undefined,
      sprintId: sprintId || undefined,
    });

    try {
      const created = await retroApi.saveOrUpdateBoard(newBoard);
      if (created && created.id) {
        saveRoomMeta(created.id, title.trim(), newBoard.team || 'Squad Geral', userProfile.id);
        if (saveFormat) {
          saveTemplate({ name: title.trim(), template, customColumns: customColumns.filter((c) => c.title.trim()), setupSettings: settings });
        }
        onOpenChange(false);
        router.push(`/retro/${created.id}`);
      } else {
        console.error('[retro] Resposta da API ao criar quadro não veio com ID válido:', created);
        setCreating(false);
        toast({ title: 'Erro ao criar', description: 'O servidor não retornou um ID para o novo quadro.', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Error creating retro board: ', error);
      setCreating(false);
      toast({ title: 'Erro ao criar', description: error?.message || 'Não foi possível iniciar o quadro agora.', variant: 'destructive' });
    }
  };

  const formats = useMemo(
    () => RETRO_FORMATS.map((f) => ({ ...f, columns: f.key === 'custom' ? null : formatColumns(f.key) ?? RETRO_TEMPLATES.classic })),
    []
  );

  const updateColumn = (index: number, patch: Partial<CustomColumnDraft>) =>
    setCustomColumns((cols) => cols.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!next) close(); else onOpenChange(true); }}
      size="lg"
      className="sm:max-w-[860px]"
      icon={moduleIcon('retro')}
      title="Nova retro"
      preventClose={isCreating}
      footerStart={
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <input type="checkbox" checked={saveFormat} onChange={(e) => setSaveFormat(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          Salvar este formato para a próxima vez
        </label>
      }
      footer={
        <>
          <ModalButton onClick={close} disabled={isCreating}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={() => void handleCreate()} disabled={isCreating} className="min-w-[132px] gap-2">
            {isCreating && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />}
            {isCreating ? 'Preparando…' : 'Criar retro'}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6 pt-3">
        {/* Título, squad e formato salvo */}
        <div className={cn('grid gap-3.5', savedFormats.length > 0 ? 'sm:grid-cols-[1.4fr_1fr_1fr]' : 'sm:grid-cols-[1.4fr_1fr]')}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nr-title" className="text-[13px] font-semibold">Título</label>
            <input
              id="nr-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(false); }}
              placeholder="Ex.: Retro Sprint 43"
              aria-invalid={titleError}
              aria-describedby={titleError ? 'nr-title-error' : undefined}
              className={cn(FIELD, 'h-10', titleError && 'border-red-500/70')}
            />
            {titleError && <span id="nr-title-error" className="text-xs text-red-700 dark:text-red-300">Dê um nome à retro.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nr-squad" className="text-[13px] font-semibold">Squad</label>
            <input id="nr-squad" value={team} onChange={(e) => { setTeam(e.target.value); setTeamTouched(true); }} placeholder="Ex.: Phoenix" className={cn(FIELD, 'h-10')} />
          </div>
          {savedFormats.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nr-saved" className="text-[13px] font-semibold">Formato salvo</label>
              <SelectField
                id="nr-saved"
                aria-label="Formato salvo"
                value={savedFormatId}
                onChange={(v) => (v === BLANK_FORMAT ? setSavedFormatId(BLANK_FORMAT) : applySaved(v))}
                options={[{ value: BLANK_FORMAT, label: 'Retro em branco' }, ...savedFormats.map((t) => ({ value: t.id, label: t.name }))]}
                className="h-10 text-sm"
              />
            </div>
          )}
        </div>

        {/* Formato */}
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2.5 p-0 text-[13px] font-semibold">Formato</legend>
          <div role="radiogroup" aria-label="Formato das colunas" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
            {formats.map((f) => {
              const selected = template === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTemplate(f.key)}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border p-3 text-left transition-[transform,background-color,border-color] duration-fast hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
                    FOCUS_RING,
                    selected ? 'border-primary bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/40'
                  )}
                >
                  <span aria-hidden="true" className="flex h-[26px] gap-[3px]">
                    {f.columns ? (
                      f.columns.map((col) => <span key={col.id} className={cn('flex-1 rounded-[3px] opacity-85', columnTone(col.theme).bar)} />)
                    ) : (
                      [0, 1, 2].map((i) => <span key={i} className="flex-1 rounded-[3px] bg-muted-foreground/40" />)
                    )}
                  </span>
                  <span className="text-[13px] font-bold leading-tight">{f.name}</span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {f.columns ? f.columns.map((c) => c.title.replace(/\s*\(.*\)\s*$/, '')).join(' · ') : 'Você define · de 2 a 6 colunas'}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {template === 'custom' && (
          <section aria-label="Colunas do formato personalizado" className="room-rise flex flex-col gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">Colunas <span className="font-normal text-muted-foreground">({MIN_CUSTOM_COLUMNS} a {MAX_CUSTOM_COLUMNS})</span></span>
              {customColumns.length < MAX_CUSTOM_COLUMNS && (
                <ModalButton className="h-8 gap-1.5 px-3 text-[13px]" onClick={() => setCustomColumns((cols) => [...cols, { title: '', theme: 'neutral' }])}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Adicionar coluna
                </ModalButton>
              )}
            </div>
            {customColumns.map((col, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  value={col.title}
                  onChange={(e) => updateColumn(i, { title: e.target.value })}
                  placeholder={`Coluna ${i + 1}`}
                  aria-label={`Nome da coluna ${i + 1}`}
                  maxLength={40}
                  className={cn(FIELD, 'h-9 min-w-[10rem] flex-1')}
                />
                <div role="group" aria-label={`Tipo da coluna ${i + 1}`} className="inline-flex gap-[3px] rounded-lg border border-border bg-background p-[3px]">
                  {([['neutral', 'Cartões'], ['action', 'Ações']] as const).map(([theme, label]) => {
                    const on = theme === 'action' ? col.theme === 'action' : col.theme !== 'action';
                    return (
                      <button
                        key={theme}
                        type="button"
                        aria-pressed={on}
                        onClick={() => updateColumn(i, { theme })}
                        className={cn('h-[30px] rounded-md px-3 text-[13px] transition-colors', FOCUS_RING, on ? 'bg-primary/10 font-semibold text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)]' : 'text-muted-foreground hover:text-foreground')}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {customColumns.length > MIN_CUSTOM_COLUMNS && (
                  <IconButton label={`Remover a coluna ${i + 1}`} icon={X} size="sm" onClick={() => setCustomColumns((cols) => cols.filter((_, idx) => idx !== i))} />
                )}
              </div>
            ))}
          </section>
        )}

        {/* Opções */}
        <section aria-label="Opções da retro" className="flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-1">
            <span className="text-[13px] font-semibold">Opções</span>
            <ModalButton variant="ghost" className="h-8 text-[13px]" onClick={() => setSettings(DEFAULT_SETUP_SETTINGS)}>Padrão</ModalButton>
          </div>
          {SETUP_TOGGLES.map((t) => (
            <SettingRow
              key={t.key}
              id={`nr-${t.key}`}
              title={t.title}
              desc={t.desc}
              checked={settings[t.key]}
              onChange={(v) => setSettings((s) => ({ ...s, [t.key]: v }))}
            >
              {t.key === 'healthCheckEnabled' && (
                <div className="room-rise mt-3 flex items-center gap-2.5 rounded-[10px] border border-border bg-muted/40 p-2.5">
                  <label htmlFor="nr-hc-question" className="shrink-0 text-[13px] text-muted-foreground">Pergunta do check-in</label>
                  <input
                    id="nr-hc-question"
                    value={healthCheckQuestion}
                    onChange={(e) => setHealthCheckQuestion(e.target.value)}
                    placeholder={DEFAULT_HEALTH_CHECK_QUESTION}
                    className={cn(FIELD, 'h-9 min-w-0 flex-1')}
                  />
                </div>
              )}
            </SettingRow>
          ))}
        </section>
      </div>
    </Modal>
  );
}

