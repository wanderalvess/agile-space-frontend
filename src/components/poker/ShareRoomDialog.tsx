'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Share2,
  Copy,
  CheckCircle2,
  MapPin,
  Calendar,
  ListTodo,
  Link2,
  FileText,
} from 'lucide-react';
import type { Issue } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ShareRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomTitle?: string;
  issues: Issue[];
}

export function ShareRoomDialog({
  isOpen,
  onClose,
  roomId,
  roomTitle,
  issues = [],
}: ShareRoomDialogProps) {
  const { toast } = useToast();
  const [copiedType, setCopiedType] = useState<'full' | 'link' | null>(null);

  // Tab mode: 'template' | 'link_only'
  const [activeTab, setActiveTab] = useState<'template' | 'link_only'>('template');

  // Greeting header
  const [greeting, setGreeting] = useState(
    'Bom dia pessoal, segue abaixo informações do nosso refinamento:'
  );

  // Physical rooms / location (optional)
  const [physicalRooms, setPhysicalRooms] = useState('');
  const [includeRooms, setIncludeRooms] = useState(true);

  // Reservation time / date (optional)
  const [reservationTime, setReservationTime] = useState('');
  const [includeReservation, setIncludeReservation] = useState(true);

  // Selected issue IDs
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [includeIssues, setIncludeIssues] = useState(true);

  // Room URL
  const roomUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/room/${roomId}`;
    }
    return `https://espacoagil.com.br/room/${roomId}`;
  }, [roomId]);

  // Load saved preferences for this room from localStorage
  useEffect(() => {
    if (!roomId) return;
    try {
      const saved = localStorage.getItem(`agileSpace_share_meta_${roomId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.greeting !== undefined) setGreeting(parsed.greeting);
        if (parsed.physicalRooms !== undefined) setPhysicalRooms(parsed.physicalRooms);
        if (parsed.reservationTime !== undefined) setReservationTime(parsed.reservationTime);
      }
    } catch (err) {
      console.error('Erro ao carregar preferências de compartilhamento:', err);
    }
  }, [roomId]);

  // Save inputs to localStorage on change
  const handlePhysicalRoomsChange = (val: string) => {
    setPhysicalRooms(val);
    try {
      const saved = localStorage.getItem(`agileSpace_share_meta_${roomId}`) || '{}';
      const parsed = JSON.parse(saved);
      localStorage.setItem(
        `agileSpace_share_meta_${roomId}`,
        JSON.stringify({ ...parsed, physicalRooms: val })
      );
    } catch (e) {}
  };

  const handleReservationTimeChange = (val: string) => {
    setReservationTime(val);
    try {
      const saved = localStorage.getItem(`agileSpace_share_meta_${roomId}`) || '{}';
      const parsed = JSON.parse(saved);
      localStorage.setItem(
        `agileSpace_share_meta_${roomId}`,
        JSON.stringify({ ...parsed, reservationTime: val })
      );
    } catch (e) {}
  };

  const handleGreetingChange = (val: string) => {
    setGreeting(val);
    try {
      const saved = localStorage.getItem(`agileSpace_share_meta_${roomId}`) || '{}';
      const parsed = JSON.parse(saved);
      localStorage.setItem(
        `agileSpace_share_meta_${roomId}`,
        JSON.stringify({ ...parsed, greeting: val })
      );
    } catch (e) {}
  };

  // Sync selected issues when issues prop changes or dialog opens
  useEffect(() => {
    if (isOpen && issues.length > 0) {
      setSelectedIssueIds(issues.map((i) => i.id));
    }
  }, [isOpen, issues]);

  // Format single issue for export:
  // If jiraLink exists -> export link
  // Else if key exists -> export key
  // Else -> export key from title or title
  const getIssueExportString = (issue: Issue): string => {
    if (issue.jiraLink && issue.jiraLink.trim().length > 0) {
      return issue.jiraLink.trim();
    }
    if (issue.key && issue.key.trim().length > 0) {
      return issue.key.trim();
    }
    const match = issue.title.match(/([A-Za-z0-9]+-\d+)/);
    if (match) {
      return match[1];
    }
    return issue.title.trim();
  };

  // Build the complete message text
  const formattedMessage = useMemo(() => {
    if (activeTab === 'link_only') {
      return roomUrl;
    }

    const parts: string[] = [];

    if (greeting.trim()) {
      parts.push(greeting.trim());
      parts.push('');
    }

    parts.push(`Link: ${roomUrl}`);

    if (includeRooms && physicalRooms.trim()) {
      parts.push('');
      parts.push(`Salas: ${physicalRooms.trim()}`);
    }

    if (includeReservation && reservationTime.trim()) {
      parts.push('');
      parts.push(`Reserva para: ${reservationTime.trim()}`);
    }

    if (includeIssues && selectedIssueIds.length > 0) {
      const selectedIssues = issues.filter((i) => selectedIssueIds.includes(i.id));
      if (selectedIssues.length > 0) {
        parts.push('');
        parts.push('Issues que poderão ser refinadas:');
        selectedIssues.forEach((issue) => {
          parts.push(getIssueExportString(issue));
        });
      }
    }

    return parts.join('\n').trim();
  }, [
    activeTab,
    greeting,
    roomUrl,
    includeRooms,
    physicalRooms,
    includeReservation,
    reservationTime,
    includeIssues,
    selectedIssueIds,
    issues,
  ]);

  const handleCopyFull = async () => {
    try {
      await navigator.clipboard.writeText(formattedMessage);
      setCopiedType('full');
      toast({
        title: 'Modelo Copiado!',
        description: 'O texto de refinamento foi copiado para a área de transferência.',
      });
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o texto.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLinkOnly = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopiedType('link');
      toast({
        title: 'Link Copiado!',
        description: 'Link da sala copiado para a área de transferência.',
      });
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o link.',
        variant: 'destructive',
      });
    }
  };

  const toggleSelectAllIssues = () => {
    if (selectedIssueIds.length === issues.length) {
      setSelectedIssueIds([]);
    } else {
      setSelectedIssueIds(issues.map((i) => i.id));
    }
  };

  const toggleIssue = (id: string) => {
    setSelectedIssueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Share2 className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-foreground truncate">
                Compartilhar Sala de Refinamento
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-500 dark:text-muted-foreground truncate">
                Exporte o link da sala e o modelo de texto com as informações da sessão.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1 mt-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all min-w-0',
              activeTab === 'template'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">Modelo com Issues</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link_only')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all min-w-0',
              activeTab === 'link_only'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <Link2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Apenas Link</span>
          </button>
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 my-2 overflow-x-hidden">
          {activeTab === 'template' ? (
            <div className="space-y-4">
              {/* Form Controls Card */}
              <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-3.5 sm:p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                {/* Greeting */}
                <div>
                  <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Saudação / Mensagem Inicial
                  </Label>
                  <Input
                    value={greeting}
                    onChange={(e) => handleGreetingChange(e.target.value)}
                    placeholder="Ex: Bom dia pessoal, segue abaixo informações do nosso refinamento:"
                    className="mt-1 text-xs sm:text-sm h-9 sm:h-10 w-full"
                  />
                </div>

                {/* Physical Rooms & Reservation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {/* Physical Rooms */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>Salas (Opcional)</span>
                      </Label>
                      <div className="flex items-center gap-1 shrink-0">
                        <Checkbox
                          id="inc-rooms"
                          checked={includeRooms}
                          onCheckedChange={(c) => setIncludeRooms(!!c)}
                        />
                        <label htmlFor="inc-rooms" className="text-[11px] text-slate-500 cursor-pointer">
                          Incluir
                        </label>
                      </div>
                    </div>
                    <Textarea
                      value={physicalRooms}
                      onChange={(e) => handlePhysicalRoomsChange(e.target.value)}
                      disabled={!includeRooms}
                      placeholder="Ex: Caldas Novas&#10;Goiânia › 11º Andar"
                      className="text-xs sm:text-sm min-h-[56px] resize-none w-full"
                    />
                  </div>

                  {/* Reservation */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>Reserva / Horário (Opcional)</span>
                      </Label>
                      <div className="flex items-center gap-1 shrink-0">
                        <Checkbox
                          id="inc-res"
                          checked={includeReservation}
                          onCheckedChange={(c) => setIncludeReservation(!!c)}
                        />
                        <label htmlFor="inc-res" className="text-[11px] text-slate-500 cursor-pointer">
                          Incluir
                        </label>
                      </div>
                    </div>
                    <Input
                      value={reservationTime}
                      onChange={(e) => handleReservationTimeChange(e.target.value)}
                      disabled={!includeReservation}
                      placeholder="Ex: qui, 30/07/2026 - 14:30 às 16:00"
                      className="text-xs sm:text-sm h-9 sm:h-10 w-full"
                    />
                  </div>
                </div>

                {/* Issues Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ListTodo className="h-4 w-4 text-indigo-500 shrink-0" />
                      <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                        Issues da Fila ({issues.length})
                      </Label>
                    </div>
                    {issues.length > 0 && (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={toggleSelectAllIssues}
                          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {selectedIssueIds.length === issues.length ? 'Desmarcar todas' : 'Marcar todas'}
                        </button>
                        <div className="flex items-center gap-1">
                          <Checkbox
                            id="inc-issues"
                            checked={includeIssues}
                            onCheckedChange={(c) => setIncludeIssues(!!c)}
                          />
                          <label htmlFor="inc-issues" className="text-[11px] text-slate-500 cursor-pointer">
                            Incluir seção
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {issues.length === 0 ? (
                    <p className="text-xs italic text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-lg border">
                      Nenhuma issue cadastrada na fila desta sala.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-lg border">
                      {issues.map((issue) => {
                        const isSelected = selectedIssueIds.includes(issue.id);
                        return (
                          <div
                            key={issue.id}
                            onClick={() => toggleIssue(issue.id)}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-md text-xs sm:text-sm cursor-pointer transition-colors gap-2',
                              isSelected
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleIssue(issue.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0"
                              />
                              <span className="font-medium text-xs sm:text-sm truncate">
                                {issue.title}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-semibold">
                              {issue.jiraLink ? 'Link Jira' : (issue.key || 'Número/Título')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Live Preview Box */}
              <div>
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1.5">
                  <span>Pré-visualização do Texto</span>
                  <span className="text-[11px] text-slate-400 font-normal">Pronto para copiar</span>
                </Label>
                <pre className="p-3.5 sm:p-4 bg-slate-900 text-slate-100 font-mono text-xs sm:text-sm rounded-xl overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words max-h-40 sm:max-h-52 border border-slate-800 shadow-inner">
                  {formattedMessage}
                </pre>
              </div>
            </div>
          ) : (
            /* Link Only View */
            <div className="space-y-4 py-2">
              <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border space-y-3">
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Link da Sala
                </Label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input value={roomUrl} readOnly className="font-mono text-xs sm:text-sm bg-white dark:bg-slate-900 flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLinkOnly}
                    className="shrink-0 font-bold text-xs sm:text-sm gap-1.5 h-10"
                  >
                    {copiedType === 'link' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar Link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLinkOnly}
            className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 gap-1.5 w-full sm:w-auto justify-center"
          >
            <Link2 className="h-4 w-4" />
            Copiar Apenas Link
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs sm:text-sm font-semibold flex-1 sm:flex-none"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleCopyFull}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-indigo-600/20 flex-1 sm:flex-none justify-center h-9 sm:h-10"
            >
              {copiedType === 'full' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  Modelo Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar Texto Formatado
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
