'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Pencil, 
  ChevronUp, 
  ChevronDown, 
  Target, 
  Folders, 
  FolderOpen,
  ListTodo,
  ExternalLink
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PlannerTask, PlannerTaskCard } from './PlannerTaskCard';
import { PokerSessionPicker } from '../../poker/PokerSessionPicker';

interface BacklogManagerProps {
  tasks: PlannerTask[];
  onAddTask: (task: Omit<PlannerTask, 'id'>) => void;
  onUpdateTask: (id: string, updates: Partial<PlannerTask>) => void;
  onRemoveTask: (id: string) => void;
  onBatchImport: (text: string) => void;
  onPokerImport: (room: any) => void;
  isReadOnly?: boolean;
}

export function BacklogManager({
  tasks,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
  onBatchImport,
  onPokerImport,
  isReadOnly = false,
}: BacklogManagerProps) {
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDevHours, setNewTaskDevHours] = useState('');
  const [newTaskQaHours, setNewTaskQaHours] = useState('');
  const [newTaskLink, setNewTaskLink] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [showAdvancedTaskForm, setShowAdvancedTaskForm] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  
  const [selectedTask, setSelectedTask] = useState<PlannerTask | null>(null);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showPokerImport, setShowPokerImport] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');

  const resetForm = () => {
    setNewTaskName('');
    setNewTaskDevHours('');
    setNewTaskQaHours('');
    setNewTaskLink('');
    setNewTaskDescription('');
    setEditTaskId(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    const taskData = {
      name: newTaskName,
      devHours: Number(newTaskDevHours) || 0,
      qaHours: Number(newTaskQaHours) || 0,
      link: newTaskLink,
      description: newTaskDescription,
    };

    if (editTaskId) {
      onUpdateTask(editTaskId, taskData);
    } else {
      onAddTask(taskData);
    }
    resetForm();
  };

  const startEditTask = (task: PlannerTask) => {
    setEditTaskId(task.id);
    setNewTaskName(task.name);
    setNewTaskDevHours(String(task.devHours));
    setNewTaskQaHours(String(task.qaHours));
    setNewTaskLink(task.link || '');
    setNewTaskDescription(task.description || '');
    setShowAdvancedTaskForm(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {!isReadOnly && (
        <form onSubmit={handleFormSubmit} className="p-5 border-b dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md space-y-4 shrink-0 transition-all">
          <div className="flex flex-col md:flex-row gap-3">
            <Input 
              placeholder="Nome da Tarefa (Ex: API de Pagamento...)" 
              className="flex-1 h-11 border-2 border-slate-100 dark:border-slate-800 focus:border-violet-500 rounded-2xl font-black text-xs uppercase tracking-tight bg-white dark:bg-slate-900 dark:text-slate-100"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
            />
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950/20 border-2 border-violet-100 dark:border-violet-900/60 rounded-2xl px-3 h-11 focus-within:border-violet-500 transition-all">
                <span className="text-[9px] font-black uppercase text-violet-600 tracking-widest">DEV</span>
                <Input 
                  type="number"
                  placeholder="0h" 
                  className="w-12 bg-transparent border-0 text-center font-black text-sm p-0 h-auto focus-visible:ring-0"
                  value={newTaskDevHours}
                  onChange={e => setNewTaskDevHours(e.target.value)}
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2 bg-fuchsia-50 dark:bg-fuchsia-950/20 border-2 border-fuchsia-100 dark:border-fuchsia-900/60 rounded-2xl px-3 h-11 focus-within:border-fuchsia-500 transition-all">
                <span className="text-[9px] font-black uppercase text-fuchsia-600 tracking-widest">QA</span>
                <Input 
                  type="number"
                  placeholder="0h" 
                  className="w-12 bg-transparent border-0 text-center font-black text-sm p-0 h-auto focus-visible:ring-0"
                  value={newTaskQaHours}
                  onChange={e => setNewTaskQaHours(e.target.value)}
                  min={0}
                />
              </div>
              <Button type="submit" className={cn("h-11 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all gap-2 shrink-0", editTaskId ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900")}>
                {editTaskId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
                {editTaskId ? 'Salvar' : 'Adicionar'}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <button 
              type="button" 
              onClick={() => setShowAdvancedTaskForm(!showAdvancedTaskForm)}
              className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-violet-600 flex items-center gap-2 transition-all"
            >
              {showAdvancedTaskForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showAdvancedTaskForm ? 'Recolher' : 'Expandir'} Detalhes
            </button>
            {editTaskId && (
              <button 
                type="button" 
                onClick={resetForm}
                className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600"
              >
                Cancelar Edição
              </button>
            )}
          </div>

          {showAdvancedTaskForm && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
              <Input 
                placeholder="Link da sua Issue (Jira, GitHub...)" 
                className="h-11 border-2 border-slate-100 dark:border-slate-800 focus:border-violet-500 rounded-xl text-xs bg-white dark:bg-slate-900 dark:text-slate-100"
                value={newTaskLink}
                onChange={e => setNewTaskLink(e.target.value)}
              />
              <Input 
                placeholder="Critérios de aceite / Notas rápidas..."
                className="h-11 border-2 border-slate-100 dark:border-slate-800 focus:border-violet-500 rounded-xl text-xs bg-white dark:bg-slate-900 dark:text-slate-100"
                value={newTaskDescription}
                onChange={e => setNewTaskDescription(e.target.value)}
              />
            </div>
          )}
        </form>
      )}

      {/* List Area */}
      <div className="flex-1 p-6 space-y-4 bg-white/30 dark:bg-slate-950/30 custom-scrollbar overflow-y-auto min-h-0">
        {!isReadOnly && tasks.length > 0 && (
          <div className="flex justify-end gap-2 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowBatchImport(true)}
              className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-xl gap-2 shadow-sm"
            >
              📥 Importar Lista
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowPokerImport(true)}
              className="h-8 text-[9px] font-black uppercase tracking-widest border-violet-100 dark:border-violet-900 text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/30 hover:bg-violet-50 dark:hover:bg-violet-950/50 rounded-xl gap-2 shadow-sm"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Poker session
            </Button>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white/40 dark:bg-slate-900/40 rounded-[3rem] border-2 border-dashed border-slate-200/50 dark:border-slate-800 animate-in fade-in zoom-in">
            <div className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl mb-8">
              <Target className="h-16 w-16 text-slate-200 dark:text-slate-700" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-slate-100 mb-2">Workspace Vazio</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] max-w-[320px] leading-relaxed mb-10">
              Pronto para construir o futuro? Comece adicionando tarefas ou importe dados do Poker.
            </p>
            
            {!isReadOnly && (
              <div className="flex flex-col gap-4 w-full max-w-[320px]">
                <Button 
                  onClick={() => setShowPokerImport(true)}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-[11px] h-16 rounded-[2rem] shadow-2xl shadow-violet-600/20 gap-3"
                >
                  <Folders className="h-5 w-5" /> Importar do Poker
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowBatchImport(true)}
                  className="w-full h-14 text-[11px] font-black uppercase tracking-widest rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-900"
                >
                  <Plus className="h-5 w-5 mr-3" /> Colar Lista
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 content-start pb-20">
            {tasks.map(task => (
              <PlannerTaskCard
                key={task.id}
                task={task}
                onClick={setSelectedTask}
                onEdit={startEditTask}
                onDelete={onRemoveTask}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        )}
      </div>

      {/* Overlays */}
      <PokerSessionPicker 
        isOpen={showPokerImport}
        onClose={() => setShowPokerImport(false)}
        onSelect={(room) => { onPokerImport(room); setShowPokerImport(false); }}
        importedIds={[]} // This would need the list of imported IDs if used
      />

      <Dialog open={showBatchImport} onOpenChange={setShowBatchImport}>
        <DialogContent className="sm:max-w-[600px] border-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl rounded-[3rem] p-10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-slate-100">Importação em Lote</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              Cole sua lista de tarefas (uma por linha).
            </DialogDescription>
          </DialogHeader>
          <textarea 
            className="w-full min-h-[250px] p-6 text-xs font-bold bg-slate-50 dark:bg-slate-950/60 border-2 border-slate-100 dark:border-slate-850 rounded-[2rem] focus:border-violet-500 text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
            placeholder="Exemplo:\nJIRA-101 Login | https://jira... | Fazer a tela de login"
            value={batchImportText}
            onChange={(e) => setBatchImportText(e.target.value)}
          />
          <DialogFooter className="gap-2 pt-6">
            <Button variant="ghost" onClick={() => setShowBatchImport(false)} className="rounded-2xl uppercase text-[10px] font-black tracking-widest">Cancelar</Button>
            <Button 
              onClick={() => { onBatchImport(batchImportText); setShowBatchImport(false); setBatchImportText(''); }} 
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-2xl h-12 px-8 uppercase text-[10px] font-black tracking-widest shadow-xl shadow-violet-600/20"
            >
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedTask} onOpenChange={(val) => !val && setSelectedTask(null)}>
        <SheetContent className="w-full sm:max-w-xl border-l border-white/40 dark:border-slate-850 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl flex flex-col p-8 sm:p-12 overflow-y-auto custom-scrollbar">
          <SheetHeader className="mb-10">
            <div className="h-14 w-14 rounded-[1.5rem] bg-violet-600 text-white flex items-center justify-center shadow-xl shadow-violet-600/20 mb-6">
              <ListTodo className="h-7 w-7" />
            </div>
            <SheetTitle className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-tight uppercase tracking-tighter">
              {selectedTask?.name}
            </SheetTitle>
          </SheetHeader>
          
          <div className="space-y-10">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 mb-2">Dev Scope</p>
                  <p className="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-slate-100">{selectedTask?.devHours}<span className="text-xl">h</span></p>
               </div>
               <div className="bg-white dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-sm text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-600 mb-2">QA Scope</p>
                  <p className="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-slate-100">{selectedTask?.qaHours}<span className="text-xl">h</span></p>
               </div>
            </div>

            {selectedTask?.description && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Descrição / Notas</h3>
                <div className="p-6 bg-slate-50/50 dark:bg-slate-950/40 rounded-[2rem] leading-relaxed text-sm font-bold text-slate-650 dark:text-slate-300 border border-slate-100 dark:border-slate-850">
                  {selectedTask?.description}
                </div>
              </div>
            )}

            {selectedTask?.link && (
              <div className="pt-6">
                <a href={selectedTask?.link} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Button className="w-full h-16 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs tracking-[0.2em] uppercase rounded-[1.5rem] transition-all shadow-2xl group">
                    <ExternalLink className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" /> 
                    Abrir Issue Externa
                  </Button>
                </a>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
