'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Link2, Megaphone, Pencil, Send, Trash2, TriangleAlert, Wrench, X, type LucideIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { adminApi, type Announcement } from '@/app/admin/api';
import { useAuth } from '@/context/AuthContext';
import { projectService } from '@/services/projectService';
import { errorMessage } from '@/lib/ceremony-api';
import type { AnnouncementType, AudienceType } from '@/lib/home-api';
import {
  ANNOUNCEMENT_TYPE_LABELS,
  AUDIENCE_LABELS,
  AUDIENCE_ROLE_OPTIONS,
  EMPTY_ANNOUNCEMENT_FORM,
  audienceSummary,
  formFromAnnouncement,
  inputFromForm,
  validateAnnouncementForm,
  type AnnouncementFormState,
} from '@/lib/announcement-form';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ConfirmDialog, FIELD, FOCUS_RING, IconButton, IconTile, ModalButton, StatusChip, type Tone } from '@/components/room-kit';
import { AdminCheckbox, ChipGroup, FIELD_HINT, FIELD_LABEL } from './AdminOpsParts';

const TYPE_ICONS: Record<AnnouncementType, LucideIcon> = {
  INFO: Megaphone,
  IMPORTANT: TriangleAlert,
  MAINTENANCE: Wrench,
};

const TYPE_TONES: Record<AnnouncementType, Tone> = {
  INFO: 'brand',
  IMPORTANT: 'warn',
  MAINTENANCE: 'neutral',
};

const TITLE_MAX = 120;
const CONTENT_MAX = 2000;

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Mensagem inline do campo de público; só aparece depois de tentar publicar. */
function audienceProblem(form: AnnouncementFormState): string | null {
  if (form.audienceType === 'SQUADS' && form.audienceSquadIds.length === 0) return 'Escolha ao menos uma squad.';
  if (form.audienceType === 'ROLES' && form.audienceRoles.length === 0) return 'Escolha ao menos um papel.';
  return null;
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={cn('text-xs tabular-nums', value >= max ? 'font-semibold text-red-700 dark:text-red-300' : 'text-muted-foreground')} aria-live="off">
      {value}/{max}
    </span>
  );
}

