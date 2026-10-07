import React, { useState } from 'react';
import { BrainstormingIdea, BrainstormingGroup, BrainstormingBoard } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, TrendingUp, Zap, Target, ArrowRight, ListChecks, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { actionPlanApi } from '../../app/action-plan/api';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface ActionsPhaseProps {
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  boardData: BrainstormingBoard;
  onUpdateIdea: (id: string, content: string) => void;
  onMoveIdea: (id: string, groupId: string | null) => void;
}

export function ActionsPhase({ ideas, groups, boardData, onUpdateIdea, onMoveIdea }: ActionsPhaseProps) {
  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const sortedIdeas = [...ideas].sort((a, b) => {
    const votesA = a.votes?.length || 0;
    const votesB = b.votes?.length || 0;
    return votesB - votesA;
  });

  const quickWins = sortedIdeas.filter(i => (i.qualifiers?.roi || 0) >= 50 && (i.qualifiers?.effort || 0) <= 50);
  const strategic = sortedIdeas.filter(i => (i.qualifiers?.roi || 0) >= 50 && (i.qualifiers?.effort || 0) > 50);

  const topIdeas = sortedIdeas.slice(0, 5);

  const handleExportTo5W2H = async () => {
    if (!session || isExporting) return;

    setIsExporting(true);

    try {
      const planTitle = `Plano de Ação: ${boardData.title}`;

      const newPlan = await actionPlanApi.createBoard({
        creatorId: session.id,
        title: planTitle,
        team: boardData.team || 'Squad Geral',
        createdAt: new Date().toISOString(),
        settings: { isPublic: true },
        participantIds: [session.id]
      });

      if (!newPlan || !newPlan.id) {
        throw new Error('Falha ao criar o plano de ação.');
      }

      for (let i = 0; i < topIdeas.length; i++) {
        const idea = topIdeas[i];
        const group = groups.find(g => g.id === idea.groupId);
        
        await actionPlanApi.createTask(newPlan.id, {
          boardId: newPlan.id,
          what: idea.content,
          why: `Idea priorizada no Brainstorming (ROI: ${idea.qualifiers?.roi || 0}%)`,
          where: group?.title || 'Squad',
          when: '',
          who: '',
          how: '',
          howMuch: idea.qualifiers?.effort ? `Esforço: ${idea.qualifiers.effort}%` : '',
          status: 'todo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          authorId: session.id,
          order: i
        });
      }

      toast({
        title: "Sucesso!",
        description: "Matriz 5W2H gerada com sucesso. Redirecionando...",
      });

      router.push(`/action-plan/${newPlan.id}`);
    } catch (e) {
      console.error("Erro ao exportar", e);
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar a matriz 5W2H.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50/50">
      <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Plano de Ação</h2>
          <p className="text-slate-500 text-sm">Resumo estratégico baseado nas fases anteriores.</p>
        </div>

        <Button
          onClick={handleExportTo5W2H}
          disabled={isExporting}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl shadow-xl shadow-fuchsia-600/20 gap-3"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ListChecks className="h-4 w-4" />
          )}
          {isExporting ? 'Exportando...' : 'Exportar para 5W2H'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-12">
        <div className="max-w-full mx-auto space-y-12 py-8">
          
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Execução Imediata (Quick Wins)</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {quickWins.length > 0 ? (
                quickWins.map((idea, idx) => (
                  <ActionCard 
                    key={idea.id} 
                    idea={idea} 
                    groups={groups} 
                    rank={idx + 1} 
                    onUpdate={onUpdateIdea}
                    onMove={onMoveIdea}
                  />
                ))
              ) : (
                <div className="col-span-full p-8 border-2 border-dashed border-slate-200 rounded-[2rem] text-center text-slate-400 font-bold text-sm italic">
                  Nenhuma ideia classificada como Quick Win ainda.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Iniciativas Estratégicas</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {strategic.length > 0 ? (
                strategic.map((idea, idx) => (
                  <ActionCard 
                    key={idea.id} 
                    idea={idea} 
                    groups={groups} 
                    isStrategic 
                    onUpdate={onUpdateIdea}
                    onMove={onMoveIdea}
                  />
                ))
              ) : (
                <div className="col-span-full p-8 border-2 border-dashed border-slate-200 rounded-[2rem] text-center text-slate-400 font-bold text-sm italic">
                  Nenhuma iniciativa estratégica identificada.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Rank Total de Ideias</h3>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rank</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ideia</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Grupo</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Votos</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Valor/ROI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedIdeas.slice(0, 10).map((idea, idx) => (
                      <tr key={idea.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-black text-slate-300">#{idx + 1}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-700 max-w-md truncate">{idea.content}</td>
                        <td className="px-6 py-4">
                           {idea.groupId ? (
                             <Badge variant="outline" className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 border-amber-100">
                               {groups.find(g => g.id === idea.groupId)?.title || 'Geral'}
                             </Badge>
                           ) : <span className="text-[10px] text-slate-300 italic">Sem grupo</span>}
                        </td>
                        <td className="px-6 py-4 font-black text-xs text-orange-500">{idea.votes?.length || 0} 🔥</td>
                        <td className="px-6 py-4 font-black text-xs text-emerald-500">{idea.qualifiers?.roi || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

function ActionCard({ 
  idea, 
  groups, 
  rank, 
  isStrategic,
  onUpdate,
  onMove
}: { 
  idea: BrainstormingIdea, 
  groups: BrainstormingGroup[], 
  rank?: number, 
  isStrategic?: boolean,
  onUpdate: (id: string, content: string) => void,
  onMove: (id: string, groupId: string | null) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(idea.content);
  const group = groups.find(g => g.id === idea.groupId);

  const handleSave = () => {
    if (editedContent.trim() && editedContent !== idea.content) {
      onUpdate(idea.id, editedContent.trim());
    }
    setIsEditing(false);
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full"
    >
      <Card className="p-4 rounded-[1.5rem] border-none shadow-lg bg-white relative overflow-hidden group h-full flex flex-col">
        <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full -mr-8 -mt-8 group-hover:scale-110 transition-transform" />
        
        <div className="relative flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
             <div className="flex gap-2">
               {rank && (
                 <div className="text-[7px] font-black text-white bg-slate-900 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                   TOP {rank}
                 </div>
               )}
               {isStrategic && (
                 <div className="text-[7px] font-black text-white bg-indigo-500 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                   Estratégico
                 </div>
               )}
             </div>
             <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="flex-1 mb-4">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full text-[12px] font-bold text-slate-800 bg-slate-50 border-2 border-indigo-100 rounded-xl p-2 focus:ring-0 focus:border-indigo-400 outline-none resize-none min-h-[80px]"
                  autoFocus
                  onBlur={handleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                />
              </div>
            ) : (
              <div 
                onClick={() => setIsEditing(true)}
                className="cursor-pointer hover:bg-slate-50 rounded-xl p-1 -m-1 transition-colors"
              >
                <p className={cn(
                  "text-[12px] font-bold text-slate-800 leading-snug",
                  !isExpanded && "line-clamp-4"
                )}>
                  {idea.content}
                </p>
              </div>
            )}
            
            {idea.content.length > 100 && !isEditing && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 mt-2 flex items-center gap-1"
              >
                {isExpanded ? 'Ver menos' : 'Ver tudo'}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50 shrink-0">
             <div className="relative group/group">
               <select
                 value={idea.groupId || ''}
                 onChange={(e) => onMove(idea.id, e.target.value || null)}
                 className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
               >
                 <option value="">Geral</option>
                 {groups.map(g => (
                   <option key={g.id} value={g.id}>{g.title}</option>
                 ))}
               </select>
               <div className="flex items-center gap-1.5 pointer-events-none">
                 <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: group?.color || '#cbd5e1' }} />
                 <span className="text-[8px] font-black text-slate-400 uppercase truncate max-w-[80px]">
                   {group?.title || 'Geral'}
                 </span>
               </div>
             </div>
             <div className="flex items-center gap-1 font-black text-[9px] text-amber-500 px-1.5 py-0.5 bg-amber-50 rounded-md">
                <TrendingUp className="h-2.5 w-2.5" />
                {idea.votes?.length || 0}
             </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
