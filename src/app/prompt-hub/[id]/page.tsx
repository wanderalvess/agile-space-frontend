'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { promptApi } from '../api';
import { PromptItem } from '../types';
import { PromptView } from '../components/PromptView';
import { useRouter } from 'next/navigation';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
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
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <AgileSpinner size="lg" variant="indigo" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-5 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Acesso ao Ativo de IA</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
          </div>
          <Button 
            variant="outline"
            onClick={() => router.push('/prompt-hub')}
            className="w-full h-10 font-medium"
          >
             <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Hub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
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
