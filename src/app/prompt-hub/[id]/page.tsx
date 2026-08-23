'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { promptApi } from '../api';
import { PromptItem } from '../types';
import { PromptView } from '../components/PromptView';
import { useRouter } from 'next/navigation';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const deniedMessage = (isSignedIn: boolean) =>
  isSignedIn
    ? 'Acesso restrito. Este item não é público e só pode ser aberto pelo autor.'
    : 'Acesso restrito. Este item não é público. Entre com sua conta — se você for o autor, ele será exibido.';

export default function SharedPromptPage(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params);
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const [prompt, setPrompt] = useState<PromptItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    async function load() {
      try {
        const data = await promptApi.getPromptById(params.id);

        // Itens não públicos são visíveis apenas para o autor.
        if (data.visibility === 'public' || data.authorId === session?.id) {
          setPrompt(data);
        } else {
          setError(deniedMessage(!!session));
        }
      } catch (e: any) {
        console.error(e);
        setError('Prompt não encontrado ou acesso restrito.');
      } finally {
        setLoading(false);
      }
    }
    
    load();
  }, [params.id, session, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900">
        <EliteSpinner size="lg" variant="indigo" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-900 space-y-6">
        <ShieldAlert className="h-16 w-16 text-rose-500" />
        <p className="text-lg font-bold text-white text-center max-w-md">{error}</p>
        <Button 
          onClick={() => router.push('/prompt-hub')}
          className="bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest px-8 rounded-xl h-12"
        >
           <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Hub
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/10 blur-[100px] rounded-full -z-10" />
      
      <PromptView 
        prompt={prompt} 
        isOpen={!!prompt} 
        isOwner={session?.id === prompt?.authorId}
        onClose={() => router.push('/prompt-hub')}
        onCopy={() => {}}
      />
    </div>
  );
}