export function CommunicationsManager() {
  const { session } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [squads, setSquads] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<AnnouncementFormState>(EMPTY_ANNOUNCEMENT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Announcement | null>(null);
  const [removing, setRemoving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [squadFilter, setSquadFilter] = useState('');

  const fetchAnnouncements = useCallback(async (initial = false) => {
    try {
      const list = await adminApi.getAnnouncements();
      setAnnouncements(list || []);
      setLoadError(false);
    } catch (e) {
      if (initial) setLoadError(true);
      toast({ variant: 'destructive', title: errorMessage(e, 'Não foi possível carregar os avisos') });
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = () => {
    setLoading(true);
    setLoadError(false);
    fetchAnnouncements(true);
  };

  useEffect(() => {
    fetchAnnouncements(true);
  }, [fetchAnnouncements]);

  // Squads que o admin enxerga: catálogo de projetos; sem ele, as squads da própria sessão.
  useEffect(() => {
    let cancelled = false;
    const fromSession = (session?.accessibleProjects || []).map((p) => ({ id: p.projectId, name: p.projectName || p.projectId }));
    projectService
      .getAllProjects()
      .then((projects) => {
        if (cancelled) return;
        const list = (projects || []).map((p) => ({ id: p.id, name: p.name || p.id }));
        setSquads(list.length ? list : fromSession);
      })
      .catch(() => { if (!cancelled) setSquads(fromSession); });
    return () => { cancelled = true; };
  }, [session?.accessibleProjects]);

  const squadNames = useMemo(() => Object.fromEntries(squads.map((s) => [s.id, s.name])), [squads]);
  const visibleSquads = useMemo(() => {
    const q = squadFilter.trim().toLowerCase();
    return q ? squads.filter((s) => `${s.name} ${s.id}`.toLowerCase().includes(q)) : squads;
  }, [squads, squadFilter]);

  const set = <K extends keyof AnnouncementFormState>(key: K, value: AnnouncementFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const resetForm = () => {
    setForm(EMPTY_ANNOUNCEMENT_FORM);
    setEditingId(null);
    setAttempted(false);
  };

  const handleSubmit = async () => {
    setAttempted(true);
    const problem = validateAnnouncementForm(form);
    if (problem) {
      toast({ variant: 'destructive', title: problem });
      return;
    }
    setSending(true);
    try {
      const input = inputFromForm(form);
      if (editingId) {
        await adminApi.updateAnnouncement(editingId, input);
        toast({ title: 'Aviso atualizado' });
      } else {
        await adminApi.createAnnouncement(input);
        toast({ title: 'Aviso publicado' });
      }
      resetForm();
      fetchAnnouncements();
    } catch (e) {
      toast({ variant: 'destructive', title: errorMessage(e, editingId ? 'Erro ao salvar' : 'Erro ao publicar') });
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async () => {
    const target = pendingRemove;
    if (!target) return;
    setRemoving(true);
    try {
      await adminApi.deleteAnnouncement(target.id);
      if (editingId === target.id) resetForm();
      toast({ title: 'Aviso removido' });
      fetchAnnouncements();
    } catch (e) {
      toast({ variant: 'destructive', title: errorMessage(e, 'Erro ao remover') });
    } finally {
      setRemoving(false);
      setPendingRemove(null);
    }
  };

  if (loading) return <LoadingSkeleton variant="cards" rows={3} label="Carregando avisos" />;
  if (loadError) return <ErrorState title="Não foi possível carregar os avisos" onRetry={reload} />;

  const typeOptions = (Object.keys(ANNOUNCEMENT_TYPE_LABELS) as AnnouncementType[]).map((value) => ({
    id: value,
    label: ANNOUNCEMENT_TYPE_LABELS[value],
    icon: TYPE_ICONS[value],
  }));
  const audienceOptions = (Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((value) => ({ id: value, label: AUDIENCE_LABELS[value] }));
  const problem = attempted ? audienceProblem(form) : null;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      {/* Editor */}
      <section className={cn(PAGE_CARD, 'flex flex-col overflow-clip xl:col-span-2')} aria-label={editingId ? 'Editar aviso' : 'Novo aviso'}>
        <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <IconTile icon={Megaphone} />
            <h2 className="text-lg font-bold tracking-tight text-foreground">{editingId ? 'Editar aviso' : 'Novo aviso'}</h2>
          </div>
          {editingId && (
            <ModalButton variant="ghost" onClick={resetForm}>
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Cancelar
            </ModalButton>
          )}
        </header>
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <span className={FIELD_LABEL} id="ann-type-label">Tipo</span>
            <ChipGroup options={typeOptions} value={form.type} onChange={(v) => set('type', v)} ariaLabel="Tipo do aviso" />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="ann-title" className={FIELD_LABEL}>Título</label>
              <Counter value={form.title.length} max={TITLE_MAX} />
            </div>
            <input id="ann-title" value={form.title} maxLength={TITLE_MAX} onChange={(e) => set('title', e.target.value)} className={cn(FIELD, 'h-11')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="ann-content" className={FIELD_LABEL}>Texto</label>
              <Counter value={form.content.length} max={CONTENT_MAX} />
            </div>
            <textarea
              id="ann-content"
              value={form.content}
              maxLength={CONTENT_MAX}
              onChange={(e) => set('content', e.target.value)}
              className={cn(FIELD, 'min-h-[120px] py-2.5 leading-relaxed')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className={FIELD_LABEL}>Público</span>
            <ChipGroup options={audienceOptions} value={form.audienceType} onChange={(v) => set('audienceType', v)} ariaLabel="Público do aviso" />
            {form.audienceType === 'SQUADS' && (
              <div
                className={cn('mt-1 flex flex-col gap-2 rounded-xl border bg-muted/30 p-3', problem ? 'border-red-500/60' : 'border-border')}
                aria-invalid={problem ? true : undefined}
              >
                <input
                  value={squadFilter}
                  onChange={(e) => setSquadFilter(e.target.value)}
                  placeholder="Buscar squad"
                  aria-label="Buscar squad"
                  className={cn(FIELD, 'h-9')}
                />
                <div className="scrollbar-thin flex max-h-44 flex-col gap-0.5 overflow-y-auto pr-1">
                  {visibleSquads.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-foreground hover:bg-accent">
                      <AdminCheckbox
                        checked={form.audienceSquadIds.includes(s.id)}
                        onChange={() => set('audienceSquadIds', toggle(form.audienceSquadIds, s.id))}
                        label={`Squad ${s.name}`}
                      />
                      <span className="truncate">{s.name}</span>
                      {s.name !== s.id && <span className="font-mono text-xs text-muted-foreground">{s.id}</span>}
                    </label>
                  ))}
                  {visibleSquads.length === 0 && <p className="px-2 py-1 text-[13px] text-muted-foreground">Nenhuma squad</p>}
                </div>
              </div>
            )}
            {form.audienceType === 'ROLES' && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {AUDIENCE_ROLE_OPTIONS.map((r) => {
                  const on = form.audienceRoles.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('audienceRoles', toggle(form.audienceRoles, r.value))}
                      className={cn(
                        'h-8 rounded-full border px-3 text-[13px] font-semibold transition-colors max-sm:h-11',
                        FOCUS_RING,
                        on
                          ? 'border-primary/50 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}
            {problem && (
              <p role="alert" className="text-[13px] font-medium text-red-700 dark:text-red-300">
                {problem}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ann-from" className={FIELD_LABEL}>Início</label>
              <input id="ann-from" type="datetime-local" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} className={cn(FIELD, 'h-11 py-0')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ann-until" className={FIELD_LABEL}>Fim</label>
              <input id="ann-until" type="datetime-local" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={cn(FIELD, 'h-11 py-0')} />
            </div>
            <p className={cn(FIELD_HINT, 'sm:col-span-2')}>Início vazio publica agora. Fim vazio não expira.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ann-link" className={FIELD_LABEL}>Link</label>
            <input id="ann-link" value={form.link} maxLength={500} onChange={(e) => set('link', e.target.value)} placeholder="https://… ou /rota" className={cn(FIELD, 'h-11')} />
          </div>

          <ModalButton
            variant="primary"
            onClick={handleSubmit}
            disabled={sending || !form.title.trim() || !form.content.trim()}
            className="h-11 w-full gap-2"
          >
            {sending ? 'Salvando…' : editingId ? 'Salvar' : 'Publicar'}
            <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </ModalButton>
        </div>
      </section>

      {/* Lista */}
      <section className={cn(PAGE_CARD, 'flex flex-col overflow-clip xl:col-span-3')} aria-label="Avisos">
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          <IconTile icon={Bell} tone="neutral" />
          <h2 className="text-lg font-bold tracking-tight text-foreground">Avisos</h2>
          <StatusChip tone="neutral" className="ml-auto">{announcements.length}</StatusChip>
        </header>
        <div className="flex flex-1 flex-col gap-3 p-5">
          {announcements.length === 0 ? (
            <EmptyState embedded icon={Bell} title="Nenhum aviso" description="Publique o primeiro ao lado." />
          ) : (
            announcements.map((a) => {
              const Icon = TYPE_ICONS[a.type] || Megaphone;
              const tone = TYPE_TONES[a.type] || 'brand';
              const now = Date.now();
              const expired = a.validUntil ? new Date(a.validUntil).getTime() <= now : false;
              const scheduled = a.validFrom ? new Date(a.validFrom).getTime() > now : false;
              return (
                <article
                  key={a.id}
                  className={cn(
                    'rounded-2xl border p-4 transition-colors',
                    editingId === a.id ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    <IconTile icon={Icon} tone={tone} size="sm" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{ANNOUNCEMENT_TYPE_LABELS[a.type] || 'Aviso'}</span>
                        {expired && <StatusChip tone="neutral">Expirado</StatusChip>}
                        {scheduled && <StatusChip tone="brand">Agendado</StatusChip>}
                      </div>
                      <h3 className="text-sm font-bold text-foreground">{a.title}</h3>
                      <p className="line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{a.content}</p>
                      <p className="flex flex-wrap items-center gap-x-1.5 pt-1 text-xs text-muted-foreground">
                        <span>{a.createdByName || a.createdBy}</span>
                        <span aria-hidden="true">·</span>
                        <span suppressHydrationWarning>{a.createdAt ? new Date(a.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                        <span aria-hidden="true">·</span>
                        <span>{audienceSummary(a, squadNames)}</span>
                        {a.validUntil && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span suppressHydrationWarning>até {new Date(a.validUntil).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </>
                        )}
                        {a.link && <Link2 className="ml-1 h-3.5 w-3.5" strokeWidth={1.5} aria-label="Com link" />}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <IconButton
                        size="sm"
                        label={`Editar o aviso ${a.title}`}
                        icon={Pencil}
                        onClick={() => { setEditingId(a.id); setForm(formFromAnnouncement(a)); setAttempted(false); }}
                      />
                      <IconButton
                        size="sm"
                        label={`Remover o aviso ${a.title}`}
                        icon={Trash2}
                        onClick={() => setPendingRemove(a)}
                        className="hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                      />
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={(open) => { if (!open) setPendingRemove(null); }}
        tone="danger"
        icon={Trash2}
        title={`Remover o aviso “${pendingRemove?.title ?? ''}”?`}
        description="Some para quem ainda não viu."
        cancelLabel="Manter"
        confirmLabel="Remover aviso"
        loading={removing}
        loadingLabel="Removendo…"
        keepOpenOnConfirm
        onConfirm={handleRemove}
      >
        {pendingRemove && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[13px] text-muted-foreground">
            <StatusChip tone={TYPE_TONES[pendingRemove.type] || 'brand'}>{ANNOUNCEMENT_TYPE_LABELS[pendingRemove.type] || 'Aviso'}</StatusChip>
            <span>{audienceSummary(pendingRemove, squadNames)}</span>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
