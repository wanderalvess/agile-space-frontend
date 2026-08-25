'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LayoutGrid,
  Plus,
  History,
  Trash2,
  StickyNote as StickyNoteIcon,
  ExternalLink,
  Cloud,
  User as UserIcon,
  ShieldCheck,
  HelpCircle,
  CloudLightning,
  Lock,
  Home,
  Link2,
  BrainCircuit,
  ClipboardList,
  Code,
  Search
} from 'lucide-react';

import { MyPrompts } from '@/components/workspace/MyPrompts';
import { DailyHelper } from '@/components/workspace/DailyHelper';
import { SnippetLibrary } from '@/components/workspace/SnippetLibrary';
import { CommandPalette } from '@/components/workspace/CommandPalette';
import { QuickLinks } from '@/components/workspace/QuickLinks';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from '@/components/ui/separator';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Badge } from '@/components/ui/badge';
import { workspaceApi } from '@/app/workspace/api';
import { pokerApi } from '@/app/room/api';
import { retroApi } from '@/app/retro/api';
import { healthCheckApi } from '@/app/health-check/api';
import Link from 'next/link';

// Workspace V3 Components & Types
import { KanbanBoard } from '@/components/workspace/KanbanBoard';
import { StickyNotes } from '@/components/workspace/StickyNotes';
import { HistoryTimeline } from '@/components/workspace/HistoryTimeline';
import { ProfileSettings } from '@/components/workspace/ProfileSettings';
import { BentoDashboard } from '@/components/workspace/BentoDashboard';
import { ConnectivitySettings } from '@/components/workspace/ConnectivitySettings';
import { KanbanCardData, KanbanStatus, KanbanPriority, StickyNote, HistoryItem } from '@/components/workspace/types';

