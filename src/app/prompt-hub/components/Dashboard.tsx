'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  LayoutGrid,
  Library,
  HelpCircle,
  GraduationCap,
  Layers,
  Star,
  X,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { PromptGuide } from '@/components/prompt-hub/PromptGuide';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserContext } from '@/context/UserContext';
import { cn } from '@/lib/utils';
import { PromptItem, PromptFilters } from '../types';
import { TYPE_ORDER, getTypeMeta, SORT_OPTIONS, type SortKey } from '../constants';
import { PromptCard } from './PromptCard';
import { useFirebase } from '@/firebase';
import { toast } from 'sonner';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import { promptApi } from '../api';
import { PromptEditor } from './PromptEditor';
import { PromptView } from './PromptView';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const HIGHLIGHT_COUNT = 3;

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return value?.toDate?.()?.getTime?.() ?? 0;
};

export function PromptDashboard({
  userProfile,
  isPublicView = false
}: {
  userProfile: any;
  isPublicView?: boolean;
}) {
  const { user } = useFirebase();
  const router = useRouter();
  const { requestIdentity } = useUserContext();
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<PromptItem | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const [filters, setFilters] = useState<PromptFilters>({
    search: '',
    type: 'all',
    visibility: isPublicView ? 'public' : 'all',
    tags: [],
    onlyFavorites: false
  });
  const [sort, setSort] = useState<SortKey>('recent');

  const [rawPrompts, setRawPrompts] = useState<PromptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Carrega favoritos do LocalStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`favorites_${user?.uid || 'anonymous'}`);
      if (saved) {
        try {
          setFavoriteIds(new Set(JSON.parse(saved)));
        } catch (e) {
          console.warn('Erro ao carregar favoritos locais', e);
        }
      }
    }
  }, [user]);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const publicResponse = await promptApi.listPrompts(undefined, undefined, 0, 100);
      let myResponseContent: PromptItem[] = [];
      if (user?.uid && !isPublicView) {
        const myResponse = await promptApi.listPrompts(undefined, user.uid, 0, 100);
        myResponseContent = myResponse.content;
      }
      
      const map = new Map<string, PromptItem>();
      publicResponse.content.forEach(item => map.set(item.id, item));
      myResponseContent.forEach(item => map.set(item.id, item));

      const merged = Array.from(map.values()).map(item => ({
        ...item,
        isFavorited: favoriteIds.has(item.id)
      }));

      setRawPrompts(merged);
    } catch (err: any) {
      console.error('Erro ao buscar prompts', err);
      toast.error('Não foi possível carregar os itens do Prompt Hub');
    } finally {
      setIsLoading(false);
    }
  }, [user, isPublicView, favoriteIds]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  /** Itens que o usuário pode ver, já com escopo e favoritos aplicados — mas antes
   *  do filtro de tipo, para que a contagem de cada categoria não zere ao clicar. */
  const scopedPrompts = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return rawPrompts.filter(item => {
      const isOwner = item.authorId === user?.uid;
      if (!isOwner && item.visibility !== 'public') return false;

      if (filters.visibility === 'public' && item.visibility !== 'public') return false;
      if (filters.visibility === 'private' && (item.visibility !== 'private' || !isOwner)) return false;

      if (filters.onlyFavorites && !item.isFavorited) return false;

      if (filters.tags.length > 0) {
        const itemTags = item.tags?.map(t => t.toLowerCase()) ?? [];
        if (!filters.tags.every(tag => itemTags.includes(tag.toLowerCase()))) return false;
      }

      if (searchTerm) {
        const haystack = [
          item.title,
          item.description,
          item.content,
          item.authorName,
          item.businessGoal,
          ...(item.tags ?? [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }

      return true;
    });
  }, [rawPrompts, filters.visibility, filters.onlyFavorites, filters.tags, filters.search, user?.uid]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    scopedPrompts.forEach(item => {
      counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    });
    return counts;
  }, [scopedPrompts]);

  const sortedPrompts = useMemo(() => {
    const list = filters.type === 'all'
      ? [...scopedPrompts]
      : scopedPrompts.filter(item => item.type === filters.type);

    switch (sort) {
      case 'used':
        return list.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
      case 'forked':
        return list.sort((a, b) => (b.forkCount || 0) - (a.forkCount || 0));
      case 'alpha':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'));
      default:
        return list.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
    }
  }, [scopedPrompts, filters.type, sort]);

  const hasActiveFilters =
    !!filters.search.trim() ||
    filters.type !== 'all' ||
    filters.tags.length > 0 ||
    filters.onlyFavorites ||
    (!isPublicView && filters.visibility !== 'all');

  /** A faixa de destaques só faz sentido na visão sem filtros: é uma vitrine de
   *  entrada, não um resultado de busca. Ordena por uso real, não por data. */
  const highlights = useMemo(() => {
    if (hasActiveFilters) return [];
    return [...scopedPrompts]
      .filter(item => (item.useCount || 0) > 0)
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, HIGHLIGHT_COUNT);
  }, [scopedPrompts, hasActiveFilters]);

  const clearFilters = () =>
    setFilters({
      search: '',
      type: 'all',
      visibility: isPublicView ? 'public' : 'all',
      tags: [],
      onlyFavorites: false
    });

  const toggleTag = (tag: string) =>
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));

  const handleSave = async (data: Partial<PromptItem>) => {
    if (!user) return;
    const loadingToast = toast.loading('Salvando...');
    try {
      const { isFavorited: _ignored, ...promptData } = data;
      const payload = {
        ...promptData,
        authorId: user.uid,
        authorName: userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Membro',
        authorRole: userProfile?.role || 'Engenheiro',
        authorSquad: userProfile?.squadId || 'Squad Geral',
        authorAvatar: userProfile?.avatarSeed || '',
        status: data.status || 'producao',
        impact: data.impact || 'medio',
      };

      if (data.id) {
        await promptApi.updatePrompt(data.id, payload);
      } else {
        await promptApi.createPrompt(payload);
      }

      toast.success(data.id ? 'Item atualizado' : 'Item publicado', { id: loadingToast });
      setIsEditorOpen(false);
      setEditingPrompt(null);
      loadData();
    } catch (err: any) {
      toast.error('Erro ao salvar', { id: loadingToast, description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este item? A ação não pode ser desfeita.')) return;

    if (viewingPrompt?.id === id) setViewingPrompt(null);

    const loadingToast = toast.loading('Excluindo...');
    try {
      await promptApi.deletePrompt(id);
      toast.success('Item removido', { id: loadingToast });
      loadData();
    } catch (err: any) {
      toast.error('Erro ao remover', { id: loadingToast, description: err.message });
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await promptApi.usePrompt(id);
      setRawPrompts(prev => prev.map(p => p.id === id ? { ...p, useCount: (p.useCount || 0) + 1 } : p));
    } catch (err) {
      console.warn('Não foi possível atualizar o contador de uso.', err);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    if (!user) {
      requestIdentity?.();
      return;
    }

    const wasFavorited = favoriteIds.has(id);
    const newFavorites = new Set(favoriteIds);
    if (wasFavorited) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }

    try {
      localStorage.setItem(`favorites_${user.uid}`, JSON.stringify(Array.from(newFavorites)));
      setFavoriteIds(newFavorites);
      setRawPrompts(prev => prev.map(p => p.id === id ? { ...p, isFavorited: !wasFavorited } : p));
      toast.success(wasFavorited ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch (err: any) {
      console.error(err);
      toast.error('Não foi possível atualizar o favorito.');
    }
  };

  const handleEdit = (prompt: PromptItem) => {
    setEditingPrompt(prompt);
    setIsEditorOpen(true);
  };

  const handleFork = async (source: PromptItem) => {
    if (!user) {
      requestIdentity?.();
      return;
    }
    const loadingToast = toast.loading('Duplicando...');
    try {
      const payload: Partial<PromptItem> = {
        ...source,
        id: undefined,
        title: `Cópia de ${source.title}`,
        visibility: 'private',
        authorId: user.uid,
        authorName: userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Membro',
        authorRole: userProfile?.role || 'Engenheiro',
        authorSquad: userProfile?.squadId || 'Squad Geral',
        authorAvatar: userProfile?.avatarSeed || '',
        status: source.status || 'producao',
        impact: source.impact || 'medio',
        useCount: 0,
        forkCount: 0
      };

      const newPrompt = await promptApi.createPrompt(payload);
      await promptApi.forkPrompt(source.id);

      toast.success('Cópia criada na sua biblioteca privada', { id: loadingToast });

      setViewingPrompt(null);
      loadData();
      setTimeout(() => {
        setEditingPrompt(newPrompt);
        setIsEditorOpen(true);
      }, 250);
    } catch (err: any) {
      toast.error('Erro ao duplicar', { id: loadingToast, description: err.message });
    }
  };

  const currentViewingPrompt = viewingPrompt
    ? rawPrompts?.find(p => p.id === viewingPrompt.id) || viewingPrompt
    : null;

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-1 items-center justify-center bg-background">
        <EliteSpinner size="md" variant="indigo" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-1 flex-col bg-background">
      <RoomHeader
        title="Biblioteca de IA"
        toolIcon={<Library className="h-4 w-4" />}
        toolColorClass="text-primary"
        onOpenFeedback={() => setFeedbackSignal(Date.now())}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/prompt-hub/colecoes')}
              className="hidden gap-2 text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Layers className="h-4 w-4" />
              Coleções
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/prompt-hub/tutorial')}
              className="hidden gap-2 text-muted-foreground hover:text-foreground lg:inline-flex"
            >
              <GraduationCap className="h-4 w-4" />
              Como criar uma skill
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsGuideOpen(true)}
              title="Guia do Hub"
              className="text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <PromptGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

            {!isPublicView && (
              <Button
                onClick={() => {
                  setEditingPrompt(null);
                  setIsEditorOpen(true);
                }}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Publicar item</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col overflow-hidden px-4 lg:px-8">
          {/* Barra de descoberta: busca em destaque, escopo e ordenação ao lado. */}
          <div className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
                placeholder="Buscar por título, descrição, conteúdo, tag ou autor..."
                className="h-11 pl-10 text-sm"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters({ ...filters, search: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isPublicView && (
                <Select
                  value={filters.visibility}
                  onValueChange={(value: any) => setFilters({ ...filters, visibility: value })}
                >
                  <SelectTrigger className="h-11 w-[150px] text-sm">
                    <SelectValue placeholder="Escopo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os itens</SelectItem>
                    <SelectItem value="public">Públicos</SelectItem>
                    <SelectItem value="private">Meus privados</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Select value={sort} onValueChange={(value: any) => setSort(value)}>
                <SelectTrigger className="h-11 w-[150px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!isPublicView && (
                <Button
                  variant={filters.onlyFavorites ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setFilters({ ...filters, onlyFavorites: !filters.onlyFavorites })}
                  title={filters.onlyFavorites ? 'Mostrar todos' : 'Mostrar apenas favoritos'}
                  className="h-11 w-11 shrink-0"
                >
                  <Star className={cn('h-4 w-4', filters.onlyFavorites && 'fill-current')} />
                </Button>
              )}
            </div>
          </div>

          {/* Categorias com contagem: dá noção do acervo antes de clicar. */}
          <div className="flex flex-wrap items-center gap-2 pb-4">
            <button
              onClick={() => setFilters({ ...filters, type: 'all' })}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                filters.type === 'all'
                  ? 'border-foreground/20 bg-accent font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Tudo
              <span className="text-xs text-muted-foreground">{scopedPrompts.length}</span>
            </button>

            {TYPE_ORDER.map(type => {
              const meta = getTypeMeta(type);
              const count = typeCounts.get(type) ?? 0;
              const Icon = meta.icon;
              const isActive = filters.type === type;

              return (
                <button
                  key={type}
                  onClick={() => setFilters({ ...filters, type: isActive ? 'all' : type })}
                  disabled={count === 0 && !isActive}
                  title={meta.summary}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'border-foreground/20 bg-accent font-medium text-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    count === 0 && !isActive && 'cursor-not-allowed opacity-40 hover:bg-transparent'
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive && meta.accent)} />
                  {meta.label}
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Tags ativas + limpar filtros */}
          {(filters.tags.length > 0 || hasActiveFilters) && (
            <div className="flex flex-wrap items-center gap-2 pb-4">
              {filters.tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs text-foreground"
                  title="Remover esta tag do filtro"
                >
                  #{tag}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar filtros
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pb-16">
            {highlights.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Mais utilizados
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {highlights.map(prompt => (
                    <PromptCard
                      key={`highlight-${prompt.id}`}
                      prompt={prompt}
                      isOwner={prompt.authorId === user?.uid}
                      isReadOnly={isPublicView}
                      onFork={handleFork}
                      onEdit={handleEdit}
                      onView={setViewingPrompt}
                      onDelete={handleDelete}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectTag={toggleTag}
                      onCopy={handleCopy}
                      onSelectAuthor={authorId => router.push(`/prompt-hub/autor/${authorId}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {hasActiveFilters ? 'Resultados' : 'Todos os itens'}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {sortedPrompts.length}{' '}
                  {sortedPrompts.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {sortedPrompts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
                  <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
                  <h3 className="text-base font-semibold text-foreground">
                    {hasActiveFilters ? 'Nenhum item encontrado' : 'A biblioteca está vazia'}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? 'Tente outro termo, remova filtros ou amplie o escopo da busca.'
                      : 'Publique o primeiro prompt, skill ou agente para o time começar a reaproveitar.'}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Limpar filtros
                      </Button>
                    )}
                    {!isPublicView && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingPrompt(null);
                          setIsEditorOpen(true);
                        }}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Publicar item
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
                  {sortedPrompts.map(prompt => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      isOwner={prompt.authorId === user?.uid}
                      isReadOnly={isPublicView}
                      onFork={handleFork}
                      onEdit={handleEdit}
                      onView={setViewingPrompt}
                      onDelete={handleDelete}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectTag={toggleTag}
                      onCopy={handleCopy}
                      onSelectAuthor={authorId => router.push(`/prompt-hub/autor/${authorId}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} />

      <FeedbackWidget
        toolName="Espaço Ágil - Biblioteca de IA"
        triggerVariant="none"
        externalTriggerSignal={feedbackSignal}
      />

      <PromptEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingPrompt(null);
        }}
        onSave={handleSave}
        initialData={editingPrompt}
        existingItems={rawPrompts}
      />

      <PromptView
        isOpen={!!viewingPrompt}
        onClose={() => setViewingPrompt(null)}
        prompt={currentViewingPrompt}
        onCopy={handleCopy}
        isOwner={currentViewingPrompt?.authorId === user?.uid}
        isReadOnly={isPublicView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onFork={handleFork}
        onToggleFavorite={handleToggleFavorite}
        onSelectTag={tag => {
          setViewingPrompt(null);
          toggleTag(tag);
        }}
        userProfile={userProfile}
      />
    </div>
  );
}
