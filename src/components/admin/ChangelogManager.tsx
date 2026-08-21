'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  Rocket,
  Zap,
  Sparkles,
  ShieldCheck,
  Layers,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertCircle,
  Database,
  Code2,
  Cpu,
  Globe,
  Monitor,
  Layout,
  Lock,
  MessageSquareHeart,
  Shield,
  ListChecks,
  History,
  X,
  UploadCloud,
  FileText
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { changelogApi, AppReleaseItem } from '@/services/changelogApi';

const AVAILABLE_ICONS = [
  { name: 'Zap', label: 'Raio (Patch / Fix)', className: 'h-5 w-5 text-indigo-500', defaultFor: 'patch' },
  { name: 'Sparkles', label: 'Brilho (Feature / Minor)', className: 'h-5 w-5 text-emerald-500', defaultFor: 'minor' },
  { name: 'Rocket', label: 'Foguete (Major / Lançamento)', className: 'h-5 w-5 text-primary', defaultFor: 'major' },
  { name: 'ShieldCheck', label: 'Segurança & Validação', className: 'h-5 w-5 text-emerald-600' },
  { name: 'Layers', label: 'Arquitetura / Módulos', className: 'h-5 w-5 text-blue-500' },
  { name: 'Code2', label: 'Engenharia de Código', className: 'h-5 w-5 text-amber-500' },
  { name: 'Database', label: 'Banco de Dados', className: 'h-5 w-5 text-cyan-500' },
  { name: 'Cpu', label: 'Performance & Backend', className: 'h-5 w-5 text-rose-500' },
  { name: 'Globe', label: 'Integrações Web', className: 'h-5 w-5 text-teal-500' },
  { name: 'ListChecks', label: 'Checklist / Qualidade', className: 'h-5 w-5 text-purple-500' },
];

const iconComponentMap: Record<string, React.ComponentType<any>> = {
  Zap,
  Sparkles,
  Rocket,
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
  GitBranch
};

function renderIcon(name?: string, className?: string) {
  const IconComp = (name && iconComponentMap[name]) || Sparkles;
  return <IconComp className={className || 'h-5 w-5 text-primary'} />;
}

function getTodayFormatted(): string {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const now = new Date();
  return `${now.getDate()} de ${months[now.getMonth()]}, ${now.getFullYear()}`;
}

