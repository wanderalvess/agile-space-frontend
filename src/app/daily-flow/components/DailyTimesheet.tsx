'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, Trash2, Layers, FileText, Filter, RefreshCw, AlertCircle, Sparkles, ChevronLeft, ChevronRight, Pencil, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDailyStore } from '@/store/useDailyStore';
import { useToast } from '@/hooks/use-toast';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { fetchJiraIssues, JiraIssue } from '@/services/jiraService';
import { useUserContext } from '@/context/UserContext';
import { userApi } from '@/app/users/api';
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
import { Badge } from '@/components/ui/badge';

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
  const { toast } = useToast();
  const { settings, saveSettings } = useJiraSettings();
  const { userProfile } = useUserContext();
  const effectiveUserId = userProfile?.id || userProfile?.email || 'user';
  
  const { 
    worklogs, 
    addWorklog, 
    deleteWorklog, 
    updateWorklog,
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

  const selectedTotalMinutes = syncableLogs
    .filter(log => selectedLogIds.includes(log.id))
    .reduce((acc, log) => acc + log.durationMinutes, 0);
  
  const [configJiraUrl, setConfigJiraUrl] = useState('');
  const [configJiraToken, setConfigJiraToken] = useState('');
  const [isJiraConfigModalOpen, setIsJiraConfigModalOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setConfigJiraUrl(settings.domain || '');
      setConfigJiraToken(settings.token || '');
    }
  }, [settings]);

  // Carrega worklogs caso ainda não tenham sido carregados para o dia
  useEffect(() => {
    if (effectiveUserId) {
      fetchWorklogs(effectiveUserId, selectedDate);
      fetchWeeklyWorklogs(effectiveUserId);
    }
  }, [effectiveUserId, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    if (totalMinutes <= 0) return;

    setIsSubmitting(true);
    try {
      await addWorklog(effectiveUserId, {
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
    try {
      await deleteWorklog(id);
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
      await updateWorklog(id, durationMinutes);
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
      // Executa a sincronização logo após salvar
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

    setIsSyncing(true);
    try {
      // 1. Tenta obter o usuário autenticado no Jira para matching perfeito de worklogs
      let jiraUser: any = null;
      try {
        const valRes = await userApi.validateJiraToken(settings.domain, settings.token);
        if (valRes && valRes.valid && valRes.user) {
          jiraUser = valRes.user;
        }
      } catch (e) {
        console.warn("Could not fetch Jira myself info:", e);
      }

      // 2. Busca issues com worklogs - Estratégia multi-query robusta
      let issues: JiraIssue[] = [];
      let querySuccess = false;

      // Query Primária (Jira Cloud ou Server com plugin de worklog)
      try {
        const primaryJql = `worklogAuthor = currentUser() AND worklogDate = "${selectedDate}"`;
        const res = await fetchJiraIssues(settings.domain, settings.token, primaryJql);
        if (res && res.issues) {
          issues = res.issues;
          querySuccess = true;
        }
      } catch (primaryErr) {
        console.warn("Primary worklog query failed, trying standard fallback queries:", primaryErr);
      }

      // Se a query primária falhou ou não retornou nada, tenta fallbacks padrão do Jira Server / Data Center
      if (!querySuccess || issues.length === 0) {
        const fallbackQueries: string[] = [];
        if (jiraUser?.name) {
          fallbackQueries.push(`worklogAuthor = "${jiraUser.name}" AND updated >= "${selectedDate}"`);
          fallbackQueries.push(`assignee = "${jiraUser.name}" AND updated >= "${selectedDate}"`);
        }
        fallbackQueries.push(`assignee = currentUser() AND updated >= "${selectedDate}"`);
        fallbackQueries.push(`updated >= "${selectedDate}"`);

        for (const q of fallbackQueries) {
          try {
            const res = await fetchJiraIssues(settings.domain, settings.token, q);
            if (res && res.issues && res.issues.length > 0) {
              issues = res.issues;
              break;
            }
          } catch (err) {
            console.warn(`Fallback JQL query "${q}" failed:`, err);
          }
        }
      }

      if (issues.length === 0) {
        toast({
          title: "Sincronização",
          description: `Nenhuma atividade encontrada no Jira para a data ${selectedDate.split('-').reverse().join('/')}.`
        });
        return;
      }

      // 3. Extrai worklogs da data filtrando ESTRITAMENTE para o usuário logado
      const tempLogs: any[] = [];

      const jName = (jiraUser?.name || '').toLowerCase().trim();
      const jKey = (jiraUser?.key || '').toLowerCase().trim();
      const jEmail = (jiraUser?.emailAddress || '').toLowerCase().trim();
      const jAccountId = (jiraUser?.accountId || '').toLowerCase().trim();
      const jDisplayName = (jiraUser?.displayName || '').toLowerCase().trim();

      const profEmail = (userProfile?.email || '').toLowerCase().trim();
      const profEmailUser = profEmail.includes('@') ? profEmail.split('@')[0] : '';
      const profName = (userProfile?.name || '').toLowerCase().trim();
      const profJiraId = (userProfile?.jiraAccountId || '').toLowerCase().trim();

      for (const issue of issues) {
        const dateWorklogs = (issue.worklogs || []).filter((wl: any) => {
          return matchesWorklogDate(wl.started, selectedDate);
        });

        for (const wl of dateWorklogs) {
          const duration = wl.timeSpentSeconds > 0 ? Math.max(1, Math.round(wl.timeSpentSeconds / 60)) : 60;
          const author = wl.author || {};
          const authorName = (author.displayName || author.name || author.key || '').trim();
          const authorEmail = (author.emailAddress || '').toLowerCase().trim();
          const authorId = (author.accountId || '').toLowerCase().trim();
          const authorKey = (author.key || '').toLowerCase().trim();
          const authorUsername = (author.name || '').toLowerCase().trim();
          const authorDisplay = (author.displayName || '').toLowerCase().trim();

          let isUserLog = false;

          // Se temos o perfil do Jira autenticado via token, usamos matching exato
          if (jiraUser) {
            if (jName && (authorUsername === jName || authorKey === jName)) isUserLog = true;
            else if (jKey && (authorKey === jKey || authorUsername === jKey)) isUserLog = true;
            else if (jAccountId && authorId === jAccountId) isUserLog = true;
            else if (jEmail && authorEmail === jEmail) isUserLog = true;
            else if (jDisplayName && authorDisplay === jDisplayName) isUserLog = true;
            else if (jDisplayName && matchesNameFuzzy(authorDisplay, jDisplayName)) isUserLog = true;
          } else {
            // Fallback usando o perfil local
            if (profJiraId && (authorId === profJiraId || authorUsername === profJiraId || authorKey === profJiraId)) {
              isUserLog = true;
            } else if (profEmail && authorEmail === profEmail) {
              isUserLog = true;
            } else if (profEmailUser && profEmailUser.length >= 3 && (authorUsername === profEmailUser || authorKey === profEmailUser)) {
              isUserLog = true;
            } else if (profName && (authorDisplay === profName || matchesNameFuzzy(authorDisplay, profName))) {
              isUserLog = true;
            }
          }

          // FILTRA ESTRITAMENTE: Não inclui worklogs de outros membros
          if (!isUserLog) {
            continue;
          }

          tempLogs.push({
            id: wl.id ? String(wl.id) : `${issue.key}_${wl.started}_${Math.random().toString(36).substring(2, 7)}`,
            taskId: issue.key,
            title: issue.title,
            durationMinutes: duration,
            comment: wl.comment || '',
            authorName: authorName || 'Você',
            isUserLog: true
          });
        }
      }

      if (tempLogs.length === 0) {
        toast({
          title: "Sincronização do Jira",
          description: `Nenhum lançamento de horas seu foi encontrado no Jira para a data ${selectedDate.split('-').reverse().join('/')}.`
        });
        return;
      }

      setSyncableLogs(tempLogs);
      setSelectedLogIds(tempLogs.map(l => l.id));
      setIsSyncModalOpen(true);
    } catch (err: any) {
      console.error('Erro na sincronização do Jira:', err);
      const errMsg = String(err?.message || '');
      if (errMsg.includes('401') || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('token')) {
        toast({
          title: "Erro de Conexão",
          description: "Suas credenciais do Jira parecem inválidas ou expiradas. Por favor, revise-as.",
          variant: "destructive"
        });
        setIsJiraConfigModalOpen(true);
      } else {
        toast({
          title: "Erro de Sincronização",
          description: errMsg.length > 120 ? "Não foi possível buscar os dados do Jira. Verifique sua conexão e o domínio informado." : errMsg,
          variant: "destructive"
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportSelected = async () => {
    setIsSyncing(true);
    let added = 0;
    try {
      const logsToImport = syncableLogs.filter(l => selectedLogIds.includes(l.id));

      for (const log of logsToImport) {
        const displayTitle = log.comment ? `${log.title} - ${log.comment}` : log.title;
        // Evita duplicatas se já existe exatamente no mesmo dia
        const exists = worklogs.some(w => 
          w.date === selectedDate && 
          w.taskId === log.taskId && 
          w.durationMinutes === log.durationMinutes && 
          (w.title === displayTitle || w.title.includes(log.title))
        );
        
        if (!exists) {
          await addWorklog(effectiveUserId, {
            taskId: log.taskId,
            title: displayTitle,
            durationMinutes: log.durationMinutes
          });
          added++;
        }
      }

      // Atualiza listagem local
      await fetchWorklogs(effectiveUserId, selectedDate);
      await fetchWeeklyWorklogs(effectiveUserId);

      toast({
        title: "Jira Sincronizado",
        description: `${added} ${added === 1 ? 'registro importado' : 'registros importados'} com sucesso.`
      });
      setIsSyncModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao Importar",
        description: err?.message || "Não foi possível salvar os registros selecionados.",
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

          {/* Settings Button */}
          <Button
            onClick={() => setIsJiraConfigModalOpen(true)}
            size="xs"
            variant="ghost"
            className="h-7.5 w-7.5 p-0 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
            title="Configurar Conexão Jira"
          >
            <Settings2 className="h-3.5 w-3.5" />
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
        <DialogContent className="sm:max-w-[840px] md:max-w-[940px] w-[95vw] rounded-[2.5rem] border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-6 md:p-8 font-sans max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 font-headline italic flex items-center gap-2.5">
                  <Sparkles className="h-6 w-6 text-indigo-500 not-italic" />
                  Sincronizar <span className="text-indigo-600 dark:text-indigo-400 not-italic">Lançamentos</span>
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  Seus worklogs encontrados no Jira para {selectedDate.split('-').reverse().join('/')}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-indigo-50/50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200/50">
                  {syncableLogs.length} {syncableLogs.length === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-[220px] max-h-[55vh] overflow-y-auto space-y-3 py-4 pr-2 custom-scrollbar">
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
                    "flex items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all cursor-pointer select-none",
                    isChecked
                      ? "bg-indigo-50/60 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-700 shadow-xs ring-1 ring-indigo-500/20"
                      : "bg-slate-50/60 border-slate-100 dark:bg-slate-950/40 dark:border-slate-800/80 hover:bg-slate-100/60 dark:hover:bg-slate-900/60"
                  )}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by parent div onClick
                      className="mt-1 sm:mt-0 h-5 w-5 rounded-lg border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer shrink-0"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md">
                          {log.taskId}
                        </span>
                        {log.authorName && (
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                            • {log.authorName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-1">
                        {log.title}
                      </p>
                      {log.comment && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 italic bg-white/60 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-100/80 dark:border-slate-800/40">
                          "{log.comment}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs md:text-sm font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-xs shrink-0 self-start sm:self-center">
                    {h > 0 ? `${h}h ` : ''}{m}m
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setSelectedLogIds(syncableLogs.map(l => l.id))}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 h-8 px-2.5"
                >
                  Selecionar Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setSelectedLogIds([])}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:text-slate-500 h-8 px-2.5"
                >
                  Limpar
                </Button>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {selectedTotalMinutes > 0 && (
                  <>Total: <strong className="text-slate-900 dark:text-white font-black">{Math.floor(selectedTotalMinutes / 60)}h {selectedTotalMinutes % 60}m</strong></>
                )}
              </span>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSyncModalOpen(false)}
                className="h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-800"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleImportSelected}
                disabled={selectedLogIds.length === 0 || isSyncing}
                className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-md shadow-indigo-500/20"
              >
                {isSyncing ? (
                  <AgileSpinner size="sm" variant="white" />
                ) : (
                  <>Importar ({selectedLogIds.length})</>
                )}
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
                placeholder="Ex: jira.suaempresa.com.br ou seu-dominio.atlassian.net" 
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 font-semibold text-sm focus:bg-white dark:focus:bg-slate-950 dark:text-slate-100 transition-all focus:ring-primary/20"
              />
              <p className="text-[8.5px] text-slate-400 dark:text-slate-500 italic leading-normal">Informe o domínio ou URL do seu Jira (Server/Data Center ou Cloud).</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Personal Access Token (PAT) / API Token</Label>
              <Input 
                type="password"
                value={configJiraToken} 
                onChange={(e) => setConfigJiraToken(e.target.value)} 
                placeholder="Cole seu Personal Access Token ou API Token aqui..." 
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 font-semibold text-sm focus:bg-white dark:focus:bg-slate-950 dark:text-slate-100 transition-all focus:ring-primary/20"
              />
              <p className="text-[8.5px] text-slate-400 dark:text-slate-500 italic leading-normal">Insira seu Personal Access Token (PAT) do Jira Server ou Token do Jira Cloud.</p>
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
