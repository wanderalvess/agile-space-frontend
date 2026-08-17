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
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { collection, query, where } from 'firebase/firestore';
import { workspaceApi } from '@/app/workspace/api';
import Link from 'next/link';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { PREDEFINED_AVATARS, GlobalRole } from '@/lib/types';

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
  const { firestore, auth, user, isUserLoading } = useFirebase();
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  const { toast } = useToast();
  const { userProfile, updateProfile, requestIdentity } = useUserContext();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  // Authentication Guard & Page Title
  useEffect(() => {
    document.title = `Meu Espaço | Espaço Ágil`;
    if (!isUserLoading && !user) {
      requestIdentity();
    }
  }, [user, isUserLoading, requestIdentity]);

  const [cards, setCards] = useState<KanbanCardData[]>([]);
  const [isKanbanLoading, setIsKanbanLoading] = useState(true);

  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isNotesLoading, setIsNotesLoading] = useState(true);

  const [userLinks, setUserLinks] = useState<any[]>([]);

  // Firestore Queries para Históricos colaborativos
  const pokerHistoryQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'rooms'), where('participantIds', 'array-contains', user.uid)) : null, [firestore, user]);
  const { data: pokerHistory, isLoading: isLoadingPoker } = useCollection<any>(pokerHistoryQuery);

  const retroHistoryQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'retro_boards'), where('participantIds', 'array-contains', user.uid)) : null, [firestore, user]);
  const { data: retroHistory, isLoading: isLoadingRetro } = useCollection<any>(retroHistoryQuery);

  const healthHistoryQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'health_checks'), where('participantIds', 'array-contains', user.uid)) : null, [firestore, user]);
  const { data: healthHistory, isLoading: isLoadingHealth } = useCollection<any>(healthHistoryQuery);

  const mergedHistory = useMemo(() => {
    if (isLoadingPoker || isLoadingRetro || isLoadingHealth) return null;
    const all = [
      ...(pokerHistory || []).map(r => ({ ...r, type: 'poker', roomId: r.id })),
      ...(retroHistory || []).map(r => ({ ...r, type: 'retro', roomId: r.id })),
      ...(healthHistory || []).map(r => ({ ...r, type: 'health', roomId: r.id })),
    ];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [pokerHistory, retroHistory, healthHistory, isLoadingPoker, isLoadingRetro, isLoadingHealth]);

  const loadWorkspaceData = async () => {
    if (!user) return;
    try {
      const [cardsList, notesList, linksList] = await Promise.all([
        workspaceApi.getKanbanCards(user.uid),
        workspaceApi.getStickyNotes(user.uid),
        workspaceApi.getQuickLinks(user.uid)
      ]);
      setCards(cardsList);
      setNotes(notesList);
      setUserLinks(linksList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsKanbanLoading(false);
      setIsNotesLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadWorkspaceData();
    }
  }, [user]);

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
  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-slate-950">
        <AgileSpinner size="lg" variant="primary" title="Autenticação Requerida" subtitle="Por favor, conecte-se para acessar o seu Espaço Privado." />
      </div>
    );
  }

  // Handlers Kanban
  const handleUpdateTaskStatus = async (id: string, newStatus: KanbanStatus) => {
    triggerSavingIndicator();
    // Optimistic Update
    setCards(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    try {
      await workspaceApi.saveKanbanCard(user.uid, { id, status: newStatus });
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
    if (!newTaskTitle.trim() || !user) return;
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
      await workspaceApi.saveKanbanCard(user.uid, taskData as any);
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
    if (!user) return;
    triggerSavingIndicator();
    try {
      await workspaceApi.saveStickyNote(user.uid, {
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
    triggerSavingIndicator();
    // Optimistic Update
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    try {
      await workspaceApi.saveStickyNote(user.uid, { id, ...updates });
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
    if (!user) return;
    triggerSavingIndicator();
    const lines = note.content.split('\n');
    const title = lines[0].trim() || 'Rascunho de Nota';
    const description = lines.slice(1).join('\n').trim();

    try {
      await workspaceApi.saveKanbanCard(user.uid, {
        title,
        description: description || null,
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
    if (!user) return;
    triggerSavingIndicator();
    try {
      await workspaceApi.saveQuickLink(user.uid, {
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
    <div className="flex flex-col flex-1 bg-[#fafafa] h-dvh overflow-hidden relative font-sans selection:bg-primary/30">
      {/* ELITE MESH GRADIENT LAYER */}
      <div className="fixed inset-0 -z-10 bg-[#fafafa] overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-primary/5 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '2s' }}></div>
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

      <header className="sticky top-0 z-50 h-16 border-b border-slate-100 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shrink-0 select-none">
        <div className="w-full h-full flex items-center justify-between px-6 md:px-12">
          <div className="flex items-center gap-5">
            <Button
              onClick={() => router.push('/')}
              variant="ghost"
              className="h-10 px-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all flex items-center gap-2 group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Hub</span>
            </Button>

            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-black font-headline uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 leading-none">
                  Meu <span className="text-primary not-italic">Espaço</span>
                </h1>
                <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none mt-0.5">
                  <Cloud className="h-2.5 w-2.5 text-emerald-500 animate-pulse" />
                  <span>Espaço Ágil</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-3 px-4 h-10 rounded-xl bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-600 dark:hover:text-slate-350 transition-all group"
            >
              <Search className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
              <span>Pesquisar...</span>
              <kbd className="ml-4 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-1.5 font-mono text-[9px] font-medium text-slate-400 dark:text-slate-500 opacity-100">
                <span className="text-[10px]">⌘</span>K
              </kbd>
            </div>

            <div className={cn(
              "hidden sm:flex items-center gap-2 px-3 h-8 rounded-full bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest transition-all duration-500",
              isSaving ? "text-primary border-primary/20 bg-primary/5 shadow-sm" : "text-slate-400 dark:text-slate-500"
            )}>
              {isSaving ? <AgileSpinner size="sm" /> : <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
              {isSaving ? "Sincronizando..." : "Conectado"}
            </div>

            <Separator orientation="vertical" className="h-6 hidden md:block bg-slate-250 dark:bg-slate-800" />

            <div className="flex items-center gap-2.5">
              {userProfile?.role === 'admin' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="h-9 px-3 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl transition-all"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  <span className="hidden lg:inline text-[9px] font-black uppercase tracking-widest">Admin</span>
                </Button>
              )}

              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/60 dark:border-slate-800/80 shadow-sm text-slate-700 dark:text-slate-350">
                <NiceAvatar
                  className="w-7 h-7 rounded-full border border-primary/20 bg-primary/10 shadow-sm"
                  {...(PREDEFINED_AVATARS[userProfile?.avatarSeed || ''] || genConfig(userProfile?.avatarSeed || userProfile?.email || userProfile?.name || 'user'))}
                />
                <span className="text-[10px] font-black uppercase tracking-tight text-slate-700 dark:text-slate-300">{userProfile?.name?.split(' ')[0]}</span>
              </div>

              <Separator orientation="vertical" className="h-6 hidden md:block bg-slate-250 dark:bg-slate-800" />

              <ThemeToggle className="h-9 w-9 rounded-xl border-none hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-400 hover:text-slate-900 transition-all dark:text-slate-300 dark:hover:text-slate-100" />

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary rounded-xl"><HelpCircle className="h-4 w-4" /></Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-xl flex flex-col p-0 bg-white dark:bg-slate-950 border-l border-slate-100 dark:border-slate-800">
                  <SheetHeader className="shrink-0 border-b border-slate-100 dark:border-slate-800 p-8 bg-slate-50/50 dark:bg-slate-900/50">
                    <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-white">Guia <span className="text-primary not-italic">V3</span></SheetTitle>
                    <SheetDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Sua central privada de engenharia.</SheetDescription>
                  </SheetHeader>
                  <ScrollArea className="flex-1 p-8 space-y-10">
                    <section className="space-y-4">
                      <h3 className="font-black text-[11px] uppercase tracking-widest text-primary flex items-center gap-3"><Lock className="h-4 w-4" /> Privacidade</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">Seu Workspace é privado. Kanban e Notas são visíveis apenas para você.</p>
                    </section>
                    <section className="space-y-4">
                      <h3 className="font-black text-[11px] uppercase tracking-widest text-primary flex items-center gap-3"><CloudLightning className="h-4 w-4" /> Sincronização</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">Dados salvos instantaneamente via Firebase Realtime Updates.</p>
                    </section>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden px-4 md:px-10 pb-2 w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full space-y-0">
          <div className="h-12 border-b border-slate-100 dark:border-slate-850 bg-white/60 dark:bg-slate-950/40 backdrop-blur-lg shrink-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
            <TabsList className="bg-transparent h-full p-0 rounded-none shadow-none border-none w-auto">
              <TabsTrigger value="home" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <Home className="h-4 w-4" />
                Início
              </TabsTrigger>
              <TabsTrigger value="kanban" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="notes" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <StickyNoteIcon className="h-4 w-4" />
                Notas
              </TabsTrigger>
              <TabsTrigger value="history" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <History className="h-4 w-4" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="profile" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <UserIcon className="h-4 w-4" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="connectivity" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <Link2 className="h-4 w-4" />
                Conectividade
              </TabsTrigger>
              <TabsTrigger value="links" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <Link2 className="h-4 w-4" />
                Atalhos
              </TabsTrigger>
              <TabsTrigger value="prompts" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <BrainCircuit className="h-4 w-4" />
                Prompts
              </TabsTrigger>
              <TabsTrigger value="daily" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <ClipboardList className="h-4 w-4" />
                Daily Helper
              </TabsTrigger>
              <TabsTrigger value="snippets" className="relative text-[10px] font-black uppercase tracking-widest px-6 h-full gap-2.5 rounded-none border-none shadow-none bg-transparent data-[state=active]:text-slate-950 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-100 transition-all data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-6 data-[state=active]:after:right-6 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary">
                <Code className="h-4 w-4" />
                Snippets
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="home" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
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

          <TabsContent value="kanban" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <KanbanBoard
              cards={cards || []}
              isLoading={isKanbanLoading}
              onUpdateStatus={handleUpdateTaskStatus}
              onEditCard={(card) => openTaskModal(card.status, card)}
              onAddTask={openTaskModal}
            />
          </TabsContent>

          <TabsContent value="notes" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <StickyNotes
              notes={notes || []}
              isLoading={isNotesLoading}
              onAdd={handleAddNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              onConvertToTask={handleSendNoteToKanban}
            />
          </TabsContent>

          <TabsContent value="history" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <div className="flex-1 p-4 md:px-12 md:pb-12 md:pt-3 overflow-y-auto no-scrollbar flex flex-col justify-between min-h-0">
              <HistoryTimeline
                items={mergedHistory}
                isLoading={isLoadingPoker || isLoadingRetro || isLoadingHealth}
                userId={user?.uid || ''}
              />
              <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} className="mt-8 mx-0 md:mx-0 lg:mx-0" />
            </div>
          </TabsContent>

          <TabsContent value="profile" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <div className="flex-1 p-4 md:px-12 md:pb-12 md:pt-3 overflow-y-auto no-scrollbar flex flex-col justify-between min-h-0">
              <ProfileSettings
                profile={userProfile}
                onUpdate={handleUpdateProfile}
              />
              <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} className="mt-8 mx-0 md:mx-0 lg:mx-0" />
            </div>
          </TabsContent>

          <TabsContent value="connectivity" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <div className="flex-1 p-4 md:px-12 md:pb-12 md:pt-3 bg-slate-50/30 rounded-[3rem] border border-slate-100 overflow-y-auto no-scrollbar flex flex-col justify-between min-h-0">
              <div className="w-full mx-auto">
                <ConnectivitySettings />
              </div>
              <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} className="mt-8 mx-0 md:mx-0 lg:mx-0" />
            </div>
          </TabsContent>

          <TabsContent value="links" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <div className="flex-1 p-4 md:px-12 md:pb-12 md:pt-3 bg-slate-50/30 rounded-[3rem] border border-slate-100 overflow-y-auto no-scrollbar flex flex-col justify-between min-h-0">
              <div className="w-full mx-auto">
                <QuickLinks links={userLinks || []} onAddLink={handleAddLink} onDeleteLink={handleDeleteLink} />
              </div>
              <Footer onOpenFeedback={handleOpenFeedback} className="mt-8 mx-0 md:mx-0 lg:mx-0" />
            </div>
          </TabsContent>

          <TabsContent value="prompts" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <div className="flex-1 p-4 md:px-12 md:pb-12 md:pt-3 overflow-y-auto no-scrollbar flex flex-col justify-between min-h-0">
              <MyPrompts userProfile={userProfile} />
              <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} className="mt-8 mx-0 md:mx-0 lg:mx-0" />
            </div>
          </TabsContent>

          <TabsContent value="daily" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <div className="flex-1 flex flex-col overflow-hidden">
              <DailyHelper userProfile={userProfile} />
            </div>
          </TabsContent>

          <TabsContent value="snippets" className="flex-1 m-0 overflow-hidden outline-none data-[state=active]:flex data-[state=active]:flex-col min-h-0 animate-in fade-in duration-500">
            <div className="flex-1 p-4 md:px-12 md:pb-12 md:pt-3 overflow-y-auto no-scrollbar flex flex-col justify-between min-h-0">
              <SnippetLibrary />
              <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} className="mt-8 mx-0 md:mx-0 lg:mx-0" />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* TASK MODAL */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl">
          <DialogHeader className="p-8 pb-4 border-b border-slate-100 bg-slate-900 text-white">
            <DialogTitle className="text-2xl font-black font-headline uppercase tracking-tighter italic text-white">
              {editingCardId ? 'Ajustar' : 'Nova'} <span className="text-primary not-italic">Tarefa</span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 p-8">
            {currentOriginLink && (
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-primary tracking-widest">Vinculado a Cerimônia</span>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-9 text-primary hover:bg-primary/10 font-black text-[10px] uppercase rounded-xl">
                  <Link href={currentOriginLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" /> Ver Sala
                  </Link>
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Título da Atividade</Label>
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="h-12 rounded-xl font-bold border-2 focus-visible:ring-primary/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descrição / Detalhes</Label>
              <Textarea value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} className="min-h-[100px] rounded-xl text-sm border-2 focus-visible:ring-primary/20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Urgência</Label>
                <Select value={newTaskPriority} onValueChange={(v: KanbanPriority) => setNewTaskPriority(v)}>
                  <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="baixa" className="text-xs font-bold">Baixa</SelectItem>
                    <SelectItem value="media" className="text-xs font-bold text-blue-500">Média</SelectItem>
                    <SelectItem value="alta" className="text-xs font-bold text-orange-500">Alta</SelectItem>
                    <SelectItem value="critica" className="text-xs font-bold text-rose-600">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</Label>
                <Select value={newTaskStatus} onValueChange={(v: KanbanStatus) => setNewTaskStatus(v)}>
                  <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="todo" className="text-xs font-bold">A Fazer</SelectItem>
                    <SelectItem value="doing" className="text-xs font-bold">Em Andamento</SelectItem>
                    <SelectItem value="done" className="text-xs font-bold">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100">
            {editingCardId && <Button variant="ghost" onClick={handleDeleteTask} className="sm:mr-auto text-destructive hover:bg-rose-50 font-black text-[10px] uppercase tracking-widest">Excluir</Button>}
            <Button variant="ghost" onClick={() => setIsTaskModalOpen(false)} className="font-black text-[10px] uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleSaveTask} disabled={!newTaskTitle.trim()} className="h-12 px-8 font-black text-[10px] uppercase tracking-widest rounded-xl bg-slate-900 text-white shadow-lg">Salvar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackWidget toolName="Espaço Ágil - Meu Espaço V3" externalTriggerSignal={feedbackSignal} triggerVariant="none" />
    </div>
  );
}
