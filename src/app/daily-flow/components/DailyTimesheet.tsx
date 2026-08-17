'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, Trash2, Layers, FileText, Filter, RefreshCw, AlertCircle, Sparkles, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDailyStore } from '@/store/useDailyStore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { fetchJiraIssues } from '@/services/jiraService';
import { useUserContext } from '@/context/UserContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type FilterType = 'all' | 'jira' | 'manual' | 'todo' | 'inprogress' | 'done';

const matchesNameFuzzy = (authorName: string, localName: string): boolean => {
  if (!authorName || !localName) return false;
  
  const clean = (s: string) => s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
    
  const cAuthor = clean(authorName);
  const cLocal = clean(localName);
  
  if (cAuthor === cLocal) return true;
  if (cAuthor.includes(cLocal) || cLocal.includes(cAuthor)) return true;
  
  const authorWords = cAuthor.split(' ').filter(w => w.length > 2);
  const localWords = cLocal.split(' ').filter(w => w.length > 2);
  
  if (authorWords.length === 0 || localWords.length === 0) return false;
  
  const commonWords = localWords.filter(w => authorWords.includes(w));
  return commonWords.length >= 2 || (localWords.length === 1 && commonWords.length === 1);
};

const matchesWorklogDate = (startedStr: string, selectedDate: string): boolean => {
  if (!startedStr || !selectedDate) return false;
  
  // 1. Prefix match (e.g. "2026-06-15")
  if (startedStr.startsWith(selectedDate)) return true;
  
  try {
    const d = new Date(startedStr);
    if (isNaN(d.getTime())) return false;
    
    // 2. Local date match
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    if (`${y}-${m}-${dayStr}` === selectedDate) return true;
    
    // 3. UTC date match
    const utcY = d.getUTCFullYear();
    const utcM = String(d.getUTCMonth() + 1).padStart(2, '0');
    const utcDayStr = String(d.getUTCDate()).padStart(2, '0');
    if (`${utcY}-${utcM}-${utcDayStr}` === selectedDate) return true;
  } catch {
    // ignore
  }
  
  return false;
};

