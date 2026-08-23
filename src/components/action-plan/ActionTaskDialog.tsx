'use client';

import React, { useState, useEffect } from 'react';
import { ActionPlanTask, ActionPlanTaskStatus } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { actionPlanApi } from '@/app/action-plan/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Target, Sparkles, LayoutGrid, Clock, User, CheckCircle2, Trash2 } from 'lucide-react';

interface ActionTaskDialogProps {
  boardId: string;
  task: ActionPlanTask | null;
  isOpen: boolean;
  onClose: () => void;
  totalTasks: number;
  onSaveSuccess?: () => void;
}

export function ActionTaskDialog({ boardId, task, isOpen, onClose, totalTasks, onSaveSuccess }: ActionTaskDialogProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    what: '',
    why: '',
    where: '',
    when: '',
    who: '',
    how: '',
    howMuch: '',
    status: 'todo' as ActionPlanTaskStatus
  });

  useEffect(() => {
    if (task) {
      setFormData({
        what: task.what,
        why: task.why,
        where: task.where,
        when: task.when,
        who: task.who,
        how: task.how,
        howMuch: task.howMuch || '',
        status: task.status
      });
    } else {
      setFormData({
        what: '', why: '', where: '', when: '', who: '', how: '', howMuch: '', status: 'todo'
      });
    }
  }, [task, isOpen]);

  const handleSave = async () => {
    if (!session) return;
    
    if (!formData.what.trim() || !formData.who.trim()) {
      toast({
        title: "Campos Obrigatórios",
        description: "Preencha pelo menos 'O quê' e 'Quem' para salvar a tarefa.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      if (task) {
        // Update
        await actionPlanApi.updateTask(task.id, formData);
      } else {
        // Create
        await actionPlanApi.createTask(boardId, {
          ...formData,
          authorId: session.id,
          order: totalTasks
        });
      }
      onSaveSuccess?.();
      onClose();
    } catch (e) {
      console.error("Erro ao salvar tarefa", e);
      toast({ title: "Erro", description: "Não foi possível salvar a tarefa.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    try {
      await actionPlanApi.deleteTask(task.id);
      onSaveSuccess?.();
      onClose();
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível excluir a tarefa.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const FieldIcon = ({ icon: Icon, color }: { icon: any, color: string }) => (
    <div className={`p-1.5 rounded-lg bg-${color}-50 text-${color}-500 mr-2 shrink-0`}>
      <Icon className="h-3 w-3" />
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[700px] rounded-[2rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-black uppercase tracking-tighter text-slate-800">
            {task ? 'Editar Ação' : 'Nova Ação 5W2H'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WHAT */}
          <div className="space-y-2 md:col-span-2">
            <Label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FieldIcon icon={Target} color="fuchsia" /> What (O que será feito?) *
            </Label>
            <Input 
              value={formData.what} onChange={e => setFormData({...formData, what: e.target.value})}
              placeholder="Ex: Criar endpoint de pagamento" 
              className="h-12 border-slate-200 focus:border-fuchsia-500 rounded-xl"
            />
          </div>

          {/* WHY */}
          <div className="space-y-2">
            <Label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FieldIcon icon={Sparkles} color="amber" /> Why (Por que será feito?)
            </Label>
            <Textarea 
              value={formData.why} onChange={e => setFormData({...formData, why: e.target.value})}
              placeholder="Ex: Para permitir transações via PIX" 
              className="resize-none h-24 border-slate-200 focus:border-amber-500 rounded-xl text-sm"
            />
          </div>

          {/* HOW */}
          <div className="space-y-2">
            <Label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FieldIcon icon={CheckCircle2} color="emerald" /> How (Como será feito?)
            </Label>
            <Textarea 
              value={formData.how} onChange={e => setFormData({...formData, how: e.target.value})}
              placeholder="Ex: Usando a API da Stripe v2" 
              className="resize-none h-24 border-slate-200 focus:border-emerald-500 rounded-xl text-sm"
            />
          </div>

          {/* WHO & WHEN */}
          <div className="space-y-2">
            <Label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FieldIcon icon={User} color="cyan" /> Who (Responsável) *
            </Label>
            <Input 
              value={formData.who} onChange={e => setFormData({...formData, who: e.target.value})}
              placeholder="Ex: João Silva" 
              className="h-12 border-slate-200 focus:border-cyan-500 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FieldIcon icon={Clock} color="rose" /> When (Prazo)
            </Label>
            <Input 
              value={formData.when} onChange={e => setFormData({...formData, when: e.target.value})}
              placeholder="Ex: 15/Out até as 18h" 
              className="h-12 border-slate-200 focus:border-rose-500 rounded-xl"
            />
          </div>

          {/* WHERE & HOW MUCH */}
          <div className="space-y-2">
            <Label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FieldIcon icon={LayoutGrid} color="indigo" /> Where (Onde?)
            </Label>
            <Input 
              value={formData.where} onChange={e => setFormData({...formData, where: e.target.value})}
              placeholder="Ex: Repositório Backend-Core" 
              className="h-12 border-slate-200 focus:border-indigo-500 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FieldIcon icon={Target} color="slate" /> How Much (Custo/Esforço)
            </Label>
            <Input 
              value={formData.howMuch} onChange={e => setFormData({...formData, howMuch: e.target.value})}
              placeholder="Ex: 8 Horas / R$ 500" 
              className="h-12 border-slate-200 focus:border-slate-500 rounded-xl"
            />
          </div>
          
          {/* STATUS - ONLY ON EDIT */}
          {task && (
            <div className="space-y-2 md:col-span-2 pt-4 border-t border-slate-100">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status da Tarefa</Label>
              <div className="flex gap-2">
                {(['todo', 'doing', 'done', 'blocked'] as ActionPlanTaskStatus[]).map(status => (
                   <button
                     key={status}
                     onClick={() => setFormData({...formData, status})}
                     className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                       formData.status === status 
                         ? 'bg-slate-800 text-white shadow-md' 
                         : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                     }`}
                   >
                     {status.toUpperCase()}
                   </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-8 pt-4 border-t border-slate-100 sm:justify-between">
          {task ? (
             <Button
               variant="ghost"
               onClick={handleDelete}
               disabled={isDeleting}
               className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 font-bold"
             >
               <Trash2 className="h-4 w-4 mr-2" /> Excluir
             </Button>
          ) : <div></div>}
          
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500">Cancelar</Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-black uppercase tracking-widest text-xs px-8 shadow-xl shadow-fuchsia-500/20"
            >
              {isSaving ? 'Salvando...' : 'Salvar Ação'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