export default function WorkspacePage() {
  const router = useRouter();
  const { session } = useAuth();
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  const { toast } = useToast();
  const { userProfile, updateProfile, requestIdentity, isInitializing } = useUserContext();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const effectiveUserId = userProfile?.id || userProfile?.email || session?.id || '';

  // Authentication Guard & Page Title
  useEffect(() => {
    document.title = `Meu Espaço | Espaço Ágil`;
    if (!isInitializing && !userProfile && !session) {
      requestIdentity();
    }
  }, [userProfile, session, isInitializing, requestIdentity]);

  const [cards, setCards] = useState<KanbanCardData[]>([]);
  const [isKanbanLoading, setIsKanbanLoading] = useState(true);

  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isNotesLoading, setIsNotesLoading] = useState(true);

  const [userLinks, setUserLinks] = useState<any[]>([]);

  // Históricos colaborativos: busca as listas completas via REST e filtra no
  // cliente pelas salas/quadros em que o usuário é participante ou criador —
  // mesmo padrão de "minhas sessões" já adotado em src/app/room/page.tsx.
  const [pokerHistory, setPokerHistory] = useState<any[]>([]);
  const [retroHistory, setRetroHistory] = useState<any[]>([]);
  const [healthHistory, setHealthHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    if (!effectiveUserId) return;
    let cancelled = false;

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const [rooms, retros, healths] = await Promise.all([
          pokerApi.listRooms(),
          retroApi.listBoards(),
          healthCheckApi.listBoards(),
        ]);
        if (cancelled) return;
        const isMine = (r: any) => r.participantIds?.includes(effectiveUserId) || r.creatorId === effectiveUserId;
        setPokerHistory((rooms || []).filter(isMine));
        setRetroHistory((retros || []).filter(isMine));
        setHealthHistory((healths || []).filter(isMine));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [effectiveUserId]);

  const mergedHistory = useMemo(() => {
    if (isLoadingHistory) return null;
    const all = [
      ...(pokerHistory || []).map(r => ({ ...r, type: 'poker', roomId: r.id })),
      ...(retroHistory || []).map(r => ({ ...r, type: 'retro', roomId: r.id })),
      ...(healthHistory || []).map(r => ({ ...r, type: 'health', roomId: r.id })),
    ];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pokerHistory, retroHistory, healthHistory, isLoadingHistory]);

  const loadWorkspaceData = async () => {
    if (!effectiveUserId) return;
    try {
      const [cardsList, notesList, linksList] = await Promise.all([
        workspaceApi.getKanbanCards(effectiveUserId),
        workspaceApi.getStickyNotes(effectiveUserId),
        workspaceApi.getQuickLinks(effectiveUserId)
      ]);
      setCards(cardsList || []);
      setNotes(notesList || []);
      setUserLinks(linksList || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsKanbanLoading(false);
      setIsNotesLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveUserId) {
      loadWorkspaceData();
    }
  }, [effectiveUserId]);

  const triggerSavingIndicator = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  // Modal State for Kanban Task
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<KanbanStatus>('todo');
  const [newTaskPriority, setNewTaskPriority] = useState<KanbanPriority>('media');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [currentOriginLink, setCurrentOriginLink] = useState<string | undefined>();
  const [currentExportedAt, setCurrentExportedAt] = useState<string | undefined>();

  // Guard de Autenticação Estrito (Rule of Hooks Compliant)
  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-slate-950">
        <AgileSpinner size="lg" variant="primary" title="Carregando..." subtitle="Carregando dados do seu Espaço." />
      </div>
    );
  }

  if (!userProfile && !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-slate-950">
        <AgileSpinner size="lg" variant="primary" title="Autenticação Requerida" subtitle="Por favor, conecte-se para acessar o seu Espaço Privado." />
      </div>
    );
  }

  // Handlers Kanban
  const handleUpdateTaskStatus = async (id: string, newStatus: KanbanStatus) => {
    if (!effectiveUserId) return;
    triggerSavingIndicator();
    // Optimistic Update
    setCards(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    try {
      await workspaceApi.saveKanbanCard(effectiveUserId, { id, status: newStatus });
    } catch (e) {
      console.error(e);
      loadWorkspaceData();
    }
  };

  const openTaskModal = (initialStatus: KanbanStatus = 'todo', cardToEdit?: KanbanCardData) => {
    if (cardToEdit) {
      setEditingCardId(cardToEdit.id);
      setNewTaskTitle(cardToEdit.title);
      setNewTaskDescription(cardToEdit.description || '');
      setNewTaskStatus(cardToEdit.status);
      setNewTaskPriority(cardToEdit.priority);
      setNewTaskDueDate(cardToEdit.dueDate || '');
      setCurrentOriginLink(cardToEdit.originLink);
      setCurrentExportedAt(cardToEdit.exportedAt);
    } else {
      setEditingCardId(null);
      setNewTaskStatus(initialStatus);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('media');
      setNewTaskDueDate('');
      setCurrentOriginLink(undefined);
      setCurrentExportedAt(undefined);
    }
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async () => {
    if (!newTaskTitle.trim() || !effectiveUserId) return;
    triggerSavingIndicator();
    const taskData = {
      id: editingCardId || undefined,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      status: newTaskStatus,
      priority: newTaskPriority,
      dueDate: newTaskDueDate ? newTaskDueDate : null,
      tag: editingCardId ? 'Editado' : 'Manual',
    };

    try {
      await workspaceApi.saveKanbanCard(effectiveUserId, taskData as any);
      loadWorkspaceData();
    } catch (e) {
      console.error(e);
    }
    setIsTaskModalOpen(false);
  };

  const handleDeleteTask = async () => {
    if (!editingCardId) return;
    triggerSavingIndicator();
    try {
      await workspaceApi.deleteKanbanCard(editingCardId);
      loadWorkspaceData();
    } catch (e) {
      console.error(e);
    }
    setIsTaskModalOpen(false);
  };

  // Handlers Sticky Notes
  const handleAddNote = async () => {
    if (!effectiveUserId) return;
    triggerSavingIndicator();
    try {
      await workspaceApi.saveStickyNote(effectiveUserId, {
        content: '',
        color: 'bg-amber-50 border-amber-200/60 text-amber-900',
        isPinned: false
      });
      loadWorkspaceData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateNote = async (id: string, updates: Partial<StickyNote>) => {
    if (!effectiveUserId) return;
    triggerSavingIndicator();
    // Optimistic Update
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    try {
      await workspaceApi.saveStickyNote(effectiveUserId, { id, ...updates });
    } catch (e) {
      console.error(e);
      loadWorkspaceData();
    }
  };

  const handleDeleteNote = async (id: string) => {
    triggerSavingIndicator();
    // Optimistic Update
    setNotes(prev => prev.filter(n => n.id !== id));
    try {
      await workspaceApi.deleteStickyNote(id);
    } catch (e) {
      console.error(e);
      loadWorkspaceData();
    }
  };

  const handleSendNoteToKanban = async (note: StickyNote) => {
    if (!effectiveUserId) return;
    triggerSavingIndicator();
    const lines = note.content.split('\n');
    const title = lines[0].trim() || 'Rascunho de Nota';
    const description = lines.slice(1).join('\n').trim();

    try {
      await workspaceApi.saveKanbanCard(effectiveUserId, {
        title,
        description: description || undefined,
        status: 'todo',
        priority: 'media',
        tag: 'Nota Rápida'
      });
      await workspaceApi.deleteStickyNote(note.id);
      loadWorkspaceData();
      toast({ title: "Nota promovida!", description: "Convertida em tarefa no Kanban." });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfile = (data: any) => {
    triggerSavingIndicator();
    updateProfile(data);
    toast({ title: "Perfil atualizado!", description: "Suas permissões foram validadas." });
  };

  const handleAddLink = async (name: string, url: string, iconType: string, color: string) => {
    if (!effectiveUserId) return;
    triggerSavingIndicator();
    try {
      await workspaceApi.saveQuickLink(effectiveUserId, {
        title: name,
        url,
      });
      loadWorkspaceData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLink = async (id: string) => {
    triggerSavingIndicator();
    try {
      await workspaceApi.deleteQuickLink(id);
      loadWorkspaceData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between w-full bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-x-hidden font-body selection:bg-primary/30">
      {/* Background Mesh Glow */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onNavigate={(tab) => setActiveTab(tab)}
        onAddTask={() => openTaskModal('todo')}
        onAddNote={handleAddNote}
        onAddSnippet={() => {
          setActiveTab('snippets');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('agile-space:new-snippet'));
          }, 150);
        }}
      />

      <div className="w-full flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          {/* PADRONIZAÇÃO DO HEADER */}
          <RoomHeader
            title="Meu Espaço de Trabalho"
            toolIcon={<LayoutGrid className="h-4 w-4" />}
            toolColorClass="text-primary"
            onOpenFeedback={() => setFeedbackSignal(Date.now())}
            badge={<Badge className="bg-primary/10 text-primary border-none font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5 rounded-md">V3 WORKSPACE</Badge>}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="hidden md:flex h-8 px-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[10px] font-bold gap-2 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Busca</span>
                  <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 font-mono text-[8px] font-medium text-slate-400">
                    ⌘K
                  </kbd>
                </Button>
                {isSaving && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">
                    <AgileSpinner size="sm" />
                    <span>Salvando...</span>
                  </div>
                )}
              </div>
            }
          />

          {/* PADRONIZAÇÃO DAS ABAS */}
          <div className="w-full bg-white dark:bg-slate-900/40 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/50 sticky top-12 z-[40]">
            <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-2.5 overflow-x-auto no-scrollbar">
              <TabsList className="bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl h-auto gap-1.5 inline-flex w-auto min-w-full sm:min-w-0 flex-nowrap items-center border border-slate-200/50 dark:border-slate-800/50">
                {[
                  { id: 'home', label: 'Início', icon: <Home className="h-3.5 w-3.5" /> },
                  { id: 'kanban', label: 'Kanban', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                  { id: 'notes', label: 'Notas', icon: <StickyNoteIcon className="h-3.5 w-3.5" /> },
                  { id: 'history', label: 'Histórico', icon: <History className="h-3.5 w-3.5" /> },
                  { id: 'profile', label: 'Perfil', icon: <UserIcon className="h-3.5 w-3.5" /> },
                  { id: 'connectivity', label: 'Conectividade', icon: <Link2 className="h-3.5 w-3.5" /> },
                  { id: 'links', label: 'Atalhos', icon: <ExternalLink className="h-3.5 w-3.5" /> },
                  { id: 'prompts', label: 'Prompts', icon: <BrainCircuit className="h-3.5 w-3.5" /> },
                  { id: 'daily', label: 'Daily Helper', icon: <ClipboardList className="h-3.5 w-3.5" /> },
                  { id: 'snippets', label: 'Snippets', icon: <Code className="h-3.5 w-3.5" /> },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-xl px-4 py-2 text-[10.5px] font-black uppercase tracking-wider transition-all gap-2 flex items-center border border-transparent data-[state=active]:border-slate-200/80 dark:data-[state=active]:border-slate-800 whitespace-nowrap shrink-0 justify-center"
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          {/* ÁREA DE CONTEÚDO COM CONTAINER MAX-W-7XL */}
          <div className="relative z-10 p-4 md:p-6 lg:p-8 flex-1 w-full max-w-7xl mx-auto">
            <main className="w-full space-y-6">
              <TabsContent value="home" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <BentoDashboard
                  tasks={cards || []}
                  history={mergedHistory}
                  notes={notes || []}
                  userProfile={userProfile}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onAddTask={() => openTaskModal('todo')}
                  onAddNote={handleAddNote}
                  onOpenFeedback={() => setFeedbackSignal(Date.now())}
                />
              </TabsContent>

              <TabsContent value="kanban" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <KanbanBoard
                  cards={cards || []}
                  isLoading={isKanbanLoading}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onEditCard={(card) => openTaskModal(card.status, card)}
                  onAddTask={openTaskModal}
                />
              </TabsContent>

              <TabsContent value="notes" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <StickyNotes
                  notes={notes || []}
                  isLoading={isNotesLoading}
                  onAdd={handleAddNote}
                  onUpdate={handleUpdateNote}
                  onDelete={handleDeleteNote}
                  onConvertToTask={handleSendNoteToKanban}
                />
              </TabsContent>

              <TabsContent value="history" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <HistoryTimeline
                  items={mergedHistory}
                  isLoading={isLoadingHistory}
                  userId={effectiveUserId}
                />
              </TabsContent>

              <TabsContent value="profile" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <ProfileSettings
                  profile={userProfile}
                  onUpdate={handleUpdateProfile}
                />
              </TabsContent>

              <TabsContent value="connectivity" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <ConnectivitySettings />
              </TabsContent>

              <TabsContent value="links" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <QuickLinks links={userLinks || []} onAddLink={handleAddLink} onDeleteLink={handleDeleteLink} />
              </TabsContent>

              <TabsContent value="prompts" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <MyPrompts userProfile={userProfile} />
              </TabsContent>

              <TabsContent value="daily" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <DailyHelper userProfile={userProfile} />
              </TabsContent>

              <TabsContent value="snippets" className="outline-none focus-visible:ring-0 animate-in fade-in duration-300">
                <SnippetLibrary />
              </TabsContent>
            </main>
          </div>
        </Tabs>
      </div>

      {/* TASK MODAL */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-900 text-white">
            <DialogTitle className="text-xl font-black font-headline uppercase tracking-tight italic text-white">
              {editingCardId ? 'Ajustar' : 'Nova'} <span className="text-primary not-italic">Tarefa</span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 p-6">
            {currentOriginLink && (
              <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-primary tracking-widest">Vinculado a Cerimônia</span>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-8 text-primary hover:bg-primary/10 font-black text-[9px] uppercase rounded-xl">
                  <Link href={currentOriginLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver Sala
                  </Link>
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Título da Atividade</Label>
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="h-11 rounded-xl font-bold border-2 focus-visible:ring-primary/20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descrição / Detalhes</Label>
              <Textarea value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} className="min-h-[90px] rounded-xl text-sm border-2 focus-visible:ring-primary/20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Urgência</Label>
                <Select value={newTaskPriority} onValueChange={(v: KanbanPriority) => setNewTaskPriority(v)}>
                  <SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="baixa" className="text-xs font-bold">Baixa</SelectItem>
                    <SelectItem value="media" className="text-xs font-bold text-blue-500">Média</SelectItem>
                    <SelectItem value="alta" className="text-xs font-bold text-orange-500">Alta</SelectItem>
                    <SelectItem value="critica" className="text-xs font-bold text-rose-600">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</Label>
                <Select value={newTaskStatus} onValueChange={(v: KanbanStatus) => setNewTaskStatus(v)}>
                  <SelectTrigger className="h-10 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="todo" className="text-xs font-bold">A Fazer</SelectItem>
                    <SelectItem value="doing" className="text-xs font-bold">Em Andamento</SelectItem>
                    <SelectItem value="done" className="text-xs font-bold">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            {editingCardId && <Button variant="ghost" onClick={handleDeleteTask} className="sm:mr-auto text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/30 font-black text-[10px] uppercase tracking-widest">Excluir</Button>}
            <Button variant="ghost" onClick={() => setIsTaskModalOpen(false)} className="font-black text-[10px] uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleSaveTask} disabled={!newTaskTitle.trim()} className="h-10 px-6 font-black text-[10px] uppercase tracking-widest rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md">Salvar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RODAPÉ GLOBAL */}
      <Footer className="mt-8 shrink-0" onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget toolName="Espaço Ágil - Meu Espaço" externalTriggerSignal={feedbackSignal} triggerVariant="none" />
    </div>
  );
}