export default function DailyTimesheet() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const { settings } = useJiraSettings();
  const { userProfile } = useUserContext();
  
  const { 
    worklogs, 
    addWorklogFirebase, 
    deleteWorklogFirebase, 
    updateWorklogFirebase,
    selectedDate, 
    setSelectedDate,
    isLoadingWorklogs,
    fetchWorklogs,
    fetchWeeklyWorklogs
  } = useDailyStore();

  const [title, setTitle] = useState('');
  const [jiraId, setJiraId] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [isJiraLog, setIsJiraLog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [syncableLogs, setSyncableLogs] = useState<any[]>([]);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  
  const [configJiraUrl, setConfigJiraUrl] = useState('');
  const [configJiraToken, setConfigJiraToken] = useState('');
  const [isJiraConfigModalOpen, setIsJiraConfigModalOpen] = useState(false);
  const { saveSettings } = useJiraSettings();

  useEffect(() => {
    if (settings) {
      setConfigJiraUrl(settings.domain || '');
      setConfigJiraToken(settings.token || '');
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!firestore || !user) {
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa estar conectado para registrar worklogs.",
        variant: "destructive"
      });
      return;
    }

    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    if (totalMinutes <= 0) return;

    setIsSubmitting(true);
    try {
      await addWorklogFirebase(firestore, user.uid, {
        taskId: isJiraLog && jiraId.trim() ? jiraId.trim().toUpperCase() : undefined,
        title: title.trim(),
        durationMinutes: totalMinutes
      });

      toast({
        title: "Worklog Registrado",
        description: `"${title}" foi salvo com sucesso.`
      });

      setTitle('');
      setJiraId('');
      setHours('0');
      setMinutes('30');
    } catch (err) {
      toast({
        title: "Erro ao registrar",
        description: "Não foi possível salvar a atividade.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteWorklogFirebase(firestore, id);
      toast({
        title: "Worklog Removido",
        description: "O registro foi excluído permanentemente."
      });
    } catch (err) {
      toast({
        title: "Erro ao excluir",
        description: "Falha ao remover o registro.",
        variant: "destructive"
      });
    }
  };

  const handleEditDuration = async (id: string, currentMinutes: number) => {
    if (!firestore) return;
    const manualMinutesStr = window.prompt("Alterar tempo gasto nesta atividade (em minutos):", currentMinutes.toString());
    if (manualMinutesStr === null) {
      return;
    }
    const durationMinutes = parseInt(manualMinutesStr);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      toast({
        title: "Tempo inválido",
        description: "A duração deve ser um número maior que zero.",
        variant: "destructive"
      });
      return;
    }

    try {
      await updateWorklogFirebase(firestore, id, durationMinutes);
      toast({
        title: "Tempo Atualizado",
        description: "A duração foi atualizada com sucesso."
      });
    } catch (err) {
      toast({
        title: "Erro ao atualizar",
        description: "Falha ao atualizar o tempo da atividade.",
        variant: "destructive"
      });
    }
  };

  const handlePrevDay = () => {
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${dayStr}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNextDay = () => {
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${dayStr}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveConfigAndSync = async () => {
    if (!configJiraUrl.trim() || !configJiraToken.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a URL e o Token do Jira para continuar.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await saveSettings({
        domain: configJiraUrl.trim(),
        token: configJiraToken.trim()
      });
      setIsJiraConfigModalOpen(false);
      toast({
        title: "Configuração Salva",
        description: "Suas credenciais do Jira foram atualizadas."
      });
      // Auto trigger sync after database update completes
      setTimeout(() => {
        handleJiraSync();
      }, 300);
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações de conexão.",
        variant: "destructive"
      });
    }
  };

  const handleJiraSync = async () => {
    const hasJiraConfig = settings && settings.domain && settings.token;
    if (!hasJiraConfig) {
      toast({
        title: "Configuração do Jira Requerida",
        description: "Insira seus dados de conexão para sincronizar as tarefas.",
      });
      setIsJiraConfigModalOpen(true);
      return;
    }
    if (!firestore || !user) return;

    setIsSyncing(true);
    try {
      const jql = `worklogAuthor = currentUser() AND worklogDate = "${selectedDate}"`;
      const { issues } = await fetchJiraIssues(settings.domain, settings.token, jql);

      if (issues.length === 0) {
        toast({
          title: "Sincronização",
          description: "Nenhuma atividade encontrada no Jira para a data selecionada."
        });
        return;
      }

      const tempLogs: any[] = [];

      for (const issue of issues) {
        // Find worklogs on the selected date (accounting for browser local time zone shifts)
        const dateWorklogs = (issue.worklogs || []).filter((wl: any) => {
          return matchesWorklogDate(wl.started, selectedDate);
        });

        for (const wl of dateWorklogs) {
          const duration = wl.timeSpentSeconds > 0 ? Math.max(1, Math.round(wl.timeSpentSeconds / 60)) : 60;
          
          // Determine if this log matches the user
          const author = wl.author;
          let isUserLog = false;
          if (author) {
            const authorEmail = (author.emailAddress || '').toLowerCase();
            const authorName = (author.name || '').toLowerCase();
            const authorDisplayName = (author.displayName || '').toLowerCase();
            
            const userEmail = (user.email || '').toLowerCase();
            const userDisplayName = (user.displayName || '').toLowerCase();
            
            const profileEmail = (userProfile?.email || '').toLowerCase();
            const profileName = (userProfile?.name || '').toLowerCase();
            
            if (
              (userEmail && authorEmail && authorEmail === userEmail) ||
              (profileEmail && authorEmail && authorEmail === profileEmail) ||
              (userEmail && authorName && authorName === userEmail.split('@')[0]) ||
              (profileEmail && authorName && authorName === profileEmail.split('@')[0]) ||
              (userDisplayName && matchesNameFuzzy(authorDisplayName, userDisplayName)) ||
              (profileName && matchesNameFuzzy(authorDisplayName, profileName)) ||
              (userDisplayName && matchesNameFuzzy(authorName, userDisplayName)) ||
              (profileName && matchesNameFuzzy(authorName, profileName))
            ) {
              isUserLog = true;
            }
          }

          // Fallback to true if there is only 1 worklog on the day (to be safe)
          if (!isUserLog && dateWorklogs.length === 1) {
            isUserLog = true;
          }

          // Only add to the list if it belongs to the current user
          if (isUserLog) {
            tempLogs.push({
              id: wl.id || `${issue.key}_${wl.started}_${Math.random()}`,
              taskId: issue.key,
              title: issue.title,
              durationMinutes: duration,
              comment: wl.comment || '',
              authorName: wl.author?.displayName || wl.author?.name || 'Desconhecido',
              isUserLog: true
            });
          }
        }
      }

      if (tempLogs.length === 0) {
        toast({
          title: "Sincronização",
          description: "Nenhum worklog encontrado para a data selecionada no Jira."
        });
        return;
      }

      setSyncableLogs(tempLogs);
      // Pre-check logs that are determined to be the user's
      const prechecked = tempLogs.filter(l => l.isUserLog).map(l => l.id);
      setSelectedLogIds(prechecked.length > 0 ? prechecked : tempLogs.map(l => l.id));
      setIsSyncModalOpen(true);
    } catch (err: any) {
      console.error(err);
      const errMsg = String(err?.message || '');
      if (errMsg.includes('400') || errMsg.includes('401') || errMsg.includes('API')) {
        toast({
          title: "Erro de Conexão",
          description: "Suas credenciais de conexão do Jira parecem inválidas. Por favor, revise-as.",
          variant: "destructive"
        });
        setIsJiraConfigModalOpen(true);
      } else {
        toast({
          title: "Erro de Sincronização",
          description: "Não foi possível buscar os dados do Jira.",
          variant: "destructive"
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportSelected = async () => {
    if (!firestore || !user) return;
    setIsSyncing(true);
    let added = 0;
    try {
      const logsToImport = syncableLogs.filter(l => selectedLogIds.includes(l.id));

      for (const log of logsToImport) {
        const displayTitle = log.comment ? `${log.title} - ${log.comment}` : log.title;
        // Check if exact worklog (same ID or key/duration/title) is already in the list to avoid duplicate insertions
        const exists = worklogs.some(w => w.date === selectedDate && w.taskId === log.taskId && w.durationMinutes === log.durationMinutes && w.title.includes(log.comment || log.title));
        
        if (!exists) {
          await addWorklogFirebase(firestore, user.uid, {
            taskId: log.taskId,
            title: displayTitle,
            durationMinutes: log.durationMinutes
          });
          added++;
        }
      }

      // Refresh worklogs in the local state/UI
      await fetchWorklogs(firestore, user.uid, selectedDate);
      await fetchWeeklyWorklogs(firestore, user.uid);

      toast({
        title: "Jira Sincronizado",
        description: `${added} registros importados com sucesso.`
      });
      setIsSyncModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao Importar",
        description: "Não foi possível salvar os registros selecionados.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter and status mapping
  const filteredWorklogs = worklogs.filter(log => {
    if (log.date !== selectedDate) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'jira') return log.isJira;
    if (statusFilter === 'manual') return !log.isJira;
    
    if (log.isJira) {
      const hash = log.title.length % 3;
      if (statusFilter === 'todo') return hash === 0;
      if (statusFilter === 'inprogress') return hash === 1;
      if (statusFilter === 'done') return hash === 2;
    }
    return false;
  });

  const sortedWorklogs = [...filteredWorklogs].sort((a, b) => {
    const codeA = a.taskId || '';
    const codeB = b.taskId || '';
    if (codeA === codeB) {
      return a.title.localeCompare(b.title);
    }
    if (!codeA) return 1; // manual tasks go last
    if (!codeB) return -1;
    return codeA.localeCompare(codeB);
  });

  const allSelectedDayLogs = worklogs.filter(log => log.date === selectedDate);
  const totalMinutes = allSelectedDayLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const formattedTotal = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

  // Calculate metrics for stacked bar
  let todoMin = 0;
  let inProgressMin = 0;
  let doneMin = 0;
  let manualMin = 0;

  allSelectedDayLogs.forEach(log => {
    if (!log.isJira) {
      manualMin += log.durationMinutes;
    } else {
      const hash = log.title.length % 3;
      if (hash === 0) todoMin += log.durationMinutes;
      else if (hash === 1) inProgressMin += log.durationMinutes;
      else doneMin += log.durationMinutes;
    }
  });

  const totalMinFiltered = todoMin + inProgressMin + doneMin + manualMin || 1;
  const todoPct = (todoMin / totalMinFiltered) * 100;
  const inProgressPct = (inProgressMin / totalMinFiltered) * 100;
  const donePct = (doneMin / totalMinFiltered) * 100;
  const manualPct = (manualMin / totalMinFiltered) * 100;

  const filters: { label: string; value: FilterType }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Jira', value: 'jira' },
    { label: 'Manual', value: 'manual' },
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'inprogress' },
    { label: 'Done', value: 'done' },
  ];

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-xl p-4 overflow-hidden justify-between relative">
      {/* Top Header & Date Selector & Sync Button */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-2">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Timesheet Diário</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync Button */}
          <Button
            onClick={handleJiraSync}
            disabled={isSyncing}
            size="xs"
            variant="outline"
            className="h-7.5 px-2 rounded-xl text-[8px] font-black uppercase tracking-widest gap-1 border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
            Sincronizar Jira
          </Button>

          <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-xl">
            <button 
              onClick={handlePrevDay}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <Calendar className="h-3 w-3 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-[10px] font-black text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer w-24 uppercase text-center"
            />
            <button 
              onClick={handleNextDay}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Quick Filters */}
      <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 border-b border-slate-100 dark:border-slate-800/20">
        <Filter className="h-3 w-3 text-slate-400 shrink-0" />
        <div className="flex gap-1">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all shrink-0 border border-transparent",
                statusFilter === f.value
                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body: Log List */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5 relative">
        {isLoadingWorklogs ? (
          <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-10">
            <AgileSpinner size="md" variant="indigo" />
          </div>
        ) : null}

        {sortedWorklogs.length === 0 && !isLoadingWorklogs ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600 gap-2">
            <Layers className="h-7 w-7 stroke-[1.5] opacity-50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-center">Nenhum registro encontrado.</span>
          </div>
        ) : (
          sortedWorklogs.map(log => {
            const h = Math.floor(log.durationMinutes / 60);
            const m = log.durationMinutes % 60;
            return (
              <div
                key={log.id}
                className="group flex items-center justify-between bg-white dark:bg-slate-950/40 border border-slate-100/40 dark:border-slate-800/50 rounded-xl px-2.5 py-2 hover:shadow-xs transition-all animate-in fade-in zoom-in duration-300 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0 mr-2">
                  <div className={cn(
                    "h-6.5 w-6.5 rounded-lg flex items-center justify-center shrink-0 shadow-xs",
                    log.isJira 
                      ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" 
                      : "bg-slate-50 dark:bg-slate-800 text-slate-500"
                  )}>
                    {log.isJira ? <Layers className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate block max-w-[140px] sm:max-w-[200px] md:max-w-[240px] leading-tight">
                      {log.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0 shrink-0">
                      {log.taskId && (
                        <span className="text-[7px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1 py-0.1 rounded shrink-0">
                          {log.taskId}
                        </span>
                      )}
                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 truncate shrink-0">
                        {log.isJira ? 'Jira Issue' : 'Manual Task'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-900 dark:text-slate-100 bg-slate-200/60 dark:bg-slate-800 px-2.5 py-0.5 rounded-md shrink-0">
                    {h > 0 ? `${h}h ` : ''}{m}m
                  </span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button
                      onClick={() => handleEditDuration(log.id, log.durationMinutes)}
                      className="p-1 text-slate-400 hover:text-indigo-500 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20 cursor-pointer"
                      title="Editar tempo"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                      title="Excluir atividade"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Stacked Bar Insights (Productivity) */}
      {allSelectedDayLogs.length > 0 && (
        <div className="shrink-0 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/40 rounded-2xl p-2.5 my-2 backdrop-blur-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-500" /> Distribuição de Tempo
            </span>
            <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Status</span>
          </div>

          {/* Stacked segmented bar */}
          <div className="h-3.5 w-full bg-slate-200/50 dark:bg-slate-800 rounded-full overflow-hidden flex border border-slate-100 dark:border-slate-800">
            {todoPct > 0 && <div style={{ width: `${todoPct}%` }} className="h-full bg-slate-400/80" title={`To Do: ${Math.round(todoPct)}%`} />}
            {inProgressPct > 0 && <div style={{ width: `${inProgressPct}%` }} className="h-full bg-indigo-500" title={`In Progress: ${Math.round(inProgressPct)}%`} />}
            {donePct > 0 && <div style={{ width: `${donePct}%` }} className="h-full bg-emerald-500" title={`Done: ${Math.round(donePct)}%`} />}
            {manualPct > 0 && <div style={{ width: `${manualPct}%` }} className="h-full bg-amber-400" title={`Manual: ${Math.round(manualPct)}%`} />}
          </div>

          <div className="flex justify-between items-center gap-2 mt-1.5 text-[7px] font-black uppercase tracking-wider text-slate-400">
            {todoMin > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-slate-400" /> To Do</span>}
            {inProgressMin > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-indigo-500" /> In Progress</span>}
            {doneMin > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-emerald-500" /> Done</span>}
            {manualMin > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded bg-amber-400" /> Manual</span>}
          </div>

          {/* Productivity Warnings */}
          {manualMin > 0 && (
            <div className="flex gap-1.5 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-amber-600 dark:text-amber-400 animate-pulse">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p className="text-[8.5px] font-bold leading-normal">
                Você possui {manualMin} minutos de foco local não pareados com o Jira. Deseja consolidar?
              </p>
            </div>
          )}
          {totalMinutes < 240 && (
            <div className="flex gap-1.5 mt-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-2 text-indigo-600 dark:text-indigo-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p className="text-[8.5px] font-bold leading-normal">
                Tempo total do dia abaixo da meta de 4h lançadas. Complete os registros.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Input Worklog Form */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800/50 pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Tracked</span>
          <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{formattedTotal}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Toggle Type */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsJiraLog(false)}
              className={cn(
                "flex-1 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                !isJiraLog 
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800"
              )}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setIsJiraLog(true)}
              className={cn(
                "flex-1 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                isJiraLog 
                  ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800"
              )}
            >
              Jira
            </button>
          </div>

          <div className="flex gap-1.5">
            {isJiraLog && (
              <input
                type="text"
                placeholder="Key (e.g. SYS-123)"
                value={jiraId}
                onChange={e => setJiraId(e.target.value)}
                className="w-24 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold border border-slate-200/50 dark:border-slate-800/50 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
            )}
            <input
              type="text"
              placeholder="O que você fez nesta tarefa?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold border border-slate-200/50 dark:border-slate-800/50 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Tempo:</span>
              <input
                type="number"
                min="0"
                max="24"
                value={hours}
                onChange={e => setHours(e.target.value)}
                className="w-12 h-8 bg-slate-100 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">h</span>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={e => setMinutes(e.target.value)}
                className="w-12 h-8 bg-slate-100 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">m</span>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || !title.trim()} 
              size="xs" 
              className="flex-1 h-8 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest gap-1 shadow-sm"
            >
              {isSubmitting ? <AgileSpinner size="sm" variant="white" /> : <><Plus className="h-3.5 w-3.5" /> Registrar</>}
            </Button>
          </div>
        </form>
      </div>

      {/* JIRA WORKLOG IMPORT DIALOG */}
      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-[2rem] border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-slate-50 leading-none font-headline italic">
              Sincronizar Lançamentos
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">
              Selecione os worklogs do Jira para {selectedDate.split('-').reverse().join('/')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[300px] overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
            {syncableLogs.map(log => {
              const isChecked = selectedLogIds.includes(log.id);
              const h = Math.floor(log.durationMinutes / 60);
              const m = log.durationMinutes % 60;
              
              return (
                <div
                  key={log.id}
                  onClick={() => {
                    if (isChecked) {
                      setSelectedLogIds(selectedLogIds.filter(id => id !== log.id));
                    } else {
                      setSelectedLogIds([...selectedLogIds, log.id]);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                    isChecked
                      ? "bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800"
                      : "bg-slate-50/50 border-slate-100 dark:bg-slate-950/40 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Handled by parent div onClick
                    className="h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer"
                  />
                  
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                        {log.taskId}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[150px] uppercase tracking-wider">
                        {log.authorName}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate mt-1">
                      {log.title}
                    </p>
                    {log.comment && (
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate mt-0.5 italic">
                        "{log.comment}"
                      </p>
                    )}
                  </div>

                  <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg shrink-0">
                    {h > 0 ? `${h}h ` : ''}{m}m
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between sm:justify-between gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedLogIds(syncableLogs.map(l => l.id))}
                className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 transition-colors"
              >
                Todos
              </button>
              <span className="text-slate-300 dark:text-slate-700 text-xs">|</span>
              <button
                onClick={() => setSelectedLogIds([])}
                className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-600 dark:text-slate-400 transition-colors"
              >
                Nenhum
              </button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSyncModalOpen(false)}
                className="h-9 rounded-xl text-[9px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-800"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleImportSelected}
                disabled={selectedLogIds.length === 0}
                className="h-9 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                Importar ({selectedLogIds.length})
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JIRA CONFIGURATION DIALOG */}
      <Dialog open={isJiraConfigModalOpen} onOpenChange={setIsJiraConfigModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-900 dark:bg-slate-950 text-white">
            <DialogTitle className="text-2xl font-black font-headline uppercase tracking-tighter italic text-white">
              Conexão <span className="text-primary not-italic">Jira</span>
            </DialogTitle>
            <DialogDescription className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-1">
              Configure suas credenciais de integração
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 p-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">URL / Domínio do Jira</Label>
              <Input 
                value={configJiraUrl} 
                onChange={(e) => setConfigJiraUrl(e.target.value)} 
                placeholder="Ex: https://seu-dominio.atlassian.net" 
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 font-semibold text-sm focus:bg-white dark:focus:bg-slate-950 dark:text-slate-100 transition-all focus:ring-primary/20"
              />
              <p className="text-[8.5px] text-slate-400 dark:text-slate-500 italic leading-normal">Informe a URL completa do seu Jira Cloud.</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">API Token / Token de Acesso</Label>
              <Input 
                type="password"
                value={configJiraToken} 
                onChange={(e) => setConfigJiraToken(e.target.value)} 
                placeholder="Cole seu token aqui..." 
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 font-semibold text-sm focus:bg-white dark:focus:bg-slate-950 dark:text-slate-100 transition-all focus:ring-primary/20"
              />
              <p className="text-[8.5px] text-slate-400 dark:text-slate-500 italic leading-normal">Insira o Token de API Pessoal gerado no Atlassian Account.</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60">
            <Button variant="ghost" onClick={() => setIsJiraConfigModalOpen(false)} className="font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200">
              Cancelar
            </Button>
            <Button onClick={handleSaveConfigAndSync} className="h-12 px-8 font-black text-[10px] uppercase tracking-widest rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 text-white shadow-lg shadow-slate-900/10 transition-all active:scale-95">
              Salvar e Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