function computeNextTag(currentTag: string | undefined, bumpType: 'patch' | 'minor' | 'major'): string {
  if (!currentTag) {
    if (bumpType === 'major') return 'v1.0.0';
    if (bumpType === 'minor') return 'v0.1.0';
    return 'v0.0.1';
  }

  const clean = currentTag.replace(/^v/, '');
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);

  while (parts.length < 3) parts.push(0);

  if (bumpType === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (bumpType === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else {
    parts[2] += 1;
  }

  return `v${parts.join('.')}`;
}

export function ChangelogManager() {
  const { toast } = useToast();
  const [releases, setReleases] = useState<AppReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AppReleaseItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formTag, setFormTag] = useState('');
  const [formType, setFormType] = useState<'patch' | 'minor' | 'major'>('patch');
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

  // Load Releases
  const loadReleases = async () => {
    setLoading(true);
    try {
      const data = await changelogApi.getAdminReleases();
      setReleases(data || []);
    } catch (err: any) {
      console.warn('Erro ao carregar versões do backend:', err);
      setReleases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReleases();
  }, []);

  const latestTag = useMemo(() => {
    return releases[0]?.tag || 'v3.117.1';
  }, [releases]);

  // Open Dialog for Create
  const handleOpenCreate = () => {
    setEditingItem(null);
    const calculatedTag = computeNextTag(latestTag, 'patch');
    setFormTag(calculatedTag);
    setFormType('patch');
    setFormTitle('');
    setFormDescription('');
    setFormDate(getTodayFormatted());
    setFormIconName('Zap');
    setFormIconClass('h-5 w-5 text-indigo-500');
    setFormIsPublished(true);
    setFormChanges([]);
    setNewChangeInput('');
    setBulkChangeInput('');
    setShowBulkAdd(false);
    setIsDialogOpen(true);
  };

  // Open Dialog for Edit
  const handleOpenEdit = (item: AppReleaseItem) => {
    setEditingItem(item);
    setFormTag(item.tag);
    setFormType((item.type as any) || 'patch');
    setFormTitle(item.title);
    setFormDescription(item.description);
    setFormDate(item.displayDate || item.date || getTodayFormatted());
    setFormIconName(item.iconName || item.icon?.name || 'Sparkles');
    setFormIconClass(item.iconClass || item.icon?.className || 'h-5 w-5 text-primary');
    setFormIsPublished(item.isPublished !== false);
    setFormChanges([...(item.changes || [])]);
    setNewChangeInput('');
    setBulkChangeInput('');
    setShowBulkAdd(false);
    setIsDialogOpen(true);
  };

  // Auto update tag when changing type in create mode
  const handleTypeChange = (newType: 'patch' | 'minor' | 'major') => {
    setFormType(newType);
    if (!editingItem) {
      setFormTag(computeNextTag(latestTag, newType));
      const foundIcon = AVAILABLE_ICONS.find((i) => i.defaultFor === newType);
      if (foundIcon) {
        setFormIconName(foundIcon.name);
        setFormIconClass(foundIcon.className);
      }
    }
  };

  // Icon Selection
  const handleSelectIcon = (iconName: string) => {
    const found = AVAILABLE_ICONS.find((i) => i.name === iconName);
    if (found) {
      setFormIconName(found.name);
      setFormIconClass(found.className);
    }
  };

  // Changes Management
  const handleAddChange = () => {
    if (!newChangeInput.trim()) return;
    setFormChanges([...formChanges, newChangeInput.trim()]);
    setNewChangeInput('');
  };

  const handleRemoveChange = (index: number) => {
    setFormChanges(formChanges.filter((_, idx) => idx !== index));
  };

  const handleParseBulkChanges = () => {
    if (!bulkChangeInput.trim()) return;
    const lines = bulkChangeInput
      .split(/[\n;]+/)
      .map((l) => l.trim().replace(/^[-*•]\s*/, ''))
      .filter((l) => l.length > 0);

    if (lines.length > 0) {
      setFormChanges([...formChanges, ...lines]);
      setBulkChangeInput('');
      setShowBulkAdd(false);
      toast({
        title: 'Itens adicionados',
        description: `${lines.length} itens foram inseridos na lista de alterações.`
      });
    }
  };

  // Save Release
  const handleSave = async () => {
    if (!formTag.trim()) {
      toast({ title: 'Tag obrigatória', description: 'Por favor, informe a tag da versão (ex: v3.118.0)', variant: 'destructive' });
      return;
    }
    if (!formTitle.trim()) {
      toast({ title: 'Título obrigatório', description: 'Por favor, informe um título descritivo para a versão.', variant: 'destructive' });
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
        toast({ title: 'Versão criada!', description: `A versão ${formTag} foi cadastrada no banco de dados.` });
      }

      setIsDialogOpen(false);
      await loadReleases();
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar versão',
        description: err.message || 'Falha na comunicação com o servidor.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Release
  const handleDelete = async (item: AppReleaseItem) => {
    if (!confirm(`Tem certeza que deseja remover a versão ${item.tag}?`)) return;

    try {
      if (item.id && !item.id.startsWith('legacy-')) {
        await changelogApi.deleteRelease(item.id);
        toast({ title: 'Versão excluída', description: `A versão ${item.tag} foi removida.` });
      }
      setReleases(releases.filter((r) => r.id !== item.id && r.tag !== item.tag));
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'Não foi possível excluir a versão.',
        variant: 'destructive'
      });
    }
  };

  // Filtered List
  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      const matchSearch =
        search === '' ||
        r.tag.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.changes?.some((c) => c.toLowerCase().includes(search.toLowerCase()));

      const matchType =
        typeFilter === 'all' ||
        (typeFilter === 'draft' && !r.isPublished) ||
        r.type?.toLowerCase() === typeFilter.toLowerCase();

      return matchSearch && matchType;
    });
  }, [releases, search, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <GitBranch className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white font-headline">
              Changelog & <span className="text-primary">Engenharia de Versões</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Gerencie o histórico de lançamentos, builds e notas de engenharia armazenadas no banco de dados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider gap-2 shadow-lg shadow-primary/20"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4" />
            <span>Nova Versão</span>
          </Button>
        </div>
      </div>

      {/* Stats and Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Build Mais Recente</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{latestTag}</p>
        </Card>
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Releases</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{releases.length}</p>
        </Card>
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Major Releases</span>
          <p className="text-2xl font-black text-primary tracking-tight mt-1">
            {releases.filter((r) => r.type === 'major').length}
          </p>
        </Card>
        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patches & Fixes</span>
          <p className="text-2xl font-black text-indigo-500 tracking-tight mt-1">
            {releases.filter((r) => r.type === 'patch').length}
          </p>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por tag, título ou alteração..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'patch', label: 'Patches' },
            { id: 'minor', label: 'Minors' },
            { id: 'major', label: 'Majors' },
            { id: 'draft', label: 'Rascunhos' },
          ].map((f) => (
            <Button
              key={f.id}
              variant={typeFilter === f.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(f.id)}
              className={`h-8 px-3 rounded-lg text-xs font-bold ${
                typeFilter === f.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {f.label}
            </Button>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={loadReleases}
            className="h-8 px-2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
            title="Recarregar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Releases List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm font-medium">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Carregando versões do banco de dados...
          </div>
        ) : filteredReleases.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 text-sm font-medium">
            Nenhuma versão encontrada para os filtros selecionados.
          </div>
        ) : (
          filteredReleases.map((release) => (
            <Card
              key={release.id || release.tag}
              className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 rounded-3xl p-5 hover:border-primary/30 transition-all shadow-sm group"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    {renderIcon(release.iconName || release.icon?.name, release.iconClass || release.icon?.className)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-black uppercase tracking-wider py-0.5 px-2 rounded-md ${
                          release.type === 'major'
                            ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900'
                            : release.type === 'minor'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                            : 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900'
                        }`}
                      >
                        {release.tag}
                      </Badge>

                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {release.displayDate || release.date}
                      </span>

                      {!release.isPublished && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-[9px] uppercase font-black">
                          Rascunho
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                      {release.title}
                    </h3>

                    {release.description && release.description !== release.title && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {release.description}
                      </p>
                    )}

                    {release.changes && release.changes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {release.changes.slice(0, 3).map((change, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span className="truncate max-w-[280px]">{change}</span>
                          </span>
                        ))}
                        {release.changes.length > 3 && (
                          <span className="text-[10px] font-bold text-slate-400 py-1 px-1">
                            +{release.changes.length - 3} mais
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-bold gap-1.5"
                    onClick={() => handleOpenEdit(release)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-500 hover:text-rose-600 text-xs font-bold gap-1.5"
                    onClick={() => handleDelete(release)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Excluir</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal: Nova / Editar Versão */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight font-headline flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                {renderIcon(formIconName, formIconClass)}
              </div>
              <span>{editingItem ? 'Editar Versão' : 'Nova Versão & Release'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Preencha os dados da nova versão para alimentar a timeline pública do Changelog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* SemVer Type Selector */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 block">
                Tipo de Incremento SemVer
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: 'patch', title: 'Patch (+0.0.1)', desc: 'Correções de bugs e melhorias leves' },
                  { type: 'minor', title: 'Minor (+0.1.0)', desc: 'Novas funcionalidades e módulos' },
                  { type: 'major', title: 'Major (+1.0.0)', desc: 'Mudanças estruturais e grandes marcos' },
                ].map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => handleTypeChange(t.type as any)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formType === t.type
                        ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-black uppercase tracking-wide mb-0.5">{t.title}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tag and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">
                  Tag da Versão
                </Label>
                <Input
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  placeholder="v3.118.0"
                  className="h-10 rounded-xl font-mono text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">
                  Data de Lançamento
                </Label>
                <Input
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  placeholder="17 de Agosto, 2026"
                  className="h-10 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">
                Título do Release
              </Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: feat(squad): Squad Pulse — dashboard de produtividade integrado ao Jira"
                className="h-10 rounded-xl text-sm font-semibold"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">
                Resumo / Descrição
              </Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Breve resumo destacando os objetivos alcançados nesta entrega..."
                rows={2}
                className="rounded-xl text-sm"
              />
            </div>

            {/* Icon Picker */}
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 block">
                Ícone do Release
              </Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ICONS.map((icon) => (
                  <button
                    key={icon.name}
                    type="button"
                    onClick={() => handleSelectIcon(icon.name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                      formIconName === icon.name
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {renderIcon(icon.name, icon.className)}
                    <span>{icon.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Changes List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Lista de Alterações ({formChanges.length})
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBulkAdd(!showBulkAdd)}
                  className="h-7 text-[11px] font-bold text-primary hover:text-primary/80"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  {showBulkAdd ? 'Ocultar inserção em massa' : 'Inserir em lote'}
                </Button>
              </div>

              {showBulkAdd ? (
                <div className="space-y-2 mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <Textarea
                    placeholder="Cole múltiplas alterações separadas por quebra de linha ou ponto e vírgula (;)..."
                    value={bulkChangeInput}
                    onChange={(e) => setBulkChangeInput(e.target.value)}
                    rows={3}
                    className="text-xs rounded-xl"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleParseBulkChanges}
                      className="h-8 px-4 text-xs font-bold"
                    >
                      Processar Itens
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Adicionar item de alteração..."
                  value={newChangeInput}
                  onChange={(e) => setNewChangeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChange();
                    }
                  }}
                  className="h-9 rounded-xl text-xs"
                />
                <Button
                  type="button"
                  onClick={handleAddChange}
                  className="h-9 px-4 rounded-xl text-xs font-bold shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {formChanges.map((change, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium"
                  >
                    <span className="truncate flex-1">{change}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChange(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Published toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Publicar Imediatamente</div>
                <div className="text-[11px] text-slate-500">Se desativado, o registro ficará salvo como rascunho visível apenas para administradores.</div>
              </div>
              <Switch checked={formIsPublished} onCheckedChange={setFormIsPublished} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-xl h-10 px-5 text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider shadow-md"
            >
              {isSaving ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Publicar Versão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
