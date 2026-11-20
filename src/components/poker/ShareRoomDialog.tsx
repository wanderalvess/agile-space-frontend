'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Share2, Copy, Check, MapPin, Calendar, ListTodo } from 'lucide-react';
import type { Issue } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FIELD, Modal, ModalButton, RoomQr, TabBar } from '@/components/room-kit';

interface ShareRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomTitle?: string;
  issues: Issue[];
}

type ShareTab = 'link' | 'invite';

const META_KEY = (roomId: string) => `agileSpace_share_meta_${roomId}`;

export function ShareRoomDialog({
  isOpen,
  onClose,
  roomId,
  roomTitle,
  issues = [],
}: ShareRoomDialogProps) {
  const { toast } = useToast();
  const [copiedType, setCopiedType] = useState<'full' | 'link' | null>(null);
  const [activeTab, setActiveTab] = useState<ShareTab>('link');

  // Saudação do convite
  const [greeting, setGreeting] = useState(
    'Bom dia pessoal, segue abaixo informações do nosso refinamento:'
  );

  // Salas físicas / local (opcional)
  const [physicalRooms, setPhysicalRooms] = useState('');
  const [includeRooms, setIncludeRooms] = useState(true);

  // Reserva / horário (opcional)
  const [reservationTime, setReservationTime] = useState('');
  const [includeReservation, setIncludeReservation] = useState(true);

  // Issues selecionadas
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [includeIssues, setIncludeIssues] = useState(true);

  const roomUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/room/${roomId}`;
    }
    return `https://espacoagil.com.br/room/${roomId}`;
  }, [roomId]);


  // Preferências salvas desta sala
  useEffect(() => {
    if (!roomId) return;
    try {
      const saved = localStorage.getItem(META_KEY(roomId));
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

  const persistMeta = (patch: Record<string, string>) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(META_KEY(roomId)) || '{}');
      localStorage.setItem(META_KEY(roomId), JSON.stringify({ ...parsed, ...patch }));
    } catch { /* storage indisponível: segue sem persistir */ }
  };

  const handlePhysicalRoomsChange = (val: string) => { setPhysicalRooms(val); persistMeta({ physicalRooms: val }); };
  const handleReservationTimeChange = (val: string) => { setReservationTime(val); persistMeta({ reservationTime: val }); };
  const handleGreetingChange = (val: string) => { setGreeting(val); persistMeta({ greeting: val }); };

  // Reseleciona tudo ao abrir ou quando a fila muda
  useEffect(() => {
    if (isOpen && issues.length > 0) {
      setSelectedIssueIds(issues.map((i) => i.id));
    }
  }, [isOpen, issues]);

  // Issue no convite: link do Jira, senão a chave, senão a chave achada no título, senão o título.
  const getIssueExportString = (issue: Issue): string => {
    if (issue.jiraLink && issue.jiraLink.trim().length > 0) return issue.jiraLink.trim();
    if (issue.key && issue.key.trim().length > 0) return issue.key.trim();
    const match = issue.title.match(/([A-Za-z0-9]+-\d+)/);
    if (match) return match[1];
    return issue.title.trim();
  };

  const formattedMessage = useMemo(() => {
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
  }, [greeting, roomUrl, includeRooms, physicalRooms, includeReservation, reservationTime, includeIssues, selectedIssueIds, issues]);

  const copy = async (text: string, kind: 'full' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(kind);
      toast({
        title: kind === 'link' ? 'Link copiado' : 'Convite copiado',
        description: kind === 'link' ? 'Link da sala na área de transferência.' : 'Texto do convite na área de transferência.',
      });
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'Selecione o texto e copie manualmente.', variant: 'destructive' });
    }
  };

  const toggleSelectAllIssues = () => {
    setSelectedIssueIds(selectedIssueIds.length === issues.length ? [] : issues.map((i) => i.id));
  };

  const toggleIssue = (id: string) => {
    setSelectedIssueIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const copyLabel = (kind: 'full' | 'link', idle: string) =>
    copiedType === kind ? (
      <><Check className="h-4 w-4" strokeWidth={1.75} /> Copiado</>
    ) : (
      <><Copy className="h-4 w-4" strokeWidth={1.5} /> {idle}</>
    );

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size={activeTab === 'invite' ? 'lg' : 'md'}
      icon={Share2}
      title="Compartilhar sala"
      description={roomTitle ? `${roomTitle} · quem tiver o link entra direto na mesa.` : 'Quem tiver o link entra direto na mesa.'}
      headerExtra={
        <TabBar
          label="Formato de compartilhamento"
          idPrefix="share"
          value={activeTab}
          onChange={setActiveTab}
          tabs={[{ id: 'link', label: 'Link' }, { id: 'invite', label: 'Convite em texto' }]}
        />
      }
      bodyClassName="pt-5"
      footer={
        <>
          <ModalButton onClick={onClose}>Fechar</ModalButton>
          {activeTab === 'link' ? (
            <ModalButton variant="primary" className="gap-2" onClick={() => copy(roomUrl, 'link')}>{copyLabel('link', 'Copiar link')}</ModalButton>
          ) : (
            <ModalButton variant="primary" className="gap-2" onClick={() => copy(formattedMessage, 'full')}>{copyLabel('full', 'Copiar convite')}</ModalButton>
          )}
        </>
      }
      footerStart={
        activeTab === 'invite' ? (
          <ModalButton variant="ghost" className="gap-2" onClick={() => copy(roomUrl, 'link')}>{copyLabel('link', 'Só o link')}</ModalButton>
        ) : undefined
      }
    >
      {activeTab === 'link' ? (
        <div role="tabpanel" id="share-panel-link" aria-labelledby="share-tab-link" className="flex flex-col items-center gap-5 sm:flex-row">
          <RoomQr url={roomUrl} size={132} />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 self-stretch">
            <label htmlFor="share-link" className="text-[13px] font-semibold">Link da sala</label>
            <input id="share-link" readOnly value={roomUrl} onFocus={(e) => e.currentTarget.select()} className={cn(FIELD, 'h-10 text-xs tabular-nums')} />
          </div>
        </div>
      ) : (
        <div role="tabpanel" id="share-panel-invite" aria-labelledby="share-tab-invite" className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="share-greeting" className="text-[13px] font-semibold">Saudação</label>
              <input
                id="share-greeting"
                value={greeting}
                onChange={(e) => handleGreetingChange(e.target.value)}
                placeholder="Bom dia pessoal, segue abaixo…"
                className={cn(FIELD, 'h-10')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="share-rooms" className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Salas
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={includeRooms} onCheckedChange={(c) => setIncludeRooms(!!c)} aria-label="Incluir salas no convite" /> Incluir
                </label>
              </div>
              <textarea
                id="share-rooms"
                value={physicalRooms}
                onChange={(e) => handlePhysicalRoomsChange(e.target.value)}
                disabled={!includeRooms}
                rows={2}
                placeholder={'Caldas Novas\nGoiânia, 11º andar'}
                className={cn(FIELD, 'min-h-[56px] resize-none py-2')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="share-when" className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Reserva e horário
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={includeReservation} onCheckedChange={(c) => setIncludeReservation(!!c)} aria-label="Incluir reserva no convite" /> Incluir
                </label>
              </div>
              <input
                id="share-when"
                value={reservationTime}
                onChange={(e) => handleReservationTimeChange(e.target.value)}
                disabled={!includeReservation}
                placeholder="qui, 30/07/2026 · 14:30 às 16:00"
                className={cn(FIELD, 'h-10')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <ListTodo className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Issues da fila
                  <span className="font-normal tabular-nums text-muted-foreground">({issues.length})</span>
                </span>
                {issues.length > 0 && (
                  <span className="flex items-center gap-3">
                    <button type="button" onClick={toggleSelectAllIssues} className="text-xs font-semibold text-primary hover:underline [.theme-totvs:not(.dark)_&]:text-foreground">
                      {selectedIssueIds.length === issues.length ? 'Desmarcar todas' : 'Marcar todas'}
                    </button>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox checked={includeIssues} onCheckedChange={(c) => setIncludeIssues(!!c)} aria-label="Incluir issues no convite" /> Incluir
                    </label>
                  </span>
                )}
              </div>
              {issues.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border p-3 text-xs text-muted-foreground">Nenhuma issue na fila desta sala.</p>
              ) : (
                <ul className="m-0 flex max-h-40 list-none flex-col gap-1 overflow-y-auto rounded-[10px] border border-border p-1.5">
                  {issues.map((issue) => {
                    const isSelected = selectedIssueIds.includes(issue.id);
                    return (
                      <li key={issue.id}>
                        <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-fast', isSelected ? 'bg-primary/10' : 'hover:bg-accent/50')}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleIssue(issue.id)} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate font-medium">{issue.title}</span>
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-code text-xs text-muted-foreground">
                            {issue.jiraLink ? 'Link Jira' : (issue.key || 'Título')}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="share-preview" className="text-[13px] font-semibold">Convite</label>
            <textarea
              id="share-preview"
              readOnly
              value={formattedMessage}
              className={cn(FIELD, 'min-h-[260px] flex-1 resize-none py-2.5 font-code text-xs leading-relaxed')}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
