'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Code2,
  Cpu,
  Database,
  FileText,
  Flag,
  GitBranch,
  Globe,
  History,
  Layers,
  ListChecks,
  Lock,
  Monitor,
  Layout,
  MessageSquareHeart,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { changelogApi, type AppReleaseItem } from '@/services/changelogApi';
import rawVersions from '@/app/changelog/versions.json';
import { DataToolbar, EmptyState, ErrorState, KpiCard, KpiRow, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { BRAND_TINT, ConfirmDialog, FIELD, FOCUS_RING, IconButton, Modal, ModalButton, StatusChip } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import { ChipGroup, FIELD_HINT, FIELD_LABEL } from './AdminOpsParts';
import {
  RELEASE_FILTERS,
  RELEASE_ICONS,
  canonicalIconName,
  computeNextTag,
  filterReleases,
  getTodayFormatted,
  parseBulkChanges,
  releaseStats,
  type ReleaseType,
} from './admin-platform-utils';

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  Zap,
  Sparkles,
  Flag,
  Rocket: Flag, // alias: releases já gravados com o ícone antigo
  ShieldCheck,
  Layers,
  Code2,
  Database,
  Cpu,
  Globe,
  ListChecks,
  Monitor,
  Layout,
  Lock,
  MessageSquareHeart,
  Shield,
  History,
  GitBranch,
};

/** Ícone do release com cor do tema (a classe colorida gravada no dado é do Changelog público). */
function ReleaseIcon({ name, className }: { name?: string; className?: string }) {
  const Comp = (name && ICON_COMPONENTS[name]) || Sparkles;
  return <Comp className={cn('h-5 w-5', className)} strokeWidth={1.5} aria-hidden="true" />;
}

const TYPE_LABELS: Record<ReleaseType, string> = { major: 'Major', minor: 'Minor', patch: 'Patch' };

function TagChip({ tag, type }: { tag: string; type?: string | null }) {
  const t = (type as ReleaseType) || 'patch';
  return (
    <span
      title={TYPE_LABELS[t] ?? 'Patch'}
      className={cn(
        'inline-flex h-6 items-center rounded-md px-2 text-xs font-bold tabular-nums',
        t === 'major'
          ? 'bg-primary text-primary-foreground'
          : t === 'minor'
            ? cn(BRAND_TINT, 'text-primary [.theme-totvs:not(.dark)_&]:text-foreground')
            : 'border border-border bg-muted text-muted-foreground',
      )}
    >
      {tag}
    </span>
  );
}

const SEMVER_TYPES: Array<{ type: ReleaseType; title: string; desc: string }> = [
  { type: 'patch', title: 'Patch (+0.0.1)', desc: 'Correções e melhorias leves' },
  { type: 'minor', title: 'Minor (+0.1.0)', desc: 'Novas funcionalidades e módulos' },
  { type: 'major', title: 'Major (+1.0.0)', desc: 'Mudanças estruturais e grandes marcos' },
];

