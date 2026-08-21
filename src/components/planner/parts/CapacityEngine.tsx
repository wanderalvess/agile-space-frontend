'use client';

import React from 'react';
import { 
  CalendarDays, 
  Trash2, 
  Plus,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TeamMember {
  id: string;
  name: string;
  role: 'dev' | 'qa';
  focusFactor: number;
  daysOff: number;
  hoursPerDay: number;
}

interface CapacityEngineProps {
  isDetailedMode: boolean;
  setIsDetailedMode: (val: boolean) => void;
  workingDays: number;
  setWorkingDays: (val: number) => void;
  focusFactor: number;
  setFocusFactor: (val: number) => void;
  devCount: number;
  setDevCount: (val: number) => void;
  devAbsences: number;
  setDevAbsences: (val: number) => void;
  qaCount: number;
  setQaCount: (val: number) => void;
  qaAbsences: number;
  setQaAbsences: (val: number) => void;
  sprintMembers: TeamMember[];
  onUpdateMember: (id: string, field: keyof TeamMember, value: any) => void;
  onAddMember: () => void;
  onRemoveMember: (id: string) => void;
  onImportRoster?: () => void;
  isReadOnly?: boolean;
}

export function CapacityEngine({
  isDetailedMode,
  setIsDetailedMode,
  workingDays,
  setWorkingDays,
  focusFactor,
  setFocusFactor,
  devCount,
  setDevCount,
  devAbsences,
  setDevAbsences,
  qaCount,
  setQaCount,
  qaAbsences,
  setQaAbsences,
  sprintMembers,
  onUpdateMember,
  onAddMember,
  onRemoveMember,
  isReadOnly = false,
}: CapacityEngineProps) {
  return (
    <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-auto lg:h-full lg:overflow-hidden space-y-4">
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-[1.5rem] border border-slate-200/50 dark:border-slate-800 shadow-inner">
        <button 
          className={cn(
            "flex-1 py-2 px-3 rounded-2xl text-[10px] font-black transition-all disabled:opacity-50 uppercase tracking-widest", 
            !isDetailedMode ? "bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
          onClick={() => setIsDetailedMode(false)}
          disabled={isReadOnly}
        >
          Simples
        </button>
        <button 
          className={cn(
            "flex-1 py-2 px-3 rounded-2xl text-[10px] font-black transition-all disabled:opacity-50 uppercase tracking-widest", 
            isDetailedMode ? "bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
          onClick={() => setIsDetailedMode(true)}
          disabled={isReadOnly}
        >
          Por Pessoa
        </button>
      </div>

      <Card className="border border-white/60 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-2xl shadow-violet-500/5 rounded-[3rem] overflow-hidden flex flex-col h-auto lg:h-full">
        <CardHeader className="pb-4 pt-6 px-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/30">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-tighter text-slate-800 dark:text-slate-100">Capacidade</CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Configuração da Squad</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-2 space-y-6 flex-1">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 flex items-center gap-2">
               DIAS ÚTEIS
            </label>
            <Input 
              type="number" 
              value={workingDays} 
              onChange={e => setWorkingDays(Number(e.target.value))}
              className="h-12 border-2 border-slate-100 dark:border-slate-800 focus:border-violet-500 rounded-2xl font-black text-xl text-center bg-white/50 dark:bg-slate-900/50 dark:text-slate-100 transition-all focus:ring-4 focus:ring-violet-500/10"
              disabled={isReadOnly}
              min={1}
            />
          </div>

          {!isDetailedMode && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 flex items-center gap-2">
                 FOCUS FACTOR %
              </label>
              <Input 
                type="number" 
                value={focusFactor} 
                onChange={e => setFocusFactor(Number(e.target.value))}
                className="h-12 border-2 border-slate-100 dark:border-slate-800 focus:border-violet-500 rounded-2xl font-black text-xl text-center bg-white/50 dark:bg-slate-900/50 dark:text-slate-100 transition-all focus:ring-4 focus:ring-violet-500/10"
                disabled={isReadOnly}
                min={1}
                max={100}
              />
            </div>
          )}

          {isDetailedMode ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">MEMBROS ({sprintMembers.length})</label>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {sprintMembers.map(member => (
                   <div key={member.id} className="p-5 rounded-[2rem] border border-white/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 shadow-sm group hover:border-violet-200 dark:hover:border-violet-800 transition-all space-y-4 relative overflow-hidden">
                      {/* Sub-card glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                     <div className="flex items-center gap-2">
                        <Input 
                          value={member.name}
                          onChange={e => onUpdateMember(member.id, 'name', e.target.value)}
                          placeholder="Nome..."
                          className="h-9 flex-1 bg-slate-50 dark:bg-slate-950/60 border-none rounded-xl text-xs font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650"
                          disabled={isReadOnly}
                        />
                        <button
                          onClick={() => onUpdateMember(member.id, 'role', member.role === 'dev' ? 'qa' : 'dev')}
                          className={cn(
                            "h-9 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm shrink-0",
                            member.role === 'dev' ? "bg-violet-600 text-white" : "bg-fuchsia-600 text-white"
                          )}
                          disabled={isReadOnly}
                        >
                          {member.role}
                        </button>
                        {!isReadOnly && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-slate-300 dark:text-slate-650 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl"
                            onClick={() => onRemoveMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Foco %</span>
                          <input 
                            type="number"
                            value={member.focusFactor}
                            onChange={e => onUpdateMember(member.id, 'focusFactor', Number(e.target.value))}
                            className="w-full h-8 text-center text-[10px] font-black bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 rounded-lg outline-none"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">H/Dia</span>
                          <input 
                            type="number"
                            value={member.hoursPerDay}
                            onChange={e => onUpdateMember(member.id, 'hoursPerDay', Number(e.target.value))}
                            className="w-full h-8 text-center text-[10px] font-black bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 rounded-lg outline-none"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Off</span>
                          <input 
                            type="number"
                            value={member.daysOff}
                            onChange={e => onUpdateMember(member.id, 'daysOff', Number(e.target.value))}
                            className="w-full h-8 text-center text-[10px] font-black bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 rounded-lg outline-none"
                            disabled={isReadOnly}
                          />
                        </div>
                     </div>
                  </div>
                ))}
                {!isReadOnly && (
                  <div className="flex flex-col gap-2">
                    {onImportRoster && (
                      <Button
                        variant="outline"
                        className="w-full h-10 rounded-[1.2rem] border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-100 transition-all gap-1.5"
                        onClick={onImportRoster}
                      >
                        <Users className="h-3.5 w-3.5" /> Carregar Integrantes do Time
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="w-full h-10 rounded-[1.2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-black uppercase text-[10px] tracking-widest hover:border-violet-200 dark:hover:border-violet-850 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 hover:text-violet-600 dark:hover:text-violet-400 transition-all gap-2"
                      onClick={onAddMember}
                    >
                      <Plus className="h-4 w-4" /> Adicionar Membro
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">TIME DEV</label>
                  <Input 
                    type="number" 
                    value={devCount} 
                    onChange={e => setDevCount(Number(e.target.value))}
                    className="h-12 border-2 border-slate-100 dark:border-slate-800 focus:border-violet-500 rounded-2xl font-black text-xl text-center bg-white/50 dark:bg-slate-900/50 dark:text-slate-100 focus:ring-4 focus:ring-violet-500/10"
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-600">TIME QA</label>
                  <Input 
                    type="number" 
                    value={qaCount} 
                    onChange={e => setQaCount(Number(e.target.value))}
                    className="h-12 border-2 border-slate-100 dark:border-slate-800 focus:border-fuchsia-500 rounded-2xl font-black text-xl text-center bg-white/50 dark:bg-slate-900/50 dark:text-slate-100 focus:ring-4 focus:ring-fuchsia-500/10"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">DEV OFF (DIAS)</label>
                  <Input 
                    type="number" 
                    value={devAbsences} 
                    onChange={e => setDevAbsences(Number(e.target.value))}
                    className="h-12 border-2 border-slate-100 dark:border-slate-800 focus:border-violet-300 rounded-2xl font-black text-xl text-center bg-white/50 dark:bg-slate-900/50 dark:text-slate-100"
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-400">QA OFF (DIAS)</label>
                  <Input 
                    type="number" 
                    value={qaAbsences} 
                    onChange={e => setQaAbsences(Number(e.target.value))}
                    className="h-12 border-2 border-slate-100 dark:border-slate-800 focus:border-fuchsia-300 rounded-2xl font-black text-xl text-center bg-white/50 dark:bg-slate-900/50 dark:text-slate-100"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
