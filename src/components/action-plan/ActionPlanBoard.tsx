import React, { useState } from 'react';
import { ActionPlanBoard as IActionPlanBoard, ActionPlanTask, ActionPlanTaskStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, ListChecks, Target, Clock, User, Sparkles, LayoutGrid, CheckCircle2 } from 'lucide-react';
import { ActionTaskDialog } from './ActionTaskDialog';
import { Badge } from '@/components/ui/badge';
import { actionPlanApi } from '@/app/action-plan/api';
import { cn } from '@/lib/utils';

interface ActionPlanBoardProps {
  board: IActionPlanBoard;
  tasks: ActionPlanTask[];
  onRefresh?: () => void;
}

export function ActionPlanBoard({ board, tasks, onRefresh }: ActionPlanBoardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ActionPlanTask | null>(null);

  const handleOpenNew = () => {
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (task: ActionPlanTask) => {
    setEditingTask(task);
    setIsDialogOpen(true);
  };

  const handleUpdateField = async (taskId: string, field: string, value: string) => {
    await actionPlanApi.updateTask(taskId, { [field]: value });
    onRefresh?.();
  };

  const handleUpdateStatus = async (taskId: string, currentStatus: ActionPlanTaskStatus) => {
    const statuses: ActionPlanTaskStatus[] = ['todo', 'doing', 'done', 'blocked'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    await actionPlanApi.updateTask(taskId, { status: nextStatus });
    onRefresh?.();
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50/50 p-8 overflow-hidden">
      {/* HEADER ROW */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
           <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Matriz de Execução</h2>
           <p className="text-slate-500 text-sm">Gerencie o 5W2H para {board.title}</p>
        </div>
        
        <div className="flex items-center gap-4">
           <Button 
             onClick={handleOpenNew}
             className="h-12 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-fuchsia-500/20 gap-2 px-6"
           >
             <Plus className="h-4 w-4" /> Nova Ação
           </Button>
        </div>
      </div>

      {/* MATRIX / TABLE */}
      <div className="flex-1 overflow-auto bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/50">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
            <tr>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-10 text-center">#</th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-[30%]">
                <div className="flex items-center gap-2"><Target className="h-3 w-3 text-fuchsia-500"/> What (O quê)</div>
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-[22%]">
                <div className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-amber-500"/> Why / How</div>
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-28">
                <div className="flex items-center gap-2"><LayoutGrid className="h-3 w-3 text-indigo-500"/> Where</div>
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-32">
                <div className="flex items-center gap-2"><Clock className="h-3 w-3 text-rose-500"/> When</div>
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-40">
                <div className="flex items-center gap-2"><User className="h-3 w-3 text-cyan-500"/> Who</div>
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400">
                   <ListChecks className="h-12 w-12 mx-auto text-slate-200 mb-4" />
                   <p className="font-bold text-sm">Nenhuma ação definida ainda.</p>
                   <p className="text-xs">Comece adicionando o primeiro item do plano.</p>
                </td>
              </tr>
            ) : (
              tasks.map((task, idx) => (
                <tr 
                  key={task.id} 
                  className="hover:bg-fuchsia-50/20 transition-colors group border-b border-slate-50 last:border-0"
                >
                  <td className="p-4 text-xs font-black text-slate-300 text-center border-r border-slate-50">{idx + 1}</td>
                  
                  {/* WHAT */}
                  <td className="p-2 border-r border-slate-50 min-w-[240px]">
                    <div className="flex flex-col gap-1">
                      <InPlaceInput 
                        value={task.what} 
                        onSave={(val) => handleUpdateField(task.id, 'what', val)}
                        className="text-xs font-bold text-slate-800 leading-snug line-clamp-2"
                        placeholder="O que será feito?"
                      />
                      {task.howMuch && (
                        <div className="flex items-center px-2">
                           <span className="text-[8px] font-black text-emerald-500 uppercase">Custo: {task.howMuch}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* WHY / HOW */}
                  <td className="p-2 border-r border-slate-50 min-w-[280px]">
                    <div className="space-y-3 p-1">
                       <div>
                         <span className="text-[7px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1 px-1">
                           <Sparkles className="h-2 w-2" /> Why
                         </span>
                         <InPlaceInput 
                           value={task.why} 
                           onSave={(val) => handleUpdateField(task.id, 'why', val)}
                           className="text-[10px] text-slate-600 leading-snug line-clamp-1"
                           placeholder="Por que?"
                         />
                       </div>
                       <div>
                         <span className="text-[7px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1 px-1">
                           <CheckCircle2 className="h-2 w-2" /> How
                         </span>
                         <InPlaceInput 
                           value={task.how} 
                           onSave={(val) => handleUpdateField(task.id, 'how', val)}
                           className="text-[10px] text-slate-600 leading-snug line-clamp-1"
                           placeholder="Como?"
                         />
                       </div>
                    </div>
                  </td>

                  {/* WHERE */}
                  <td className="p-2 border-r border-slate-50">
                    <div className="px-1">
                      <InPlaceInput 
                        value={task.where} 
                        onSave={(val) => handleUpdateField(task.id, 'where', val)}
                        className="text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded-lg inline-block w-full truncate"
                        placeholder="Onde?"
                      />
                    </div>
                  </td>

                  {/* WHEN */}
                  <td className="p-2 border-r border-slate-50">
                    <div className="flex items-center gap-1 px-1">
                      <Clock className="h-3 w-3 text-rose-400 shrink-0" />
                      <InPlaceInput 
                        value={task.when} 
                        onSave={(val) => handleUpdateField(task.id, 'when', val)}
                        className="text-[10px] font-bold text-rose-600 w-full truncate"
                        placeholder="Quando?"
                      />
                    </div>
                  </td>

                  {/* WHO */}
                  <td className="p-2 border-r border-slate-50">
                    <div className="flex items-center gap-2 px-1 group/who">
                      <div className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm border border-cyan-200">
                         {task.who.substring(0, 2).toUpperCase() || '??'}
                      </div>
                      <InPlaceInput 
                        value={task.who} 
                        onSave={(val) => handleUpdateField(task.id, 'who', val)}
                        className="text-[10px] font-bold text-slate-700 w-full truncate"
                        placeholder="Quem?"
                      />
                    </div>
                  </td>

                  {/* STATUS */}
                  <td className="p-2 text-center min-w-[120px]">
                    <button 
                      onClick={() => handleUpdateStatus(task.id, task.status)}
                      className="w-full text-left"
                    >
                      <StatusBadge status={task.status} interactive />
                    </button>
                    
                    {/* Tiny Edit Button for Modal Access */}
                    <button 
                      onClick={() => handleEdit(task)}
                      className="mt-2 text-[8px] font-black text-slate-300 hover:text-fuchsia-500 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Editar Detalhes
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isDialogOpen && (
        <ActionTaskDialog 
          boardId={board.id}
          task={editingTask}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          totalTasks={tasks.length}
          onSaveSuccess={onRefresh}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, interactive = false }: { status: ActionPlanTask['status'], interactive?: boolean }) {
  const map: Record<ActionPlanTask['status'], { label: string, color: string }> = {
    todo: { label: 'A Fazer', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    doing: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    done: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    blocked: { label: 'Impedido', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  };

  const info = map[status];
  return (
    <div className={cn(
      "px-2 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-between group/status",
      info.color,
      interactive && "hover:shadow-md hover:scale-[1.02] cursor-pointer"
    )}>
      <span>{info.label}</span>
      {interactive && <Plus className="h-2 w-2 opacity-0 group-hover/status:opacity-50" />}
    </div>
  );
}

function InPlaceInput({ value, onSave, className, placeholder }: { value: string, onSave: (val: string) => void, className?: string, placeholder?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  const handleBlur = () => {
    setIsEditing(false);
    if (currentValue !== value) {
      onSave(currentValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        value={currentValue}
        onChange={e => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full bg-white border-b-2 border-fuchsia-500 outline-none px-1 py-0.5",
          className
        )}
      />
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-text hover:bg-slate-50 px-1 py-0.5 rounded transition-colors min-h-[1.5em] break-words overflow-hidden",
        !value && "text-slate-300 italic",
        className
      )}
    >
      {value || placeholder}
    </div>
  );
}
