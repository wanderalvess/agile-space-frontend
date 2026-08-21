'use client';

import React, { useState, useMemo } from 'react';
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
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, serverTimestamp, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import { PromptItem } from '@/app/prompt-hub/types';
import { deletePromptWithChildren } from '@/app/prompt-hub/deletePrompt';
import { PromptCard } from '@/app/prompt-hub/components/PromptCard';
import { PromptEditor } from '@/app/prompt-hub/components/PromptEditor';
import { PromptView } from '@/app/prompt-hub/components/PromptView';

export function MyPrompts({ userProfile }: { userProfile: any }) {
  const { firestore, user } = useFirebase();
  const effectiveUserId = userProfile?.id || userProfile?.email || user?.uid;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<PromptItem | null>(null);
  const [search, setSearch] = useState('');

  // Filtra só por autoria para usar o índice (authorId, updatedAt) que existe.
  // visibility + authorId + updatedAt não tem índice composto e falharia.
  const promptsQuery = useMemoFirebase(() => {
    if (!firestore || !effectiveUserId) return null;
    return query(
      collection(firestore, 'prompt_hub'),
      where('authorId', '==', effectiveUserId),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, effectiveUserId]);

  const { data: rawPrompts, isLoading } = useCollection<PromptItem>(promptsQuery, { silent: true });

  const filteredPrompts = useMemo(() => {
    if (!rawPrompts || !effectiveUserId) return [];
    
    // Filtra apenas os prompts do usuário logado
    const userPrompts = rawPrompts.filter(item => item.authorId === effectiveUserId);
    
    if (!search) return userPrompts;
    
    const searchLower = search.toLowerCase();
    return userPrompts.filter(item => 
      item.title.toLowerCase().includes(searchLower) || 
      item.content?.toLowerCase().includes(searchLower) ||
      item.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }, [rawPrompts, search, effectiveUserId]);

  const handleSave = async (data: Partial<PromptItem>) => {
    if (!firestore || !effectiveUserId) return;
    
    const loadingToast = toast.loading('Salvando...');
    try {
      const id = data.id || `prompt_${Date.now()}_${effectiveUserId}`;
      const payload = {
        ...data,
        id,
        authorId: effectiveUserId,
        authorName: userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Membro',
        authorRole: userProfile?.role || 'Colaborador',
        authorSquad: userProfile?.squadId || 'Squad Geral',
        authorAvatar: userProfile?.avatarSeed || '',
        updatedAt: serverTimestamp()
      };

      if (!data.id) {
        (payload as any).createdAt = serverTimestamp();
        (payload as any).useCount = 0;
        (payload as any).forkCount = 0;
      }

      await setDoc(doc(firestore, 'prompt_hub', id), payload, { merge: true });
      toast.success('Prompt salvo com sucesso!', { id: loadingToast });
      setIsEditorOpen(false);
      setEditingPrompt(null);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message, { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !confirm('Deseja realmente excluir este prompt?')) return;
    try {
      // Remove também os comentários pendurados no item — o Firestore não
      // apaga subcoleção em cascata.
      await deletePromptWithChildren(firestore, id, effectiveUserId);
      toast.success('Prompt removido.');
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[60vh]">
        <EliteSpinner size="md" variant="indigo" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900 leading-none">
            Meus <span className="text-primary not-italic">Prompts</span>
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
            Sua biblioteca privada de modelos de escrita e prompts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar prompts..."
              className="h-10 pl-9 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-primary/10 text-xs font-bold"
            />
          </div>
          <Button 
            onClick={() => {
              setEditingPrompt(null);
              setIsEditorOpen(true);
            }}
            className="h-10 px-6 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all gap-2 shrink-0"
          >
            <Plus className="h-4 w-4 text-primary" /> Novo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPrompts.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
              <MessageSquare className="h-8 w-8 text-slate-200" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic">Nenhum prompt encontrado</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[240px] mt-2">
              Você ainda não possui prompts registrados nesta conta. Comece criando um novo.
            </p>
          </div>
        ) : (
          filteredPrompts.map(prompt => (
            <PromptCard 
              key={prompt.id} 
              prompt={prompt} 
              isOwner={true}
              // Sem estrela aqui: favoritos vivem em users/{uid}/prompt_favorites
              // e este painel não assina essa coleção.
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
