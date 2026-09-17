'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Lock,
  Sparkles,
  Terminal,
  BrainCircuit,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { PromptItem } from '@/app/prompt-hub/types';
import { promptApi } from '@/app/prompt-hub/api';
import { deletePromptWithChildren } from '@/app/prompt-hub/deletePrompt';
import { PromptCard } from '@/app/prompt-hub/components/PromptCard';
import { PromptEditor } from '@/app/prompt-hub/components/PromptEditor';
import { PromptView } from '@/app/prompt-hub/components/PromptView';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';

export function MyPrompts({ userProfile }: { userProfile: any }) {
  const { session } = useAuth();
  const effectiveUserId = userProfile?.id || userProfile?.email || session?.id;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<PromptItem | null>(null);
  const [search, setSearch] = useState('');

  const [rawPrompts, setRawPrompts] = useState<PromptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPrompts = useCallback(async () => {
    if (!effectiveUserId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await promptApi.listPrompts(undefined, effectiveUserId, 0, 100);
      setRawPrompts(response.content);
    } catch (err: any) {
      console.error('Erro ao carregar prompts do usuário', err);
      toast.error('Erro ao carregar seus prompts.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const filteredPrompts = useMemo(() => {
    if (!rawPrompts) return [];

    if (!search) return rawPrompts;

    const searchLower = search.toLowerCase();
    return rawPrompts.filter(item =>
      item.title.toLowerCase().includes(searchLower) ||
      item.content?.toLowerCase().includes(searchLower) ||
      item.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }, [rawPrompts, search]);

  const handleSave = async (data: Partial<PromptItem>) => {
    if (!effectiveUserId) return;

    const loadingToast = toast.loading('Salvando...');
    try {
      const payload: Partial<PromptItem> = {
        ...data,
        authorId: effectiveUserId,
        authorName: userProfile?.name || session?.name || session?.email?.split('@')[0] || 'Membro',
        authorRole: userProfile?.role || 'Colaborador',
        authorSquad: userProfile?.squadId || 'Squad Geral',
        authorAvatar: userProfile?.avatarSeed || '',
      };
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

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este prompt?')) return;
    try {
      await deletePromptWithChildren(id);
      toast.success('Prompt removido.');
      loadPrompts();
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[60vh]">
        <AgileSpinner size="md" variant="indigo" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-6 w-full">
      <WorkspaceSectionHeader
        kicker="Prompts"
        accent="orange"
        title="Meus"
        titleAccent="Prompts"
        subtitle="Sua biblioteca privada de modelos de escrita, instruções de IA e prompts"
        action={
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar prompts..."
                className="h-10 pl-9 rounded-xl border-border bg-background text-foreground shadow-xs focus-visible:ring-2 focus-visible:ring-primary/20 text-xs font-medium"
              />
            </div>
            <Button
              onClick={() => {
                setEditingPrompt(null);
                setIsEditorOpen(true);
              }}
              className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold uppercase text-xs tracking-wider shadow-md shadow-primary/20 transition-all gap-2 shrink-0 active:scale-95"
            >
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
        {filteredPrompts.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center bg-card text-card-foreground border border-border/80 rounded-3xl shadow-xs">
            <div className="w-16 h-16 bg-muted/40 rounded-2xl flex items-center justify-center mb-5">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-bold text-foreground uppercase tracking-tight italic">Nenhum prompt encontrado</h3>
            <p className="text-xs font-medium text-muted-foreground max-w-sm mt-1.5 leading-relaxed">
              Você ainda não possui prompts registrados nesta conta. Comece criando um novo modelo para acelerar seu trabalho.
            </p>
            <Button
              onClick={() => {
                setEditingPrompt(null);
                setIsEditorOpen(true);
              }}
              variant="outline"
              className="mt-4 text-xs font-bold rounded-xl"
            >
              <Plus className="h-3.5 w-3.5 mr-1 text-primary" /> Criar Primeiro Prompt
            </Button>
          </div>
        ) : (
          filteredPrompts.map(prompt => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              isOwner={true}
              // Sem estrela aqui: favoritos vivem em localStorage do navegador
              // e este painel não os carrega.
              isReadOnly={true}
              onFork={() => {}}
              onEdit={() => {
                setEditingPrompt(prompt);
                setIsEditorOpen(true);
              }}
              onView={() => setViewingPrompt(prompt)}
              onDelete={() => handleDelete(prompt.id)}
              onToggleFavorite={() => {}}
            />
          ))
        )}
      </div>

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
        onCopy={() => {}}
      />
    </div>
  );
}
