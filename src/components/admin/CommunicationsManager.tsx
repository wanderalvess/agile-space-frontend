'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, Send, Trash2, Clock, Bell, Pencil, X, TriangleAlert, Wrench, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { AgileSpinner } from '../ui/AgileSpinner';
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

const TYPE_ICONS: Record<AnnouncementType, React.ElementType> = {
  INFO: Megaphone,
  IMPORTANT: TriangleAlert,
  MAINTENANCE: Wrench,
};

const fieldLabel = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1';
const fieldBox = 'w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium outline-none focus:border-primary/40 focus:bg-background transition-all';

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'h-9 px-4 rounded-xl border text-[11px] font-bold transition-all',
            value === o.value ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function CommunicationsManager() {
  const { session } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [squads, setSquads] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<AnnouncementFormState>(EMPTY_ANNOUNCEMENT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [squadFilter, setSquadFilter] = useState('');

  const fetchAnnouncements = useCallback(async () => {
    try {
      const list = await adminApi.getAnnouncements();
      setAnnouncements(list || []);
    } catch (e) {
      toast({ variant: 'destructive', title: errorMessage(e, 'Não foi possível carregar os avisos') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
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
  };

  const handleSubmit = async () => {
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

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await adminApi.deleteAnnouncement(id);
      if (editingId === id) resetForm();
      toast({ title: 'Aviso removido' });
      fetchAnnouncements();
    } catch (e) {
      toast({ variant: 'destructive', title: errorMessage(e, 'Erro ao remover') });
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
      </div>
    );
  }

  const typeOptions = (Object.keys(ANNOUNCEMENT_TYPE_LABELS) as AnnouncementType[]).map((value) => ({ value, label: ANNOUNCEMENT_TYPE_LABELS[value] }));
  const audienceOptions = (Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((value) => ({ value, label: AUDIENCE_LABELS[value] }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
      {/* Editor */}
      <div className="xl:col-span-2">
        <Card className="border-border/70 rounded-[2.5rem] bg-card/80 backdrop-blur-xl shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
          <CardHeader className="p-8 border-b border-border/50 flex flex-row items-center justify-between gap-4 space-y-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Megaphone className="h-6 w-6" /></div>
              <CardTitle className="text-xl font-black uppercase tracking-tighter italic font-headline">
                {editingId ? 'Editar aviso' : 'Novo aviso'}
              </CardTitle>
            </div>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetForm} className="rounded-xl gap-1.5 text-xs font-bold">
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <label className={fieldLabel}>Tipo</label>
              <Segmented value={form.type} options={typeOptions} onChange={(v) => set('type', v)} />
            </div>

            <div className="space-y-2">
              <label htmlFor="ann-title" className={fieldLabel}>Título</label>
              <Input id="ann-title" value={form.title} maxLength={120} onChange={(e) => set('title', e.target.value)} className="h-11 rounded-2xl" />
            </div>

            <div className="space-y-2">
              <label htmlFor="ann-content" className={fieldLabel}>Texto</label>
              <textarea
                id="ann-content"
                value={form.content}
                maxLength={2000}
                onChange={(e) => set('content', e.target.value)}
                className={cn(fieldBox, 'min-h-[120px] leading-relaxed')}
              />
            </div>

            <div className="space-y-2">
              <label className={fieldLabel}>Público</label>
              <Segmented value={form.audienceType} options={audienceOptions} onChange={(v) => set('audienceType', v)} />
              {form.audienceType === 'SQUADS' && (
                <div className="mt-3 rounded-2xl border border-border bg-muted/20 p-3 space-y-2">
                  <Input value={squadFilter} onChange={(e) => setSquadFilter(e.target.value)} placeholder="Buscar squad" className="h-9 rounded-xl text-xs" />
                  <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                    {visibleSquads.map((s) => (
                      <label key={s.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-muted/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.audienceSquadIds.includes(s.id)}
                          onChange={() => set('audienceSquadIds', toggle(form.audienceSquadIds, s.id))}
                          className="accent-[hsl(var(--primary))]"
                        />
                        <span className="truncate">{s.name}</span>
                        {s.name !== s.id && <span className="text-[10px] text-muted-foreground font-mono">{s.id}</span>}
                      </label>
                    ))}
                    {visibleSquads.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma squad</p>}
                  </div>
                </div>
              )}
              {form.audienceType === 'ROLES' && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {AUDIENCE_ROLE_OPTIONS.map((r) => {
                    const on = form.audienceRoles.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set('audienceRoles', toggle(form.audienceRoles, r.value))}
                        className={cn(
                          'h-8 px-3 rounded-full border text-[11px] font-bold transition-all',
                          on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="ann-from" className={fieldLabel}>Início</label>
                <input id="ann-from" type="datetime-local" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} className={cn(fieldBox, 'h-11 py-0')} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ann-until" className={fieldLabel}>Fim</label>
                <input id="ann-until" type="datetime-local" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={cn(fieldBox, 'h-11 py-0')} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="ann-link" className={fieldLabel}>Link</label>
              <Input id="ann-link" value={form.link} maxLength={500} onChange={(e) => set('link', e.target.value)} placeholder="https://… ou /rota" className="h-11 rounded-2xl" />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={sending || !form.title.trim() || !form.content.trim()}
              className="w-full h-14 rounded-[1.5rem] bg-slate-900 dark:bg-primary hover:bg-primary text-white font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all gap-3"
            >
              {sending ? 'Salvando…' : editingId ? 'Salvar' : 'Publicar'}
              <Send className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <div className="xl:col-span-3">
        <Card className="border-border/70 rounded-[2.5rem] bg-card/80 backdrop-blur-xl shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden min-h-[600px]">
          <CardHeader className="p-8 border-b border-border/50 flex flex-row items-center gap-4 space-y-0">
            <div className="p-3 bg-muted rounded-2xl text-muted-foreground"><Clock className="h-6 w-6" /></div>
            <CardTitle className="text-xl font-black uppercase tracking-tighter italic font-headline">Avisos</CardTitle>
            <Badge variant="outline" className="ml-auto rounded-full text-[10px] font-black">{announcements.length}</Badge>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {announcements.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3 border-2 border-dashed border-border rounded-[2rem]">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum aviso</p>
              </div>
            ) : announcements.map((a) => {
              const Icon = TYPE_ICONS[a.type] || Megaphone;
              const now = Date.now();
              const expired = a.validUntil ? new Date(a.validUntil).getTime() <= now : false;
              const scheduled = a.validFrom ? new Date(a.validFrom).getTime() > now : false;
              return (
                <div
                  key={a.id}
                  className={cn(
                    'group p-5 rounded-[1.75rem] border transition-all',
                    editingId === a.id ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-muted/20 hover:bg-background',
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      a.type === 'IMPORTANT' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : a.type === 'MAINTENANCE' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{ANNOUNCEMENT_TYPE_LABELS[a.type] || 'Aviso'}</span>
                        {expired && <Badge variant="outline" className="text-[9px] rounded-full">Expirado</Badge>}
                        {scheduled && <Badge variant="outline" className="text-[9px] rounded-full">Agendado</Badge>}
                      </div>
                      <p className="text-sm font-bold text-foreground">{a.title}</p>
                      <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-3">{a.content}</p>
                      <p className="text-[11px] text-muted-foreground pt-1 flex flex-wrap items-center gap-x-1.5">
                        <span>{a.createdByName || a.createdBy}</span>
                        <span>·</span>
                        <span suppressHydrationWarning>{a.createdAt ? new Date(a.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                        <span>·</span>
                        <span>{audienceSummary(a, squadNames)}</span>
                        {a.validUntil && (
                          <>
                            <span>·</span>
                            <span suppressHydrationWarning>até {new Date(a.validUntil).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </>
                        )}
                        {a.link && <Link2 className="h-3 w-3 ml-1" aria-label="Com link" />}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => { setEditingId(a.id); setForm(formFromAnnouncement(a)); setConfirmDeleteId(null); }}
                        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size={confirmDeleteId === a.id ? 'sm' : 'icon'}
                        aria-label="Remover"
                        onClick={() => handleDelete(a.id)}
                        onBlur={() => setConfirmDeleteId((cur) => (cur === a.id ? null : cur))}
                        className={cn(
                          'h-9 rounded-xl',
                          confirmDeleteId === a.id ? 'px-3 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30' : 'w-9 text-muted-foreground hover:text-rose-600',
                        )}
                      >
                        {confirmDeleteId === a.id ? 'Remover?' : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
