'use client';

import React, { useState, useEffect } from 'react';
import { pokerApi } from '../../app/room/api';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  Calendar, 
  CheckCircle2, 
  Search,
  Package,
  History
} from 'lucide-react';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { Room } from '@/lib/types';

interface PokerSessionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (room: Room) => void;
  importedIds: string[];
}

export function PokerSessionPicker({ isOpen, onClose, onSelect, importedIds }: PokerSessionPickerProps) {
  const [sessions, setSessions] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const allRooms = await pokerApi.listRooms();
      const finishedRooms = allRooms
        .filter(r => r.sessionEndedAt)
        .sort((a, b) => (b.sessionEndedAt || '').localeCompare(a.sessionEndedAt || ''));
      setSessions(finishedRooms);
    } catch (error) {
      console.error("Error fetching poker sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.team?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[600px] border-none shadow-2xl bg-card/95 backdrop-blur-xl rounded-[2rem] p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 bg-primary/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Sessões de Refinamento</DialogTitle>
              <DialogDescription className="font-medium">
                Selecione uma sessão concluída para importar as tarefas estimadas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-8 py-4">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar por título ou time..."
              className="w-full h-11 pl-10 pr-4 bg-muted/50 border-2 border-transparent focus:border-primary/20 focus:bg-background rounded-xl text-sm transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <ScrollArea className="h-[350px] pr-4">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-70">
                <AgileSpinner size="lg" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] ml-[0.4em] animate-pulse text-slate-400">Carregando Histórico...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30 py-10">
                <History className="h-12 w-12" />
                <p className="text-sm font-bold uppercase tracking-tight">Nenhuma sessão encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => {
                  const isImported = importedIds.includes(session.id);
                  const completedIssues = session.issuesQueue?.filter(i => i.status === 'completed' && !i.skipped).length || 0;

                  return (
                    <div 
                      key={session.id}
                      onClick={() => !isImported && onSelect(session)}
                      className={cn(
                        "group p-4 rounded-2xl border-2 border-border/50 bg-background/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer relative overflow-hidden",
                        isImported && "opacity-60 cursor-not-allowed grayscale-[0.5]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-black text-sm text-foreground truncate uppercase tracking-tight">
                              {session.title || 'Sessão sem título'}
                            </h4>
                            {isImported && (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none text-[9px] uppercase font-black tracking-widest px-2 group-hover:bg-emerald-500/20">
                                Já Importado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(session.sessionEndedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {completedIssues} Tarefas Estimadas
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 pt-1">
                           <div className="h-8 w-8 rounded-full border-2 border-border flex items-center justify-center group-hover:border-primary/50 group-hover:bg-primary group-hover:text-white transition-all">
                              <CheckCircle2 className="h-4 w-4" />
                           </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="p-6 bg-muted/20 border-t flex sm:justify-center">
           <Button variant="ghost" onClick={onClose} className="font-bold uppercase tracking-widest text-[10px]">
              Fechar Galeria
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
