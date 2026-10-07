'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Eye, ListPlus, Users, CalendarDays, ArrowRight } from 'lucide-react';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ShowcaseHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useAuth();
  const { userProfile, requestIdentity } = useUserContext();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [sprintName, setSprintName] = useState('');
  const [squadName, setSquadName] = useState('');

  useEffect(() => {
    if (!squadName) {
      const defaultSquad = session?.activeProjectId || userProfile?.squadId || '';
      if (defaultSquad) setSquadName(defaultSquad);
    }
  }, [session, userProfile, isSetupOpen]);

  const [dbSessions, setDbSessions] = useState<ShowcaseSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);

  const currentSquadId = session?.activeProjectId || userProfile?.squadId;

  const fetchSessions = async (squadId: string) => {
    try {
      const data = await showcaseApi.getSessions(squadId);
      setDbSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (currentSquadId) fetchSessions(currentSquadId);
  }, [currentSquadId]);

  const handleCreate = async () => {
    if (isCreating) return;
    if (!name.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Dê um nome para a sessão de Review.', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const resolvedSquad = squadName.trim() || session?.activeProjectId || userProfile?.squadId || 'DDWMISSI';
      const newSession = await showcaseApi.saveSession({
        name: name.trim(),
        sprintName: sprintName.trim(),
        squadName: resolvedSquad,
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
      router.push(`/showcase/${newSession.id}?setup=1`);
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

      {/* CREATE SESSION SETUP DIALOG — mesmo padrão do "Configurar Sessão" do Poker */}
      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[94vh] overflow-y-auto gap-2 p-5 sm:p-6 rounded-[2rem] border border-border shadow-2xl bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight text-foreground leading-none">Configurar Review</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1.5">
              Dê um nome à Review e escolha o time. Você importa as tarefas do Jira logo depois de criar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="review-name" className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground ml-1 flex items-center gap-1.5">
                <ListPlus className="h-3.5 w-3.5 text-violet-500" /> Título da Review
              </Label>
              <Input
                id="review-name"
                placeholder="Ex: Review da Sprint 42"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="h-11 rounded-2xl border-border focus:border-violet-500 font-semibold bg-muted/40 focus-visible:ring-violet-500"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-squad" className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground ml-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-violet-500" /> Squad / Time
              </Label>
              <Input
                id="review-squad"
                placeholder="Ex: Squad Fênix"
                value={squadName}
                onChange={(e) => setSquadName(e.target.value)}
                className="h-11 rounded-2xl border-border font-semibold bg-muted/40 focus-visible:ring-violet-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-sprint" className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground ml-1 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-violet-500" /> Sprint <span className="normal-case font-medium text-muted-foreground/70">(opcional)</span>
              </Label>
              <Input
                id="review-sprint"
                placeholder="Ex: Sprint 42"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                className="h-11 rounded-2xl border-border font-semibold bg-muted/40 focus-visible:ring-violet-500"
              />
            </div>
          </div>

          <div className="pt-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground ml-1">Como a Review funciona</p>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { n: 1, t: 'Importe as tarefas', d: 'Traga as issues da sprint do Jira ou crie cards à mão.' },
                { n: 2, t: 'Prepare as evidências', d: 'Em cada card, registre o problema, a solução e links de vídeo ou print.' },
                { n: 3, t: 'Apresente e colete o aceite', d: 'No Modo Teatro, o PO aceita ou pede ajuste em cada entrega.' },
              ].map((step) => (
                <li key={step.n} className="rounded-2xl border border-border bg-muted/30 p-3.5 flex flex-col gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-violet-600/15 text-violet-500 text-xs font-bold flex items-center justify-center">{step.n}</span>
                  <span className="text-sm font-bold text-foreground leading-tight">{step.t}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{step.d}</span>
                </li>
              ))}
            </ol>
          </div>

          <DialogFooter className="pt-4 flex-row items-center justify-between sm:justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSetupOpen(false)}
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              disabled={isCreating || !name.trim()}
              onClick={handleCreate}
              className="h-12 px-8 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-violet-600/25 gap-2"
            >
              {isCreating ? 'Criando…' : 'Criar Review'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
