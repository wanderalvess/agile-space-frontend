'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useUserContext } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { squadApi } from '@/app/squad/api';
import { sprintPlanningApi } from '../../app/sprint-planner/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FeedbackWidget } from '@/components/feedback-widget';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { cn } from '@/lib/utils';

// Specialized Parts
import { MetricsHUD } from './parts/MetricsHUD';
import { CapacityEngine, TeamMember } from './parts/CapacityEngine';
import { BacklogManager } from './parts/BacklogManager';
import type { PlannerTask } from './parts/PlannerTaskCard';
import { PlannerGuide } from './PlannerGuide';
import { HelpCircle, CalendarRange, Save } from 'lucide-react';

interface SprintPlannerContentProps {
  initialPlannerId?: string | null;
}

export function SprintPlannerContent({ initialPlannerId }: SprintPlannerContentProps) {
  const { user } = useFirebase();
  const { userProfile } = useUserContext();
  const { toast } = useToast();
  const router = useRouter();
  const activeSquadId = userProfile?.squadId || 'DDWMISSI';

  const handleImportRosterFromSquad = async () => {
    try {
      const roster = await squadApi.getMembers(activeSquadId);
      if (!roster || roster.length === 0) {
        toast({
          title: 'Roster Vazio',
          description: `Nenhum membro encontrado na squad ${activeSquadId}.`,
          variant: 'destructive',
        });
        return;
      }

      const importedMembers: TeamMember[] = roster.map(m => ({
        id: m.jiraAccountId,
        name: m.displayName,
        role: (m.role || '').toLowerCase().includes('qa') ? 'qa' : 'dev',
        focusFactor: 100,
        daysOff: 0,
        hoursPerDay: m.capacityHoursPerDay ?? 8,
      }));

      setSprintMembers(importedMembers);
      setIsDetailedMode(true);

      toast({
        title: 'Roster Sincronizado!',
        description: `${importedMembers.length} integrantes carregados com a capacidade calibrada do gestor.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao Buscar Roster',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };
  
  // Capacity Engine State
  const [workingDays, setWorkingDays] = useState<number>(10);
  const [focusFactor, setFocusFactor] = useState<number>(70);
  const [devCount, setDevCount] = useState<number>(3);
  const [devAbsences, setDevAbsences] = useState<number>(0);
  const [qaCount, setQaCount] = useState<number>(1);
  const [qaAbsences, setQaAbsences] = useState<number>(0);

  // Scope State
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [isDetailedMode, setIsDetailedMode] = useState<boolean>(false);
  const [sprintMembers, setSprintMembers] = useState<TeamMember[]>([]);

  // Persistence State
  const [shareId, setShareId] = useState<string | null>(initialPlannerId || null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isSaving = saveStatus === 'saving';
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Poker Integration State
  const [importedPokerRoomIds, setImportedPokerRoomIds] = useState<string[]>([]);

  // Planner title and default settings
  const [plannerTitle, setPlannerTitle] = useState('Sprint Planner');
  const [defaultDevHoursPerDay, setDefaultDevHoursPerDay] = useState<number>(8);
  const [defaultQaHoursPerDay, setDefaultQaHoursPerDay] = useState<number>(8);

  useEffect(() => {
    async function loadPlanner() {
      if (initialPlannerId) {
        try {
          const data = await sprintPlanningApi.getPlanner(initialPlannerId);
          if (data) {
            setPlannerTitle(data.title || 'Sprint Planner');
            setTasks(data.tasks || []);
            setSprintMembers(data.members || []);
            
            if (data.settings) {
              setWorkingDays(data.settings.workingDays || 10);
              setFocusFactor(data.settings.focusFactor || 70);
              setDevCount(data.settings.devCount || 0);
              setDevAbsences(data.settings.devAbsences || 0);
              setQaCount(data.settings.qaCount || 0);
              setQaAbsences(data.settings.qaAbsences || 0);
              setIsDetailedMode(data.settings.isDetailedMode || false);
              
              if (data.settings.defaultDevHoursPerDay) setDefaultDevHoursPerDay(data.settings.defaultDevHoursPerDay);
              if (data.settings.defaultQaHoursPerDay) setDefaultQaHoursPerDay(data.settings.defaultQaHoursPerDay);
            }
            
            setImportedPokerRoomIds(data.importedPokerRoomIds || []);
            
            const localCreatorId = localStorage.getItem('sprint_planner_creator_id');
            if (data.createdBy && data.createdBy !== localCreatorId) {
              setIsReadOnly(true);
            }
          }
        } catch (error) {
          console.error("Error loading planner:", error);
        }
      }
    }
    loadPlanner();
  }, [initialPlannerId]);

  // AUTO-SAVE LOGIC
  useEffect(() => {
    if (!shareId || isReadOnly) return;
    const timer = setTimeout(() => savePlanner(), 5000);
    return () => clearTimeout(timer);
  }, [tasks, sprintMembers, workingDays, focusFactor, devCount, qaCount, devAbsences, qaAbsences, isDetailedMode, plannerTitle, shareId]);

  const savePlanner = async () => {
    if (isReadOnly) return;
    setSaveStatus('saving');
    try {
      const payload = {
        id: shareId || undefined,
        tasks,
        members: sprintMembers,
        settings: {
          workingDays,
          focusFactor,
          devCount,
          devAbsences,
          qaCount,
          qaAbsences,
          isDetailedMode,
          defaultDevHoursPerDay,
          defaultQaHoursPerDay
        },
        title: plannerTitle,
        createdBy: shareId ? undefined : (user?.uid || 'anonymous'),
        importedPokerRoomIds
      };
      const saved = await sprintPlanningApi.saveOrUpdatePlanner(payload);
      
      // Phase 3: commit to backend
      if (saved && saved.id) {
        try {
          const { workItemsApi } = await import('@/app/work-items-api');
          await Promise.all(tasks.map(t => {
            if (t.link && t.link.includes('-')) {
              return workItemsApi.commitWorkItem(activeSquadId, t.link, saved.id).catch(() => {});
            }
          }));
        } catch(e) {}
      }

      setSaveStatus('saved');
      if (!shareId && saved && saved.id) {
        localStorage.setItem('sprint_planner_creator_id', user?.uid || 'anonymous');
        setShareId(saved.id);
        router.push(`/sprint-planner/${saved.id}`);
      }
    } catch (e) {
      console.error(e);
      setSaveStatus('idle');
    }
  };

  // Memoized Calculations
  const devCapacityHours = useMemo(() => {
    if (isDetailedMode) {
      return sprintMembers
        .filter(m => m.role === 'dev')
        .reduce((acc, m) => acc + ((workingDays - m.daysOff) * m.hoursPerDay * (m.focusFactor / 100)), 0);
    }
    return (devCount * workingDays - devAbsences * workingDays / 10) * 8 * (focusFactor / 100);
  }, [isDetailedMode, sprintMembers, workingDays, devCount, devAbsences, focusFactor]);

  const qaCapacityHours = useMemo(() => {
    if (isDetailedMode) {
      return sprintMembers
        .filter(m => m.role === 'qa')
        .reduce((acc, m) => acc + ((workingDays - m.daysOff) * m.hoursPerDay * (m.focusFactor / 100)), 0);
    }
    return (qaCount * workingDays - qaAbsences * workingDays / 10) * 8 * (focusFactor / 100);
  }, [isDetailedMode, sprintMembers, workingDays, qaCount, qaAbsences, focusFactor]);

  const totalDevScope = useMemo(() => tasks.reduce((acc, t) => acc + t.devHours, 0), [tasks]);
  const totalQaScope = useMemo(() => tasks.reduce((acc, t) => acc + t.qaHours, 0), [tasks]);
  
  const devLoadPercentage = devCapacityHours > 0 ? (totalDevScope / devCapacityHours) * 100 : 0;
  const qaLoadPercentage = qaCapacityHours > 0 ? (totalQaScope / qaCapacityHours) * 100 : 0;

  const isDevOverloaded = devLoadPercentage > 100;
  const isQaOverloaded = qaLoadPercentage > 100;

  // Handlers
  const handleAddTask = (taskData: Omit<PlannerTask, 'id'>) => {
    const newTask = { ...taskData, id: crypto.randomUUID() };
    setTasks([...tasks, newTask]);
  };

  const handleUpdateTask = (id: string, updates: Partial<PlannerTask>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleRemoveTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleUpdateMember = (id: string, field: keyof TeamMember, value: any) => {
    setSprintMembers(sprintMembers.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleBatchImport = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    const newTasks = lines.map(line => {
        const [name, link, description] = line.split('|').map(s => s.trim());
        return {
            id: crypto.randomUUID(),
            name: name || 'Nova Tarefa',
            devHours: 0,
            qaHours: 0,
            link: link || undefined,
            description: description || undefined
        };
    });
    setTasks([...tasks, ...newTasks]);
  };

  const handleSelectPokerSession = (room: any) => {
    if (importedPokerRoomIds.includes(room.id)) return;
    const roomTasks = room.issues?.map((issue: any) => ({
      id: crypto.randomUUID(),
      name: issue.name,
      devHours: issue.finalEstimate || 0,
      qaHours: 0,
      description: `Importado da sessão Poker: ${room.name}`,
    })) || [];
    setTasks([...tasks, ...roomTasks]);
    setImportedPokerRoomIds([...importedPokerRoomIds, room.id]);
  };

  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col lg:overflow-hidden bg-[#FDFDFF] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-violet-100 selection:text-violet-900">
      <RoomHeader 
        title={plannerTitle}
        isEditable={!isReadOnly}
        onTitleChange={setPlannerTitle}
        toolIcon={<CalendarRange className="h-4 w-4" />}
        toolColorClass="text-violet-600"
        onOpenFeedback={() => setFeedbackSignal(Date.now())}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsGuideOpen(true)}
              className="h-9 w-9 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50"
              title="COMO USAR"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <PlannerGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />
            {!isReadOnly && (
              <Button
                variant="ghost"
                size="icon"
                onClick={savePlanner}
                disabled={isSaving}
                className="h-9 w-9 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                title="SALVAR ALTERAÇÕES"
              >
                <Save className={cn("h-4 w-4", isSaving && "animate-spin")} />
              </Button>
            )}
          </div>
        }
      />

      <MetricsHUD
        devCapacityHours={Math.round(devCapacityHours)}
        qaCapacityHours={Math.round(qaCapacityHours)}
        totalDevScope={totalDevScope}
        totalQaScope={totalQaScope}
        devLoadPercentage={devLoadPercentage}
        qaLoadPercentage={qaLoadPercentage}
        isDevOverloaded={isDevOverloaded}
        isQaOverloaded={isQaOverloaded}
      />

      <main className="flex-1 lg:overflow-hidden p-5 max-w-[1800px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-full lg:overflow-hidden">
          <CapacityEngine
            isDetailedMode={isDetailedMode}
            setIsDetailedMode={setIsDetailedMode}
            workingDays={workingDays}
            setWorkingDays={setWorkingDays}
            focusFactor={focusFactor}
            setFocusFactor={setFocusFactor}
            devCount={devCount}
            setDevCount={setDevCount}
            devAbsences={devAbsences}
            setDevAbsences={setDevAbsences}
            qaCount={qaCount}
            setQaCount={setQaCount}
            qaAbsences={qaAbsences}
            setQaAbsences={setQaAbsences}
            sprintMembers={sprintMembers}
            onUpdateMember={handleUpdateMember}
            onAddMember={() => setSprintMembers([...sprintMembers, { id: crypto.randomUUID(), name: '', role: 'dev', focusFactor: 70, daysOff: 0, hoursPerDay: 8 }])}
            onRemoveMember={(id) => setSprintMembers(sprintMembers.filter(m => m.id !== id))}
            onImportRoster={handleImportRosterFromSquad}
            isReadOnly={isReadOnly}
          />

          <div className="lg:col-span-8 xl:col-span-9 h-auto lg:h-full lg:overflow-hidden">
            <Card className="border border-white/60 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-2xl shadow-violet-500/5 rounded-[3rem] overflow-hidden flex flex-col h-auto lg:h-full">
              <BacklogManager
                tasks={tasks}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onRemoveTask={handleRemoveTask}
                onBatchImport={handleBatchImport}
                onPokerImport={handleSelectPokerSession}
                isReadOnly={isReadOnly}
              />
            </Card>
          </div>
        </div>
      </main>

      <FeedbackWidget toolName="Sprint Planner" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}
