'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog, FIELD, ModalButton } from '@/components/room-kit';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/page';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { PromptItem } from '@/app/prompt-hub/types';
import { promptApi } from '@/app/prompt-hub/api';
import { deletePromptWithChildren } from '@/app/prompt-hub/deletePrompt';
import { PromptCard } from '@/app/prompt-hub/components/PromptCard';
import { PromptEditor } from '@/app/prompt-hub/components/PromptEditor';
import { PromptView } from '@/app/prompt-hub/components/PromptView';
import { WorkspaceSectionHeader } from './workspace-ui';

/** Filtra os prompts por título, conteúdo ou tag (sem diferenciar caixa). */
export function filterPrompts(prompts: PromptItem[], search: string): PromptItem[] {
  const q = search.trim().toLowerCase();
  if (!q) return prompts;
  return prompts.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.content?.toLowerCase().includes(q) ||
      (item.tags || []).some((t) => t.toLowerCase().includes(q)),
  );
}

export function MyPrompts({ userProfile }: { userProfile: any }) {
  const { session } = useAuth();
  const effectiveUserId = userProfile?.id || userProfile?.email || session?.id;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<PromptItem | null>(null);
  const [toDelete, setToDelete] = useState<PromptItem | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [search, setSearch] = useState('');

  const [rawPrompts, setRawPrompts] = useState<PromptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadPrompts = useCallback(async () => {
    if (!effectiveUserId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(false);
    try {
      const response = await promptApi.listPrompts(undefined, effectiveUserId, 0, 100);
      setRawPrompts(response.content);
    } catch (err: any) {
      console.error('Erro ao carregar prompts do usuário', err);
      setLoadError(true);
      toast.error('Erro ao carregar seus prompts.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const filteredPrompts = useMemo(() => filterPrompts(rawPrompts || [], search), [rawPrompts, search]);

  const authorSnapshot = () => ({
    authorName: userProfile?.name || session?.name || session?.email?.split('@')[0] || 'Membro',
    authorRole: userProfile?.role || 'Colaborador',
    authorSquad: userProfile?.squadId || 'Squad Geral',
    authorAvatar: userProfile?.avatarSeed || '',
  });

  const openNew = () => {
    setEditingPrompt(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (prompt: PromptItem) => {
    setViewingPrompt(null);
    setEditingPrompt(prompt);
    setIsEditorOpen(true);
  };

  const handleSave = async (data: Partial<PromptItem>) => {
    if (!effectiveUserId) return;

    const loadingToast = toast.loading('Salvando...');
    try {
      const payload: Partial<PromptItem> = { ...data, authorId: effectiveUserId, ...authorSnapshot() };
      delete (payload as any).id;
      delete (payload as any).createdAt;
      delete (payload as any).updatedAt;

      if (data.id) {
        await promptApi.updatePrompt(data.id, payload);
      } else {
        await promptApi.createPrompt(payload);
      }
      toast.success('Prompt salvo com sucesso!', { id: loadingToast });
      setIsEditorOpen(false);
      setEditingPrompt(null);
      loadPrompts();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message, { id: loadingToast });
    }
  };

  const handleDelete = async () => {
    const target = toDelete;
    if (!target) return;
    if (viewingPrompt?.id === target.id) setViewingPrompt(null);
    try {
      await deletePromptWithChildren(target.id);
      toast.success('Prompt removido.');
      loadPrompts();
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    }
  };

  // Duplicar cria a cópia na biblioteca privada e já abre para ajustar (mesmo caminho do Prompt Hub).
  const handleFork = async (source: PromptItem) => {
    if (isCloning) return;
    setIsCloning(true);
    const loadingToast = toast.loading('Duplicando...');
    try {
      const copy = await promptApi.clonePrompt(source.id, authorSnapshot());
      toast.success('Cópia criada na sua biblioteca privada', { id: loadingToast });
      setViewingPrompt(null);
      loadPrompts();
      setTimeout(() => {
        setEditingPrompt(copy);
        setIsEditorOpen(true);
      }, 250);
    } catch (err: any) {
      toast.error('Erro ao duplicar', { id: loadingToast, description: err.message });
    } finally {
      setIsCloning(false);
    }
  };

  // Contabiliza o uso quando o conteúdo é copiado.
  const handleCopied = async (id: string) => {
    try {
      await promptApi.usePrompt(id);
      setRawPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, useCount: (p.useCount || 0) + 1 } : p)));
    } catch (err) {
      console.warn('Não foi possível atualizar o contador de uso.', err);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Meus prompts"
        subtitle="Sua biblioteca privada de modelos de escrita, instruções de IA e prompts"
        action={
          <>
            <div className="relative w-full sm:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar prompts..."
                aria-label="Filtrar prompts"
                className={cn(FIELD, 'h-[42px] pl-9 text-sm')}
              />
            </div>
            <ModalButton variant="primary" onClick={openNew}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Novo
            </ModalButton>
          </>
        }
      />

      {isLoading ? (
        <LoadingSkeleton variant="cards" rows={3} label="Carregando seus prompts" />
      ) : loadError ? (
        <ErrorState title="Não foi possível carregar os prompts" description="Verifique a conexão e tente de novo." onRetry={loadPrompts} />
      ) : filteredPrompts.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhum prompt encontrado"
          description={rawPrompts.length === 0 ? 'Você ainda não possui prompts registrados nesta conta. Comece criando um novo modelo para acelerar seu trabalho.' : `Nenhum prompt combina com "${search.trim()}".`}
          actions={
            rawPrompts.length === 0 ? (
              <ModalButton variant="primary" onClick={openNew}>
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Criar primeiro prompt
              </ModalButton>
            ) : (
              <ModalButton onClick={() => setSearch('')}>Limpar filtro</ModalButton>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              isOwner={true}
              // Favoritos vivem no navegador e este painel não os carrega: sem estrela. O menu
              // Editar/Duplicar/Excluir é do dono e aparece aqui (antes ficava oculto por isReadOnly).
              hideFavorite
              onFork={handleFork}
              onEdit={handleEdit}
              onView={() => setViewingPrompt(prompt)}
              onDelete={() => setToDelete(prompt)}
              onCopy={handleCopied}
            />
          ))}
        </div>
      )}

      <PromptEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingPrompt(null);
        }}
        onSave={handleSave}
        initialData={editingPrompt}
      />

      <PromptView
        isOpen={!!viewingPrompt}
        onClose={() => setViewingPrompt(null)}
        prompt={viewingPrompt}
        isOwner={true}
        onCopy={handleCopied}
        onEdit={handleEdit}
        onDelete={(id) => setToDelete(rawPrompts.find((p) => p.id === id) ?? viewingPrompt)}
        onFork={handleFork}
        userProfile={userProfile}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        tone="danger"
        icon={Trash2}
        title={`Excluir "${toDelete?.title ?? 'prompt'}"?`}
        description="Isso não pode ser desfeito."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  );
}
