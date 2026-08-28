'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { ShowcaseDashboard } from '@/components/showcase/ShowcaseDashboard';
import { ShowcaseSession } from '@/components/showcase/types';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { useAuth } from '@/context/AuthContext';
import { showcaseApi } from '@/app/showcase/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ShowcaseHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useAuth();
  const { requestIdentity } = useUserContext();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [sprintName, setSprintName] = useState('');

  const [dbSessions, setDbSessions] = useState<ShowcaseSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const data = await showcaseApi.getSessions();
      setDbSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSessionsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreate = async () => {
    if (isCreating) return;
    if (!name.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Dê um nome para a sessão de Review.', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const newSession = await showcaseApi.saveSession({
        name: name.trim(),
        sprintName: sprintName.trim(),
        tasks: [],
        status: 'planning',
      } as any);

      // Salva no histórico local
      try {
        const ROOMS_META_KEY = 'agileSpace_rooms_meta';
        const saved = localStorage.getItem(ROOMS_META_KEY);
        const rooms = saved ? JSON.parse(saved) : [];
        rooms.unshift({
          roomId: newSession.id,
          type: 'showcase',
          title: name.trim(),
          team: sprintName.trim() || 'Sprint Review',
          createdBy: session?.id,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(ROOMS_META_KEY, JSON.stringify(rooms));
      } catch { /* ignore localStorage errors */ }

      setIsSetupOpen(false);
      setName('');
      setSprintName('');
      router.push(`/showcase/${newSession.id}`);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao criar sessão', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <ToolHubLayout
        title="Sprint Review"
        description="Apresente entregas sem slides. Evidências integradas e aceites do PO registrados em tempo real durante a cerimônia."
        icon={<Eye />}
        themeColor="violet"
        tips={[]}
        referenceSections={[]}
        onlyChildren={true}
      >
        <ShowcaseDashboard
          sessions={dbSessions || []}
          isLoading={isSessionsLoading}
          onNewSession={() => {
            if (!session) {
              requestIdentity(() => setIsSetupOpen(true));
            } else {
              setIsSetupOpen(true);
            }
          }}
          onJoinSession={(id) => router.push(`/showcase/${id}`)}
          isCreating={isCreating}
        />
      </ToolHubLayout>

      {/* CREATE SESSION SETUP DIALOG */}
      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-[3rem] border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <div className="w-14 h-14 rounded-3xl bg-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-600/20 text-white">
              <Eye className="h-7 w-7" />
            </div>
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-slate-50 leading-none font-headline italic">
              Nova Sprint Review
            </DialogTitle>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
              Configure a sessão e importe as tarefas do Jira
            </p>
          </DialogHeader>

          <div className="space-y-5 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Nome da Sessão *
              </Label>
              <Input
                placeholder="Ex: Review Sprint 42"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="h-14 rounded-2xl border-slate-200 dark:border-slate-800 focus:border-violet-500 font-bold bg-slate-50/50 dark:bg-slate-950/50 text-base"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Sprint / Squad (opcional)
              </Label>
              <Input
                placeholder="Ex: Squad Phoenix — Sprint 42"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                className="h-12 rounded-2xl border-slate-200 dark:border-slate-800 font-bold bg-slate-50/50 dark:bg-slate-955/50"
              />
            </div>

            <div className="bg-violet-50 dark:bg-violet-950/20 rounded-2xl p-5 border border-violet-100 dark:border-violet-900/35">
              <p className="text-[11px] font-bold text-violet-700 dark:text-violet-400 leading-relaxed">
                💡 Após criar, importe as tarefas do Jira (via XML ou API) e adicione os links de evidência antes de iniciar o Modo Teatro.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-850 flex-col gap-3">
            <Button
              disabled={isCreating || !name.trim()}
              onClick={handleCreate}
              className="w-full h-16 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-violet-600/20 gap-3"
            >
              {isCreating ? 'Criando sessão...' : 'Criar & Configurar'}
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSetupOpen(false)}
              className="h-auto px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-transparent"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