export function ChangelogManager() {
  const { toast } = useToast();
  const [releases, setReleases] = useState<AppReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Diálogos
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AppReleaseItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AppReleaseItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Formulário
  const [formTag, setFormTag] = useState('');
  const [formType, setFormType] = useState<ReleaseType>('patch');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formIconName, setFormIconName] = useState('Zap');
  const [formIconClass, setFormIconClass] = useState('h-5 w-5 text-indigo-500');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formChanges, setFormChanges] = useState<string[]>([]);
  const [newChangeInput, setNewChangeInput] = useState('');
  const [bulkChangeInput, setBulkChangeInput] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const loadReleases = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await changelogApi.getAdminReleases();
      setReleases(data || []);
    } catch (err) {
      console.warn('Erro ao carregar versões do backend:', err);
      setReleases([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReleases();
  }, [loadReleases]);

  const stats = useMemo(() => releaseStats(releases), [releases]);
  /** Tag da versão mais recente; sem versão nenhuma, a próxima tag começa do zero. */
  const latestTag = stats.latestTag ?? undefined;

  const filteredReleases = useMemo(() => filterReleases(releases, search, typeFilter), [releases, search, typeFilter]);
  const hasFilters = search.trim() !== '' || typeFilter !== 'all';

  const resetFormFields = () => {
    setNewChangeInput('');
    setBulkChangeInput('');
    setShowBulkAdd(false);
  };

  const handleImportLegacy = async () => {
    setImporting(true);
    try {
      const res = await changelogApi.importLegacyReleases(rawVersions);
      toast({
        title: 'Importação concluída',
        description: `${res.imported} novas versões foram salvas (${res.skipped} existentes mantidas).`,
      });
      setImportOpen(false);
      await loadReleases();
    } catch (err) {
      toast({
        title: 'Erro na importação',
        description: (err as Error)?.message || 'Falha ao importar histórico.',
        variant: 'destructive',
      });
      setImportOpen(false);
    } finally {
      setImporting(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormTag(computeNextTag(latestTag, 'patch'));
    setFormType('patch');
    setFormTitle('');
    setFormDescription('');
    setFormDate(getTodayFormatted());
    setFormIconName('Zap');
    setFormIconClass('h-5 w-5 text-indigo-500');
    setFormIsPublished(true);
    setFormChanges([]);
    resetFormFields();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: AppReleaseItem) => {
    setEditingItem(item);
    setFormTag(item.tag);
    setFormType((item.type as ReleaseType) || 'patch');
    setFormTitle(item.title);
    setFormDescription(item.description);
    setFormDate(item.displayDate || item.date || getTodayFormatted());
    setFormIconName(item.iconName || item.icon?.name || 'Sparkles');
    setFormIconClass(item.iconClass || item.icon?.className || 'h-5 w-5 text-primary');
    setFormIsPublished(item.isPublished !== false);
    setFormChanges([...(item.changes || [])]);
    resetFormFields();
    setIsDialogOpen(true);
  };

  // Troca de tipo no modo "nova": recalcula a tag e o ícone padrão. Editando, a tag não muda.
  const handleTypeChange = (newType: ReleaseType) => {
    setFormType(newType);
    if (!editingItem) {
      setFormTag(computeNextTag(latestTag, newType));
      const found = RELEASE_ICONS.find((i) => i.defaultFor === newType);
      if (found) {
        setFormIconName(found.name);
        setFormIconClass(found.className);
      }
    }
  };

  const handleSelectIcon = (iconName: string) => {
    const found = RELEASE_ICONS.find((i) => i.name === iconName);
    if (found) {
      setFormIconName(found.name);
      setFormIconClass(found.className);
    }
  };

  const handleAddChange = () => {
    if (!newChangeInput.trim()) return;
    setFormChanges([...formChanges, newChangeInput.trim()]);
    setNewChangeInput('');
  };

  const handleRemoveChange = (index: number) => setFormChanges(formChanges.filter((_, idx) => idx !== index));

  const handleParseBulkChanges = () => {
    if (!bulkChangeInput.trim()) return;
    const lines = parseBulkChanges(bulkChangeInput);
    if (lines.length > 0) {
      setFormChanges([...formChanges, ...lines]);
      setBulkChangeInput('');
      setShowBulkAdd(false);
      toast({ title: 'Itens adicionados', description: `${lines.length} itens foram inseridos na lista de alterações.` });
    }
  };

  const handleSave = async () => {
    if (!formTag.trim()) {
      toast({ title: 'Tag obrigatória', description: 'Informe a tag da versão (ex.: v3.118.0).', variant: 'destructive' });
      return;
    }
    if (!formTitle.trim()) {
      toast({ title: 'Título obrigatório', description: 'Informe um título descritivo para a versão.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<AppReleaseItem> = {
        tag: formTag.trim(),
        type: formType,
        title: formTitle.trim(),
        description: formDescription.trim() || formTitle.trim(),
        displayDate: formDate.trim() || getTodayFormatted(),
        iconName: formIconName,
        iconClass: formIconClass,
        isPublished: formIsPublished,
        changes: formChanges.length > 0 ? formChanges : [formTitle.trim()],
      };

      if (editingItem && editingItem.id && !editingItem.id.startsWith('legacy-')) {
        await changelogApi.updateRelease(editingItem.id, payload);
        toast({ title: 'Versão atualizada!', description: `A versão ${formTag} foi atualizada com sucesso.` });
      } else {
        await changelogApi.createRelease(payload);
        toast({ title: 'Versão criada!', description: `A versão ${formTag} foi cadastrada.` });
      }

      setIsDialogOpen(false);
      await loadReleases();
    } catch (err) {
      toast({
        title: 'Erro ao salvar versão',
        description: (err as Error)?.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const item = pendingDelete;
    if (!item) return;
    setDeleting(true);
    try {
      if (item.id && !item.id.startsWith('legacy-')) {
        await changelogApi.deleteRelease(item.id);
        toast({ title: 'Versão excluída', description: `A versão ${item.tag} foi removida.` });
      }
      setReleases((prev) => prev.filter((r) => r.id !== item.id && r.tag !== item.tag));
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: (err as Error)?.message || 'Não foi possível excluir a versão.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
  };

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ModalButton variant="secondary" onClick={() => setImportOpen(true)} title="Traz as versões do arquivo de histórico (versions.json)">
        <UploadCloud className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Importar histórico
      </ModalButton>
      <ModalButton variant="primary" onClick={handleOpenCreate}>
        <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Nova versão
      </ModalButton>
    </div>
  );

  if (loading && releases.length === 0 && !loadError) {
    return (
      <div className="flex flex-col gap-4">
        {headerActions}
        <LoadingSkeleton variant="page" rows={4} label="Carregando versões" />
      </div>
    );
  }

  const selectedIconName = canonicalIconName(formIconName);

  return (
    <div className="flex flex-col gap-4">
      {headerActions}

      <KpiRow>
        <KpiCard label="Build mais recente" value={stats.latestTag ?? '—'} icon={GitBranch} />
        <KpiCard label="Total de releases" value={stats.total} icon={moduleIcon('changelog')} />
        <KpiCard label="Major releases" value={stats.majors} icon={Flag} />
        <KpiCard label="Patches e fixes" value={stats.patches} icon={Zap} />
      </KpiRow>

      <DataToolbar
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar por tag, título ou alteração...', ariaLabel: 'Buscar versões por tag, título ou alteração' }}
        filters={<ChipGroup options={RELEASE_FILTERS} value={typeFilter as (typeof RELEASE_FILTERS)[number]['id']} onChange={setTypeFilter} ariaLabel="Tipo de versão" />}
        actions={
          <IconButton
            label="Recarregar"
            icon={RefreshCw}
            onClick={loadReleases}
            disabled={loading}
            className={cn(loading && '[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none')}
          />
        }
      />

      {loadError ? (
        <ErrorState title="Não foi possível carregar as versões" onRetry={loadReleases} />
      ) : releases.length === 0 ? (
        <EmptyState
          title="Nenhuma versão cadastrada"
          description="Crie a primeira ou traga o histórico antigo."
          actions={
            <>
              <ModalButton variant="primary" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Nova versão
              </ModalButton>
              <ModalButton variant="secondary" onClick={() => setImportOpen(true)}>
                <UploadCloud className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Importar histórico
              </ModalButton>
            </>
          }
        />
      ) : filteredReleases.length === 0 ? (
        <EmptyState
          title="Nenhuma versão encontrada para os filtros selecionados"
          actions={hasFilters ? <ModalButton variant="secondary" onClick={clearFilters}>Limpar filtros</ModalButton> : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Versões">
          {filteredReleases.map((release) => (
            <li key={release.id || release.tag} className={cn(PAGE_CARD, 'p-5 transition-colors hover:border-primary/30')}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 items-start gap-4">
                  <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-muted text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
                    <ReleaseIcon name={release.iconName || release.icon?.name} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <TagChip tag={release.tag} type={release.type} />
                      <span className="text-xs text-muted-foreground">{release.displayDate || release.date}</span>
                      {!release.isPublished && <StatusChip tone="warn">Rascunho</StatusChip>}
                    </div>
                    <h3 className="text-base font-bold leading-snug text-foreground">{release.title}</h3>
                    {release.description && release.description !== release.title && (
                      <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{release.description}</p>
                    )}
                    {release.changes && release.changes.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {release.changes.slice(0, 3).map((change, cIdx) => (
                          <span key={cIdx} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
                            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span className="truncate max-w-[280px]">{change}</span>
                          </span>
                        ))}
                        {release.changes.length > 3 && <span className="text-xs font-semibold text-muted-foreground">+{release.changes.length - 3} mais</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end lg:self-center">
                  <ModalButton variant="ghost" className="h-9 gap-1.5 px-3 text-[13px]" onClick={() => handleOpenEdit(release)} aria-label={`Editar a versão ${release.tag}`}>
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Editar
                  </ModalButton>
                  <ModalButton
                    variant="ghost"
                    className="h-9 gap-1.5 px-3 text-[13px] text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
                    onClick={() => setPendingDelete(release)}
                    aria-label={`Excluir a versão ${release.tag}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Excluir
                  </ModalButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Nova / editar versão */}
      <Modal
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        size="lg"
        icon={moduleIcon('changelog')}
        title={editingItem ? 'Editar versão' : 'Nova versão e release'}
        description="Alimenta a linha do tempo pública do Changelog."
        preventClose={isSaving}
        footer={
          <>
            <ModalButton variant="secondary" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando…' : editingItem ? 'Salvar alterações' : 'Publicar versão'}
            </ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-5 pt-1">
          <fieldset className="flex flex-col gap-2">
            <legend className={cn(FIELD_LABEL, 'mb-2')}>Tipo de incremento (SemVer)</legend>
            <div role="radiogroup" aria-label="Tipo de incremento" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {SEMVER_TYPES.map((t) => {
                const on = formType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => handleTypeChange(t.type)}
                    className={cn(
                      'flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors',
                      FOCUS_RING,
                      on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent',
                    )}
                  >
                    <span className="text-[13px] font-bold text-foreground">{t.title}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rel-tag" className={FIELD_LABEL}>Tag da versão</label>
              <input id="rel-tag" value={formTag} onChange={(e) => setFormTag(e.target.value)} placeholder="v3.118.0" className={cn(FIELD, 'h-10 font-mono')} />
              <span className={FIELD_HINT}>
                {editingItem ? 'A tag não muda ao trocar o tipo' : latestTag ? `Calculada sobre ${latestTag} (${TYPE_LABELS[formType].toLowerCase()})` : 'Sem versão anterior: a tag começa do zero'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rel-date" className={FIELD_LABEL}>Data de lançamento</label>
              <input id="rel-date" value={formDate} onChange={(e) => setFormDate(e.target.value)} placeholder="17 de Agosto, 2026" className={cn(FIELD, 'h-10')} />
              <span className={FIELD_HINT}>Texto livre, como aparece no Changelog</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rel-title" className={FIELD_LABEL}>Título do release</label>
            <input
              id="rel-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Ex.: feat(squad): Squad Pulse, dashboard de produtividade"
              className={cn(FIELD, 'h-10 font-semibold')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rel-desc" className={FIELD_LABEL}>Resumo</label>
            <textarea
              id="rel-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Breve resumo destacando os objetivos alcançados nesta entrega..."
              rows={2}
              className={cn(FIELD, 'py-2.5')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className={FIELD_LABEL} id="rel-icon-label">Ícone do release</span>
            <div role="radiogroup" aria-labelledby="rel-icon-label" className="flex flex-wrap gap-2">
              {RELEASE_ICONS.map((icon) => {
                const on = selectedIconName === icon.name;
                return (
                  <button
                    key={icon.name}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => handleSelectIcon(icon.name)}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors',
                      FOCUS_RING,
                      on ? 'border-primary/60 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <ReleaseIcon name={icon.name} className="h-4 w-4" />
                    {icon.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className={FIELD_LABEL}>Lista de alterações ({formChanges.length})</span>
              <ModalButton variant="ghost" className="h-8 gap-1.5 px-2.5 text-[13px] text-primary [.theme-totvs:not(.dark)_&]:text-foreground" onClick={() => setShowBulkAdd(!showBulkAdd)}>
                <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                {showBulkAdd ? 'Ocultar inserção em lote' : 'Inserir em lote'}
              </ModalButton>
            </div>

            {showBulkAdd && (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                <textarea
                  aria-label="Alterações em lote"
                  placeholder="Cole várias alterações, uma por linha."
                  value={bulkChangeInput}
                  onChange={(e) => setBulkChangeInput(e.target.value)}
                  rows={3}
                  className={cn(FIELD, 'py-2.5')}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={FIELD_HINT}>Separe por quebra de linha ou ponto e vírgula (;). Marcadores - * • são removidos.</span>
                  <ModalButton variant="primary" className="h-9" onClick={handleParseBulkChanges}>Processar itens</ModalButton>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                aria-label="Adicionar item de alteração"
                placeholder="Adicionar item de alteração..."
                value={newChangeInput}
                onChange={(e) => setNewChangeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChange();
                  }
                }}
                className={cn(FIELD, 'h-10')}
              />
              <ModalButton variant="secondary" className="shrink-0 gap-1.5" onClick={handleAddChange}>
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Adicionar
              </ModalButton>
            </div>

            {formChanges.length > 0 && (
              <ul className="scrollbar-thin flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
                {formChanges.map((change, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[13px] text-foreground">
                    <span className="min-w-0 flex-1 truncate" title={change}>{change}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChange(idx)}
                      aria-label={`Remover o item ${change}`}
                      className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300', FOCUS_RING)}
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="rel-published" className="text-[13px] font-semibold text-foreground">Publicar imediatamente</label>
              <span className={FIELD_HINT}>Desligado, fica como rascunho, visível só para administradores</span>
            </div>
            <Switch id="rel-published" checked={formIsPublished} onCheckedChange={setFormIsPublished} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        tone="danger"
        icon={Trash2}
        title={`Excluir a versão ${pendingDelete?.tag ?? ''}?`}
        description="Some do Changelog público. Esta ação é irreversível."
        cancelLabel="Manter"
        confirmLabel="Excluir versão"
        loading={deleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={handleDelete}
      >
        {pendingDelete && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
            <TagChip tag={pendingDelete.tag} type={pendingDelete.type} />
            <span className="min-w-0 text-[13px] font-medium text-foreground">{pendingDelete.title}</span>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        tone="brand"
        icon={UploadCloud}
        title="Importar o histórico de versões?"
        description={`Traz as ${rawVersions.length} versões do arquivo de histórico (versions.json). As que já existem são mantidas.`}
        cancelLabel="Cancelar"
        confirmLabel="Importar histórico"
        loading={importing}
        loadingLabel="Importando…"
        keepOpenOnConfirm
        onConfirm={handleImportLegacy}
      >
        <p className={FIELD_HINT}>Depois diz quantas entraram e quantas já existiam.</p>
      </ConfirmDialog>
    </div>
  );
}
